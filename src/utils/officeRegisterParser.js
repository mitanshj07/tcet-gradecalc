// ═══════════════════════════════════════════════════════════════════════════════
// TCET Gazette Auto-Parser V2 — Top-Class Office Register Parser
// ═══════════════════════════════════════════════════════════════════════════════
//
// Architecture:
//  1. extractHeaderMetadata()    → Branch, semester, scheme, exam date
//  2. extractCourseMap()         → COURSE I→VII roman → name map
//  3. extractHorizontalRecord()  → Seat no, name, theory/practical token lines
//  4. parseValidatedTokenBlocks()→ Per-subject: ESE/IA/TW/PR/GP/CP with math checks
//  5. validateParsedResult()     → Cross-check ΣC, ΣCG, SGPA vs official
//
// V2 Innovations:
//  • Every token block is validated: Grade↔GP, ESE+IA=Total, GP×C=CP
//  • Self-healing: if validation fails, try skip/backtrack alignment
//  • Non-credit subjects fully handled in horizontal mode
//  • Robust multi-line name extraction
//  • Summary-anchored parsing (reads totals from end of line first)
// ═══════════════════════════════════════════════════════════════════════════════

import {
  combineConfidence,
  computeSubjectConfidence,
  gradeToGP,
  isValidCreditProduct,
  isValidGrade,
  isValidGradeGPPair,
  isValidPracticalTotal,
  isValidTheoryTotal,
} from './parserConfidence'
import { calculateSemester } from './grading'
import { resolveCycle, normalizeBranch } from './branchCycleResolver'
import { BRANCHES } from './semesterData'

// ─── Text Utilities ──────────────────────────────────────────────────────────

const MONTH_PATTERN =
  /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*[\s/-]*(20\d{2})/i

