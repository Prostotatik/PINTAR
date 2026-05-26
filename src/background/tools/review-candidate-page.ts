import { chatCompletion } from '../llm-client'
import type { PageAnalysis } from '../../shared/tool-types'

const SYSTEM_PROMPT = `You are a talent analyst cross-referencing a candidate's public profile against a job description.
Return ONLY valid JSON matching this exact structure:
{
  "verified_skills": ["skills confirmed on the public page that match the JD"],
  "additional_signals": ["positive signals found on the page NOT present in resume"],
  "red_flags": ["concerns or inconsistencies found"],
  "confidence_boost": number between -20 and +20
}
Be evidence-based. Only include what you actually see on the page.`

export async function reviewCandidatePage(
  candidateId: string,
  pageContent: string,
  jobDescription: string
): Promise<PageAnalysis> {
  const content = await chatCompletion(
    SYSTEM_PROMPT,
    `Candidate ID: ${candidateId}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE PAGE CONTENT:
${pageContent.slice(0, 8000)}`,
    0.2,
    1024
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`review_candidate_page: no JSON for ${candidateId}`)

  return JSON.parse(jsonMatch[0]) as PageAnalysis
}
