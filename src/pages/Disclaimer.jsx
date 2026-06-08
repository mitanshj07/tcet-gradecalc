export default function Disclaimer() {
  return (
    <section className="surface-panel mx-auto max-w-3xl p-6">
      <p className="section-kicker">Disclaimer</p>
      <h1 className="text-3xl font-semibold text-white">Not an official TCET system</h1>
      <div className="mt-4 space-y-3 text-sm text-slate-300">
        <p>TCET GradeCalc is an unofficial calculator built to help students estimate and organize results.</p>
        <p>Leaderboard values are not official TCET rankings. They only include users who opted in.</p>
        <p>Always cross-check official gazettes, marksheets, and institute notices before relying on any imported or calculated value.</p>
      </div>
    </section>
  )
}