function cleanText(text) {
  return text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
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

// ─── Format Detection ────────────────────────────────────────────────────────

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

// ─── Header Metadata Extraction ──────────────────────────────────────────────

export function extractHeaderMetadata(text) {
  const normalized = cleanText(text)
  const lines = linesOf(normalized)
  const branchMatch =
    normalized.match(/(?:BRANCH|PROGRAM(?:ME)?)\s*[:-]?\s*([A-Z&() .-]{2,})/i) ??
    lines.find((line) => /AI&DS|AI&ML|INFORMATION TECHNOLOGY|COMPUTER|CIVIL|MECHANICAL|E&TC|E&CS|M&ME/i.test(line))
  const semesterMatch = normalized.match(/\bSEM(?:ESTER)?\s*[-:]?\s*(I{1,3}V?|[12])\b/i)
  const schemeMatch = normalized.match(/\b(?:CBCGS-)?(?:CBCGS\s*)?(?:WITH\s*HOLISTIC[A-Z ]*)?-?\s*(HME\s*20\d{2})\b/i) ??
    normalized.match(/\b(HME\s*20\d{2})\b/i)
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

// ─── Course Map Extraction ───────────────────────────────────────────────────

export function extractCourseMap(text) {
  const map = {}
  const regex = /COURSE\s*(VIII|VII|VI|IV|III|II|V|I)\s*[:-]?\s*(.+?)(?=\s*COURSE\s*(?:VIII|VII|VI|IV|III|II|V|I)\b|\s*$)/gi
  for (const line of linesOf(text)) {
    const matches = [...line.matchAll(regex)]
    for (const match of matches) {
      map[match[1].toUpperCase()] = match[2].replace(/^[:-]\s*/, '').trim()
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

// ─── Vertical Student Row Extraction (legacy format support) ─────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// V2: HORIZONTAL STUDENT RECORD EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the student record from horizontal gazette format.
 * Improved V2: better name parsing, robust summary line extraction.
 */
function extractHorizontalStudentRecord(text) {
  const lines = linesOf(text)
  const startIndex = lines.findIndex((line) => /^\d{8,9}\b/.test(line))
  if (startIndex === -1) return null

  const firstLine = lines[startIndex]
  const nameLines = []
  let practicalLine = ''

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    // Stop at footer / next student / page markers
    if (/^\/ - FEMALE|^G\s*: GRADE|^MARKS\s*:|^GRADE POINT|^PREPARED BY|^PAGE \d+/i.test(line)) break
    if (/^\d{8,9}\b/.test(line)) break

    // Detect marks pattern: number followed by single letter grade followed by number
    const marksIdx = !practicalLine ? line.search(/\b\d{1,2}\s+[A-Z]\s+\d{1,2}\b/) : -1
    if (marksIdx !== -1) {
      if (marksIdx > 0) {
        const namePrefix = line.slice(0, marksIdx).trim()
        if (namePrefix && /[A-Z]/.test(namePrefix)) {
          nameLines.push(namePrefix)
        }
      }
      practicalLine = line.slice(marksIdx).trim()
    } else {
      // Pure name continuation lines
      if (/^[A-Z/][A-Z/ '.-]+$/i.test(line)) {
        nameLines.push(line)
      }
    }
  }

  // Parse seat number and extract first line content
  const seatMatch = firstLine.match(/^(\d{8,9})\s+(.*)$/)
  const rest = seatMatch?.[2] ?? ''

  // V2: Parse the summary from the END of the first line (anchored)
  // Pattern: totalCredits totalCreditPoints SGPA status
  const finalMatch = rest.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d{1,2})?)\s+(P|F|ATKT)\s*$/i)
  if (!seatMatch || !finalMatch) return null

  const lead = rest.slice(0, finalMatch.index).trim()

  // V2: Better name/marks separation
  // Find where marks begin: first occurrence of "number grade number" pattern
  const marksStart = lead.search(/\d+(?:\.\d+)?\s+[A-Z]\s+\d+(?:\.\d+)?\s+[A-Z]/)
  const firstNameChunk = marksStart === -1 ? lead : lead.slice(0, marksStart)
  const name = [firstNameChunk.replace(/^\//, '').trim(), ...nameLines.map((line) => line.trim())]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
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

// ═══════════════════════════════════════════════════════════════════════════════
// V2: VALIDATED TOKEN BLOCK PARSER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a 9-token theory block with full mathematical validation.
 * Block: [ESE, Grade, IA, Grade, Total, Credits, Grade, GP, CP]
 *
 * Validations:
 *  ✓ ESE + IA = Total
 *  ✓ Grade ↔ GP is a valid pair
 *  ✓ GP × Credits = CP (±0.5 tolerance)
 */
function parseValidatedTheoryBlock(tokens, subject) {
  if (tokens.length < 9) return null

  const ese = Number(tokens[0])
  const eseGrade = tokens[1]
  const ia = Number(tokens[2])
  const iaGrade = tokens[3]
  const total = Number(tokens[4])
  const credits = Number(tokens[5])
  const grade = tokens[6]
  const gp = Number(tokens[7])
  const cp = Number(tokens[8])

  // Check tokens are the right shape
  if (!isValidGrade(eseGrade) || !isValidGrade(iaGrade) || !isValidGrade(grade)) return null
  if (!Number.isFinite(ese) || !Number.isFinite(ia) || !Number.isFinite(total)) return null
  if (!Number.isFinite(credits) || !Number.isFinite(gp) || !Number.isFinite(cp)) return null

  const warnings = []
  const totalValid = isValidTheoryTotal(ese, ia, total)
  const gradeGPValid = isValidGradeGPPair(grade, gp)
  const creditProductValid = isValidCreditProduct(gp, credits, cp)

  if (!totalValid) warnings.push(`Theory total mismatch: ${ese} + ${ia} ≠ ${total}`)
  if (!gradeGPValid) warnings.push(`Grade/GP mismatch: ${grade} should map to GP ${gradeToGP(grade)}, got ${gp}`)
  if (!creditProductValid) warnings.push(`CP mismatch: ${gp} × ${credits} ≠ ${cp}`)

  return {
    subjectCode: subject.code,
    subjectName: subject.name,
    courseRoman: subject.courseRoman,
    componentType: subject.gradingMode,
    ese,
    eseGrade,
    importedIA: ia,
    iaGrade,
    total,
    credits,
    grade,
    gradePoint: gp,
    creditPoints: cp,
    confidence: computeSubjectConfidence({
      hasParsedMarks: true,
      gradeGPValid,
      totalValid,
      creditProductValid,
      warningCount: warnings.length,
    }),
    warnings,
    rawSubjectLine: tokens.join(' '),
    _validation: { totalValid, gradeGPValid, creditProductValid },
  }
}

/**
 * Parse a 9-token practical block (TW + PR) with validation.
 * Block: [TW, Grade, PR, Grade, Total, Credits, Grade, GP, CP]
 */
function parseValidatedPracticalBlock9(tokens, subject) {
  if (tokens.length < 9) return null

  const tw = Number(tokens[0])
  const twGrade = tokens[1]
  const pr = Number(tokens[2])
  const prGrade = tokens[3]
  const practicalTotal = Number(tokens[4])
  const credits = Number(tokens[5])
  const grade = tokens[6]
  const gp = Number(tokens[7])
  const cp = Number(tokens[8])

  if (!isValidGrade(twGrade) || !isValidGrade(prGrade) || !isValidGrade(grade)) return null
  if (!Number.isFinite(tw) || !Number.isFinite(pr) || !Number.isFinite(practicalTotal)) return null

  const warnings = []
  const totalValid = isValidPracticalTotal(tw, pr, practicalTotal)
  const gradeGPValid = isValidGradeGPPair(grade, gp)
  const creditProductValid = isValidCreditProduct(gp, credits, cp)

  if (!totalValid) warnings.push(`Practical total mismatch: ${tw} + ${pr} ≠ ${practicalTotal}`)
  if (!gradeGPValid) warnings.push(`Grade/GP mismatch: ${grade} → GP ${gradeToGP(grade)}, got ${gp}`)
  if (!creditProductValid) warnings.push(`CP mismatch: ${gp} × ${credits} ≠ ${cp}`)

  return {
    tw,
    twGrade,
    pr,
    prGrade,
    practicalTotal,
    credits,
    grade,
    gradePoint: gp,
    creditPoints: cp,
    confidence: computeSubjectConfidence({
      hasParsedMarks: true,
      gradeGPValid,
      totalValid,
      creditProductValid,
      warningCount: warnings.length,
    }),
    warnings,
    _validation: { totalValid, gradeGPValid, creditProductValid },
  }
}

/**
 * Parse a 5-token practical block (TW-only) with validation.
 * Block: [TW, Grade, Credits, GP, CP]
 */
function parseValidatedPracticalBlock5(tokens, subject) {
  if (tokens.length < 5) return null

  const tw = Number(tokens[0])
  const twGrade = tokens[1]
  const credits = Number(tokens[2])
  const gp = Number(tokens[3])
  const cp = Number(tokens[4])

  if (!isValidGrade(twGrade)) return null
  if (!Number.isFinite(tw) || !Number.isFinite(credits) || !Number.isFinite(gp) || !Number.isFinite(cp)) return null

  const gradeGPValid = isValidGradeGPPair(twGrade, gp)
  const creditProductValid = isValidCreditProduct(gp, credits, cp)
  const warnings = []
  if (!gradeGPValid) warnings.push(`Grade/GP mismatch: ${twGrade} → GP ${gradeToGP(twGrade)}, got ${gp}`)
  if (!creditProductValid) warnings.push(`CP mismatch: ${gp} × ${credits} ≠ ${cp}`)

  return {
    tw,
    twGrade,
    credits,
    grade: twGrade,
    gradePoint: gp,
    creditPoints: cp,
    practicalTotal: tw,
    confidence: computeSubjectConfidence({
      hasParsedMarks: true,
      gradeGPValid,
      totalValid: true,
      creditProductValid,
      warningCount: warnings.length,
    }),
    warnings,
    _validation: { totalValid: true, gradeGPValid, creditProductValid },
  }
}

/**
 * Parse a non-credit subject block.
 * Non-credit blocks in the gazette: [Marks, Grade, Credits(0), GP, CP(0)]
 * Sometimes just: [Marks, Grade, Credits(0), GP, CP(0)]
 */
function parseNonCreditBlock(tokens) {
  if (tokens.length < 5) return null

  const marks = Number(tokens[0])
  const grade = tokens[1]
  const credits = Number(tokens[2])
  const gp = Number(tokens[3])
  const cp = Number(tokens[4])

  if (!isValidGrade(grade)) return null

  return {
    tw: marks,
    twGrade: grade,
    credits,
    grade,
    gradePoint: gp,
    creditPoints: cp,
    practicalTotal: marks,
    isNonCredit: true,
    confidence: 0.95,
    warnings: [],
    _validation: { totalValid: true, gradeGPValid: true, creditProductValid: cp === 0 },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2: SELF-HEALING HORIZONTAL PARSER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Try parsing a theory block at the given cursor position.
 * If the standard 9-token block fails validation, try self-healing:
 *  - Skip 1 token ahead
 *  - Try with offset adjustments
 */
function tryParseTheoryBlock(tokens, cursor, subject) {
  // Standard attempt: 9 tokens at cursor
  const block = parseValidatedTheoryBlock(tokens.slice(cursor, cursor + 9), subject)
  if (block && block._validation.totalValid && block._validation.creditProductValid) {
    return { block, consumed: 9 }
  }

  // Self-heal: try skipping 1 token (extra stray token before block)
  const skip1 = parseValidatedTheoryBlock(tokens.slice(cursor + 1, cursor + 10), subject)
  if (skip1 && skip1._validation.totalValid && skip1._validation.creditProductValid) {
    skip1.warnings.push('Self-healed: skipped 1 token to align theory block.')
    return { block: skip1, consumed: 10 }
  }

  // Return the best attempt even if imperfect
  if (block) return { block, consumed: 9 }
  return null
}

/**
 * Try parsing a practical block at the given cursor position.
 * Automatically chooses 9-token (TW+PR) or 5-token (TW-only) based on subject.
 */
function tryParsePracticalBlock(tokens, cursor, subject) {
  const hasTwAndPr = subject.hasTW && subject.hasPR

  if (hasTwAndPr) {
    // Try 9-token block first
    const block9 = parseValidatedPracticalBlock9(tokens.slice(cursor, cursor + 9), subject)
    if (block9 && block9._validation.creditProductValid) {
      return { block: block9, consumed: 9 }
    }

    // Self-heal: skip 1
    const skip1 = parseValidatedPracticalBlock9(tokens.slice(cursor + 1, cursor + 10), subject)
    if (skip1 && skip1._validation.creditProductValid) {
      skip1.warnings.push('Self-healed: skipped 1 token to align practical block.')
      return { block: skip1, consumed: 10 }
    }

    if (block9) return { block: block9, consumed: 9 }
  }

  // 5-token block (TW-only or fallback)
  const block5 = parseValidatedPracticalBlock5(tokens.slice(cursor, cursor + 5), subject)
  if (block5) {
    return { block: block5, consumed: 5 }
  }

  // Self-heal: skip 1
  const skip1_5 = parseValidatedPracticalBlock5(tokens.slice(cursor + 1, cursor + 6), subject)
  if (skip1_5) {
    skip1_5.warnings.push('Self-healed: skipped 1 token to align practical block.')
    return { block: skip1_5, consumed: 6 }
  }

  return null
}

/**
 * V2 horizontal student row parser with validated token blocks.
 * 
 * The gazette layout puts ALL theory marks on line 1 (seat-no line)
 * and ALL practical marks on line 2, in the order of course I, II, III, etc.
 * 
 * This parser:
 *  1. Splits subjects into theory-subjects and practical-subjects
 *  2. Walks through theory tokens consuming validated 9-token blocks
 *  3. Walks through practical tokens consuming 9 or 5-token blocks
 *  4. Merges theory + practical for subjects that have both
 *  5. Validates GP×C=CP for the merged result
 */
function parseHorizontalStudentRows(record, selectedTemplate) {
  if (!record || !selectedTemplate?.subjects?.length) return []

  const parsedByCode = new Map()
  const theoryTokens = tokenizeMarks(record.theoryLine)
  const practicalTokens = tokenizeMarks(record.practicalLine)

  // Separate subjects by type, maintaining course order
  const theorySubjects = selectedTemplate.subjects.filter((s) => s.hasTheory)
  const practicalSubjects = selectedTemplate.subjects.filter(
    (s) => s.hasTW || s.hasPR || s.hasOR || s.isNonCredit
  )

  // ── Phase 1: Parse theory blocks ──────────────────────────────
  let theoryCursor = 0
  for (const subject of theorySubjects) {
    const result = tryParseTheoryBlock(theoryTokens, theoryCursor, subject)
    if (result) {
      theoryCursor += result.consumed
      parsedByCode.set(subject.code, {
        ...result.block,
        isNonCredit: subject.isNonCredit,
      })
    } else {
      // Emergency fallback: try raw 9-token consumption
      const raw = parseRawTheoryBlock(theoryTokens.slice(theoryCursor, theoryCursor + 9), subject)
      if (raw) {
        theoryCursor += 9
        parsedByCode.set(subject.code, raw)
      }
    }
  }

  // ── Phase 2: Parse practical blocks ───────────────────────────
  let practicalCursor = 0
  for (const subject of practicalSubjects) {
    // Non-credit subjects get special handling
    if (subject.isNonCredit) {
      const ncBlock = parseNonCreditBlock(practicalTokens.slice(practicalCursor, practicalCursor + 5))
      if (ncBlock) {
        practicalCursor += 5
        const existing = parsedByCode.get(subject.code) ?? createEmptySubjectEntry(subject)
        parsedByCode.set(subject.code, { ...existing, ...ncBlock })
      }
      continue
    }

    const result = tryParsePracticalBlock(practicalTokens, practicalCursor, subject)
    if (result) {
      practicalCursor += result.consumed
      // Use existing theory entry if available; otherwise create a clean base
      // (not createEmptySubjectEntry which adds misleading "could not parse" warning)
      const existing = parsedByCode.get(subject.code) ?? {
        subjectCode: subject.code,
        subjectName: subject.name,
        courseRoman: subject.courseRoman,
        componentType: subject.gradingMode,
        isNonCredit: subject.isNonCredit,
        confidence: 0.85,
        warnings: [],
        rawSubjectLine: '',
      }

      // V2: Smart credit merging with validation
      const mergedCredits = (existing.credits ?? 0) + (result.block.credits ?? 0)
      const mergedCreditPoints = (existing.creditPoints ?? 0) + (result.block.creditPoints ?? 0)
      const mergedGP = mergedCredits ? Number((mergedCreditPoints / mergedCredits).toFixed(2)) : 0

      // Validate the merged result
      const mergeValid = isValidCreditProduct(mergedGP, mergedCredits, mergedCreditPoints, 1.0)

      parsedByCode.set(subject.code, {
        ...existing,
        ...result.block,
        credits: mergedCredits,
        creditPoints: mergedCreditPoints,
        gradePoint: mergedGP,
        confidence: Math.min(
          0.98,
          Math.max(existing.confidence ?? 0.85, result.block.confidence ?? 0.85)
        ),
        rawSubjectLine: `${existing.rawSubjectLine ?? ''} | ${practicalTokens.slice(practicalCursor - result.consumed, practicalCursor).join(' ')}`.trim(),
        warnings: [
          ...(existing.warnings ?? []),
          ...(result.block.warnings ?? []),
          ...(!mergeValid ? [`Merged CP validation: ${mergedGP} × ${mergedCredits} ≈ ${mergedCreditPoints}`] : []),
        ],
        _validation: {
          ...(existing._validation ?? {}),
          practicalValid: result.block._validation,
          mergeValid,
        },
      })
    }
  }

  // ── Phase 3: Assemble final subject list in template order ────
  return selectedTemplate.subjects.map((subject) => {
    const parsed = parsedByCode.get(subject.code)
    if (parsed) {
      // Clean up internal validation data
      const { _validation, ...clean } = parsed
      return clean
    }
    return createEmptySubjectEntry(subject)
  })
}

/** Raw fallback theory parser (no validation) — used only as emergency fallback */
function parseRawTheoryBlock(tokens, subject) {
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
    confidence: 0.6,
    warnings: ['Parsed without mathematical validation (raw fallback).'],
    rawSubjectLine: tokens.join(' '),
    isNonCredit: subject.isNonCredit,
  }
}

/** Create an empty entry for subjects that couldn't be parsed */
function createEmptySubjectEntry(subject) {
  return {
    subjectCode: subject.code,
    subjectName: subject.name,
    courseRoman: subject.courseRoman,
    componentType: subject.gradingMode,
    isNonCredit: subject.isNonCredit,
    confidence: 0.1,
    warnings: ['Could not parse this subject from the gazette.'],
    rawSubjectLine: '',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL FORMAT PARSERS (for non-horizontal gazette PDFs)
// ═══════════════════════════════════════════════════════════════════════════════

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

  // V2: Add validation checks to vertical format too
  if (parsed.grade && parsed.gradePoint !== undefined) {
    const gpValid = isValidGradeGPPair(parsed.grade, parsed.gradePoint)
    if (!gpValid) warnings.push(`Grade/GP validation: ${parsed.grade} should be GP ${gradeToGP(parsed.grade)}, got ${parsed.gradePoint}`)
  }
  if (parsed.gradePoint !== undefined && parsed.creditPoints !== undefined) {
    const cpValid = isValidCreditProduct(parsed.gradePoint, credits, parsed.creditPoints, 1.0)
    if (!cpValid) warnings.push(`CP validation: ${parsed.gradePoint} × ${credits} ≠ ${parsed.creditPoints}`)
  }

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

  parsed.confidence = computeSubjectConfidence({
    hasParsedMarks: parsed.ese !== undefined || parsed.tw !== undefined,
    gradeGPValid: parsed.grade ? isValidGradeGPPair(parsed.grade, parsed.gradePoint) : false,
    totalValid: parsed.total !== undefined,
    creditProductValid: parsed.creditPoints !== undefined && isValidCreditProduct(parsed.gradePoint, credits, parsed.creditPoints, 1.0),
    warningCount: warnings.length,
  })

  return parsed
}

// ─── Result Validation ───────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PARSER ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

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

  // V2: Enhanced SGPA detection — try multiple regex patterns
  const officialSgpaMatch =
    normalized.match(/\bS?GPA\s*[:=-]?\s*(\d+(?:\.\d{1,2})?)/i) ??
    normalized.match(/(\d+\.\d{2})\s+(?:P|F|ATKT)\s*$/im)
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

  // V2: Compute per-subject validation summary
  const subjectValidationSummary = parsedRows.map((row) => {
    const gpValid = row.grade && row.gradePoint !== undefined
      ? isValidGradeGPPair(row.grade, row.gradePoint)
      : null
    const cpValid = row.gradePoint !== undefined && row.credits !== undefined && row.creditPoints !== undefined
      ? isValidCreditProduct(row.gradePoint, row.credits, row.creditPoints, 1.0)
      : null
    return {
      subjectCode: row.subjectCode,
      gradeGPValid: gpValid,
      creditPointMatches: cpValid,
      warnings: row.warnings,
    }
  })

  // V2: Elevated confidence when all mathematical validations pass
  const allSubjectsValid = subjectValidationSummary.every(
    (s) => s.gradeGPValid !== false && s.creditPointMatches !== false
  )
  const validationBonus = allSubjectsValid && parsedRows.length > 0 ? 0.05 : 0

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
      subjectValidations: subjectValidationSummary,
      allSubjectsValid,
    },
    rawTextPreview: normalized.slice(0, 4000),
    confidence: Math.min(1.0, combineConfidence([
      resolved.confidence,
      courseMatch.confidence,
      parsedRows.length ? parsedRows.reduce((sum, row) => sum + row.confidence, 0) / parsedRows.length : 0,
      warnings.length ? Math.max(0.2, 1 - warnings.length * 0.08) : 0.95,
    ]) + validationBonus),
    warnings: getUniqueWarnings(warnings),
  }
}

function capitalize(value = '') {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

function getUniqueWarnings(warnings = []) {
  return Array.from(new Set(warnings.filter(Boolean)))
}
