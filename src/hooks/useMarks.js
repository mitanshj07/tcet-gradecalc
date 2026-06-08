import { useStore } from '../store/useStore'

const EMPTY_MARKS = {}

export function useMarks(subjectCode) {
  const marks = useStore((state) => state.marks[subjectCode] ?? EMPTY_MARKS)
  const updateMark = useStore((state) => state.updateMark)
  const clearSubject = useStore((state) => state.clearSubject)

  return {
    marks,
    updateMark: (key, value) => updateMark(subjectCode, key, value),
    clearSubject: () => clearSubject(subjectCode),
  }
}
