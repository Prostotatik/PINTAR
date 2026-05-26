export const CHUTES_API_URL = 'https://llm.chutes.ai/v1/chat/completions'
export const MODEL = 'google/gemma-4-31B-turbo-TEE'

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
export const GEMINI_MODEL = 'gemini-3.1-flash-lite'

export const MORPHEUS_API_URL = 'https://api.mor.org/api/v1/chat/completions'
export const MORPHEUS_MODEL = 'minimax-m2.5'

export type PipelineStage = 'idle' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'done' | 'error'
