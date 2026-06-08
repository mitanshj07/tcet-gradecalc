const gradeStyles = {
  O: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  A: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  B: 'border-violet-400/40 bg-violet-400/15 text-violet-200',
  C: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
  D: 'border-orange-400/40 bg-orange-400/15 text-orange-200',
  E: 'border-red-400/40 bg-red-400/15 text-red-200',
  P: 'border-zinc-400/40 bg-zinc-400/15 text-zinc-200',
  F: 'border-red-500/50 bg-red-500/15 text-red-200',
}

export default function GradePill({ grade, label, className = '' }) {
  const displayGrade = grade ?? '-'

  return (
    <span
      className={`inline-flex h-7 items-center rounded-lg border px-2.5 font-mono text-xs font-semibold ${gradeStyles[displayGrade] ?? 'border-white/10 bg-white/5 text-slate-300'} ${className}`}
    >
      {label ?? displayGrade}
    </span>
  )
}
