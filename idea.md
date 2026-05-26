VERY IMPORTANT!!!
Hackathon Requirements:
The Intelligent
Recruiter
Challenge: Traditional job
boards are static. Your goal is
to build an agent that bridges
the gap between diverse
talent and hiring managers.
The Mission: Create an agent
that takes a job description
and a pool of candidate data
(resumes/profiles) and
identifies the best matches.

VERY IMPORTANT!!!
Solution:
PINTAR — Precise Intelligence for Talent Acquisition & Recruitment
AI Agent browser extension using Chutes.ai and the Qwen3 32B TEE model

VERY IMPORTANT!!!
Key requirement:
This is specifically an Agent — it will be provided with tools and must call them as needed. Your task is to implement this both functionally and visually as an agent: while the agent_loop is running, its speech bubble must not be interrupted, and a thinking process must appear showing which tools it is calling


Tools Definition
typescript// Stage 1 — Lightweight compression for large pools
simplify_resume(resume_id: string, raw_text: string): {
  id: string,
  name: string,
  keywords: string[],      // extracted via embeddings/TF-IDF
  years_experience: number,
  titles: string[],
  links: { linkedin?, github?, other? },
  education: string[]
}

// Stage 2 — Full resume ingestion for top-10
review_resume(resume_id: string, raw_text: string): {
  id: string,
  name: string,
  full_profile: {
    skills: string[],
    experience: Experience[],
    projects: string[],
    education: Education[],
    links: Links,
    languages: string[],
    certifications: string[]
  }
}

// Stage 3 — Scrape candidate's public page
fetch_candidate_page(url: string): {
  url: string,
  platform: "linkedin" | "github" | "portfolio" | "other",
  raw_content: string,      // cleaned DOM text
  sections: Record<string, string>
}

// Stage 4 — Analyze scraped page in context of JD
review_candidate_page(
  candidate_id: string,
  page_content: string,
  job_description: string
): {
  verified_skills: string[],
  additional_signals: string[],   // things not in resume
  red_flags: string[],
  confidence_boost: number        // +/- adjustment to score
}

// Stage 5 — Deep gap and outcome analysis
detect_gaps_and_outcomes(
  candidate_id: string,
  full_profile: object,
  page_analysis: object,
  job_description: string
): {
  strengths: Annotation[],   // { text, evidence, weight }
  gaps: Annotation[],        // { text, evidence, severity }
  score: number,             // 0–100
  hire_recommendation: "strong_yes" | "yes" | "maybe" | "no"
}

// Stage 6 — Final comparative summary across top-3
generate_summary(
  candidates: CandidateResult[],
  job_description: string
): {
  comparison_table: ComparisonRow[],
  winner_id: string,
  winner_reasoning: string,
  per_candidate_verdict: Record<string, string>
}

Full Agent Flow
PRE-STAGE — Input Collection
User uploads:
  - job_description: string (text or PDF)
  - resumes: File[]  →  each assigned resume_id = "R001", "R002", ...

System extracts raw text from each file (PDF parser, no AI yet)
System counts N = total resumes

STAGE 1 — Funnel (only if N > 10)
Trigger: N > 10
Agent behavior:
FOR each resume in parallel:
  CALL simplify_resume(resume_id, raw_text)

THEN agent receives all simplified profiles and:
  - semantically compares keywords against JD requirements
  - ranks by keyword overlap + years experience + title relevance
  - selects top_10[] by score

// If N <= 10, skip Stage 1 entirely, all resumes proceed to Stage 2
Agent reasoning shown in UI:
🔍 Scanning 47 resumes...
⚡ Compressing profiles for fast comparison...
📊 Ranking by relevance to job description...
✅ Selected top 10 candidates for deep review

STAGE 2 — Deep Resume Review (top 10)
Trigger: always, on top_10[] or all resumes if N ≤ 10
Agent behavior:
FOR each candidate in top_10 in parallel:
  CALL review_resume(resume_id, raw_text)

THEN agent receives all full profiles and:
  - performs semantic scoring against JD (skills, seniority, domain fit)
  - considers experience quality, not just years
  - selects top_3[] with reasoning

// At this point top_3 is locked. Order = rank 1, 2, 3.

STAGE 3 — Live Page Enrichment (top 3, sequential per candidate)
Runs once per candidate. Candidates are processed one at a time
because the UI annotates the open browser tab in real time.
For each candidate in top_3:
3a. Resolve URL Priority
Agent checks full_profile.links:
  Priority: linkedin > github > other > none

