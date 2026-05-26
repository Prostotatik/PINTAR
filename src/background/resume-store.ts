// Stores uploaded resume texts separately from conversation history so the LLM
// context only contains ID metadata, not full resume bodies.
export const resumeTexts = new Map<string, string>()      // id → raw text
export const resumeFilenames = new Map<string, string>()  // id → original filename

const STORAGE_KEY = 'pintar_resume_store'

export function clearResumeStore(): void {
  resumeTexts.clear()
  resumeFilenames.clear()
}

export async function saveResumesToStorage(): Promise<void> {
  try {
    const data = {
      texts: Object.fromEntries(resumeTexts),
      filenames: Object.fromEntries(resumeFilenames),
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(data) })
  } catch { /* ignore quota errors */ }
}

export async function loadResumesFromStorage(): Promise<void> {
  if (resumeTexts.size > 0) return  // already in memory, no need to restore
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    const saved = result[STORAGE_KEY]
    if (typeof saved !== 'string') return
    const data = JSON.parse(saved) as { texts: Record<string, string>; filenames: Record<string, string> }
    for (const [id, text] of Object.entries(data.texts)) resumeTexts.set(id, text)
    for (const [id, name] of Object.entries(data.filenames)) resumeFilenames.set(id, name)
  } catch { /* ignore parse errors */ }
}

export async function clearResumesFromStorage(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY)
  } catch { /* ignore */ }
}
