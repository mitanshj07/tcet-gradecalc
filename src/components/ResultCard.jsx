import { useRef, useState } from 'react'
import { Copy, Download, FileText, Share2 } from 'lucide-react'
import { formatSGPA } from '../utils/format'
import { classifySGPA, sgpaToPercentage } from '../utils/grading'

export default function ResultCard({ summary, profile, branchLabel, semester }) {
  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const classification = classifySGPA(summary.sgpa)
  const percentage = sgpaToPercentage(summary.sgpa)

  async function renderCanvas() {
    if (!cardRef.current) return null
    const { default: html2canvas } = await import('html2canvas')
    return html2canvas(cardRef.current, {
      backgroundColor: '#0a0f1a',
      scale: 2,
    })
  }

  async function downloadCard() {
    if (!cardRef.current) return
    setDownloading(true)

    try {
      const canvas = await renderCanvas()
      if (!canvas) return
      const link = document.createElement('a')
      link.download = `tcet-gradecalc-sem-${semester}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  async function copyCard() {
    const canvas = await renderCanvas()
    if (!canvas || !navigator.clipboard || typeof ClipboardItem === 'undefined') return
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  }

  async function downloadPdf() {
    setExportingPdf(true)
    try {
      const canvas = await renderCanvas()
      if (!canvas) return
      const image = canvas.toDataURL('image/png')
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      })
      pdf.addImage(image, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`tcet-gradecalc-sem-${semester}.pdf`)
    } finally {
      setExportingPdf(false)
    }
  }

  async function shareWhatsApp() {
    const text = encodeURIComponent(`TCET GradeCalc ${branchLabel} Sem ${semester} SGPA: ${formatSGPA(summary.sgpa)}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="surface-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Share card</p>
          <h3 className="panel-title">Result Snapshot</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="secondary-button" onClick={downloadCard} disabled={!summary.sgpa || downloading}>
            <Download className="size-4" />
            {downloading ? 'Rendering' : 'PNG'}
          </button>
          <button type="button" className="secondary-button" onClick={downloadPdf} disabled={!summary.sgpa || exportingPdf}>
            <FileText className="size-4" />
            {exportingPdf ? 'Rendering' : 'PDF'}
          </button>
          <button type="button" className="secondary-button" onClick={copyCard} disabled={!summary.sgpa}>
            <Copy className="size-4" />
            Copy image
          </button>
          <button type="button" className="secondary-button" onClick={shareWhatsApp} disabled={!summary.sgpa}>
            <Share2 className="size-4" />
            WhatsApp
          </button>
        </div>
      </div>

      <div ref={cardRef} className="mt-4 rounded-xl border border-amber-400/25 bg-[#0a0f1a] p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-normal text-amber-300">TCET GradeCalc</p>
            <h4 className="mt-1 text-xl font-semibold">{profile.name || 'TCET Student'}</h4>
            <p className="mt-1 text-sm text-slate-300">
              {branchLabel} / Sem {semester}
            </p>
          </div>
          <span className={`status-pill status-${classification.tone}`}>{classification.label}</span>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <ShareMetric label="SGPA" value={formatSGPA(summary.sgpa)} />
          <ShareMetric label="Credits" value={`${summary.earnedCredits}/${summary.totalCredits}`} />
          <ShareMetric label="Percent" value={percentage.low === null ? '--' : `${percentage.low}%`} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {summary.gradeDistribution.length ? (
            summary.gradeDistribution.map((item) => (
              <span key={item.grade} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs">
                {item.grade}: {item.credits} cr
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">No completed credits yet</span>
          )}
        </div>

        <p className="mt-5 text-xs text-slate-400">Generated by TCET GradeCalc. Unofficial unless marked as official and locked.</p>
      </div>
    </section>
  )
}

function ShareMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  )
}
