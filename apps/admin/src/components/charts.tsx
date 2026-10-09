import { useLayoutEffect, useRef, useState } from 'react'
import { fmt } from '../lib/format'

function niceMax(v: number) {
  if (v <= 0) return 4
  const mag = 10 ** Math.floor(Math.log10(v))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag * 4 >= v)! * mag
  return step * 4
}

function bucketLabel(bucket: string, unit: 'hour' | 'day', long = false) {
  const d = new Date(bucket)
  if (unit === 'hour') return d.toLocaleTimeString('en', { hour: '2-digit', minute: long ? '2-digit' : undefined, timeZone: 'UTC' }) + (long ? ' UTC' : '')
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// Charts draw at their real pixel width so axis text stays 11px whatever
// the card size, instead of scaling with a fixed viewBox.
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

// Single-series column chart over time. The title outside names the series,
// so there is no legend; values live in the hover tooltip and the y-axis.
export function ColumnChart({
  data,
  unit,
  format = fmt.n,
  height = 180,
}: {
  data: { bucket: string; value: number }[]
  unit: 'hour' | 'day'
  format?: (v: number) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, measured] = useWidth<HTMLDivElement>()
  const W = measured || 600
  const H = height
  const pad = { l: 40, r: 8, t: 10, b: 24 }
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const slot = (W - pad.l - pad.r) / Math.max(1, data.length)
  const barW = Math.max(2, Math.min(24, slot - 2))
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const ticks = [0, 0.5, 1].map((f) => max * f)
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(W / 80)))
  const h = hover === null ? null : data[hover]
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div ref={ref} className="relative w-full overflow-hidden">
      <svg width={W} height={H} className="block" role="img" aria-label={`Total ${fmt.full(total)}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-3)" className="tabular">
              {fmt.n(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * slot + (slot - barW) / 2
          const top = y(d.value)
          const bh = H - pad.b - top
          const r = Math.min(4, barW / 2, bh)
          return (
            <g key={d.bucket} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${H - pad.b} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${H - pad.b} Z`}
                  fill="var(--color-series)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={pad.l + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)">
                  {bucketLabel(d.bucket, unit)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: Math.min(W - 60, Math.max(60, pad.l + hover * slot + slot / 2)) }}
        >
          <div className="text-ink-3">{bucketLabel(h.bucket, unit, true)}</div>
          <div className="tabular font-semibold text-ink">{format(h.value)}</div>
        </div>
      )}
    </div>
  )
}

// Ranked horizontal bars: label, bar, value. Used for "top N" lists.
export function BarList({ items, format = fmt.n }: { items: { label: string; value: number; sub?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-3">No data yet.</p>
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="text-sm" title={`${item.label}: ${fmt.full(item.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-ink-2">{item.label}</span>
            <span className="tabular shrink-0 text-ink">
              {format(item.value)}
              {item.sub && <span className="ml-1.5 text-xs text-ink-3">{item.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5">
            <div className="h-1.5 rounded-full bg-series" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Part-to-whole bar with a legend underneath. Colors are passed as status
// classes because the parts are states (live, done, cancelled), not series.
export function SegmentBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/5">
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <div key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${fmt.full(p.value)}`} />
            ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-ink-2">
              <span className={`size-2 rounded-sm ${p.color}`} />
              {p.label}
            </span>
            <span className="tabular text-ink">
              {fmt.full(p.value)}
              <span className="ml-1.5 text-xs text-ink-3">{total ? fmt.pct(p.value / total) : '—'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
