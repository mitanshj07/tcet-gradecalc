import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, RotateCcw } from 'lucide-react'
import GazettePDFUpload from '../components/GazettePDFUpload'
import SGPADisplay from '../components/SGPADisplay'
import SubjectCard from '../components/SubjectCard'
import { useSGPA } from '../hooks/useSGPA'
import { useStore } from '../store/useStore'

export default function Calculator() {
  const navigate = useNavigate()
  const summary = useSGPA()
  const semester = useStore((state) => state.semester)
  const setSemester = useStore((state) => state.setSemester)
  const resetMarks = useStore((state) => state.resetMarks)
  const saveCurrentResult = useStore((state) => state.saveCurrentResult)
  const [saveError, setSaveError] = useState('')

  async function saveSnapshot() {
    setSaveError('')

    try {
      const saved = await saveCurrentResult()
      if (saved) navigate('/profile')
    } catch (error) {
      setSaveError(error.message ?? 'Could not save this snapshot right now.')
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="space-y-5">
        <div className="page-heading">
          <div>
            <p className="section-kicker">{summary.branch.label} / {summary.cycle === 'chemistry' ? 'Chemistry Cycle' : summary.cycle === 'physics' ? 'Physics Cycle' : 'Sem II'}</p>
            <h1>Calculator Dashboard</h1>
            <p>{summary.note}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2].map((item) => (
              <button
                key={item}
                type="button"
                className={`segmented-button ${semester === item ? 'segmented-button-active' : ''}`}
                onClick={() => setSemester(item)}
              >
                Sem {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 p-3">
          <div className="text-sm text-slate-300">
            Completed subjects are counted live. Incomplete credit heads stay pending.
          </div>
          <div className="flex gap-2">
            <button type="button" className="ghost-button" onClick={resetMarks}>
              <RotateCcw className="size-4" />
              Reset
            </button>
            <button type="button" className="primary-button" onClick={() => navigate('/analysis')}>
              <BarChart3 className="size-4" />
              Generate Analysis
            </button>
          </div>
        </div>
        {saveError && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{saveError}</div>}

        <GazettePDFUpload branch={summary.branch.id} semester={summary.semester} />

        <div className="space-y-3">
          {summary.subjects.map((subject, index) => (
            <SubjectCard key={subject.code} subject={subject} initiallyOpen={index < 2 && !subject.nonCredit} />
          ))}
        </div>
      </section>

      <SGPADisplay summary={summary} onSave={saveSnapshot} />
    </div>
  )
}
