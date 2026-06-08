import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '../store/useStore'
import { computeIA, targetESEMarks } from '../utils/grading'

export default function TargetCalculator({ subjects }) {
  const marks = useStore((state) => state.marks)
  const theorySubjects = useMemo(() => subjects.filter((subject) => subject.hasTh && subject.thCr > 0), [subjects])
  const [selectedCode, setSelectedCode] = useState(theorySubjects[0]?.code ?? '')
  const selectedSubject = theorySubjects.find((subject) => subject.code === selectedCode) ?? theorySubjects[0]
  const selectedMarks = marks[selectedSubject?.code] ?? {}
  const ia = computeIA(selectedMarks.ise1, selectedMarks.ise2, selectedMarks.ise3, selectedMarks.importedIA)
  const targets = targetESEMarks(ia)

  if (!selectedSubject) return null

  return (
    <section className="surface-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Target Calculator</p>
          <h3 className="panel-title">ESE needed by grade</h3>
        </div>
        <Target className="size-5 text-amber-300" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label>
          <span className="input-label">Subject</span>
          <select className="select-input" value={selectedSubject.code} onChange={(event) => setSelectedCode(event.target.value)}>
            {theorySubjects.map((subject) => (
              <option key={subject.code} value={subject.code}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3">
          <span className="text-xs uppercase tracking-normal text-slate-400">Current IA</span>
          <p className="font-mono text-xl font-semibold text-white">{ia}/40</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
        <table className="data-table">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Target</th>
              <th>Needed ESE</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(targets).map(([grade, target]) => (
              <tr key={grade}>
                <td className="font-mono font-semibold text-white">{grade}</td>
                <td>{gradeTargetLabel(grade)}</td>
                <td>
                  <span className={target.already ? 'text-amber-200' : target.possible ? 'text-emerald-200' : 'text-red-200'}>
                    {target.neededDisplay}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function gradeTargetLabel(grade) {
  const targets = { O: '80%+', A: '75%+', B: '70%+', C: '60%+', D: '50%+', E: '45%+', P: '40%+' }
  return targets[grade] ?? '--'
}
