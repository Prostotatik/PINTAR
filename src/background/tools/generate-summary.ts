import { chatCompletion } from '../llm-client'
import type { FinalReport } from '../../shared/tool-types'

const SYSTEM_PROMPT = `You are a head of talent. Produce a final comparative analysis of the top candidates.
Return ONLY valid JSON matching this exact structure:
{
  "comparison_table": [
    {
      "candidate_id": "string",
      "name": "string",
      "score": number,
      "top_skills": ["3-4 most relevant skills"],
      "key_gap": "the single most important gap",
      "hire_recommendation": "strong_yes|yes|maybe|no"
    }
  ],
  "winner_id": "candidate_id of recommended hire",
  "winner_reasoning": "2-3 sentence comparative reasoning explaining why this candidate is best overall",
  "per_candidate_verdict": {
    "candidate_id": "one sentence verdict"
  }
}
Important: The winner is NOT always the highest scorer. Consider overall fit, risk level, and hire_recommendation together.`

export async function generateSummary(
  candidates: object[],
  jobDescription: string
): Promise<FinalReport> {
  const content = await chatCompletion(
    SYSTEM_PROMPT,
    `JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESULTS:
${JSON.stringify(candidates, null, 2).slice(0, 8000)}`,
    0.3,
    2048
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('generate_summary: no JSON in response')

  return JSON.parse(jsonMatch[0]) as FinalReport
}
