import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../lib/api'
import { fmt } from '../lib/format'
import type { Paged, QuizRow } from '../lib/types'
import { useDebounced } from '../lib/useDebounced'
import { Card, ErrorBox, Loading, PageHeader, Pagination, QuizBadge, RowLink, SearchInput, Segmented, Table } from '../components/ui'

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
]

export default function Quizzes() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'ALL'
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState('')
  const q = useDebounced(search)

  const qs = new URLSearchParams({ page: String(page) })
  if (status !== 'ALL') qs.set('status', status)
  if (q) qs.set('search', q)
  const { data, error, loading, reload } = useApi<Paged<QuizRow>>(`/quizzes?${qs}`)

  const update = (next: Record<string, string>) => setParams({ status, page: '1', ...next })

  return (
    <>
      <PageHeader title="Quizzes" subtitle="Every quiz created on the platform, with its creator and how often it was played." />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented value={status} options={FILTERS} onChange={(v) => update({ status: v })} />
          <SearchInput value={search} onChange={(v) => { setSearch(v); if (page !== 1) update({}) }} placeholder="Title, join code or creator" />
        </div>
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && (
          <>
            <Table head={['Quiz', 'Creator', 'Status', 'Questions', 'Sessions', 'Participants', 'Last played', 'Created']} empty={!data.items.length}>
              {data.items.map((quiz) => (
                <tr key={quiz.id}>
                  <td>
                    <RowLink to={`/quizzes/${quiz.id}`}>{quiz.title}</RowLink>
                    {quiz.joinCode && <span className="ml-2 font-mono text-xs text-ink-3">{quiz.joinCode}</span>}
                  </td>
                  <td>
                    <RowLink to={`/users/${quiz.creator.id}`}><span className="font-normal text-ink-2">{quiz.creator.name}</span></RowLink>
                  </td>
                  <td><QuizBadge status={quiz.status} /></td>
                  <td className="tabular text-ink-2">{quiz.questions}</td>
                  <td className="tabular text-ink-2">{quiz.sessions}</td>
                  <td className="tabular">{fmt.full(quiz.participants)}</td>
                  <td className="text-ink-3">{fmt.ago(quiz.lastPlayed)}</td>
                  <td className="text-ink-3">{fmt.date(quiz.createdAt)}</td>
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
