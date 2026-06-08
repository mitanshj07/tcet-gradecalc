import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { calculateSemester, sgpaRange } from '../utils/grading'
import { getSemesterMeta } from '../utils/semesterData'

export function useSGPA() {
  const branch = useStore((state) => state.branch)
  const semester = useStore((state) => state.semester)
  const marks = useStore((state) => state.marks)

  return useMemo(() => {
    const meta = getSemesterMeta(branch, semester)
    const calculation = calculateSemester(meta.subjects, marks)
    const range = sgpaRange(meta.subjects, marks)

    return {
      ...meta,
      ...calculation,
      range,
    }
  }, [branch, marks, semester])
}
