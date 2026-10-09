import { useParams } from 'react-router-dom'
import { useApi } from '../lib/api'
import { fmt } from '../lib/format'
import type { UserDetail as Detail } from '../lib/types'
import { Card, ErrorBox, Loading, Meta, PageHeader, QuizBadge, RowLink, SessionBadge, Stat, StatusCode, Table } from '../components/ui'

export default function UserDetail() {
  const { id } = useParams()
  const { data, error, reload } = useApi<Detail>(`/users/${id}`)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data) return <Loading />

  const { stats } = data

  return (
    <>
      <PageHeader title={data.name} subtitle={data.email} />

      <Card>
        <Meta
          items={[
            ['Signed up', fmt.dateTime(data.createdAt)],
            ['Last login', fmt.dateTime(data.lastLoginAt)],
            ['Last API call', fmt.ago(data.recentRequests[0]?.createdAt)],
            ['User ID', <span className="font-mono text-xs">{data.id}</span>],
          ]}
        />
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Quizzes created" value={stats.quizzesCreated} />
        <Stat label="Quizzes played" value={stats.quizzesPlayed} />
        <Stat label="Total score" value={stats.totalScore} />
        <Stat label="Answers" value={stats.answered} />
        <Stat label="Accuracy" value={stats.answered ? fmt.pct(stats.correct / stats.answered) : '—'} />
        <Stat label="API calls (30d)" value={stats.requests30d} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Quizzes created">
          <Table head={['Quiz', 'Status', 'Questions', 'Sessions', 'Created']} empty={!data.quizzes.length}>
            {data.quizzes.map((q) => (
              <tr key={q.id}>
                <td><RowLink to={`/quizzes/${q.id}`}>{q.title}</RowLink></td>
                <td><QuizBadge status={q.status} /></td>
                <td className="tabular text-ink-2">{q.questions}</td>
                <td className="tabular text-ink-2">{q.sessions}</td>
                <td className="text-ink-3">{fmt.date(q.createdAt)}</td>
              </tr>
            ))}
          </Table>
          {data.coOrganizing.length > 0 && (
            <p className="mt-4 text-xs text-ink-3">
              Co-organizer of:{' '}
              {data.coOrganizing.map((q, i) => (
                <span key={q.id}>
                  {i > 0 && ', '}
                  <RowLink to={`/quizzes/${q.id}`}>{q.title}</RowLink>
                  {q.inviteStatus === 'PENDING' && ' (pending)'}
                </span>
              ))}
            </p>
          )}
        </Card>
        <Card title="Quizzes played">
          <Table head={['Quiz', 'Played as', 'Score', 'Answered', 'Session', 'Joined']} empty={!data.participations.length}>
            {data.participations.map((p) => (
              <tr key={p.id}>
                <td><RowLink to={`/sessions/${p.sessionId}`}>{p.quiz.title}</RowLink></td>
                <td className="text-ink-2">{p.username}</td>
                <td className="tabular">{fmt.full(p.score)}</td>
                <td className="tabular text-ink-2">{p.answered}</td>
                <td><SessionBadge status={p.sessionStatus} /></td>
                <td className="text-ink-3">{fmt.date(p.joinedAt)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Devices & IPs">
          <Table head={['IP', 'Client', 'Requests', 'Last seen']} empty={!data.devices.length}>
            {data.devices.map((d, i) => (
              <tr key={i}>
                <td className="font-mono text-xs">{d.ip ?? '—'}</td>
                <td className="max-w-64 truncate text-xs text-ink-3" title={d.userAgent ?? ''}>{d.userAgent ?? '—'}</td>
                <td className="tabular text-ink-2">{fmt.full(d.requests)}</td>
                <td className="text-ink-3">{fmt.ago(d.lastSeen)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Recent API activity">
          <Table head={['Time', 'Request', 'Status', 'Latency']} empty={!data.recentRequests.length}>
            {data.recentRequests.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-ink-3">{fmt.dateTime(r.createdAt)}</td>
                <td className="font-mono text-xs"><span className="text-ink-3">{r.method}</span> {r.path}</td>
                <td><StatusCode code={r.statusCode} /></td>
                <td className="tabular text-ink-2">{fmt.ms(r.durationMs)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  )
}
