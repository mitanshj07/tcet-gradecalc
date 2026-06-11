export const GRADE_THRESHOLDS = [
  { min: 80, grade: 'O', gp: 10 },
  { min: 75, grade: 'A', gp: 9 },
  { min: 70, grade: 'B', gp: 8 },
  { min: 60, grade: 'C', gp: 7 },
  { min: 50, grade: 'D', gp: 6 },
  { min: 45, grade: 'E', gp: 5 },
  { min: 40, grade: 'P', gp: 4 },
  { min: 0, grade: 'F', gp: 0 },
]

const HEADS = ['ise1', 'ise2', 'ise3', 'importedIA', 'ese', 'tw', 'pr', 'oral']

export function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function getGradeInfo(percentage) {
  const safePercentage = Number.isFinite(percentage) ? percentage : 0
  return GRADE_THRESHOLDS.find((threshold) => safePercentage >= threshold.min) ?? GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1]
}

export function inputMaxForKey(subject, key) {
  if (key === 'ese') return 60
  if (key === 'importedIA') return 40
  if (key === 'tw') return subject.twMax ?? 25
  if (key === 'pr') return subject.prMax ?? 25
  return 20
}

export function validateMark(subject, key, value) {
  const number = toNumber(value)
  if (number === null) return null
  const max = inputMaxForKey(subject, key)

  if (number < 0 || number > max) {
    return `Enter 0-${max}`
  }

  return null
}

export function computeIA(ise1, ise2, ise3, importedIA = null) {
  if (typeof ise1 === 'object' && ise1 !== null) {
    return computeIA(ise1.ise1, ise1.ise2, ise1.ise3, ise1.importedIA)
  }

  const imported = toNumber(importedIA)
  if (imported !== null) {
    return clamp(imported, 0, 40)
  }

  const i1 = clamp(toNumber(ise1) ?? 0, 0, 20)
  const i2 = clamp(toNumber(ise2) ?? 0, 0, 20)
  const i3 = clamp(toNumber(ise3) ?? 0, 0, 20)

  return Math.min(20, Math.max(i1, i2)) + Math.min(20, i3)
}

export function isTheoryComplete(marks = {}) {
  const hasImportedIA = toNumber(marks.importedIA) !== null
  if (hasImportedIA) {
    return toNumber(marks.ese) !== null
  }

  return ['ise1', 'ise2', 'ise3', 'ese'].every((key) => toNumber(marks[key]) !== null)
}

export function isPracticalComplete(subject, marks = {}) {
  if (!subject.hasTW && !subject.hasPR && !subject.hasOR) return false
  const twDone = !subject.hasTW || toNumber(marks.tw) !== null
  const prDone = !subject.hasPR || toNumber(marks.pr) !== null
  const orDone = !subject.hasOR || toNumber(marks.oral ?? marks.pr) !== null
  return twDone && prDone && orDone
}

export function isPassingTheory(ia, ese) {
  return ia >= 16 && ese >= 24
}

export function isPassingPractical(subject, tw, pr) {
  const twMax = subject.twMax ?? 25
  const prMax = subject.prMax ?? 25
  const orMax = subject.orMax ?? subject.maxMarks?.or ?? 25
  const twPass = !subject.hasTW || ((tw ?? 0) / twMax) * 100 >= 40
  const prPass = !subject.hasPR || ((pr ?? 0) / prMax) * 100 >= 40
  const orPass = !subject.hasOR || ((pr ?? 0) / orMax) * 100 >= 40

  return twPass && prPass && orPass
}

function normalizeTheoryArgs(arg1, arg2, arg3, arg4, arg5) {
  if (typeof arg1 === 'object' && arg1 !== null) {
    return {
      ise1: arg1.ise1,
      ise2: arg1.ise2,
      ise3: arg1.ise3,
      importedIA: arg1.importedIA,
      ese: arg1.ese,
    }
  }

  return {
    ise1: arg1,
    ise2: arg2,
    ise3: arg3,
    importedIA: arg4,
    ese: arg5 ?? arg4,
  }
}

