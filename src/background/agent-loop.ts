import { streamCompletion } from './llm-client'
import { executeToolCall } from './tool-executor'
import { TOOL_DEFINITIONS } from './tool-definitions'
import type { AgentEvent } from '../shared/message-types'
import type { ResumePayload } from '../shared/tool-types'
import type { CandidateResult, GapAnalysis, ReviewedResume } from '../shared/tool-types'

const SYSTEM_PROMPT = `You are PINTAR, an intelligent AI recruitment agent embedded as a Chrome extension sidebar.
You are a TRUE AGENT — you decide on your own which tools to call and when, based purely on the conversation. There are no buttons, no hardcoded flows. You reason, you act, you confirm.

YOUR CORE LOOP:
1. Understand what the user needs through conversation
2. Call tools when appropriate — never wait for the user to "click something"
3. Confirm results back in natural language, ask follow-up questions
4. When you have everything, run the full recruitment pipeline

AVAILABLE TOOLS AND WHEN TO USE THEM:

fetch_requirements
- Call this whenever the user signals they want you to read the job description from the current browser tab
- Triggers: "grab from this page", "take from here", "read the JD from the tab", "возьми отсюда", "собери с этой страницы", or any similar phrase
- After calling it: summarize what you found (job title, company, required skills) and ask the user to confirm: "Is this correct? Should I proceed, or is there something to fix?"
- Wait for the user to confirm in natural language ("yes", "да", "correct", "looks good") before proceeding
- If they say "no" or correct something, acknowledge and update your understanding

simplify_resume
- Call in PARALLEL for ALL resumes when you have both a JD and resumes
- This is Stage 1: fast keyword compression for initial ranking

review_resume
- Call in PARALLEL for the top candidates selected after Stage 1
- Deep structured extraction of skills, experience, projects

fetch_candidate_page
- Call SEQUENTIALLY for each top-3 candidate
- Use the best available link: LinkedIn > GitHub > other

review_candidate_page
- Call immediately after fetch_candidate_page for the same candidate

detect_gaps_and_outcomes
- Call after review_candidate_page (or directly after review_resume if no links available)
- Produces strengths, gaps, score 0–100, hire recommendation

generate_summary
- Call only after ALL top-3 candidates have completed detect_gaps_and_outcomes
- Final comparison table + winner

FULL PIPELINE (auto-execute when you have JD + resumes):
simplify_resume ×N (parallel) → rank → review_resume ×top (parallel) → select top 3 →
[per candidate: fetch_candidate_page → review_candidate_page → detect_gaps_and_outcomes] →
generate_summary

CONVERSATION RULES:
- You are the one who decides when to call tools — the user never needs to "press a button"
- Stream your reasoning continuously. Never go silent for more than one tool call
- After fetch_requirements: ALWAYS confirm in natural language what you extracted before proceeding
- After pipeline: give a warm, conversational summary of findings
- If the user asks a question mid-pipeline: answer briefly, then continue
- Never hallucinate data — only reference what tools actually returned
- Speak warmly and directly. You are a smart colleague, not a form processor`

export let abortSignal = false

export function setAbort() {
  abortSignal = true
}

// Persistent conversation state across user messages
const conversationHistory: unknown[] = [
  { role: 'system', content: SYSTEM_PROMPT },
]

let reviewedResumes = new Map<string, ReviewedResume>()
let candidateResults: CandidateResult[] = []
let isRunning = false

const HISTORY_KEY = 'pintar_conversation_history'

async function saveHistory(): Promise<void> {
  try {
    const json = JSON.stringify(conversationHistory)
    if (json.length < 8_000_000) {
      await chrome.storage.local.set({ [HISTORY_KEY]: json })
    }
  } catch { /* ignore quota errors */ }
}

async function restoreHistory(): Promise<void> {
  if (conversationHistory.length > 1) return // SW is still alive, history intact
  try {
    const result = await chrome.storage.local.get(HISTORY_KEY)
    const saved = result[HISTORY_KEY]
    if (typeof saved === 'string') {
      const parsed = JSON.parse(saved) as unknown[]
      if (Array.isArray(parsed) && parsed.length > 1) {
        conversationHistory.length = 0
        for (const msg of parsed) conversationHistory.push(msg)
      }
    }
  } catch { /* ignore */ }
}

export function resetConversation() {
  conversationHistory.length = 0
  conversationHistory.push({ role: 'system', content: SYSTEM_PROMPT })
  reviewedResumes = new Map()
  candidateResults = []
  isRunning = false
  chrome.storage.local.remove(HISTORY_KEY).catch(() => {})
}

