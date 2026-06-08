import { BRANCHES, SUBJECT_CATALOG, getBranch, getResolvedCycle, getRawSubjects } from '../data/semesterData'

function adaptSubject(subject) {
  return {
    ...subject,
    thCr: subject.theoryCredits,
    practicalCr: subject.practicalCredits,
    twCr: subject.hasTW ? subject.practicalCredits : 0,
    prCr: subject.hasPR || subject.hasOR ? subject.practicalCredits : 0,
    twMax: subject.maxMarks.tw,
    prMax: subject.maxMarks.pr,
    orMax: subject.maxMarks.or,
    hasTh: subject.hasTheory,
    hasOR: subject.hasOR,
    twOnly: subject.isTWOnly,
    nonCredit: subject.isNonCredit,
    special: subject.maxMarks.tw !== 25 || subject.maxMarks.pr !== 25,
  }
}

export { BRANCHES, SUBJECT_CATALOG, getBranch }

export function getSemesterMeta(branchId, semester) {
  const branch = getBranch(branchId)
  const semesterNum = Number(semester)
  const cycle = getResolvedCycle(branchId, semesterNum)
  const rawSubjects = getRawSubjects(branchId, semesterNum)
  const subjects = rawSubjects.map(adaptSubject)
  const totalCredits = subjects.reduce((sum, s) => s.nonCredit ? sum : sum + s.thCr + s.practicalCr, 0)
  const cycleLabel = cycle === 'physics' ? 'Physics' : 'Chemistry'

  return {
    branch,
    semester: semesterNum,
    cycle,
    subjects,
    rawSubjects,
    totalCredits,
    note: `${branch.label} · Semester ${semesterNum === 1 ? 'I' : 'II'} · ${cycleLabel} Cycle · ${totalCredits} credits · Source: old GitHub calculator / index.html`,
  }
}

export function getSubjectsForSemester(branchId, semester) {
  return getSemesterMeta(branchId, semester).subjects
}

export function getRawSubjectRows(branchId, semester) {
  return getSemesterMeta(branchId, semester).rawSubjects
}

export function getTotalCredits(subjects) {
  return subjects.reduce((total, subject) => {
    if (subject.nonCredit) return total
    return total + (subject.thCr ?? 0) + (subject.practicalCr ?? 0)
  }, 0)
}
