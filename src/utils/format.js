// Format minutes as human-friendly hours/minutes, e.g. 80 -> '1 hr 20 mins'
export function formatMinutes(mins) {
  const m = Math.max(0, Math.round(mins))
  const h = Math.floor(m / 60)
  const r = m % 60
  const parts = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hr' : 'hrs'}`)
  if (r > 0 || h === 0) parts.push(`${r} ${r === 1 ? 'min' : 'mins'}`)
  return parts.join(' ')
}

export default { formatMinutes }