export function computeTheory(arg1, arg2, arg3, arg4, arg5) {
  const { ise1, ise2, ise3, importedIA, ese } = normalizeTheoryArgs(arg1, arg2, arg3, arg4, arg5)
  const ia = computeIA(ise1, ise2, ise3, importedIA)
  const eseNum = clamp(toNumber(ese) ?? 0, 0, 60)
  const total = ia + eseNum
  const rawGrade = getGradeInfo(total)
  const passing = isPassingTheory(ia, eseNum)
  const grade = passing ? rawGrade.grade : 'F'
  const gp = passing ? rawGrade.gp : 0

  return {
    ia,
    ese: eseNum,
    total,
    pct: total,
    rawGrade: rawGrade.grade,
    rawGP: rawGrade.gp,
    grade,
    gp,
    passing,
    iaPassing: ia >= 16,
    esePassing: eseNum >= 24,
    importedIA: toNumber(importedIA),
  }
}

function normalizePracticalArgs(subjectOrArgs, tw, pr = null, oral = null) {
  if (typeof subjectOrArgs === 'object' && subjectOrArgs !== null && !('code' in subjectOrArgs) && !('name' in subjectOrArgs)) {
    const args = subjectOrArgs
    return {
      subject: {
        hasTW: args.twMax !== 0 && args.twMax !== null,
        hasPR: args.prMax !== 0 && args.prMax !== null,
        hasOR: args.oralMax !== 0 && args.oralMax !== null,
        twMax: args.twMax,
        prMax: args.prMax,
        orMax: args.oralMax,
      },
      tw: args.tw,
      pr: args.pr,
      oral: args.oral,
    }
  }

  return { subject: subjectOrArgs, tw, pr, oral }
}

export function computePractical(subjectOrArgs, tw, pr = null, oral = null) {
  const { subject, tw: twValue, pr: prValue, oral: oralValue } = normalizePracticalArgs(subjectOrArgs, tw, pr, oral)
  const twMax = subject.twMax ?? subject.maxMarks?.tw ?? 25
  const prMax = subject.prMax ?? subject.maxMarks?.pr ?? 25
  const orMax = subject.orMax ?? subject.maxMarks?.or ?? 25
  const twNum = subject.hasTW ? clamp(toNumber(twValue) ?? 0, 0, twMax) : null
  const prNum = subject.hasPR ? clamp(toNumber(prValue) ?? 0, 0, prMax) : null
  const oralNum = subject.hasOR ? clamp(toNumber(oralValue ?? prValue) ?? 0, 0, orMax) : null
  const total = (twNum ?? 0) + (prNum ?? 0)
  const oralTotal = total + (oralNum ?? 0)
  const max = (subject.hasTW ? twMax : 0) + (subject.hasPR ? prMax : 0) + (subject.hasOR ? orMax : 0)
  const pct = max > 0 ? (oralTotal / max) * 100 : 0
  const rawGrade = getGradeInfo(pct)
  const passing = isPassingPractical(subject, twNum, oralNum ?? prNum)
  const grade = passing ? rawGrade.grade : 'F'
  const gp = passing ? rawGrade.gp : 0

  return {
    tw: twNum,
    pr: prNum,
    oral: oralNum,
    total: oralTotal,
    max,
    pct,
    twPct: subject.hasTW ? ((twNum ?? 0) / twMax) * 100 : null,
    prPct: subject.hasPR ? ((prNum ?? 0) / prMax) * 100 : null,
    oralPct: subject.hasOR ? ((oralNum ?? 0) / orMax) * 100 : null,
    rawGrade: rawGrade.grade,
    rawGP: rawGrade.gp,
    grade,
    gp,
    passing,
    twPassing: !subject.hasTW || ((twNum ?? 0) / twMax) * 100 >= 40,
    prPassing: !subject.hasPR || ((prNum ?? 0) / prMax) * 100 >= 40,
    oralPassing: !subject.hasOR || ((oralNum ?? 0) / orMax) * 100 >= 40,
  }
}

