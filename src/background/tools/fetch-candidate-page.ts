import type { FetchedPage } from '../../shared/tool-types'

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('Tab load timeout after 30s'))
    }, 30_000)

    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

function detectPlatform(url: string): FetchedPage['platform'] {
  if (url.includes('linkedin.com')) return 'linkedin'
  if (url.includes('github.com')) return 'github'
  if (url.includes('portfolio') || url.includes('personal')) return 'portfolio'
  return 'other'
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export async function fetchCandidatePage(candidateId: string, url: string): Promise<FetchedPage> {
  const normalizedUrl = normalizeUrl(url)
  const tab = await chrome.tabs.create({ url: normalizedUrl, active: true })
  const tabId = tab.id!

  try {
    await waitForTabLoad(tabId)
    await new Promise(r => setTimeout(r, 1500))

    // Step 1: inject content script — no document ref in SW
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/candidate-scraper.js'],
    })

    // Step 2: read result — func has no document reference
    const readResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (globalThis as unknown as Record<string, unknown>).__pintarCandidatePage as { rawContent: string; sections: Record<string, string> } | undefined,
    })

    const page = readResults[0]?.result
    const rawContent = page?.rawContent ?? ''
    const sections = page?.sections ?? {}

    await chrome.storage.session.set({ [`candidateTab_${candidateId}`]: tabId })

    return {
      url: normalizedUrl,
      platform: detectPlatform(normalizedUrl),
      raw_content: rawContent,
      sections,
    }
  } catch (err) {
    try { await chrome.tabs.remove(tabId) } catch { /* ignore */ }
    throw err
  }
}
