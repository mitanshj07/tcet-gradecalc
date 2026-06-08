import { Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import MeasuredChart from './MeasuredChart'

export default function CGPATracker({ history }) {
  const data = [...history]
    .reverse()
    .map((item, index) => ({
      label: `S${item.semester} #${index + 1}`,
      sgpa: item.sgpa,
    }))

  if (!data.length) {
    return <div className="chart-card flex min-h-56 items-center justify-center text-sm text-slate-400">No saved snapshots yet</div>
  }

  return (
    <div className="chart-card">
      <div className="mb-4">
        <p className="section-kicker">Saved snapshots</p>
        <h3 className="panel-title">CGPA Tracker</h3>
      </div>
      <MeasuredChart height={224}>
        {({ width, height }) => (
          <LineChart data={data} height={height} margin={{ left: -18, right: 16, top: 8, bottom: 0 }} width={width}>
            <XAxis axisLine={false} dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} />
            <YAxis axisLine={false} domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff' }}
              formatter={(value) => [Number(value).toFixed(2), 'SGPA']}
            />
            <Line dataKey="sgpa" dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }} stroke="#f59e0b" strokeWidth={3} type="monotone" />
          </LineChart>
        )}
      </MeasuredChart>
    </div>
  )
}
