import type { ToolCallAccumulated } from './chutes-client'
import { simplifyResumeBatch } from './tools/simplify-resume'
import { reviewResumeBatch } from './tools/review-resume'
import { fetchCandidatePage } from './tools/fetch-candidate-page'
import { reviewCandidatePage } from './tools/review-candidate-page'
import { detectGapsAndOutcomes } from './tools/detect-gaps'
import { generateSummary } from './tools/generate-summary'
import { fetchRequirements } from './tools/fetch-requirements'
import { resumeTexts } from './resume-store'

function lookupResumes(ids: string[]): Array<{ resume_id: string; raw_text: string }> {
  return ids.map(id => ({
    resume_id: id,
    raw_text: resumeTexts.get(id) ?? `[Resume ${id} not found in store]`,
  }))
}

export async function executeToolCall(call: ToolCallAccumulated): Promise<unknown> {
  const a = call.args as Record<string, unknown>

  switch (call.name) {
    case 'fetch_requirements':
      return fetchRequirements()

    case 'simplify_resume':
      return simplifyResumeBatch(lookupResumes(a.resume_ids as string[]))

    case 'review_resume':
      return reviewResumeBatch(lookupResumes(a.resume_ids as string[]))

    case 'fetch_candidate_page':
      return fetchCandidatePage(a.candidate_id as string, a.url as string)

    case 'review_candidate_page':
      return reviewCandidatePage(
        a.candidate_id as string,
        a.page_content as string,
        a.job_description as string
      )

    case 'detect_gaps_and_outcomes':
      return detectGapsAndOutcomes(
        a.candidate_id as string,
        a.full_profile as object,
        (a.page_analysis as object | null) ?? null,
        a.job_description as string
      )

    case 'generate_summary':
      return generateSummary(a.candidates as object[], a.job_description as string)

    default:
      throw new Error(`Unknown tool: ${call.name}`)
  }
}
