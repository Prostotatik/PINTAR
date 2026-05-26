import type { ToolDefinition } from './chutes-client'

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_requirements',
      description: 'Scrape the currently open browser tab and extract the job description from it. The active tab URL is captured automatically — no parameters needed. Use this when the user asks you to "read from the page", "grab the job description from here", or similar. Returns structured job requirements.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simplify_resume',
      description: 'Stage 1: Lightweight compression of a batch of resumes (up to 10 per call) for fast keyword-based ranking. ONLY call this if total resumes exceed 10 — skip entirely for 10 or fewer resumes. After all parallel calls complete, rank results and SELECT TOP 10 IDs (not top 3). Returns an array of compressed profiles. Pass only resume IDs — the full text is retrieved automatically.',
      parameters: {
        type: 'object',
        properties: {
          resume_ids: {
            type: 'array',
            description: 'Resume IDs to compress (max 10 per call), e.g. ["R001","R002","R003"]',
            items: { type: 'string' },
          },
        },
        required: ['resume_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_resume',
      description: 'Stage 2: Deep resume ingestion using the full original text of each candidate (up to 5 per call). Call for the top 10 selected by simplify_resume (or all resumes if N ≤ 10). For 10 candidates call twice in parallel (5+5). After all calls complete, perform deep semantic scoring against JD and SELECT TOP 3. Returns an array of full structured profiles. Pass only resume IDs — the full text is retrieved automatically.',
      parameters: {
        type: 'object',
        properties: {
          resume_ids: {
            type: 'array',
            description: 'Resume IDs to deeply review (max 5 per call), e.g. ["R001","R002"]',
            items: { type: 'string' },
          },
        },
        required: ['resume_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_candidate_page',
      description: 'Stage 3: Scrape a candidate\'s LinkedIn profile page. Call ONLY when a LinkedIn URL is available — do NOT call for GitHub, portfolio, or any other URL. If no LinkedIn URL exists for the candidate, skip this tool entirely. Call sequentially, one candidate at a time.',
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
