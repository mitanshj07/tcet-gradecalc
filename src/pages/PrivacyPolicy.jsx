export default function PrivacyPolicy() {
  return (
    <section className="surface-panel mx-auto max-w-3xl p-6">
      <p className="section-kicker">Privacy</p>
      <h1 className="text-3xl font-semibold text-white">Privacy policy</h1>
      <div className="mt-4 space-y-3 text-sm text-slate-300">
        <p>Your marks stay in this browser unless you sign in and explicitly save structured result data.</p>
        <p>Uploaded gazette/result PDFs are parsed client-side in your browser. Raw PDF files are not uploaded by default.</p>
        <p>Only confirmed structured fields such as profile info, semester summaries, and subject marks are sent to Supabase.</p>
        <p>Leaderboard entries are opt-in. Raw marks, roll numbers, and email addresses are not shown publicly.</p>
      </div>
    </section>
  )
}
