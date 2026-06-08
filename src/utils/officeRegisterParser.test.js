import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  getAvailableTemplates,
  getTemplateWarnings,
  normalizeBranch,
  normalizeScheme,
  normalizeSemester,
  resolveCycle,
  resolveTemplate,
} from './branchCycleResolver'
import {
  detectOfficeRegisterFormat,
  extractCourseMap,
  extractHeaderMetadata,
  matchCourseMapToTemplate,
  parseStudentRow,
  parseOfficeRegisterText,
} from './officeRegisterParser'
import { getOfficeRegisterTemplate } from './officeRegisterTemplates'
import { looksLikeTcetGazette, parseTcetGazettePdfText, parseTcetGazetteText } from './tcetGazetteParser'

const fixtureText = readFileSync(new URL('../../tests/fixtures/anonymized-gazette.txt', import.meta.url), 'utf8')
const compSem1LayoutText = `REPORT DATE :               06/02/2026
OFFICE REGISTER FOR FIRST YEAR SEMESTER I (CHOICE BASED CREDIT GRADING SCHEME - HME 2023) (BRANCH - COMPUTER ENGINEERING) EXAMINATION HELD IN JANUARY 2026
COURSE I    :               PHYSICS
COURSE II   :               MATHEMATICS-I
COURSE III  :              BASIC ELECTRICAL ENGINEERING
COURSE IV  :              ENGINEERING GRAPHICS & DESIGN
COURSE V   :              WORKSHOP & MANUFACTURING PRACTICES-I
COURSE VI  :               ENGLISH FOR GENERAL & PROFESSIONAL
COMMUNICATION
COURSE VII  :              ATTITUDE & APTITUDE DEVELOPMENT-1 / NCC
121160227             / SAMPLE STUDENT                        50       O    37      O     87     3    O    10     30      38      C    31      A     69     4    C   7      28     46       A   34      O    80     3    O     10     30      32     D    32       O    64      2     C    7      14                                          45       A    35       O    80     2    O     10    20                                          21        187         8.90         P
                         CONTINUED NAME
                                                             21       O    21      O     42     1    O    10     10      19      A     1      9     9                             22       O   20      O    42     1    O     10     10      19     A    20       O    39      2     A    9      18      18       B     1    8      8        21       O     1     10     10                              23       O     0   10      0`

const itSem1LayoutText = `REPORT DATE :              31/01/2025
OFFICE REGISTER FOR FIRST YEAR SEMESTER I (CHOICE BASED CREDIT GRADING SCHEME - HME 2023) (BRANCH - INFORMATION TECHNOLOGY) EXAMINATION HELD IN DECEMBER 2024
COURSE I    :               CHEMISTRY
COURSE II   :              MATHEMATICS-I
COURSE III  :              PROGRAMMING FOR PROBLEM SOLVING
COURSE IV  :              ENGINEERING MECHANICS
COURSE V   :              WORKSHOP & MANUFACTURING PRACTICES-I
COURSE VI  :              INTRODUCTION TO INDIAN KNOWLEDGE SYSTEM
COURSE VIII :             PROFESSIONAL SKILLS-I (OBJECT ORIENTED PROGRAMMING)
COURSE VII :             ATTITUDE & APTITUDE DEVELOPMENT-I
121350076               SAMPLE IT STUDENT                     40       C   34      O     74     3    B    8      24      45      A   33      O     78      4   A   9      36     55       O   38      O    93     3    O     10     30     37      C   31       A    68      3    C     7      21                                         51       O    35       O    86     2    O    10    20       23      O      0     10      0        22     197        8.95          P
                         CONTINUED NAME
                                                             18       B   17      C     35     1    B    8      8       21      O    1      10    10                            23       O   22      O    45     1    O     10     10     19      A   18       B    37      1    B     8      8       21      O     1    10      10      21       O     1     10     10                              21      O     1      10      10`

const itSem2LayoutText = `REPORT DATE :              06/06/2025
OFFICE REGISTER FOR FIRST YEAR SEMESTER II (CHOICE BASED CREDIT GRADING SCHEME WITH HOLISTIC AND MULTIDISCIPLINARY EDUCATION 2023) (BRANCH - INFORMATION TECHNOLOGY) EXAMINATION HELD IN MAY 2025
COURSE I    :              PHYSICS
COURSE II   :              MATHEMATICS-II
COURSE III                 BASIC ELECTRICAL ENGINEERING
COURSE IV  :              ENGINEERING GRAPHICS & DESIGN
COURSE V   :              WORKSHOP & MANUFACTURING PRACTICES-II
COURSE VI  :              ENGLISH FOR GENERAL & PROFESSIONAL COMMUNICATION
COURSE VII  :               SUMMER INTERNSHIP
COURSE VIII :               ATTITUDE & APTITUDE DEVELOPMENT-II
122340076               SAMPLE IT SEM2                       57       O    36      O   93    3    O   10     30      56      O     30      A     86     3    O    10      30     57       O    35      O    92     3   O    10     30      57      O     37      O    94       2     O    10     20     53      O    36      O     89    2   O     10    20       21       O     1    10      10      18       B     0    8      0         21       209         9.95        P
                         CONTINUED NAME
                         AND MORE
                                                            21       O   19       A   40    1    O   10    10       20      O    1        10    10                              22      O     16      C    38     1   A    9      9       23       O    22      O     45     2      O    10     20     21      O    1     10      10                             20        O    1    10      10`

