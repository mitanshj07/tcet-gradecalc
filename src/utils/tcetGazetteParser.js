import { extractHeaderMetadata, parseOfficeRegisterText } from './officeRegisterParser'
import { normalizeBranch } from './branchCycleResolver'
import { extractPdfText } from './pdfExtract'

export function looksLikeTcetGazette(text) {
  const metadata = extractHeaderMetadata(text)
  const upper = String(text).toUpperCase()

  return Boolean(
    upper.includes('TCET') ||
      upper.includes('OFFICE REGISTER') ||
      upper.includes('SGPA') ||
      normalizeBranch(metadata.branch),
  )
}

export function parseTcetGazetteText(text, preferredBranch = 'AIDS', preferredSemester = 1, override = {}) {
  return parseOfficeRegisterText(text, {
    preferredBranch,
    preferredSemester,
    override,
  })
}

export function parseTcetGazettePdfText(text, options = {}) {
  return parseOfficeRegisterText(text, options)
}

export async function parseTcetGazetteFile(file, options = {}) {
  const extraction = await extractPdfText(file, options)
  return {
    ...parseOfficeRegisterText(extraction.text, options),
    extraction: {
      pageCount: extraction.pageCount,
      fileName: file.name,
    },
  }
}