export function computeSubjectResult(subject, marks = {}) {
  const totalCredits = subject.nonCredit ? 0 : (subject.thCr ?? 0) + (subject.practicalCr ?? 0)
  const result = {
    subject,
    marks,
    nonCredit: Boolean(subject.nonCredit),
    totalCredits,
    completed: subject.nonCredit,
    theory: null,
    practical: null,
    creditsCounted: 0,
    earnedCredits: 0,
    creditPoints: 0,
    failures: [],
  }

  if (subject.nonCredit) return result

  if (subject.hasTh && subject.thCr > 0 && isTheoryComplete(marks)) {
    result.theory = computeTheory({
      ise1: marks.ise1,
      ise2: marks.ise2,
      ise3: marks.ise3,
      importedIA: marks.importedIA,
      ese: marks.ese,
    })
    result.creditsCounted += subject.thCr
    result.earnedCredits += result.theory.passing ? subject.thCr : 0
    result.creditPoints += subject.thCr * result.theory.gp

    if (!result.theory.iaPassing) {
      result.failures.push({ code: subject.code, name: subject.name, head: 'IA', detail: `${result.theory.ia}/40` })
    }

    if (!result.theory.esePassing) {
      result.failures.push({ code: subject.code, name: subject.name, head: 'ESE', detail: `${result.theory.ese}/60` })
    }
  }

  if ((subject.hasTW || subject.hasPR || subject.hasOR) && subject.practicalCr > 0 && isPracticalComplete(subject, marks)) {
    result.practical = computePractical(subject, marks.tw, marks.pr, marks.oral)
    result.creditsCounted += subject.practicalCr
    result.earnedCredits += result.practical.passing ? subject.practicalCr : 0
    result.creditPoints += subject.practicalCr * result.practical.gp

    if (!result.practical.twPassing) {
      result.failures.push({
        code: subject.code,
        name: subject.name,
        head: 'TW',
        detail: `${result.practical.tw}/${subject.twMax ?? 25}`,
      })
    }

    if (!result.practical.prPassing) {
      result.failures.push({
        code: subject.code,
        name: subject.name,
        head: subject.hasOR ? 'OR' : 'PR',
        detail: `${result.practical.pr}/${subject.prMax ?? 25}`,
      })
    }

    if (!result.practical.oralPassing) {
      result.failures.push({
        code: subject.code,
        name: subject.name,
        head: 'OR',
        detail: `${result.practical.oral}/${subject.orMax ?? 25}`,
      })
    }
  }

  const requiredHeads = Number(subject.hasTh && subject.thCr > 0) + Number((subject.hasTW || subject.hasPR || subject.hasOR) && subject.practicalCr > 0)
  const completedHeads = Number(Boolean(result.theory)) + Number(Boolean(result.practical))
  result.completed = requiredHeads === completedHeads

  return result
}

export function calculateSemester(subjects, marksByCode = {}) {
  const subjectResults = subjects.map((subject) => computeSubjectResult(subject, marksByCode[subject.code] ?? {}))
  const creditSubjects = subjectResults.filter((result) => !result.nonCredit)
  const totalCredits = creditSubjects.reduce((sum, result) => sum + result.totalCredits, 0)
  const countedCredits = subjectResults.reduce((sum, result) => sum + result.creditsCounted, 0)
  const earnedCredits = subjectResults.reduce((sum, result) => sum + result.earnedCredits, 0)
  const creditPoints = subjectResults.reduce((sum, result) => sum + result.creditPoints, 0)
  const sgpa = countedCredits > 0 ? creditPoints / countedCredits : null
  const failures = subjectResults.flatMap((result) => result.failures)
  const completedSubjects = creditSubjects.filter((result) => result.completed).length

  return {
    subjectResults,
    totalCredits,
    countedCredits,
    earnedCredits,
    creditPoints,
    sgpa,
    failures,
    completedSubjects,
    totalSubjects: creditSubjects.length,
    gradeDistribution: getGradeDistribution(subjectResults),
    headAverages: getHeadAverages(subjectResults),
  }
}

export function getGradeDistribution(subjectResults) {
  const distribution = Object.fromEntries(GRADE_THRESHOLDS.map(({ grade }) => [grade, 0]))

  subjectResults.forEach((result) => {
    if (result.theory) distribution[result.theory.grade] += result.subject.thCr
    if (result.practical) distribution[result.practical.grade] += result.subject.practicalCr
  })

  return Object.entries(distribution)
    .filter(([, credits]) => credits > 0)
    .map(([grade, credits]) => ({ grade, credits }))
}

function weightedAverage(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (!totalWeight) return null
  return entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight
}

