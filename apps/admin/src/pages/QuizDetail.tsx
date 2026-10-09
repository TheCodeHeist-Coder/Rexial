import { useParams } from 'react-router-dom'
import { useApi } from '../lib/api'
import { fmt, sessionDuration } from '../lib/format'
import type { QuizDetail as Detail } from '../lib/types'
import { Card, ErrorBox, Loading, Meta, PageHeader, QuizBadge, RowLink, SessionBadge, Stat, Table } from '../components/ui'
import { QuestionTable } from '../components/QuestionTable'

export default function QuizDetail() {
  const { id } = useParams()
  const { data, error, reload } = useApi<Detail>(`/quizzes/${id}`)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data) return <Loading />

  const answered = data.questions.reduce((s, q) => s + q.answered, 0)
  const correct = data.questions.reduce((s, q) => s + q.correct, 0)
  const completed = data.sessions.filter((s) => s.status === 'COMPLETED').length

  return (
    <>
      <PageHeader title={data.title} subtitle={data.description} actions={<QuizBadge status={data.status} />} />

      <Card>
        <Meta
          items={[
            ['Creator', <RowLink to={`/users/${data.creator.id}`}>{data.creator.name}</RowLink>],
            ['Creator email', data.creator.email],
            ['Join code', data.joinCode ? <span className="font-mono">{data.joinCode}</span> : '—'],
            ['Created', fmt.dateTime(data.createdAt)],
            ['Last edited', fmt.dateTime(data.updatedAt)],
            ['Quiz ID', <span className="font-mono text-xs">{data.id}</span>],
          ]}
        />
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Questions" value={data.questions.length} />
        <Stat label="Sessions" value={data.sessions.length} hint={`${completed} completed`} />
        <Stat label="Total participants" value={data.totalParticipants} />
        <Stat label="Answer accuracy" value={answered ? fmt.pct(correct / answered) : '—'} hint={`${fmt.full(answered)} answers`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Sessions" className="lg:col-span-2">
          <Table head={['Session', 'Status', 'Players', 'Created', 'Duration']} empty={!data.sessions.length}>
            {data.sessions.map((s) => (
              <tr key={s.id}>
                <td><RowLink to={`/sessions/${s.id}`}><span className="font-mono text-xs">{s.id.slice(0, 8)}</span></RowLink></td>
                <td><SessionBadge status={s.status} stale={s.stale} /></td>
                <td className="tabular">{s.participants}</td>
                <td className="text-ink-3">{fmt.dateTime(s.createdAt)}</td>
                <td className="tabular text-ink-2">{sessionDuration(s)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Organizers">
          <ul className="divide-y divide-line/60">
            {data.organizers.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  {o.user ? <RowLink to={`/users/${o.user.id}`}>{o.user.name}</RowLink> : <span className="text-ink-2">Invited</span>}
                  <div className="truncate text-xs text-ink-3">{o.user?.email ?? o.inviteEmail}</div>
                </div>
                <span className="shrink-0 text-xs text-ink-3">
                  {o.role === 'OWNER' ? 'Owner' : 'Co-organizer'}
                  {o.inviteStatus === 'PENDING' && ' · pending'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Questions (all sessions combined)" className="mt-4">
        <QuestionTable questions={data.questions} />
      </Card>
    </>
  )
}
