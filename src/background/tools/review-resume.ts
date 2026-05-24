import { chatCompletion } from '../llm-client'
import type { ReviewedResume } from '../../shared/tool-types'

const SYSTEM_PROMPT = `You are an expert resume analyst. Extract a comprehensive structured profile from the resume.
Return ONLY valid JSON matching this exact structure:
{
  "id": "resume_id provided",
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
Be thorough. Extract all technical skills, quantified achievements, and actual URLs.`

export async function reviewResume(resumeId: string, rawText: string): Promise<ReviewedResume> {
  const content = await chatCompletion(
    SYSTEM_PROMPT,
    `resume_id: ${resumeId}\n\n${rawText}`,
    0.2,
    2048
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`review_resume: no JSON in response for ${resumeId}`)

  const parsed = JSON.parse(jsonMatch[0]) as ReviewedResume
  parsed.id = resumeId
  return parsed
}