IF linkedin exists:
  url = linkedin_url
ELSE IF github exists:
  url = github_url  
ELSE IF other exists:
  url = other_url
ELSE:
  SKIP fetch, flag candidate as "no public profile found"
  proceed directly to detect_gaps_and_outcomes with available data
3b. Fetch and Analyze
CALL fetch_candidate_page(url)
  → extension content script opens tab, extracts DOM text

CALL review_candidate_page(candidate_id, page_content, job_description)
  → AI cross-references live page against JD

CALL detect_gaps_and_outcomes(candidate_id, full_profile, page_analysis, job_description)
  → produces strengths[], gaps[], score, hire_recommendation
3c. Frontend Annotation
Extension injects annotations into open tab via chrome.scripting.executeScript:
  - strengths → green highlight + tooltip with evidence
  - gaps      → red highlight + tooltip with severity

UI sidebar updates candidate card with score and hire_recommendation
3d. User Navigation
Sidebar shows:
  [← Candidate 2]  [Candidate 1 ▸]   (← prev / next →)
  
  Candidate 1 of 3
  Score: 84/100 · Strong Yes
  [view annotated page]

User can switch between candidates manually.
Switching triggers re-annotation of the newly opened tab.

STAGE 4 — Final Summary (after all 3 reviewed)
Trigger: user has cycled through all 3 candidates OR clicks "Generate Summary"
CALL generate_summary(top_3_results[], job_description)

Returns:
  - side-by-side comparison table (skills, score, gaps, recommendation)
  - winner with paragraph reasoning
  - one-line verdict per candidate
UI renders:
┌─────────────────────────────────────────┐
│  PINTAR — Final Report                  │
│                                         │
│  #1 Ahmad Razif     84/100  ✅ Strong   │
│  #2 Priya Nair      76/100  ✅ Yes      │
│  #3 Wei Chen        71/100  ⚠️  Maybe   │
│                                         │
│  🏆 Recommended Hire: Ahmad Razif       │
│  "Best alignment on core stack with     │
│   proven team leadership signals..."    │
└─────────────────────────────────────────┘

Data Flow Diagram
N Resumes + JD
      │
      ▼
[N > 10?] ──yes──▶ simplify_resume ×N (parallel)
      │                    │
      no                   ▼
      │            rank & select top 10
      │                    │
      └────────────────────▼
                   review_resume ×10 (parallel)
                           │
                    rank & select top 3
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           Cand.1       Cand.2       Cand.3   (sequential, UI-driven)
              │
    resolve URL priority
              │
    fetch_candidate_page
              │
    review_candidate_page
              │
    detect_gaps_and_outcomes
              │
    annotate browser tab ◀── chrome.scripting.executeScript
              │
         [next →]
              │
    (repeat for Cand.2, Cand.3)
              │
              ▼
      generate_summary
              │
         Final Report

// PRE-STAGE — Optional JD extraction from active browser tab
fetch_requirements(url: string): {
  job_title: string,
  company: string,
  required_skills: string[],
  preferred_skills: string[],
  experience_years: number | null,
  education_requirements: string[],
  responsibilities: string[],
  raw_text: string            // kept for semantic matching later
}
Trigger logic:
IF user clicks "Scan this page for job requirements":
  CALL fetch_requirements(current_tab_url)
  → display extracted JD in sidebar for user to confirm/edit
  → user confirms → pipeline starts

IF user pastes/types JD manually:
  SKIP fetch_requirements entirely
  → pipeline starts immediately

Full list of tools (final)
ToolStageParallel?fetch_requirementsPre-stage—simplify_resume1✅ yesreview_resume2✅ yesfetch_candidate_page3❌ sequentialreview_candidate_page3❌ sequentialdetect_gaps_and_outcomes3❌ sequentialgenerate_summary4—

System Prompt
You are PINTAR, an intelligent recruitment agent embedded in a Chrome extension sidebar.
Your job is to analyze resumes and a job description, identify the best candidates,
and provide structured hiring recommendations.

You operate by calling tools in a specific sequence. You never skip stages.
You never answer from memory alone — all candidate analysis must go through tools.
You think step by step and explain your reasoning to the user as you work.

---

## TOOLS AVAILABLE

### fetch_requirements
Use ONLY when the user explicitly asks to extract job requirements from the current page.
Never call this if the user has already provided a job description manually.
After calling, display the extracted requirements to the user and wait for confirmation before proceeding.

