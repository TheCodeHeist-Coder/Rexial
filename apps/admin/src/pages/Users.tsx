import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiDownload, useApi } from '../lib/api'
import { fmt } from '../lib/format'
import type { Paged, UserRow } from '../lib/types'
import { useDebounced } from '../lib/useDebounced'
import { Button, Card, ErrorBox, Loading, PageHeader, Pagination, RowLink, SearchInput, Segmented, Table } from '../components/ui'

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'lastLogin', label: 'Last login' },
  { value: 'name', label: 'Name' },
  { value: 'oldest', label: 'Oldest' },
]

export default function Users() {
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') ?? 'newest'
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [exporting, setExporting] = useState(false)

  const qs = new URLSearchParams({ page: String(page), sort })
  if (q) qs.set('search', q)
  const { data, error, loading, reload } = useApi<Paged<UserRow>>(`/users?${qs}`)

  const update = (next: Record<string, string>) => setParams({ sort, page: '1', ...next })

  const exportCsv = async () => {
    setExporting(true)
    try {
      await apiDownload(`/users/export.csv${q ? `?search=${encodeURIComponent(q)}` : ''}`, `rexial-users-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone with an account. Guests who join by code without signing in appear only under their sessions."
        actions={<Button onClick={exportCsv} disabled={exporting}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>}
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented value={sort} options={SORTS} onChange={(v) => update({ sort: v })} />
          <SearchInput value={search} onChange={(v) => { setSearch(v); if (page !== 1) update({}) }} placeholder="Name or email" />
        </div>
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && (
          <>
            <Table head={['Name', 'Email', 'Signed up', 'Last login', 'Last active', 'Created', 'Played', 'Total score']} empty={!data.items.length}>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td><RowLink to={`/users/${u.id}`}>{u.name}</RowLink></td>
                  <td className="text-ink-2">{u.email}</td>
                  <td className="text-ink-3">{fmt.date(u.createdAt)}</td>
                  <td className="text-ink-3">{fmt.ago(u.lastLoginAt)}</td>
                  <td className="text-ink-3">{fmt.ago(u.lastSeenAt)}</td>
                  <td className="tabular text-ink-2">{u.quizzesCreated}</td>
                  <td className="tabular text-ink-2">{u.quizzesPlayed}</td>
                  <td className="tabular">{fmt.full(u.totalScore)}</td>
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
