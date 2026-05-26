import type { PipelineStage } from './constants'
import type { CandidateResult, FinalReport, ResumePayload } from './tool-types'

export type AgentEvent =
  | { type: 'THINK_TOKEN'; text: string }
  | { type: 'AGENT_TEXT'; text: string }
  | { type: 'TOOL_CALLING'; tool: string; args: Record<string, unknown> }
  | { type: 'TOOL_COMPLETE'; tool: string; summary?: string }
  | { type: 'TOOL_ERROR'; tool: string; error: string }
  | { type: 'STAGE_CHANGE'; stage: PipelineStage; label: string }
  | { type: 'CANDIDATE_RESULT'; candidate: CandidateResult }
  | { type: 'ANNOTATION_READY'; candidateId: string; tabId: number }
  | { type: 'FINAL_REPORT'; report: FinalReport }
  | { type: 'AGENT_ERROR'; message: string }
  | { type: 'AGENT_DONE' }

export type SidebarCommand =
  | { type: 'USER_MESSAGE'; text: string; resumes?: ResumePayload[] }
  | { type: 'ABORT' }
  | { type: 'KEEPALIVE' }
  | { type: 'RESET' }

// Chat message for display in sidebar
export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  resumes?: ResumePayload[]
  events?: AgentEvent[]
  timestamp: number
}
