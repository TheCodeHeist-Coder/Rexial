import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiPost, useApi } from '../lib/api'
import { fmt, sessionDuration } from '../lib/format'
import type { Paged, SessionListRow } from '../lib/types'
import { Button, Card, ErrorBox, Loading, PageHeader, Pagination, RowLink, SearchInput, Segmented, SessionBadge, Table } from '../components/ui'
import { useDebounced } from '../lib/useDebounced'

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'LIVE', label: 'Live' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'STALE', label: 'Abandoned' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function Sessions() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'ALL'
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [busy, setBusy] = useState<string | null>(null)

  const qs = new URLSearchParams({ page: String(page) })
  if (status !== 'ALL') qs.set('status', status)
  if (q) qs.set('search', q)
  const { data, error, loading, reload } = useApi<Paged<SessionListRow>>(`/sessions?${qs}`)

  const update = (next: Record<string, string>) => setParams({ status, page: '1', ...next })

  const cancel = async (s: SessionListRow) => {
    if (!confirm(`Cancel the abandoned session of "${s.quiz.title}"? Its quiz goes back to draft so the host can relaunch it.`)) return
    setBusy(s.id)
    try {
      await apiPost(`/sessions/${s.id}/cancel`)
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Quiz sessions" subtitle="Every time a quiz was hosted: who ran it, how many joined, and how it ended." />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented value={status} options={FILTERS} onChange={(v) => update({ status: v })} />
          <SearchInput value={search} onChange={(v) => { setSearch(v); if (page !== 1) update({}) }} placeholder="Search by quiz title" />
        </div>
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && (
          <>
            <Table head={['Quiz', 'Host', 'Status', 'Players', 'Progress', 'Created', 'Duration', '']} empty={!data.items.length}>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td><RowLink to={`/sessions/${s.id}`}>{s.quiz.title}</RowLink></td>
                  <td><RowLink to={`/users/${s.host.id}`}><span className="font-normal text-ink-2">{s.host.name}</span></RowLink></td>
                  <td><SessionBadge status={s.status} stale={s.stale} /></td>
                  <td className="tabular">{s.participants}</td>
                  <td className="tabular text-ink-2">
                    {s.status === 'COMPLETED' ? `${s.totalQuestions} / ${s.totalQuestions}` : s.startedAt ? `${s.currentQuestion + 1} / ${s.totalQuestions}` : 'Lobby'}
                  </td>
                  <td className="text-ink-3">{fmt.dateTime(s.createdAt)}</td>
                  <td className="tabular text-ink-2">{sessionDuration(s)}</td>
                  <td className="text-right">
                    {s.stale && (
                      <Button variant="danger" disabled={busy === s.id} onClick={() => cancel(s)}>
                        {busy === s.id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </Card>
    </>
  )
}
