import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import MeasuredChart from './MeasuredChart'

export default function TheoryVsPractical({ averages }) {
  const data = [
    { head: 'Theory', percentage: averages.theory ?? 0 },
    { head: 'Practical', percentage: averages.practical ?? 0 },
  ]

  return (
    <div className="chart-card">
      <div className="mb-4">
        <p className="section-kicker">Head balance</p>
        <h3 className="panel-title">Theory vs Practical</h3>
      </div>
      <MeasuredChart height={256}>
        {({ width, height }) => (
          <BarChart data={data} height={height} margin={{ left: -18, right: 8, top: 8, bottom: 0 }} width={width}>
            <CartesianGrid stroke="rgba(148,163,184,.16)" vertical={false} />
            <XAxis axisLine={false} dataKey="head" tick={{ fill: '#cbd5e1', fontSize: 12 }} tickLine={false} />
            <YAxis axisLine={false} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff' }}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Average']}
            />
            <Bar dataKey="percentage" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </MeasuredChart>
    </div>
  )
}
