import { combineConfidence } from './parserConfidence'
import { calculateSemester } from './grading'
import { resolveCycle, normalizeBranch } from './branchCycleResolver'
import { BRANCHES } from './semesterData'

const MONTH_PATTERN =
  /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*[\s/-]*(20\d{2})/i

function cleanText(text) {
  return text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
}

export function detectOfficeRegisterFormat(text) {
  const upper = String(text).toUpperCase()
  const signals = [
    upper.includes('OFFICE REGISTER'),
    upper.includes('SEMESTER'),
    upper.includes('CHOICE BASED CREDIT GRADING SCHEME'),
    upper.includes('BRANCH'),
    upper.includes('GPA') || upper.includes('SGPA'),
    upper.includes('COURSE I'),
  ]
  const score = signals.filter(Boolean).length / signals.length
  return {
    format: score >= 0.5 ? 'office-register' : 'unknown',
    confidence: Number(score.toFixed(2)),
  }
}

function linesOf(text) {
  return cleanText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function tokenizeMarks(line = '') {
  return (line.match(/\d+(?:\.\d+)?|[A-Z]/g) ?? []).filter(Boolean)
}

export function extractHeaderMetadata(text) {
  const normalized = cleanText(text)
  const lines = linesOf(normalized)
  const branchMatch =
    normalized.match(/(?:BRANCH|PROGRAM(?:ME)?)\s*[:-]?\s*([A-Z&() .-]{2,})/i) ??
    lines.find((line) => /AI&DS|AI&ML|INFORMATION TECHNOLOGY|COMPUTER|CIVIL|MECHANICAL|E&TC|E&CS|M&ME/i.test(line))
  const semesterMatch = normalized.match(/\bSEM(?:ESTER)?\s*[-:]?\s*(I{1,3}V?|[12])\b/i)
  const schemeMatch = normalized.match(/\b(?:CBCGS-)?(HME\s*20\d{2})\b/i)
  const examMatch = normalized.match(/(?:EXAM|MONTH)\s*[:-]?\s*([A-Z]+\s*20\d{2})/i) ?? normalized.match(MONTH_PATTERN)
  const reportDateMatch = normalized.match(/(?:REPORT DATE|DATE)\s*[:-]?\s*([0-3]?\d[/-][01]?\d[/-]20\d{2}|20\d{2}[/-][01]?\d[/-][0-3]?\d)/i)

  let semester
  if (semesterMatch) {
    const raw = semesterMatch[1].toUpperCase()
    semester = raw === 'I' || raw === '1' ? 1 : raw === 'II' || raw === '2' ? 2 : undefined
  }

  return {
    collegeName: lines.find((line) => /THAKUR|TCET/i.test(line)) ?? undefined,
    scheme: schemeMatch?.[1]?.toUpperCase().replace(/\s+/g, ' ') ?? undefined,
    semester,
    branchRaw: Array.isArray(branchMatch) ? branchMatch[1]?.trim() : branchMatch,
    branch: normalizeBranch(Array.isArray(branchMatch) ? branchMatch[1] : branchMatch),
    examMonthYear: examMatch ? `${examMatch[1]}${examMatch[2] ? ` ${examMatch[2]}` : ''}`.toUpperCase() : undefined,
    reportDate: reportDateMatch?.[1] ?? undefined,
  }
}

export function extractCourseMap(text) {
  const map = {}
  for (const line of linesOf(text)) {
    const match = line.match(/COURSE\s*(VIII|VII|VI|IV|III|II|V|I)\s*[:-]?\s*(.+)/i)
    if (match) {
      map[match[1].toUpperCase()] = match[2].trim()
    }
  }
  return map
}

function normalizeName(value = '') {
  return value
    .toUpperCase()
    .replace(/&/g, 'AND')
    .replace(/\bMFG\b/g, 'MANUFACTURING')
    .replace(/\bCOMMUNICATION-II\b/g, 'COMMUNICATION II')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchCourseMapToTemplate(courseMap, selectedTemplate) {
  const warnings = []
  if (!selectedTemplate) {
    return { confidence: 0, warnings: ['No template selected for course map matching.'], resolvedCourseMap: {} }
  }

  const resolvedCourseMap = {}
  let matches = 0
  const expectedCount = selectedTemplate.courseOrder.length || 1

  for (const course of selectedTemplate.courseOrder) {
    const extracted = courseMap[course.roman]
    const expected = course.expectedName
    if (!extracted) {
      warnings.push(`COURSE ${course.roman} was not found in the PDF header.`)
      continue
    }

    resolvedCourseMap[course.subjectCode] = extracted
    const extractedNormalized = normalizeName(extracted)
    const expectedNormalized = normalizeName(expected)

    if (extractedNormalized.includes(expectedNormalized) || expectedNormalized.includes(extractedNormalized)) {
      matches += 1
    } else {
      warnings.push(`COURSE ${course.roman} mismatch: PDF says "${extracted}", template expects "${expected}".`)
    }
  }

  return {
    confidence: Number((matches / expectedCount).toFixed(2)),
    warnings,
    resolvedCourseMap,
  }
}

export function extractStudentRows(text, selectedTemplate) {
  const lines = linesOf(text)
  const rows = []
  const subjectCodes = (selectedTemplate?.subjects ?? []).map((subject) => subject.code)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const matchedCode = subjectCodes.find((code) => line.includes(code))
    if (!matchedCode) continue

    const nextLine = lines[index + 1]
    const shouldAttachNextLine =
      nextLine &&
      !subjectCodes.some((code) => nextLine.includes(code)) &&
      !/^COURSE\s+/i.test(nextLine) &&
      /\d/.test(nextLine)

    rows.push({
      subjectCode: matchedCode,
      mainLine: line,
      detailLine: shouldAttachNextLine ? nextLine : '',
    })

    if (shouldAttachNextLine) index += 1
  }

  if (!rows.length && selectedTemplate?.subjects?.length) {
    const digitLines = lines.filter((line) => /\d/.test(line) && !/^COURSE\s+/i.test(line))
    return selectedTemplate.subjects.map((subject, index) => ({
      subjectCode: subject.code,
      mainLine: digitLines[index] ?? '',
      detailLine: digitLines[index + 1] ?? '',
      inferredByOrder: true,
    }))
  }

  return rows
}

function extractHorizontalStudentRecord(text) {
  const lines = linesOf(text)
  const startIndex = lines.findIndex((line) => /^\d{8,9}\b/.test(line))
  if (startIndex === -1) return null

  const firstLine = lines[startIndex]
  const nameLines = []
  let practicalLine = ''

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\/\s*- FEMALE|^G\s*: GRADE|^MARKS\s*:|^GRADE POINT|^PREPARED BY|^PAGE \d+/i.test(line)) break
    if (/^\d{1,2}\s+[A-Z]\s+\d{1,2}/.test(line)) {
      practicalLine = line
      break
    }
    if (/^[A-Z][A-Z ]+$/.test(line)) {
      nameLines.push(line)
    }
  }

  const seatMatch = firstLine.match(/^(\d{8,9})\s+(.*)$/)
  const rest = seatMatch?.[2] ?? ''
  const finalMatch = rest.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d{1,2})?)\s+(P|F|ATKT)\s*$/i)
  if (!seatMatch || !finalMatch) return null

  const lead = rest.slice(0, finalMatch.index).trim()
  const marksStart = lead.search(/\d+(?:\.\d+)?\s+[A-Z]\s+\d+(?:\.\d+)?\s+[A-Z]/)
  const firstNameChunk = marksStart === -1 ? lead : lead.slice(0, marksStart)
  const name = [firstNameChunk.replace(/^\//, '').trim(), ...nameLines.map((line) => line.trim())].filter(Boolean).join(' ')
  const theoryLine = marksStart === -1 ? '' : lead.slice(marksStart).trim()

  return {
    seatNo: seatMatch[1],
    name,
    theoryLine,
    practicalLine,
    totalCredits: Number(finalMatch[1]),
    totalCreditPoints: Number(finalMatch[2]),
    sgpa: Number(finalMatch[3]),
    status: finalMatch[4].toUpperCase(),
  }
}

function parseTheoryTokenBlock(tokens, subject) {
  if (tokens.length < 9) return null
  return {
    subjectCode: subject.code,
    subjectName: subject.name,
    courseRoman: subject.courseRoman,
    componentType: subject.gradingMode,
    ese: Number(tokens[0]),
    eseGrade: tokens[1],
    importedIA: Number(tokens[2]),
    iaGrade: tokens[3],
    total: Number(tokens[4]),
    credits: Number(tokens[5]),
    grade: tokens[6],
    gradePoint: Number(tokens[7]),
    creditPoints: Number(tokens[8]),
    confidence: 0.9,
    warnings: [],
    rawSubjectLine: tokens.join(' '),
  }
}

function parsePracticalTokenBlock(tokens, subject) {
  if (subject.hasTW && subject.hasPR && tokens.length >= 9) {
    return {
      tw: Number(tokens[0]),
      twGrade: tokens[1],
      pr: Number(tokens[2]),
      prGrade: tokens[3],
      practicalTotal: Number(tokens[4]),
      credits: Number(tokens[5]),
      grade: tokens[6],
      gradePoint: Number(tokens[7]),
      creditPoints: Number(tokens[8]),
      confidence: 0.9,
    }
  }

  if (subject.hasTW && tokens.length >= 5) {
    return {
      tw: Number(tokens[0]),
      twGrade: tokens[1],
      credits: Number(tokens[2]),
      gradePoint: Number(tokens[3]),
      creditPoints: Number(tokens[4]),
      grade: tokens[1],
      practicalTotal: Number(tokens[0]),
      confidence: 0.88,
    }
  }

  if (subject.isNonCredit && tokens.length >= 5) {
    return {
      tw: Number(tokens[0]),
      twGrade: tokens[1],
      credits: Number(tokens[2]),
      gradePoint: Number(tokens[3]),
      creditPoints: Number(tokens[4]),
      grade: tokens[1],
      practicalTotal: Number(tokens[0]),
      confidence: 0.85,
    }
  }

  return null
}

function parseHorizontalStudentRows(record, selectedTemplate) {
  if (!record || !selectedTemplate?.subjects?.length) return []

  const parsedByCode = new Map()
  const theoryTokens = tokenizeMarks(record.theoryLine)
  const practicalTokens = tokenizeMarks(record.practicalLine)
  const theorySubjects = selectedTemplate.subjects.filter((subject) => subject.hasTheory)
  const practicalSubjects = selectedTemplate.subjects.filter((subject) => subject.hasTW || subject.hasPR || subject.hasOR || subject.isNonCredit)

  let theoryCursor = 0
  for (const subject of theorySubjects) {
    const block = parseTheoryTokenBlock(theoryTokens.slice(theoryCursor, theoryCursor + 9), subject)
    if (!block) continue
    theoryCursor += 9
    parsedByCode.set(subject.code, {
      ...block,
      isNonCredit: subject.isNonCredit,
      warnings: [],
    })
  }

  let practicalCursor = 0
  for (const subject of practicalSubjects) {
    const width = subject.hasTW && subject.hasPR ? 9 : 5
    const practical = parsePracticalTokenBlock(practicalTokens.slice(practicalCursor, practicalCursor + width), subject)
    if (!practical) continue
    practicalCursor += width
    const existing = parsedByCode.get(subject.code) ?? {
      subjectCode: subject.code,
      subjectName: subject.name,
      courseRoman: subject.courseRoman,
      componentType: subject.gradingMode,
      confidence: 0.85,
      warnings: [],
      rawSubjectLine: '',
      isNonCredit: subject.isNonCredit,
    }
    parsedByCode.set(subject.code, {
      ...existing,
      ...practical,
      confidence: Math.min(0.95, Math.max(existing.confidence ?? 0.85, practical.confidence ?? 0.85)),
      rawSubjectLine: `${existing.rawSubjectLine} | ${practicalTokens.slice(practicalCursor - width, practicalCursor).join(' ')}`.trim(),
    })
  }

  return selectedTemplate.subjects.map((subject) => {
    const parsed = parsedByCode.get(subject.code)
    if (parsed) {
      return parsed
    }
    return {
      subjectCode: subject.code,
      subjectName: subject.name,
      courseRoman: subject.courseRoman,
      componentType: subject.gradingMode,
      isNonCredit: subject.isNonCredit,
      confidence: 0.3,
      warnings: ['Could not parse this subject from the horizontal gazette row.'],
      rawSubjectLine: '',
    }
  })
}

function findGpAndCp(numbers, credits, allowLooseCp = false) {
  for (let index = 0; index < numbers.length; index += 1) {
    const gp = numbers[index]
    const cp = numbers[index + 1]
    if (gp >= 0 && gp <= 10 && cp !== undefined && Math.abs(cp - gp * credits) <= 0.5) {
      return { gradePoint: gp, creditPoints: cp }
    }
  }
  if (allowLooseCp) {
    const gp = [...numbers].find((value) => value >= 0 && value <= 10)
    const cp = [...numbers].reverse().find((value) => value > 10)
    return { gradePoint: gp, creditPoints: cp }
  }
  return { gradePoint: undefined, creditPoints: undefined }
}

function parseOfficeRegisterComponentBlock(line, subject) {
  const pairMatches = [...line.matchAll(/(\d+(?:\.\d+)?)\s+(O|A|B|C|D|E|P|F)\b/g)]
  const componentPairs = pairMatches.map((match) => ({
    value: Number(match[1]),
    grade: match[2],
    endIndex: match.index + match[0].length,
  }))
  const suffixAfter = (pairIndex) => line.slice(componentPairs[pairIndex]?.endIndex ?? 0)
  const parseSuffix = (suffix) => {
    const match = suffix.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+\b(O|A|B|C|D|E|P|F)\b\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/)
    return match
      ? {
          total: Number(match[1]),
          credits: Number(match[2]),
          grade: match[3],
          gradePoint: Number(match[4]),
          creditPoints: Number(match[5]),
        }
      : {}
  }

  if (subject.hasTheory && componentPairs.length >= 2) {
    const suffix = parseSuffix(suffixAfter(1))
    return {
      ese: componentPairs[0].value,
      eseGrade: componentPairs[0].grade,
      importedIA: componentPairs[1].value,
      iaGrade: componentPairs[1].grade,
      theoryTotal: suffix.total,
      parsedOfficialCredits: suffix.credits,
      grade: suffix.grade,
      gradePoint: suffix.gradePoint,
      creditPoints: suffix.creditPoints,
    }
  }

  if (!subject.hasTheory && subject.hasTW && componentPairs.length >= 1) {
    const suffix = parseSuffix(suffixAfter(Math.min(componentPairs.length, 2) - 1))
    return {
      tw: componentPairs[0].value,
      twGrade: componentPairs[0].grade,
      pr: componentPairs[1]?.value,
      prGrade: componentPairs[1]?.grade,
      practicalTotal: suffix.total,
      parsedOfficialCredits: suffix.credits,
      grade: suffix.grade,
      gradePoint: suffix.gradePoint,
      creditPoints: suffix.creditPoints,
    }
  }

  return null
}

