import type { ResumePayload } from '../../shared/tool-types'

export async function parsePdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')

  // Set worker only when we actually need it
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(text)
  }

  return pageTexts.join('\n\n').replace(/[ \t]{2,}/g, ' ').trim()
}

export type { ResumePayload }
