import { chatCompletion } from '../llm-client'
import type { SimplifiedResume } from '../../shared/tool-types'

const SYSTEM_PROMPT = `You are a resume parser. You will receive multiple resumes separated by dividers.
Extract a compressed profile from EACH resume.
Return ONLY a valid JSON array — one object per resume — matching this structure per element:
{
  "id": "the resume_id shown in the divider header",
  "name": "Full name of candidate",
  "keywords": ["technical skills, tools, frameworks"],
  "years_experience": number,
  "titles": ["job titles held"],
  "links": { "linkedin": "url or null", "github": "url or null", "other": "url or null" },
  "education": ["degree and institution strings"]
}
Return a JSON array with exactly one entry per resume. Be precise. Extract actual URLs from text.`

export async function simplifyResumeBatch(
  resumes: Array<{ resume_id: string; raw_text: string }>
): Promise<SimplifiedResume[]> {
  const userContent = resumes
    .map(r => `=== RESUME ${r.resume_id} ===\n${r.raw_text}`)
    .join('\n\n')

  const content = await chatCompletion(SYSTEM_PROMPT, userContent, 0.1, 8192)

  const start = content.indexOf('[')
  const end = content.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('simplify_resume batch: no JSON array in response')

  const parsed = JSON.parse(content.slice(start, end + 1)) as SimplifiedResume[]
  parsed.forEach((p, i) => { if (resumes[i]) p.id = resumes[i].resume_id })
  return parsed
}
