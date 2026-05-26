import { streamCompletion, chatCompletion } from './llm-client'
import { executeToolCall } from './tool-executor'
import { TOOL_DEFINITIONS } from './tool-definitions'
import { resumeTexts, resumeFilenames, clearResumeStore, saveResumesToStorage, loadResumesFromStorage, clearResumesFromStorage } from './resume-store'
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

═══════════════════════════════════════════════
MANDATORY PIPELINE DECISION — READ BEFORE ANY TOOL CALL
═══════════════════════════════════════════════

Count N = total number of resumes uploaded.

N > 10 → Stage 1 is REQUIRED. You MUST call simplify_resume for ALL resumes first.
N ≤ 10 → Stage 1 is SKIPPED. Go directly to review_resume for all resumes.

EXAMPLE — 15 resumes (N=15, N > 10):
  ✓ CORRECT sequence:
      simplify_resume(["R001"…"R010"]) + simplify_resume(["R011"…"R015"])  [parallel]
      → rank all 15 → SELECT TOP 10 IDs
      → review_resume(["R002","R005",…top 5]) + review_resume([…next 5])   [parallel]
      → rank top 10 → SELECT TOP 3
      → [fetch page → review page → detect gaps] per candidate [sequential]
      → generate_summary

  ✗ WRONG — never do this for N > 10:
      "I will skip simplification and review all 15 directly" — FORBIDDEN
      "I will simplify and then pick top 3 directly" — FORBIDDEN

EXAMPLE — 8 resumes (N=8, N ≤ 10):
  ✓ CORRECT sequence:
      review_resume(["R001","R002","R003","R004","R005"]) + review_resume(["R006","R007","R008"])  [parallel]
      → rank all 8 → SELECT TOP 3
      → [fetch page → review page → detect gaps] per candidate [sequential]
      → generate_summary

═══════════════════════════════════════════════
PIPELINE CONTINUITY — MANDATORY
═══════════════════════════════════════════════

The full pipeline MUST run to completion without stopping for user input between stages.

CRITICAL RULE: After completing any stage, your NEXT API response MUST be tool calls — NOT a text response that says "I will now proceed." If you write "I'll now proceed to Stage 3" without calling a tool in the SAME response, you have failed. The way the system works: if your response has finish_reason=stop (text only), the loop ends. If you have more work to do, your response MUST have finish_reason=tool_calls.

Stage transitions:
  Stage 1 → Stage 2: After simplify results arrive → immediately call review_resume (no text)
  Stage 2 → Stage 3: After selecting top 3 → immediately call fetch_candidate_page for candidate #1
  Stage 3 → Stage 4: After all 3 detect_gaps_and_outcomes → immediately call generate_summary

Put your inter-stage narration ("Screened 15, top 10 selected…") inside <think> tags or save it for the final summary. The ONLY time you output a text-only response mid-pipeline is when you need explicit user confirmation (e.g., after fetch_requirements). All other transitions are automatic tool-call chains.

═══════════════════════════════════════════════

AVAILABLE TOOLS AND WHEN TO USE THEM:

fetch_requirements
- Call this whenever the user signals they want you to read the job description from the current browser tab
- Triggers: "grab from this page", "take from here", "read the JD from the tab", or any similar phrase
- After calling it: summarize what you found (job title, company, required skills) and ask the user to confirm: "Is this correct? Should I proceed, or is there something to fix?"
- Wait for the user to confirm in natural language ("yes", "correct", "looks good") before proceeding
- If they say "no" or correct something, acknowledge and update your understanding
- CRITICAL: If resumes were already provided earlier in this conversation, do NOT ask the user to upload them again — once they confirm the JD, proceed directly to the pipeline

simplify_resume  [STAGE 1 — required only when N > 10]
- Compresses resumes into keyword profiles for fast ranking. Output: TOP 10 IDs (not top 3, not top 5).
- Pass resume_ids ONLY (e.g. ["R001","R002"…]) — the full text is fetched automatically.
- Split all N IDs into parallel batches of up to 10 per call.
  Example: 15 resumes → 2 calls simultaneously: ["R001"…"R010"] and ["R011"…"R015"]
  Example: 23 resumes → 3 calls simultaneously: ["R001"…"R010"], ["R011"…"R020"], ["R021"…"R023"]
- When all parallel calls finish: rank every profile by keyword overlap with JD + years_experience + title relevance.
- SELECT EXACTLY THE TOP 10 resume IDs. Record these IDs — they proceed to review_resume.
- After selecting top 10, say: "Screened [N] resumes. Top 10 selected for deep review."

