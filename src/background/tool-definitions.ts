import type { ToolDefinition } from './chutes-client'

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_requirements',
      description: 'Scrape the currently open browser tab and extract the job description from it. Use this when the user asks you to "read from the page", "grab the job description from here", or similar. Returns structured job requirements.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL of the current page (for reference only, the actual content is scraped from the active tab)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simplify_resume',
      description: 'Stage 1: Lightweight compression of a resume for fast keyword-based ranking. Call in parallel for ALL resumes. Returns extracted keywords, years of experience, job titles, links, and education.',
      parameters: {
        type: 'object',
        properties: {
          resume_id: { type: 'string', description: 'Resume identifier, e.g. R001' },
          raw_text: { type: 'string', description: 'Full raw text of the resume' },
        },
        required: ['resume_id', 'raw_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_resume',
      description: 'Stage 2: Deep resume ingestion for top candidates. Call in parallel for selected candidates. Returns full structured profile with skills, experience, projects, education, and links.',
      parameters: {
        type: 'object',
        properties: {
          resume_id: { type: 'string', description: 'Resume identifier' },
          raw_text: { type: 'string', description: 'Full raw text of the resume' },
        },
        required: ['resume_id', 'raw_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_candidate_page',
      description: 'Stage 3: Scrape a candidate\'s public profile page (LinkedIn, GitHub, portfolio). Opens the URL in a Chrome tab and extracts the DOM text. Call sequentially for each top-3 candidate.',
      parameters: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string', description: 'Candidate identifier' },
          url: { type: 'string', description: 'URL of the candidate\'s public profile page' },
        },
        required: ['candidate_id', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_candidate_page',
      description: 'Stage 3: Analyze a fetched candidate page in context of the job description. Call immediately after fetch_candidate_page. Returns verified skills, additional signals, red flags, and confidence adjustment.',
      parameters: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string', description: 'Candidate identifier' },
          page_content: { type: 'string', description: 'Raw text content extracted from the candidate page' },
          job_description: { type: 'string', description: 'The job description text' },
        },
        required: ['candidate_id', 'page_content', 'job_description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_gaps_and_outcomes',
      description: 'Stage 3: Deep gap and outcome analysis for a candidate. Produces annotation-ready strengths and gaps, a 0-100 score, and a hire recommendation.',
      parameters: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string', description: 'Candidate identifier' },
          full_profile: { type: 'object', description: 'Full structured profile from review_resume' },
          page_analysis: { type: 'object', description: 'Page analysis from review_candidate_page, or null if no page was fetched' },
          job_description: { type: 'string', description: 'The job description text' },
        },
        required: ['candidate_id', 'full_profile', 'job_description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_summary',
      description: 'Stage 4: Final comparative summary across top 3 candidates. Call only after all top-3 candidates have completed detect_gaps_and_outcomes. Returns a comparison table, winner, and per-candidate verdicts.',
      parameters: {
        type: 'object',
        properties: {
          candidates: {
            type: 'array',
            description: 'Array of candidate results including scores and analyses',
            items: { type: 'object' },
          },
          job_description: { type: 'string', description: 'The job description text' },
        },
        required: ['candidates', 'job_description'],
      },
    },
  },
]