export function parseStudentRow(row, selectedTemplate, courseNameOverrides = {}) {
  const subject = selectedTemplate.subjects.find((entry) => entry.code === row.subjectCode)
  if (!subject) {
    return {
      subjectCode: row.subjectCode,
      confidence: 0,
      warnings: ['Subject code was not found in the selected template.'],
      rawSubjectLine: `${row.mainLine} ${row.detailLine}`.trim(),
    }
  }

  const line = `${row.mainLine} ${row.detailLine}`.trim()
  const numbers = (line.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  const rawTokens = line.match(/[A-Z]+|\d+(?:\.\d+)?/gi) ?? []
  const warnings = []
  const credits = subject.theoryCredits + subject.practicalCredits
  const gradeMatch = line.match(/\b(O|A|B|C|D|E|P|F)\b/)
  const parsed = {
    subjectCode: subject.code,
    subjectName: courseNameOverrides[subject.code] ?? subject.name,
    courseRoman: subject.courseRoman,
    componentType: subject.gradingMode,
    isNonCredit: subject.isNonCredit,
    confidence: 0.7,
    warnings,
    rawSubjectLine: line,
    rawTokens,
    templateCreditsUsed: credits,
  }

  const componentBlock = parseOfficeRegisterComponentBlock(line, subject)
  if (componentBlock) {
    Object.assign(parsed, componentBlock)
  }

  let cursor = 0
  if (line.includes(subject.code) && numbers.length && String(numbers[0]) === subject.code.replace(/\D/g, '')) {
    cursor = 1
  }

  if (subject.hasTheory && subject.theoryCredits > 0) {
    const ese = parsed.ese ?? numbers.find((value, index) => index >= cursor && value <= 60)
    const iaIndex = parsed.importedIA === undefined ? numbers.findIndex((value, index) => index > cursor && value <= 40) : -1
    if (Number.isFinite(ese)) {
      parsed.ese = ese
      cursor = numbers.indexOf(ese, cursor) + 1
    } else {
      warnings.push('Theory ESE marks were not confidently detected.')
    }
    if (parsed.importedIA !== undefined) {
      cursor = Math.max(cursor, numbers.indexOf(parsed.importedIA, cursor) + 1)
    } else if (iaIndex !== -1) {
      parsed.importedIA = numbers[iaIndex]
      cursor = iaIndex + 1
    } else {
      warnings.push('Imported IA/internal marks were not confidently detected.')
    }
  }

  if (subject.hasTW) {
    const tw = parsed.tw ?? numbers.find((value, index) => index >= cursor && value <= subject.maxMarks.tw)
    if (Number.isFinite(tw)) {
      parsed.tw = tw
      cursor = numbers.indexOf(tw, cursor) + 1
    } else {
      warnings.push('TW marks were not confidently detected.')
    }
  }

  if (subject.hasPR) {
    const pr = parsed.pr ?? numbers.find((value, index) => index >= cursor && value <= subject.maxMarks.pr)
    if (Number.isFinite(pr)) {
      parsed.pr = pr
      cursor = numbers.indexOf(pr, cursor) + 1
    } else {
      warnings.push('PR/OR marks were not confidently detected.')
    }
  }

  parsed.total = parsed.theoryTotal ?? parsed.practicalTotal ?? numbers.find((value) => value > 40 && value <= 100)
  parsed.grade = parsed.grade ?? gradeMatch?.[1]
  parsed.credits = credits
  parsed.parsedOfficialCredits = parsed.parsedOfficialCredits ?? null

  const { gradePoint, creditPoints } = parsed.gradePoint !== undefined && parsed.creditPoints !== undefined ? parsed : findGpAndCp(
    numbers.slice(cursor),
    credits,
    subject.theoryCredits > 0 && subject.practicalCredits > 0,
  )
  parsed.gradePoint = gradePoint
  parsed.creditPoints = creditPoints

  if (parsed.gradePoint === undefined) warnings.push('Grade point was not confidently detected.')
  if (parsed.creditPoints === undefined) warnings.push('C x GP validation did not match a parsed value.')
  if (parsed.parsedOfficialCredits !== null && parsed.parsedOfficialCredits !== parsed.templateCreditsUsed) {
    warnings.push(
      `PDF row credits (${parsed.parsedOfficialCredits}) differ from template credits (${parsed.templateCreditsUsed}). Calculator keeps template credits from index.html.`,
    )
  }
  if (subject.theoryCredits > 0 && subject.practicalCredits > 0 && parsed.creditPoints !== undefined) {
    warnings.push('Mixed theory/practical row validated primarily at semester-total level.')
  }
  if (!parsed.grade) warnings.push('Grade was not detected.')
  if (row.inferredByOrder) warnings.push('Subject row was assigned by subject order fallback.')

  parsed.confidence = Number(Math.max(0.2, 1 - warnings.length * 0.1).toFixed(2))
  return parsed
}

function marksByCodeFromRows(rows) {
  return rows.reduce((acc, row) => {
    acc[row.subjectCode] = {
      importedIA: row.importedIA === undefined ? '' : String(row.importedIA),
      ese: row.ese === undefined ? '' : String(row.ese),
      tw: row.tw === undefined ? '' : String(row.tw),
      pr: row.pr === undefined ? '' : String(row.pr),
      oral: row.oral === undefined ? '' : String(row.oral),
    }
    return acc
  }, {})
}

function validateParsedResult(parsedRows, template, officialSgpa, officialTotals = {}) {
  const warnings = []
  const marksByCode = marksByCodeFromRows(parsedRows)
  const calculation = calculateSemester(
    template.subjects.map((subject) => ({
      ...subject,
      thCr: subject.theoryCredits,
      practicalCr: subject.practicalCredits,
      twMax: subject.maxMarks.tw,
      prMax: subject.maxMarks.pr,
      hasTh: subject.hasTheory,
      twOnly: subject.isTWOnly,
      nonCredit: subject.isNonCredit,
    })),
    marksByCode,
  )

  const parsedCredits = parsedRows.reduce((sum, row) => sum + (row.parsedOfficialCredits ?? row.credits ?? 0), 0)
  const parsedCreditPoints = parsedRows.reduce((sum, row) => sum + (row.creditPoints ?? 0), 0)
  const sigmaCredits = officialTotals.totalCredits ?? parsedCredits
  const sigmaCreditPoints = officialTotals.totalCreditPoints ?? parsedCreditPoints
  const parsedGpa = sigmaCredits ? sigmaCreditPoints / sigmaCredits : null

  if (officialTotals.totalCredits !== undefined && parsedCredits !== officialTotals.totalCredits) {
    warnings.push(`Credit total mismatch: parsed ${parsedCredits}, official ${officialTotals.totalCredits}.`)
  }

  if (officialTotals.totalCreditPoints !== undefined && Math.abs(parsedCreditPoints - officialTotals.totalCreditPoints) > 0.5) {
    warnings.push(`Sigma C*GP mismatch: parsed ${parsedCreditPoints}, official ${officialTotals.totalCreditPoints}.`)
  }

  if (officialSgpa !== undefined && parsedGpa !== null && Math.abs(parsedGpa - officialSgpa) > 0.02) {
    warnings.push(
      `Mismatch detected. Official SGPA: ${officialSgpa.toFixed(2)}, calculated SGPA: ${parsedGpa.toFixed(2)}. Please review marks/credits.`,
    )
  }

  return {
    warnings,
    calculation,
    parsedCredits,
    parsedCreditPoints,
    parsedGpa: parsedGpa === null ? null : Number(parsedGpa.toFixed(2)),
  }
}

export function parseOfficeRegisterText(text, options = {}) {
  const normalized = cleanText(text)
  const detectedFormat = detectOfficeRegisterFormat(normalized)
  if (!normalized) {
    return {
      format: 'unknown',
      student: {},
      metadata: {},
      courseMap: {},
      subjects: [],
      final: { status: 'UNKNOWN' },
      rawTextPreview: '',
      confidence: 0,
      warnings: [
        'This PDF may be scanned/image-based. Free-tier parser cannot read scanned PDFs yet. Please enter marks manually or upload a text-based PDF.',
      ],
    }
  }

  const metadata = extractHeaderMetadata(normalized)
  const effectiveBranch = options.override?.branch ?? metadata.branch ?? options.preferredBranch
  const effectiveSemester = options.override?.semester ?? metadata.semester ?? options.preferredSemester
  const resolved = resolveCycle({
    branch: effectiveBranch,
    semester: effectiveSemester,
    cycle: options.override?.cycle,
    templateKey: options.override?.templateKey,
  })

  const courseMap = extractCourseMap(normalized)
  const courseMatch = matchCourseMapToTemplate(courseMap, resolved.template)
  const horizontalRecord = extractHorizontalStudentRecord(normalized)
  const studentRows = horizontalRecord ? [] : extractStudentRows(normalized, resolved.template)
  const parsedRows = horizontalRecord
    ? parseHorizontalStudentRows(horizontalRecord, resolved.template)
    : studentRows.map((row) => parseStudentRow(row, resolved.template, courseMatch.resolvedCourseMap))
  const officialSgpaMatch = normalized.match(/\bS?GPA\s*[:=-]?\s*(\d+(?:\.\d{1,2})?)/i)
  const totalCreditsMatch = normalized.match(/(?:TOTAL\s*C(?:REDITS)?|ΣC|SIGMA\s*C)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i)
  const totalCgMatch = normalized.match(/(?:TOTAL\s*CG|ΣCG|SIGMA\s*CG|TOTAL\s*C\*GP)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i)
  const resultMatch = normalized.match(/(?:RESULT|STATUS)\s*[:=-]?\s*(ATKT|PASS|FAIL|P|F)\b/i)
  const validation = resolved.template
    ? validateParsedResult(parsedRows, resolved.template, officialSgpaMatch ? Number(officialSgpaMatch[1]) : horizontalRecord?.sgpa, {
        totalCredits: totalCreditsMatch ? Number(totalCreditsMatch[1]) : horizontalRecord?.totalCredits,
        totalCreditPoints: totalCgMatch ? Number(totalCgMatch[1]) : horizontalRecord?.totalCreditPoints,
      })
    : { warnings: [], calculation: { totalCredits: 0, creditPoints: 0, sgpa: null }, parsedCredits: 0, parsedCreditPoints: 0, parsedGpa: null }

  const warnings = [
    ...resolved.warnings,
    ...courseMatch.warnings,
    ...parsedRows.flatMap((row) => row.warnings.slice(0, 1)),
    ...validation.warnings,
  ]

  const branchLabel = BRANCHES.find((item) => item.id === effectiveBranch)?.label ?? effectiveBranch
  const detectionMessage =
    effectiveBranch && effectiveSemester && resolved.cycle
      ? `Detected ${branchLabel} Sem ${effectiveSemester} ${capitalize(resolved.cycle)} Cycle layout from your result PDF.`
      : 'Could not confidently detect the full branch/semester/cycle layout from this PDF.'

  return {
    format: detectedFormat.format,
    student: {
      name:
        horizontalRecord?.name ??
        normalized.match(/(?:NAME|STUDENT NAME)\s*[:-]?\s*([A-Z][A-Z .']{2,})/i)?.[1]?.trim() ??
        undefined,
      seatNo:
        horizontalRecord?.seatNo ??
        normalized.match(/(?:SEAT\s*(?:NO|NUMBER)?|ROLL\s*(?:NO|NUMBER)?)\s*[:-]?\s*([A-Z0-9-]+)/i)?.[1] ??
        undefined,
      branch: effectiveBranch ?? undefined,
      semester: effectiveSemester ?? undefined,
      examMonthYear: metadata.examMonthYear,
    },
    metadata: {
      ...metadata,
      branchRaw: metadata.branchRaw,
      branch: effectiveBranch ?? metadata.branch,
      semester: effectiveSemester ?? metadata.semester,
      cycle: resolved.cycle,
      templateKey: resolved.templateKey,
      detectionMessage,
    },
    template: resolved.template,
    selectedTemplate: {
      key: resolved.templateKey,
      name: resolved.template?.name ?? resolved.template?.label,
      confidence: resolved.confidence,
      warnings: getUniqueWarnings(resolved.warnings),
    },
    courseMap,
    subjects: parsedRows,
    final: {
      sgpa: officialSgpaMatch ? Number(officialSgpaMatch[1]) : horizontalRecord?.sgpa,
      totalCredits: totalCreditsMatch ? Number(totalCreditsMatch[1]) : horizontalRecord?.totalCredits ?? validation.calculation.totalCredits,
      totalCreditPoints: totalCgMatch
        ? Number(totalCgMatch[1])
        : horizontalRecord?.totalCreditPoints ?? Number((validation.calculation.creditPoints ?? 0).toFixed(2)),
      status: resultMatch?.[1]?.toUpperCase().replace('PASS', 'P').replace('FAIL', 'F') ?? horizontalRecord?.status ?? 'UNKNOWN',
      calculatedSgpa: validation.parsedGpa,
    },
    validation: {
      computedSGPA: validation.parsedGpa,
      officialSGPA: officialSgpaMatch ? Number(officialSgpaMatch[1]) : horizontalRecord?.sgpa,
      sgpaMatches:
        (officialSgpaMatch || horizontalRecord?.sgpa) && validation.parsedGpa !== null
          ? Math.abs((officialSgpaMatch ? Number(officialSgpaMatch[1]) : horizontalRecord?.sgpa ?? 0) - validation.parsedGpa) <= 0.02
          : null,
      creditTotalMatches: totalCreditsMatch || horizontalRecord?.totalCredits ? validation.parsedCredits === Number(totalCreditsMatch ? Number(totalCreditsMatch[1]) : horizontalRecord?.totalCredits) : null,
      creditPointTotalMatches:
        totalCgMatch || horizontalRecord?.totalCreditPoints
          ? Math.abs(validation.parsedCreditPoints - Number(totalCgMatch ? Number(totalCgMatch[1]) : horizontalRecord?.totalCreditPoints)) <= 0.5
          : null,
      subjectValidations: parsedRows.map((row) => ({
        subjectCode: row.subjectCode,
        creditPointMatches:
          row.gradePoint !== undefined && row.credits !== undefined && row.creditPoints !== undefined
            ? Math.abs(row.gradePoint * row.credits - row.creditPoints) <= 0.5
            : null,
        warnings: row.warnings,
      })),
    },
    rawTextPreview: normalized.slice(0, 4000),
    confidence: combineConfidence([
      resolved.confidence,
      courseMatch.confidence,
      parsedRows.length ? parsedRows.reduce((sum, row) => sum + row.confidence, 0) / parsedRows.length : 0,
      warnings.length ? Math.max(0.2, 1 - warnings.length * 0.08) : 0.95,
    ]),
    warnings: getUniqueWarnings(warnings),
  }
}

function capitalize(value = '') {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

function getUniqueWarnings(warnings = []) {
  return Array.from(new Set(warnings.filter(Boolean)))
}
