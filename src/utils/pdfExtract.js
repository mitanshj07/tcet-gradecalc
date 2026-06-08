function groupTextItemsIntoLines(items = []) {
  const rows = new Map()

  for (const item of items) {
    if (!item?.str?.trim()) continue
    const x = item.transform?.[4] ?? 0
    const y = item.transform?.[5] ?? 0
    const rowKey = String(Math.round(y))
    const row = rows.get(rowKey) ?? []
    row.push({ text: item.str, x, y })
    rows.set(rowKey, row)
  }

  return [...rows.values()]
    .sort((a, b) => (b[0]?.y ?? 0) - (a[0]?.y ?? 0))
    .map((row) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
}

export async function extractPdfText(file, { maxPages = 5 } = {}) {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Please choose a PDF file.')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('PDF must be 5MB or smaller.')
  }

  const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString()

  const buffer = await file.arrayBuffer()
  const loadingTask = getDocument({ data: buffer })
  const pdf = await loadingTask.promise

  if (pdf.numPages > maxPages) {
    throw new Error(`PDF has ${pdf.numPages} pages. Current limit is ${maxPages} pages.`)
  }

  const pages = []

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const content = await page.getTextContent()
    const lines = groupTextItemsIntoLines(content.items)
    pages.push(lines.join('\n'))
  }

  const text = pages.join('\n')

  if (!text.trim()) {
    throw new Error(
      'This PDF may be scanned/image-based. Free-tier parser cannot read scanned PDFs yet. Please enter marks manually or upload a text-based PDF.',
    )
  }

  return {
    pageCount: pdf.numPages,
    text,
  }
}