describe('branchCycleResolver', () => {
  it('detects AI&DS branch aliases', () => {
    expect(normalizeBranch('Artificial Intelligence and Data Science')).toBe('AIDS')
    expect(normalizeBranch('AI&DS')).toBe('AIDS')
    expect(normalizeBranch('A.I.D.S.')).toBe('AIDS')
  })

  it('normalizes semester and scheme labels', () => {
    expect(normalizeSemester('Semester I')).toBe(1)
    expect(normalizeSemester('Sem II')).toBe(2)
    expect(normalizeScheme('Choice Based Credit Grading Scheme - HME 2023')).toContain('HME 2023')
  })

  it('selects chemistry cycle template for IT sem I', () => {
    const resolved = resolveCycle({ branch: 'Information Technology', semester: 1 })
    expect(resolved.cycle).toBe('chemistry')
    expect(resolved.templateKey).toBe('sem1-chemistry-office-register')
  })

  it('returns available templates and warnings', () => {
    expect(getAvailableTemplates({ branch: 'AIDS', semester: 1 }).map((template) => template.key)).toContain('sem1-physics-office-register')
    expect(resolveTemplate({ branch: 'AIDS', semester: 1, cycle: 'physics' }).templateKey).toBe('sem1-physics-office-register')
    expect(getTemplateWarnings(getOfficeRegisterTemplate('sem2-chemistry-office-register'))).toHaveLength(0)
  })
})