export async function sendUserMessage(
  userText: string,
  resumes: ResumePayload[] | undefined,
  pushEvent: (event: AgentEvent) => void
): Promise<void> {
  if (isRunning) return
  isRunning = true
  abortSignal = false

  // Restore history if SW was restarted since last turn
  await restoreHistory()

  // Validate API key before doing anything
  const stored = await chrome.storage.sync.get(['llm_provider', 'gemini_api_key', 'chutes_api_key'])
  const provider = (stored.llm_provider as string) ?? 'gemini'
  const hasKey = provider === 'chutes' ? !!stored.chutes_api_key : !!stored.gemini_api_key
  if (!hasKey) {
    const providerName = provider === 'chutes' ? 'Chutes.ai' : 'Gemini'
    pushEvent({ type: 'AGENT_ERROR', message: `No API key found. Click ⚙️ in the header to open Settings and enter your ${providerName} API key.` })
    pushEvent({ type: 'AGENT_DONE' })
    isRunning = false
    return
  }

  // Build user message content
  let userContent = userText
  if (resumes && resumes.length > 0) {
    const resumeList = resumes
      .map(r => `--- RESUME ${r.id} (${r.filename}) ---\n${r.text}`)
      .join('\n\n')
    userContent += `\n\n[User attached ${resumes.length} resume file(s)]:\n${resumeList}`
  }

  conversationHistory.push({ role: 'user', content: userContent })

  try {
    await runAgentTurn(pushEvent, resumes)
  } finally {
    isRunning = false
    await saveHistory()
  }
}

async function runAgentTurn(
  pushEvent: (event: AgentEvent) => void,
  _attachedResumes?: ResumePayload[]
): Promise<void> {
  let iteration = 0
  const MAX_ITERATIONS = 40

  while (!abortSignal && iteration < MAX_ITERATIONS) {
    iteration++

    // Keepalive checkpoint
    await chrome.storage.session.set({ agentRunning: true, agentTs: Date.now() })

    let finishReason = 'stop'
    let assistantText = ''
    const pendingToolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
    let rawModelParts: unknown[] | null = null

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('No response from Chutes.ai after 90 seconds. Check your API key and internet connection.')),
        90_000
      )
      const done = (reason: string) => { clearTimeout(timeout); finishReason = reason; resolve() }
      const fail = (err: Error) => { clearTimeout(timeout); reject(err) }

      // .catch(fail) is critical — if streamCompletion throws synchronously or rejects
      // before calling any callback (missing key, network error), it must propagate
      streamCompletion(conversationHistory, TOOL_DEFINITIONS, {
        onThinkToken: (text) => pushEvent({ type: 'THINK_TOKEN', text }),
        onAgentText: (text) => { assistantText += text; pushEvent({ type: 'AGENT_TEXT', text }) },
        onToolCalls: (calls) => { for (const c of calls) pendingToolCalls.push(c) },
        onRawModelParts: (parts) => { rawModelParts = parts },
        onDone: done,
        onError: fail,
      }).catch(fail)
    })

    // No tool calls — agent responded with text only, turn is done
    if (finishReason !== 'tool_calls' || pendingToolCalls.length === 0) {
      conversationHistory.push({ role: 'assistant', content: assistantText || '(no text)' })
      break
    }

    // Announce tool calls
    for (const call of pendingToolCalls) {
      pushEvent({ type: 'TOOL_CALLING', tool: call.name, args: call.args })
    }

    // Update pipeline stage
    updateStageFromTools(pendingToolCalls.map(c => c.name), pushEvent)

    // Execute tool calls
    const toolResults = await executeCalls(pendingToolCalls, pushEvent)

    // Build assistant message — include raw Gemini parts when available so
    // thought_signatures on thought-parts are preserved for the next turn
    conversationHistory.push({
      role: 'assistant',
      content: null,
      _geminiParts: rawModelParts ?? undefined,
      tool_calls: pendingToolCalls.map(c => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.args) },
      })),
    })

    // Append tool results
    for (const res of toolResults) {
      conversationHistory.push({
        role: 'tool',
        tool_call_id: res.callId,
        content: typeof res.output === 'string' ? res.output : JSON.stringify(res.output),
      })

      // Emit candidate result after detect_gaps_and_outcomes
      if (res.toolName === 'detect_gaps_and_outcomes') {
        const gapResult = res.output as GapAnalysis
        const candidateId = res.candidateId!
        const reviewed = reviewedResumes.get(candidateId)
        if (reviewed) {
          const tabResult = await chrome.storage.session.get(`candidateTab_${candidateId}`)
          const tabId = tabResult[`candidateTab_${candidateId}`] as number | undefined

          const candidate: CandidateResult = {
            id: candidateId,
            name: reviewed.name,
            full_profile: reviewed.full_profile,
            gap_analysis: gapResult,
            tab_id: tabId,
          }
          candidateResults.push(candidate)
          pushEvent({ type: 'CANDIDATE_RESULT', candidate })

          if (tabId) {
            await injectAnnotations(tabId, candidateId, gapResult, pushEvent)
          }
        }
      }
    }

    // Check if generate_summary was called — pipeline is done
    if (pendingToolCalls.some(c => c.name === 'generate_summary')) {
      pushEvent({ type: 'STAGE_CHANGE', stage: 'done', label: 'Analysis complete' })
    }
  }

  pushEvent({ type: 'AGENT_DONE' })
  await chrome.storage.session.set({ agentRunning: false })
}