review_resume  [STAGE 2 — always called]
- Deep structured extraction from the original full text of each resume.
- Pass resume_ids ONLY (e.g. ["R003","R007"…]) — the full text is fetched automatically.
- Input: the TOP 10 IDs from Stage 1 (if N > 10), OR all resume IDs (if N ≤ 10). Never more than 10 total.
- Call in parallel batches of up to 5 per call.
  10 candidates = 2 parallel calls (IDs 1-5 and 6-10 simultaneously)
  ≤5 candidates = 1 call
- When all calls finish: perform deep semantic scoring of each full profile against the job description.
  Evaluate: skills match, experience quality, seniority level, domain fit, project relevance.
- SELECT EXACTLY THE TOP 3 with one-sentence reasoning for each.
- After selecting top 3, say: "Deep review complete. Top 3: #1 [Name] — [why], #2 [Name] — [why], #3 [Name] — [why]"

fetch_candidate_page  [STAGE 3a — sequential, one candidate at a time]
- Call ONLY if the candidate has a LinkedIn URL. LinkedIn is the ONLY accepted source.
- If LinkedIn exists → call ONCE with the LinkedIn URL.
- If no LinkedIn URL → skip this tool entirely and go directly to detect_gaps_and_outcomes.
- NEVER call this tool for GitHub, portfolio, or any other URL type — LinkedIn only.

review_candidate_page  [STAGE 3b]
- Call immediately after fetch_candidate_page for the same candidate
- Never call without a preceding fetch_candidate_page result

detect_gaps_and_outcomes  [STAGE 3c]
- Call after review_candidate_page (or directly after review_resume if no page was fetched)
- Produces annotation-ready strengths, gaps, score 0–100, hire recommendation
- Fully complete one candidate (3a→3b→3c) before moving to the next candidate
- After the THIRD candidate's detect_gaps_and_outcomes returns → your next response MUST call generate_summary immediately

generate_summary  [STAGE 4 — final]
- Call ONLY after ALL top-3 candidates have completed detect_gaps_and_outcomes
- Never call early. Final comparison table + winner with reasoning.
- After this call completes, output your warm conversational summary as a text response.

CONVERSATION RULES:
- You are the one who decides when to call tools — the user never needs to "press a button"
- NEVER write "I will now proceed to X" without immediately calling the relevant tool in the SAME response
- NEVER ask the user to upload resumes that are already present in the conversation history — check first
- After fetch_requirements: ALWAYS confirm in natural language what you extracted before proceeding
- After generate_summary: give a warm, conversational summary of findings
- If the user asks a question mid-pipeline: answer briefly, then continue
- Never hallucinate data — only reference what tools actually returned
- Speak warmly and directly. You are a smart colleague, not a form processor

NARRATION STYLE — MANDATORY:
You MUST output exactly 1 sentence of narration immediately before EVERY batch of tool calls — no exceptions, including Stage 1 and Stage 2. The sentence streams to the user in real-time as the tools run. It must be specific to what you are actually doing right now, never a template.

Rules:
- Output the narration sentence FIRST, then the tool calls in the SAME response
- Never repeat the same phrasing across tool batches
- Reference specific details: candidate names, skills, numbers, what you're looking for
- Do NOT say "I will now..." or "Let me..." — just state what's happening

