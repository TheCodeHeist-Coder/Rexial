const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('en')

export const fmt = {
  n: (v: number) => (Math.abs(v) >= 10_000 ? compact.format(v) : full.format(Math.round(v))),
  full: (v: number) => full.format(v),
  pct: (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`,
  ms: (v: number | null | undefined) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`),
  duration(seconds: number) {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return m ? `${m}m ${s}s` : `${s}s`
  },
  date: (v: string | null | undefined) =>
    v ? new Date(v).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
  dateTime: (v: string | null | undefined) =>
    v
      ? new Date(v).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '—',
  ago(v: string | null | undefined) {
    if (!v) return 'never'
    const s = (Date.now() - new Date(v).getTime()) / 1000
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
    return fmt.date(v)
  },
}

export function sessionDuration(s: { startedAt: string | null; endedAt: string | null }) {
  if (!s.startedAt || !s.endedAt) return '—'
  return fmt.duration((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000)
}
