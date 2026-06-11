import pdfjsWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

const PDFJS_VERSION = '6.0.227'
const CDN_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`

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

async function loadPdfModule() {
  return await import('pdfjs-dist/legacy/build/pdf.mjs')
}

function configureWorker(pdfjsModule) {
  const { GlobalWorkerOptions } = pdfjsModule

  // Strategy 1: Use Vite-resolved static worker URL (best for production builds)
  try {
    if (pdfjsWorkerUrl) {
      GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
      return 'local'
    }
  } catch {
    // fall through
  }

  // Strategy 2: CDN-hosted worker (reliable fallback for mobile)
  GlobalWorkerOptions.workerSrc = CDN_WORKER_URL
  return 'cdn'
}

async function loadPdfDocument(data) {
  const pdfjsModule = await loadPdfModule()

  // Try with worker first
  const workerStrategy = configureWorker(pdfjsModule)
  try {
    const loadingTask = pdfjsModule.getDocument({ data })
    const pdf = await loadingTask.promise
    return { pdf, strategy: workerStrategy }
  } catch (workerError) {
    // If local worker failed, try CDN
    if (workerStrategy === 'local') {
      try {
        pdfjsModule.GlobalWorkerOptions.workerSrc = CDN_WORKER_URL
        const loadingTask = pdfjsModule.getDocument({ data })
        const pdf = await loadingTask.promise
        return { pdf, strategy: 'cdn-fallback' }
      } catch {
        // fall through to no-worker
      }
    }

    // Strategy 3: Disable worker entirely (runs on main thread — slower but universally compatible)
    try {
      pdfjsModule.GlobalWorkerOptions.workerSrc = ''
      const loadingTask = pdfjsModule.getDocument({
        data,
        disableWorker: true,
      })
      const pdf = await loadingTask.promise
      return { pdf, strategy: 'no-worker' }
    } catch (noWorkerError) {
      throw new Error(
        `Could not initialize the PDF reader. ` +
        `Worker error: ${workerError?.message || 'unknown'}. ` +
        `Fallback error: ${noWorkerError?.message || 'unknown'}. ` +
        `Please try on a desktop browser or update your mobile browser.`
      )
    }
  }
}

function isPdfFile(file) {
  if (!file) return false
  // Check MIME type (may be empty on some mobile browsers)
  if (file.type === 'application/pdf') return true
  // Fallback: check file extension
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

  const { pdf } = await loadPdfDocument(new Uint8Array(buffer))

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
