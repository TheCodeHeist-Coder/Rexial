import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from '../lib/format'
import type { QuizStatus, SessionStatus } from '../lib/types'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium text-ink-2">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  const dot = tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : tone === 'bad' ? 'bg-bad' : null
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs text-ink-3">
        {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
        {label}
      </div>
      <div className="tabular mt-1.5 text-2xl font-semibold">{typeof value === 'number' ? fmt.n(value) : value}</div>
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </div>
  )
}

const SESSION_STYLES: Record<SessionStatus | 'STALE', { label: string; cls: string }> = {
  WAITING: { label: 'Waiting', cls: 'text-sky-300 bg-sky-500/10 ring-sky-500/30' },
  IN_PROGRESS: { label: 'In progress', cls: 'text-green-300 bg-green-500/10 ring-green-500/30' },
  COMPLETED: { label: 'Completed', cls: 'text-ink-2 bg-white/5 ring-white/15' },
  CANCELLED: { label: 'Cancelled', cls: 'text-red-300 bg-red-500/10 ring-red-500/30' },
  STALE: { label: 'Abandoned', cls: 'text-amber-300 bg-amber-500/10 ring-amber-500/30' },
}

const QUIZ_STYLES: Record<QuizStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'text-ink-2 bg-white/5 ring-white/15' },
  ACTIVE: { label: 'Active', cls: 'text-green-300 bg-green-500/10 ring-green-500/30' },
  COMPLETED: { label: 'Completed', cls: 'text-sky-300 bg-sky-500/10 ring-sky-500/30' },
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>
}

export function SessionBadge({ status, stale }: { status: SessionStatus; stale?: boolean }) {
  return <Pill {...SESSION_STYLES[stale ? 'STALE' : status]} />
}

export function QuizBadge({ status }: { status: QuizStatus }) {
  return <Pill {...QUIZ_STYLES[status]} />
}

export function StatusCode({ code }: { code: number }) {
  const cls = code >= 500 ? 'text-red-300' : code >= 400 ? 'text-amber-300' : 'text-green-300'
  return <span className={`font-mono text-xs ${cls}`}>{code}</span>
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            {head.map((h, i) => (
              <th key={i} className="px-4 pb-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60 [&_td]:px-4 [&_td]:py-2.5">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-sm text-ink-3">Nothing here yet.</p>}
    </div>
  )
}

export function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-ink hover:text-accent">
      {children}
    </Link>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-3">
      <span className="tabular">
        {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {fmt.full(total)}
      </span>
      <div className="flex gap-2">
        <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

export function Button({ children, variant = 'default', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' }) {
  const cls =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-pink-500'
      : variant === 'danger'
        ? 'bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/30 hover:bg-red-500/20'
        : 'bg-panel-2 text-ink-2 ring-1 ring-inset ring-line hover:text-ink'
  return (
    <button {...props} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${cls} ${props.className ?? ''}`}>
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-panel-2 p-0.5 ring-1 ring-inset ring-line">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${value === o.value ? 'bg-white/10 text-ink' : 'text-ink-3 hover:text-ink-2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const RANGES = [
  { value: '1d', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '365d', label: '1y' },
]

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg bg-panel-2 px-3 py-1.5 text-sm text-ink ring-1 ring-inset ring-line placeholder:text-ink-3 focus:outline-none focus:ring-accent sm:w-72"
    />
  )
}

export function Loading() {
  return <div className="py-16 text-center text-sm text-ink-3">Loading…</div>
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 underline">
          Retry
        </button>
      )}
    </div>
  )
}

export function Meta({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-ink-3">{k}</dt>
          <dd className="mt-0.5 truncate">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