Required narration at each stage (tailor to the actual data):
  Stage 1 – before simplify_resume:
    ✓ "Skimming all 15 resumes for backend signals — REST APIs, CS degree, scalable systems..."
    ✓ "Running a fast keyword pass across the full pool to cut down to the strongest 10..."
  Stage 2 – before review_resume:
    ✓ "Good shortlist. Reading the top 10 properly now — looking for depth, not just buzzwords..."
    ✓ "Top 10 locked in. Deep-reading each one against the ShopBack backend criteria..."
  Stage 3 – before each candidate's fetch/analyze/score (be specific to THAT candidate):
    ✓ "Chris has Node.js and MongoDB in their resume — checking the LinkedIn to see if it holds up..."
    ✓ "Jake's internship looks solid on paper. Pulling the profile to cross-check the details..."
    ✓ "Rachel lists CI/CD and sprint workflows — let me see the full picture on LinkedIn..."
  Stage 4 – before generate_summary:
    ✓ "All three profiled. Putting together the final comparison now..."
    ✓ "Wrapping up — ranking the top 3 against each other for the final call..."`

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
  // Restore resume texts if SW was restarted and Map is empty
  await loadResumesFromStorage()
}

export function resetConversation() {
  conversationHistory.length = 0
  conversationHistory.push({ role: 'system', content: SYSTEM_PROMPT })
  reviewedResumes = new Map()
  candidateResults = []
  isRunning = false
  clearResumeStore()
  chrome.storage.local.remove(HISTORY_KEY).catch(() => {})
  clearResumesFromStorage().catch(() => {})
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

  // Build user message content — store full texts separately, put only metadata in history
  let userContent = userText
  if (resumes && resumes.length > 0) {
    const offset = resumeTexts.size
    const addedIds: string[] = []
    resumes.forEach((r, i) => {
      const id = `R${String(offset + i + 1).padStart(3, '0')}`
      resumeTexts.set(id, r.text)
      resumeFilenames.set(id, r.filename)
      addedIds.push(id)
    })
    const listing = addedIds.map(id => `${id} (${resumeFilenames.get(id)})`).join(', ')
    userContent += `\n\n[${resumes.length} resume(s) stored — IDs: ${listing}]\nTotal resumes available: ${resumeTexts.size}`
    await saveResumesToStorage()
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

    // If the model made tool calls without narration, generate one before showing badges
    if (!assistantText) {
      const narration = await generateToolNarration(pendingToolCalls)
      if (narration) {
        assistantText = narration
        pushEvent({ type: 'AGENT_TEXT', text: narration })
      }
    }

    // Announce tool calls
    for (const call of pendingToolCalls) {
      pushEvent({ type: 'TOOL_CALLING', tool: call.name, args: call.args })
    }

    // Update pipeline stage
    updateStageFromTools(pendingToolCalls.map(c => c.name), pushEvent)

    // Execute tool calls
    const toolResults = await executeCalls(pendingToolCalls, pushEvent)

    // Build assistant message — preserve any narration text alongside tool calls
    conversationHistory.push({
      role: 'assistant',
      content: assistantText || null,
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

    // Emit final report and mark pipeline done after generate_summary
    const summaryResult = toolResults.find(r => r.toolName === 'generate_summary')
    if (summaryResult) {
      pushEvent({ type: 'FINAL_REPORT', report: summaryResult.output as import('../shared/tool-types').FinalReport })
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
          const batchOutput = Array.isArray(output) ? output : [output]
          pushEvent({ type: 'TOOL_COMPLETE', tool: call.name, summary: `${batchOutput.length} resume(s) processed` })

          if (call.name === 'review_resume') {
            for (const r of batchOutput as ReviewedResume[]) {
              reviewedResumes.set(r.id, r)
            }
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
        const batchOutput = Array.isArray(output) ? output : [output]
        for (const r of batchOutput as ReviewedResume[]) {
          reviewedResumes.set(r.id, r)
        }
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
      args: [
        {
          strengths: gapAnalysis.strengths,
          gaps: gapAnalysis.gaps,
          score: gapAnalysis.score,
          hire_recommendation: gapAnalysis.hire_recommendation,
        },
      ],
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

async function generateToolNarration(
  calls: Array<{ name: string; args: Record<string, unknown> }>
): Promise<string> {
  const toolName = calls[0]?.name
  const allIds = calls.flatMap(c => (c.args.resume_ids as string[] | undefined) ?? [])
  const total = resumeTexts.size

  let context: string
  if (toolName === 'simplify_resume') {
    context = `Quickly scanning ${total} resumes — processing ${allIds.length} in this batch (IDs: ${allIds.slice(0, 4).join(', ')}${allIds.length > 4 ? '...' : ''})`
  } else if (toolName === 'review_resume') {
    context = `Deep-reading ${allIds.length} shortlisted resume(s) in detail (IDs: ${allIds.join(', ')})`
  } else if (toolName === 'generate_summary') {
    context = `Generating final comparison table and winner recommendation for the top 3 candidates`
  } else {
    return ''
  }

  try {
    const text = await chatCompletion(
      'You narrate live actions for an AI recruiter agent. Write ONE short natural sentence (max 12 words) describing what is happening right now. Be specific to the context given. No quotes, no ending punctuation, no "I am" or "Let me".',
      context,
      0.9,
      40
    )
    return text.trim().replace(/^["'\s]+|["'\s]+$/g, '')
  } catch {
    return ''
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
