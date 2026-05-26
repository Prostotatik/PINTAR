import { chatCompletion } from '../llm-client'
import type { ReviewedResume } from '../../shared/tool-types'

const SYSTEM_PROMPT = `You are an expert resume analyst. You will receive multiple resumes separated by dividers.
Extract a comprehensive structured profile from EACH resume.
Return ONLY a valid JSON array — one object per resume — matching this structure per element:
{
  "id": "the resume_id shown in the divider header",
  "name": "Full candidate name",
  "full_profile": {
    "skills": ["technical and soft skills"],
    "experience": [
      { "company": "name", "title": "job title", "duration": "e.g. 2021-2023", "highlights": ["key achievements"] }
    ],
    "projects": ["notable project descriptions"],
    "education": [
      { "institution": "name", "degree": "degree type and field", "year": "graduation year" }
    ],
    "links": { "linkedin": "url or null", "github": "url or null", "other": "url or null" },
    "languages": ["programming and spoken languages"],
    "certifications": ["certification names"]
  }
}
Return a JSON array with exactly one entry per resume. Be thorough. Extract all technical skills, quantified achievements, and actual URLs.`

export async function reviewResumeBatch(
  resumes: Array<{ resume_id: string; raw_text: string }>
): Promise<ReviewedResume[]> {
  const userContent = resumes
    .map(r => `=== RESUME ${r.resume_id} ===\n${r.raw_text}`)
    .join('\n\n')

  const content = await chatCompletion(SYSTEM_PROMPT, userContent, 0.2, 16384)

  const start = content.indexOf('[')
  const end = content.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('review_resume batch: no JSON array in response')

  const parsed = JSON.parse(content.slice(start, end + 1)) as ReviewedResume[]
  parsed.forEach((p, i) => { if (resumes[i]) p.id = resumes[i].resume_id })
  return parsed
}