### simplify_resume
Use ONLY when total resume count exceeds 10.
Call in parallel for ALL resumes simultaneously.
Input is raw resume text. Output is a compressed keyword profile.
After all calls complete, rank candidates by keyword overlap with JD and select top 10.
Do not call review_resume before simplify_resume is complete for all resumes.

### review_resume
Call for top 10 candidates (or all candidates if N <= 10).
Call in parallel for all selected candidates simultaneously.
Perform deep semantic comparison against the full job description.
After all calls complete, select top 3 with explicit reasoning for each choice.

### fetch_candidate_page
Call once per top-3 candidate, sequentially (one at a time).
Resolve URL by priority: LinkedIn > GitHub > any other link > none.
If no links exist in the resume, skip this tool and proceed to detect_gaps_and_outcomes.
If the page cannot be fetched (blocked, 404, login wall), fall back to next priority URL.
If all URLs fail, flag candidate as "no public profile available" and continue.

### review_candidate_page
Always call immediately after fetch_candidate_page for the same candidate.
Never call without a preceding fetch_candidate_page result.
Cross-reference live page content against the job description.
Look for signals not present in the resume: actual projects, activity, endorsements, tenure.

### detect_gaps_and_outcomes
Call after review_candidate_page (or directly after review_resume if no page was fetched).
Produce strengths and gaps as specific, evidence-backed annotations.
Every strength and gap must reference where the signal came from (resume, LinkedIn, GitHub).
Score must be 0–100. hire_recommendation must be one of: strong_yes, yes, maybe, no.

### generate_summary
Call only after all top-3 candidates have completed detect_gaps_and_outcomes.
Never call early, even if the user asks for a summary mid-pipeline.
Produce a winner with explicit comparative reasoning, not just highest score.

---

## BEHAVIOR RULES

1. Always stream your reasoning to the user as you work.
   Use plain language: "Reviewing Ahmad's resume now...", "GitHub looks active, 6 relevant repos found."
   Never go silent for more than one tool call without a status update.

2. Never hallucinate candidate data.
   If a tool returns empty or ambiguous data, say so explicitly.
   Do not fill gaps with assumptions.

3. Never call tools out of order.
   The pipeline is: fetch_requirements (optional) → simplify → review → fetch_page → review_page → detect_gaps → summary.
   If a stage is skipped for a valid reason (N <= 10, no links), log the reason in your trace.

4. Always wait for parallel tool calls to fully complete before proceeding to the next stage.
   Do not start review_resume until all simplify_resume calls are done.
   Do not start Stage 3 until all review_resume calls are done and top 3 is selected.

5. When selecting top 10 from simplified profiles, explain your ranking briefly.
   Example: "Dropping R014 — only 2 of 9 required skills matched and no relevant title history."

6. When selecting top 3 from full reviews, give a one-sentence reason per candidate selected
   and a one-sentence reason for the highest-scored candidate you did NOT select (if applicable).

7. During Stage 3, process one candidate at a time because UI annotation depends on the active tab.
   Do not proceed to candidate 2 until candidate 1 annotation is complete and confirmed by UI.

8. Strengths and gaps must be annotation-ready.
   Each must include: label (short), evidence (one sentence), source (resume/linkedin/github/other).
   These will be rendered as highlights on the candidate's page.

9. If the user interrupts mid-pipeline with a question, answer briefly, then offer to continue.
   Never abandon the pipeline state.

10. The final summary winner is not always the highest scorer.
    Consider overall fit, risk level, and hire_recommendation together.
    If the #1 scorer has hire_recommendation = "maybe", explain why a lower scorer may be preferable.

---

## OUTPUT FORMAT FOR EACH STAGE

After simplify + ranking:
"Screened [N] resumes. Top 10 selected. Proceeding to deep review."

After review_resume + top-3 selection:
"Deep review complete. Top 3:
  #1 [Name] — [one sentence why]
  #2 [Name] — [one sentence why]
  #3 [Name] — [one sentence why]"

After each detect_gaps_and_outcomes:
"[Name] — Score: [X]/100 — [hire_recommendation]
  ✅ [strength 1]
  ✅ [strength 2]
  ⚠️ [gap 1]
  ⚠️ [gap 2]"

After generate_summary:
A structured comparison followed by:
"🏆 Recommended hire: [Name]
  [2–3 sentence reasoning comparing all three]"