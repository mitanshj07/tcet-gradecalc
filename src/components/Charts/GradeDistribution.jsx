import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import MeasuredChart from './MeasuredChart'

const colors = {
  O: '#10b981',
  A: '#38bdf8',
  B: '#8b5cf6',
  C: '#f59e0b',
  D: '#fb923c',
  E: '#f87171',
  P: '#94a3b8',
  F: '#ef4444',
}

export default function GradeDistribution({ data }) {
  if (!data.length) return <ChartEmpty label="No completed credits yet" />

  return (
    <div className="chart-card">
      <div className="mb-4">
        <p className="section-kicker">Credit-weighted</p>
        <h3 className="panel-title">Grade Distribution</h3>
      </div>
      <MeasuredChart height={256}>
        {({ width, height }) => (
          <PieChart width={width} height={height}>
            <Pie data={data} dataKey="credits" innerRadius={58} outerRadius={88} paddingAngle={3} nameKey="grade">
              {data.map((entry) => (
                <Cell key={entry.grade} fill={colors[entry.grade] ?? '#64748b'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff' }}
              formatter={(value) => [`${value} credits`, 'Credits']}
            />
          </PieChart>
        )}
      </MeasuredChart>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.map((item) => (
          <span key={item.grade} className="inline-flex items-center gap-2 text-xs text-slate-300">
            <span className="size-2 rounded-full" style={{ backgroundColor: colors[item.grade] }} />
            {item.grade}: {item.credits}
          </span>
        ))}
      </div>
    </div>
  )
}

function ChartEmpty({ label }) {
  return (
    <div className="chart-card flex min-h-72 items-center justify-center text-sm text-slate-400">
      {label}
    </div>
  )
}