interface ToolResult {
  callId: string
  toolName: string
  output: unknown
  candidateId?: string
}

async function executeCalls(
  calls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
  pushEvent: (event: AgentEvent) => void
): Promise<ToolResult[]> {
  const results: ToolResult[] = []

  const parallelCalls = calls.filter(c => c.name === 'simplify_resume' || c.name === 'review_resume')
  const sequentialCalls = calls.filter(c => c.name !== 'simplify_resume' && c.name !== 'review_resume')

  if (parallelCalls.length > 0) {
    const parallelResults = await Promise.allSettled(
      parallelCalls.map(async (call) => {
        try {
          const output = await executeToolCall(call)
          pushEvent({ type: 'TOOL_COMPLETE', tool: call.name, summary: (output as { id?: string; name?: string })?.name ?? (output as { id?: string })?.id })

          if (call.name === 'review_resume') {
            reviewedResumes.set((output as ReviewedResume).id, output as ReviewedResume)
          }

          return { callId: call.id, toolName: call.name, output }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          pushEvent({ type: 'TOOL_ERROR', tool: call.name, error: msg })
          return { callId: call.id, toolName: call.name, output: { error: msg } }
        }
      })
    )

    for (const r of parallelResults) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
  }

  for (const call of sequentialCalls) {
    try {
      const output = await executeToolCall(call)
      pushEvent({ type: 'TOOL_COMPLETE', tool: call.name })

      const candidateId =
        (call.args.candidate_id as string | undefined) ??
        (call.args.resume_id as string | undefined)

      results.push({ callId: call.id, toolName: call.name, output, candidateId })

      if (call.name === 'review_resume') {
        reviewedResumes.set((output as ReviewedResume).id, output as ReviewedResume)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      pushEvent({ type: 'TOOL_ERROR', tool: call.name, error: msg })
      results.push({ callId: call.id, toolName: call.name, output: { error: msg } })
    }
  }

  return results
}

async function injectAnnotations(
  tabId: number,
  candidateId: string,
  gapAnalysis: GapAnalysis,
  pushEvent: (event: AgentEvent) => void
) {
  try {
    // Step 1: store annotation data via globalThis — no document ref in SW
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (data: unknown) => {
        (globalThis as unknown as Record<string, unknown>).__pintarAnnotationData = data
      },
      args: [{ strengths: gapAnalysis.strengths, gaps: gapAnalysis.gaps }],
    })

    // Step 2: inject the annotator content script that reads the data and builds the DOM
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/annotator.js'],
    })

    pushEvent({ type: 'ANNOTATION_READY', candidateId, tabId })
  } catch (err) {
    console.error('PINTAR: annotation injection failed', err)
  }
}

function updateStageFromTools(toolNames: string[], pushEvent: (event: AgentEvent) => void) {
  if (toolNames.includes('fetch_requirements')) {
    pushEvent({ type: 'STAGE_CHANGE', stage: 'idle', label: 'Reading job description from page…' })
  } else if (toolNames.includes('simplify_resume')) {
    pushEvent({ type: 'STAGE_CHANGE', stage: 'stage1', label: 'Compressing all resumes…' })
  } else if (toolNames.includes('review_resume')) {
    pushEvent({ type: 'STAGE_CHANGE', stage: 'stage2', label: 'Deep resume review…' })
  } else if (toolNames.some(n => ['fetch_candidate_page', 'review_candidate_page', 'detect_gaps_and_outcomes'].includes(n))) {
    pushEvent({ type: 'STAGE_CHANGE', stage: 'stage3', label: 'Enriching candidate profiles…' })
  } else if (toolNames.includes('generate_summary')) {
    pushEvent({ type: 'STAGE_CHANGE', stage: 'stage4', label: 'Generating final report…' })
  }
}
