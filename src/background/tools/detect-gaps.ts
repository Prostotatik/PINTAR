import { chatCompletion } from '../llm-client'
import type { GapAnalysis } from '../../shared/tool-types'

const SYSTEM_PROMPT = `You are a senior hiring manager. Analyze a candidate's full profile against a job description.
Return ONLY valid JSON matching this exact structure:
{
  "strengths": [
    { "label": "short label", "evidence": "one sentence citing specific evidence", "source": "resume|linkedin|github|other", "weight": 1-3 }
  ],
  "gaps": [
    { "label": "short label", "evidence": "one sentence citing what is missing", "source": "resume|linkedin|github|other", "severity": "low|medium|high" }
  ],
  "score": number 0-100,
  "hire_recommendation": "strong_yes|yes|maybe|no"
}
Rules:
- Each strength and gap MUST have specific evidence (quote or reference from data)
- Score reflects overall fit: skills 40%, experience 30%, culture/growth signals 20%, red flags -10% each
- hire_recommendation: strong_yes (85+), yes (70-84), maybe (50-69), no (<50)
- Minimum 2 strengths and 1 gap. Maximum 5 each.`

export async function detectGapsAndOutcomes(
  candidateId: string,
  fullProfile: object,
  pageAnalysis: object | null,
  jobDescription: string
): Promise<GapAnalysis> {
  const profileText = JSON.stringify(fullProfile, null, 2)
  const pageText = pageAnalysis ? JSON.stringify(pageAnalysis, null, 2) : 'No public profile available.'

  const content = await chatCompletion(
    SYSTEM_PROMPT,
    `Candidate ID: ${candidateId}

JOB DESCRIPTION:
${jobDescription}

FULL RESUME PROFILE:
${profileText.slice(0, 4000)}

PUBLIC PAGE ANALYSIS:
${pageText.slice(0, 2000)}`,
    0.3,
    2048
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`detect_gaps_and_outcomes: no JSON for ${candidateId}`)

  return JSON.parse(jsonMatch[0]) as GapAnalysis
}
