export interface ResumePayload {
  id: string
  filename: string
  text: string
}

export interface SimplifiedResume {
  id: string
  name: string
  keywords: string[]
  years_experience: number
  titles: string[]
  links: { linkedin?: string; github?: string; other?: string }
  education: string[]
}

export interface Experience {
  company: string
  title: string
  duration: string
  highlights: string[]
}

export interface Education {
  institution: string
  degree: string
  year?: string
}

export interface Links {
  linkedin?: string
  github?: string
  other?: string
}

export interface FullProfile {
  skills: string[]
  experience: Experience[]
  projects: string[]
  education: Education[]
  links: Links
  languages: string[]
  certifications: string[]
}

export interface ReviewedResume {
  id: string
  name: string
  full_profile: FullProfile
}

export interface FetchedPage {
  url: string
  platform: 'linkedin' | 'github' | 'portfolio' | 'other'
  raw_content: string
  sections: Record<string, string>
}

export interface Annotation {
  label: string
  evidence: string
  source: 'resume' | 'linkedin' | 'github' | 'other'
  weight?: number
  severity?: 'low' | 'medium' | 'high'
}

export interface PageAnalysis {
  verified_skills: string[]
  additional_signals: string[]
  red_flags: string[]
  confidence_boost: number
}

export type HireRecommendation = 'strong_yes' | 'yes' | 'maybe' | 'no'

export interface GapAnalysis {
  strengths: Annotation[]
  gaps: Annotation[]
  score: number
  hire_recommendation: HireRecommendation
}

export interface CandidateResult {
  id: string
  name: string
  full_profile: FullProfile
  page_analysis?: PageAnalysis
  gap_analysis: GapAnalysis
  tab_id?: number
  profile_url?: string
}

export interface ComparisonRow {
  candidate_id: string
  name: string
  score: number
  top_skills: string[]
  key_gap: string
  hire_recommendation: HireRecommendation
}

export interface FinalReport {
  comparison_table: ComparisonRow[]
  winner_id: string
  winner_reasoning: string
  per_candidate_verdict: Record<string, string>
}
