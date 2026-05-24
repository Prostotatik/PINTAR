import { chatCompletion } from '../llm-client'
import type { SimplifiedResume } from '../../shared/tool-types'

const SYSTEM_PROMPT = `You are a resume parser. Extract a compressed profile from the resume text.
Return ONLY valid JSON matching this exact structure:
{
  "id": "string (the resume_id provided)",
  "name": "Full name of candidate",
  "keywords": ["array of technical skills, tools, frameworks"],
  "years_experience": number,
  "titles": ["job titles held"],
  "links": { "linkedin": "url or null", "github": "url or null", "other": "url or null" },
  "education": ["degree and institution strings"]
}
Be precise. Extract actual URLs from text. years_experience should be total professional years.`

export async function simplifyResume(resumeId: string, rawText: string): Promise<SimplifiedResume> {
  const content = await chatCompletion(
    SYSTEM_PROMPT,
    `resume_id: ${resumeId}\n\n${rawText}`,
    0.1,
    1024
  )

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`simplify_resume: no JSON in response for ${resumeId}`)

  const parsed = JSON.parse(jsonMatch[0]) as SimplifiedResume
  parsed.id = resumeId
  return parsed
}