export function getHeadAverages(subjectResults) {
  const theoryEntries = []
  const practicalEntries = []

  subjectResults.forEach((result) => {
    if (result.theory) theoryEntries.push({ value: result.theory.pct, weight: result.subject.thCr })
    if (result.practical) practicalEntries.push({ value: result.practical.pct, weight: result.subject.practicalCr })
  })

  return {
    theory: weightedAverage(theoryEntries),
    practical: weightedAverage(practicalEntries),
  }
}

export function calculateSGPA(subjectResults) {
  const countedCredits = subjectResults.reduce((sum, result) => sum + result.creditsCounted, 0)
  const creditPoints = subjectResults.reduce((sum, result) => sum + result.creditPoints, 0)

  return {
    sgpa: countedCredits > 0 ? creditPoints / countedCredits : null,
    sumCP: creditPoints,
    sumC: countedCredits,
  }
}

export function sgpaRange(subjects, marksByCode, adjustment = 5) {
  const shift = (delta) => {
    const shiftedMarks = Object.fromEntries(
      Object.entries(marksByCode).map(([code, marks]) => [
        code,
        {
          ...marks,
          ese: toNumber(marks.ese) === null ? marks.ese : String(clamp((toNumber(marks.ese) ?? 0) + delta, 0, 60)),
        },
      ]),
    )

    return calculateSemester(subjects, shiftedMarks).sgpa
  }

  return {
    conservative: shift(-adjustment),
    optimistic: shift(adjustment),
  }
}

export function calculateRange(subjects, marksByCode, { eseDelta = 5 } = {}) {
  return sgpaRange(subjects, marksByCode, eseDelta)
}

export function targetESEMarks(ia) {
  const safeIA = Number.isFinite(ia) ? ia : 0

  return GRADE_THRESHOLDS.filter(({ grade }) => grade !== 'F').reduce((acc, { grade, min }) => {
    const gradeNeed = Math.ceil(min - safeIA)
    const needed = Math.max(24, gradeNeed)
    const iaPassing = safeIA >= 16

    acc[grade] = {
      needed,
      possible: iaPassing && needed <= 60,
      already: iaPassing && gradeNeed <= 0,
      neededDisplay: !iaPassing
        ? 'IA below 16'
        : gradeNeed <= 0
          ? 'Done'
          : needed > 60
            ? 'Not possible'
            : `${needed}/60`,
    }

    return acc
  }, {})
}

export function simulateTheoryESEChange(subject, marks = {}, nextEse) {
  const result = computeSubjectResult(subject, {
    ...marks,
    ese: nextEse,
  })

  return {
    subjectCode: subject.code,
    nextEse: clamp(toNumber(nextEse) ?? 0, 0, 60),
    theory: result.theory,
    result,
  }
}

export function simulateWhatIf(subjects, marksByCode = {}, { subjectCode, eseDelta = 0, customEse = null } = {}) {
  const subject = subjects.find((item) => item.code === subjectCode)
  if (!subject) return null

  const currentMarks = marksByCode[subject.code] ?? {}
  const nextEse = customEse === null || customEse === undefined ? (toNumber(currentMarks.ese) ?? 0) + eseDelta : customEse
  const nextMarks = {
    ...marksByCode,
    [subject.code]: {
      ...currentMarks,
      ese: String(clamp(toNumber(nextEse) ?? 0, 0, 60)),
    },
  }
  const before = calculateSemester(subjects, marksByCode)
  const after = calculateSemester(subjects, nextMarks)
  const subjectResult = computeSubjectResult(subject, nextMarks[subject.code])

  return {
    subject,
    subjectResult,
    newSubjectGrade: subjectResult.theory?.grade ?? subjectResult.practical?.grade ?? null,
    newSGPA: after.sgpa,
    sgpaDelta: before.sgpa === null || after.sgpa === null ? null : Number((after.sgpa - before.sgpa).toFixed(2)),
    marksByCode: nextMarks,
  }
}

