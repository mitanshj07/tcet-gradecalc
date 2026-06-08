import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="surface-panel mx-auto max-w-2xl p-8 text-center">
      <p className="section-kicker">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Page not found</h1>
      <p className="mt-3 text-sm text-slate-300">This route is not part of TCET GradeCalc.</p>
      <Link className="primary-button mt-6" to="/calculator">
        Back to Calculator
      </Link>
    </section>
  )
}