describe('officeRegisterParser', () => {
  it('detects TCET-like office register text', () => {
    expect(detectOfficeRegisterFormat(fixtureText)).toMatchObject({ format: 'office-register' })
    expect(looksLikeTcetGazette(fixtureText)).toBe(true)
  })

  it('extracts header metadata from AI&DS Sem I office register', () => {
    const metadata = extractHeaderMetadata(fixtureText)
    expect(metadata.branch).toBe('AIDS')
    expect(metadata.semester).toBe(1)
    expect(metadata.scheme).toBe('HME 2023')
    expect(metadata.examMonthYear).toBe('JANUARY 2026')
    expect(metadata.reportDate).toBe('14/02/2026')
  })

  it('extracts course map and matches the physics template', () => {
    const courseMap = extractCourseMap(fixtureText)
    const match = matchCourseMapToTemplate(courseMap, getOfficeRegisterTemplate('sem1-physics-office-register'))
    expect(courseMap.I).toBe('Physics')
    expect(match.confidence).toBeGreaterThan(0.8)
  })

  it('warns on course map mismatch', () => {
    const mismatchText = fixtureText.replace('COURSE II: Mathematics-I', 'COURSE II: Chemistry')
    const courseMap = extractCourseMap(mismatchText)
    const match = matchCourseMapToTemplate(courseMap, getOfficeRegisterTemplate('sem1-physics-office-register'))
    expect(match.warnings.some((warning) => warning.includes('mismatch'))).toBe(true)
  })

  it('parses the AI&DS Sem I office register and uses imported IA', () => {
    const parsed = parseTcetGazetteText(fixtureText, 'AIDS', 1)
    expect(parsed.metadata.cycle).toBe('physics')
    expect(parsed.metadata.templateKey).toBe('sem1-physics-office-register')
    expect(parsed.final.sgpa).toBe(8.9)
    expect(parsed.final.calculatedSgpa).toBe(8.9)
    expect(parsed.student.seatNo).toBe('TCET2025001')
    expect(parsed.student.name).toBe('SAMPLE STUDENT')
    expect(parsed.final.totalCredits).toBe(21)
    expect(parsed.final.totalCreditPoints).toBe(187)
    expect(parsed.final.status).toBe('P')
    expect(parsed.subjects.find((subject) => subject.subjectCode === 'BSC1101')).toMatchObject({
      importedIA: 34,
      ese: 46,
    })
  })

  it('parses horizontal COMP sem I gazette layout', () => {
    const parsed = parseOfficeRegisterText(compSem1LayoutText, { preferredBranch: 'COMP', preferredSemester: 1 })
    expect(parsed.student.seatNo).toBe('121160227')
    expect(parsed.metadata.branch).toBe('COMP')
    expect(parsed.metadata.cycle).toBe('physics')
    expect(parsed.final.sgpa).toBe(8.9)
    expect(parsed.final.totalCredits).toBe(21)
    expect(parsed.final.totalCreditPoints).toBe(187)
    expect(parsed.subjects.find((subject) => subject.subjectCode === 'BSC1101')).toMatchObject({
      ese: 50,
      importedIA: 37,
      tw: 21,
      pr: 21,
    })
  })

  it('parses horizontal IT sem I gazette layout', () => {
    const parsed = parseOfficeRegisterText(itSem1LayoutText, { preferredBranch: 'IT', preferredSemester: 1 })
    expect(parsed.student.seatNo).toBe('121350076')
    expect(parsed.metadata.branch).toBe('IT')
    expect(parsed.metadata.cycle).toBe('chemistry')
    expect(parsed.final.sgpa).toBe(8.95)
    expect(parsed.subjects.find((subject) => subject.subjectCode === 'BSC1201')).toMatchObject({
      ese: 40,
      importedIA: 34,
      tw: 18,
      pr: 17,
    })
  })

  it('parses horizontal IT sem II gazette layout with reversed cycle', () => {
    const parsed = parseOfficeRegisterText(itSem2LayoutText, { preferredBranch: 'IT', preferredSemester: 2 })
    expect(parsed.student.seatNo).toBe('122340076')
    expect(parsed.metadata.branch).toBe('IT')
    expect(parsed.metadata.cycle).toBe('physics')
    expect(parsed.metadata.templateKey).toBe('sem2-physics-office-register')
    expect(parsed.final.sgpa).toBe(9.95)
    expect(parsed.subjects.find((subject) => subject.subjectCode === 'BSC1101')).toMatchObject({
      ese: 57,
      importedIA: 36,
      tw: 21,
      pr: 19,
    })
  })

  it('does not invent ISE values when only imported IA exists', () => {
    const parsed = parseTcetGazetteText(fixtureText, 'AIDS', 1)
    const subject = parsed.subjects.find((entry) => entry.subjectCode === 'BSC1101')
    expect(subject.ise1).toBeUndefined()
    expect(subject.ise2).toBeUndefined()
    expect(subject.ise3).toBeUndefined()
  })

  it('validates GPA from sigma C and sigma C*GP', () => {
    const parsed = parseOfficeRegisterText(fixtureText, { preferredBranch: 'AIDS', preferredSemester: 1 })
    expect(parsed.final.totalCredits).toBe(21)
    expect(parsed.final.totalCreditPoints).toBe(187)
    expect(parsed.final.calculatedSgpa).toBe(8.9)
    expect(parsed.validation.sgpaMatches).toBe(true)
    expect(parsed.validation.creditTotalMatches).toBe(true)
  })

  it('parses theory component blocks with ESE and imported IA grades', () => {
    const template = getOfficeRegisterTemplate('sem1-physics-office-register')
    const row = parseStudentRow(
      { subjectCode: 'BSC1101', mainLine: 'BSC1101 Physics 44 B 32 O 76 4 A 9 36', detailLine: '' },
      template,
    )
    expect(row).toMatchObject({
      ese: 44,
      eseGrade: 'B',
      importedIA: 32,
      iaGrade: 'O',
      theoryTotal: 76,
      parsedOfficialCredits: 4,
      templateCreditsUsed: 4,
      grade: 'A',
      gradePoint: 9,
      creditPoints: 36,
    })
  })

  it('parses practical blocks with TW and PR grades', () => {
    const template = getOfficeRegisterTemplate('sem1-physics-office-register')
    const row = parseStudentRow(
      { subjectCode: 'ESC1103', mainLine: 'ESC1103 Workshop & Manufacturing Practices-I 18 B 23 O 41 1 O 10 10', detailLine: '' },
      template,
    )
    expect(row).toMatchObject({
      tw: 18,
      twGrade: 'B',
      pr: 23,
      prGrade: 'O',
      practicalTotal: 41,
      grade: 'O',
      gradePoint: 10,
      creditPoints: 10,
    })
  })

  it('changes template when manual override is applied', () => {
    const parsed = parseTcetGazetteText(fixtureText, 'AIDS', 1, {
      branch: 'IT',
      semester: 1,
      cycle: 'chemistry',
      templateKey: 'sem1-chemistry-office-register',
    })
    expect(parsed.metadata.templateKey).toBe('sem1-chemistry-office-register')
    expect(parsed.warnings.some((warning) => /Manual cycle override/i.test(warning))).toBe(true)
  })

  it('does not hardcode AI&DS subject names for all branches', () => {
    const resolved = resolveCycle({ branch: 'IT', semester: 1 })
    expect(resolved.subjects.some((subject) => subject.name === 'Chemistry')).toBe(true)
    expect(resolved.subjects.some((subject) => subject.name === 'Physics')).toBe(false)
  })

  it('flags low confidence on GPA mismatch', () => {
    const parsed = parseOfficeRegisterText(fixtureText.replace('SGPA: 8.90', 'SGPA: 9.99'), {
      preferredBranch: 'AIDS',
      preferredSemester: 1,
    })
    expect(parsed.warnings.some((warning) => warning.includes('Mismatch detected'))).toBe(true)
  })

  it('handles empty scanned-style text gracefully', () => {
    const parsed = parseTcetGazettePdfText('', { preferredBranch: 'AIDS', preferredSemester: 1 })
    expect(parsed.format).toBe('unknown')
    expect(parsed.confidence).toBe(0)
  })
})
