import { AlertTriangle, CheckCircle2, Save } from 'lucide-react'
import { classifySGPA, sgpaToPercentage } from '../utils/grading'
import { formatSGPA } from '../utils/format'

export default function SGPADisplay({ summary, onSave }) {
  const classification = classifySGPA(summary.sgpa)
  const percentage = sgpaToPercentage(summary.sgpa)

  return (
    <aside className="surface-panel sticky top-24 space-y-4 p-4">
      <div>
        <p className="section-kicker">Live SGPA</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="font-mono text-5xl font-semibold text-white">{formatSGPA(summary.sgpa)}</p>
          <span className={`status-pill status-${classification.tone}`}>{classification.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Conservative" value={formatSGPA(summary.range.conservative)} />
        <Metric label="Optimistic" value={formatSGPA(summary.range.optimistic)} />
        <Metric label="Credits Counted" value={`${summary.countedCredits}/${summary.totalCredits}`} />
        <Metric label="Subjects Entered" value={`${summary.completedSubjects}/${summary.totalSubjects}`} />
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-950/45 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-300">Percentage band</span>
          <span className="font-mono text-sm text-white">
            {percentage.low === null ? '--' : `${percentage.low}% - ${percentage.high}%`}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-amber-400"
            style={{ width: `${Math.min(100, ((summary.sgpa ?? 0) / 10) * 100)}%` }}
          />
        </div>
      </div>

      <div className={`rounded-lg border p-3 ${summary.failures.length ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
        <div className="flex items-start gap-2">
          {summary.failures.length ? (
            <AlertTriangle className="mt-0.5 size-4 text-red-300" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 text-emerald-300" />
          )}
          <div>
            <p className="text-sm font-semibold text-white">{summary.failures.length ? 'ATKT heads detected' : 'No completed head is failing'}</p>
            <p className="mt-1 text-xs text-slate-300">
              {summary.failures.length
                ? `${summary.failures.length} head${summary.failures.length > 1 ? 's' : ''} need attention.`
                : 'Blank heads stay outside SGPA until completed.'}
            </p>
          </div>
        </div>
      </div>

      <button type="button" className="primary-button w-full" onClick={onSave} disabled={!summary.sgpa}>
        <Save className="size-4" />
        Save snapshot
      </button>
    </aside>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