export function rankSubjectImpacts(subjects, marksByCode = {}, deltas = [5, 10]) {
  const baseline = calculateSemester(subjects, marksByCode).sgpa ?? 0

  return subjects
    .filter((subject) => !subject.nonCredit && subject.hasTh && subject.thCr > 0)
    .map((subject) => {
      const marks = marksByCode[subject.code] ?? {}
      const currentEse = clamp(toNumber(marks.ese) ?? 0, 0, 60)
      const currentTheory = computeTheory({
        ise1: marks.ise1,
        ise2: marks.ise2,
        ise3: marks.ise3,
        importedIA: marks.importedIA,
        ese: marks.ese,
      })

      const impacts = Object.fromEntries(
        deltas.map((delta) => {
          const nextMarks = {
            ...marksByCode,
            [subject.code]: {
              ...marks,
              ese: String(clamp(currentEse + delta, 0, 60)),
            },
          }
          const sgpa = calculateSemester(subjects, nextMarks).sgpa

          return [
            `plus${delta}`,
            {
              sgpa,
              delta: sgpa === null || baseline === null ? null : Number((sgpa - baseline).toFixed(2)),
            },
          ]
        }),
      )

      return {
        subjectCode: subject.code,
        subjectName: subject.name,
        currentGrade: currentTheory.grade,
        currentEse,
        impacts,
      }
    })
    .sort((left, right) => (right.impacts.plus10?.delta ?? -Infinity) - (left.impacts.plus10?.delta ?? -Infinity))
}

export function rankSGPAImpacts(subjects, marksByCode = {}) {
  return rankSubjectImpacts(subjects, marksByCode)
}

export function calculateCGPA(semesterResults = []) {
  const usable = semesterResults.filter((result) => Number.isFinite(Number(result.sgpa)))
  if (!usable.length) return { cgpa: null, formula: 'none' }

  const weightedRows = usable.filter((result) => Number.isFinite(Number(result.totalCredits)) && Number(result.totalCredits) > 0)
  if (weightedRows.length === usable.length) {
    const totalCredits = weightedRows.reduce((sum, result) => sum + Number(result.totalCredits), 0)
    const weighted = weightedRows.reduce((sum, result) => sum + Number(result.sgpa) * Number(result.totalCredits), 0)
    return {
      cgpa: totalCredits ? weighted / totalCredits : null,
      formula: 'credit-weighted',
      totalCredits,
    }
  }

  return {
    cgpa: usable.reduce((sum, result) => sum + Number(result.sgpa), 0) / usable.length,
    formula: 'simple-average',
  }
}

export function neededSGPA(currentSGPA, targetCGPA, totalSems = 2, completedSems = 1) {
  const remainingSems = totalSems - completedSems
  if (remainingSems <= 0) return { perSem: null, possible: false }
  const needed = (targetCGPA * totalSems - currentSGPA * completedSems) / remainingSems

  return {
    perSem: Math.ceil(needed * 100) / 100,
    possible: needed <= 10,
  }
}

export function sgpaToPercentage(sgpa) {
  if (!Number.isFinite(sgpa)) return { low: null, high: null }

  return {
    low: +(7.1 * sgpa + 12).toFixed(2),
    high: +(7.4 * sgpa + 12).toFixed(2),
  }
}

export function classifySGPA(sgpa) {
  if (!Number.isFinite(sgpa)) return { label: 'No SGPA yet', tone: 'muted' }
  if (sgpa >= 9) return { label: 'Distinction+', tone: 'success' }
  if (sgpa >= 7.84) return { label: 'Distinction', tone: 'success' }
  if (sgpa >= 6.5) return { label: 'First Class', tone: 'info' }
  if (sgpa >= 5.5) return { label: 'Second Class', tone: 'warning' }
  if (sgpa >= 4) return { label: 'Pass', tone: 'warning' }
  return { label: 'Fail', tone: 'danger' }
}

export function subjectStatus(result) {
  if (result.failures.length) return 'ATKT Risk'
  const values = [result.theory?.pct, result.practical?.pct].filter(Number.isFinite)
  if (!values.length) return 'Pending'
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  if (average >= 80) return 'Excellent'
  if (average >= 70) return 'Strong'
  if (average >= 55) return 'Good'
  if (average >= 40) return 'Needs Work'
  return 'ATKT Risk'
}

export function hasAnyEnteredMarks(marksByCode = {}) {
  return Object.values(marksByCode).some((marks) => HEADS.some((head) => toNumber(marks?.[head]) !== null))
}
