export function maskName(name = '') {
  const cleaned = name.trim()
  if (!cleaned) return 'Anonymous'

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.length <= 1 ? part : `${part[0]}${'*'.repeat(Math.max(2, part.length - 1))}`))
    .join(' ')
}
