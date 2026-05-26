import { chatCompletion } from '../llm-client'

export interface JobRequirements {
  job_title: string
  company: string
  required_skills: string[]
  preferred_skills: string[]
  experience_years: number | null
  education_requirements: string[]
  responsibilities: string[]
  raw_text: string
}

const SYSTEM_PROMPT = `You are a job description parser. Extract structured information from a job posting.
Return ONLY valid JSON matching this exact structure:
{
  "job_title": "exact job title",
  "company": "company name or empty string",
  "required_skills": ["list of required technical and soft skills"],
  "preferred_skills": ["nice-to-have skills"],
  "experience_years": number or null,
  "education_requirements": ["degree requirements"],
  "responsibilities": ["key responsibilities"],
  "raw_text": "original text truncated to 2000 chars"
}
Be precise. Extract only what is explicitly stated.`

export async function fetchRequirements(): Promise<JobRequirements> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!activeTab?.id) throw new Error('No active tab found')
  const url = activeTab.url ?? 'unknown'

  const targetTabId = activeTab.id

  // Step 1: inject content script that sets window.__pintarPageText (no document in SW)
  await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    files: ['content/scraper.js'],
  })

  // Step 2: read the result — func has no document reference
  const readResults = await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: () => (globalThis as unknown as Record<string, unknown>).__pintarPageText as string ?? '',
  })

  const pageText = (readResults[0]?.result as string) ?? ''
  if (!pageText) throw new Error('Could not extract text from the current tab')

  const content = await chatCompletion(
    SYSTEM_PROMPT,
    `URL: ${url}\n\nPAGE CONTENT:\n${pageText}`,
    0.1,
    1536
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('fetch_requirements: no JSON in response')

  const parsed = JSON.parse(jsonMatch[0]) as JobRequirements
  parsed.raw_text = pageText.slice(0, 2000)
  return parsed
}
