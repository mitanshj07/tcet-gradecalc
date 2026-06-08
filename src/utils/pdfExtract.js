function groupTextItemsIntoLines(items = [], tolerance = 8) {
  const sortedItems = items
    .filter((item) => item?.str?.trim())
    .map((item) => ({
      text: item.str,
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }))
    .sort((a, b) => b.y - a.y)

  const rows = []

  for (const item of sortedItems) {
    const foundRow = rows.find((row) => Math.abs(row.y - item.y) <= tolerance)
    if (foundRow) {
      foundRow.items.push(item)
    } else {
      rows.push({
        y: item.y,
        items: [item],
      })
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.items
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
