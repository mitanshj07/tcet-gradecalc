export function scoreWarnings(warnings = []) {
  return warnings.reduce((score, warning) => {
    if (/mismatch|could not|empty|scanned/i.test(warning)) return score - 0.2
    if (/missing|review|manual/i.test(warning)) return score - 0.1
    return score - 0.05
  }, 1)
}

export function getFieldConfidence({ found = false, exact = false, warnings = [] } = {}) {
  if (!found) return 0
  const base = exact ? 0.95 : 0.75
  return Math.max(0, Math.min(1, base + scoreWarnings(warnings) - 1))
}

export function combineConfidence(parts = []) {
  const filtered = parts.filter((value) => Number.isFinite(value))
  if (!filtered.length) return 0
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(2))
}
