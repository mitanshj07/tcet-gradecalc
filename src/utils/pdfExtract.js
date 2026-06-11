const PDFJS_VERSION = '3.11.174'
const CDN_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`
const WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`

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

function loadPdfJsScript() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      return resolve(window.pdfjsLib)
    }

    const script = document.createElement('script')
    script.src = CDN_URL
    script.async = true

    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL
        resolve(window.pdfjsLib)
      } else {
        reject(new Error('PDF.js loaded but pdfjsLib is undefined.'))
      }
    }

    script.onerror = () => {
      reject(new Error('Failed to load PDF.js from CDN. Please check your internet connection.'))
    }

    document.head.appendChild(script)
  })
}

function isPdfFile(file) {
  if (!file) return false
  if (file.type === 'application/pdf') return true
  if (file.name && /\.pdf$/i.test(file.name)) return true
  return false
}

export async function extractPdfText(file, { maxPages = 5 } = {}) {
  if (!isPdfFile(file)) {
    throw new Error('Please choose a PDF file.')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('PDF must be 5MB or smaller.')
  }

  let buffer
  try {
    buffer = await file.arrayBuffer()
  } catch (bufferError) {
    throw new Error(
      `Could not read the PDF file. ${bufferError?.message || 'Your browser may not support this file picker.'}`,
    )
  }

  const pdfjsLib = await loadPdfJsScript()

  let pdf
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    pdf = await loadingTask.promise
  } catch (error) {
    throw new Error(`PDF reader failed to parse document: ${error.message}`)
  }

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
