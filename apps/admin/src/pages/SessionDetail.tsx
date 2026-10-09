import { useParams } from 'react-router-dom'
import { useApi } from '../lib/api'
import { fmt, sessionDuration } from '../lib/format'
import type { SessionDetail as Detail } from '../lib/types'
import { Card, ErrorBox, Loading, Meta, PageHeader, RowLink, SessionBadge, Stat, Table } from '../components/ui'
import { QuestionTable } from '../components/QuestionTable'

export default function SessionDetail() {
  const { id } = useParams()
  const { data, error, reload } = useApi<Detail>(`/sessions/${id}`)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (!data) return <Loading />

  const answered = data.participants.reduce((s, p) => s + p.answered, 0)
  const correct = data.participants.reduce((s, p) => s + p.correct, 0)
  const registered = data.participants.filter((p) => p.user).length

  return (
    <>
      <PageHeader
        title={data.quiz.title}
        subtitle={<>Session <span className="font-mono">{data.id.slice(0, 8)}</span></>}
        actions={<SessionBadge status={data.status} stale={data.stale} />}
      />

      <Card>
        <Meta
          items={[
            ['Quiz', <RowLink to={`/quizzes/${data.quiz.id}`}>{data.quiz.title}</RowLink>],
            ['Host', <RowLink to={`/users/${data.host.id}`}>{data.host.name}</RowLink>],
            ['Created', fmt.dateTime(data.createdAt)],
            ['Started', fmt.dateTime(data.startedAt)],
            ['Ended', fmt.dateTime(data.endedAt)],
            ['Duration', sessionDuration(data)],
            ['Host email', data.host.email],
            ['Reached question', data.startedAt ? data.currentQuestion + 1 : '—'],
          ]}
        />
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Players" value={data.participants.length} hint={`${registered} signed in, ${data.participants.length - registered} guests`} />
        <Stat label="Answers" value={answered} />
        <Stat label="Accuracy" value={answered ? fmt.pct(correct / answered) : '—'} />
        <Stat label="Top score" value={data.participants[0]?.score ?? 0} hint={data.participants[0]?.username} />
      </div>

      <Card title="Leaderboard" className="mt-4">
        <Table head={['#', 'Player', 'Account', 'Score', 'Answered', 'Correct', 'Joined']} empty={!data.participants.length}>
          {data.participants.map((p) => (
            <tr key={p.id}>
              <td className="tabular text-ink-3">{p.rank}</td>
              <td className="font-medium">{p.username}</td>
              <td>{p.user ? <RowLink to={`/users/${p.user.id}`}><span className="font-normal text-ink-2">{p.user.email}</span></RowLink> : <span className="text-ink-3">Guest</span>}</td>
              <td className="tabular">{fmt.full(p.score)}</td>
              <td className="tabular text-ink-2">{p.answered}</td>
              <td className="tabular text-ink-2">{p.correct}</td>
              <td className="text-ink-3">{fmt.dateTime(p.joinedAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Per-question results" className="mt-4">
        <QuestionTable questions={data.questions} />
      </Card>
    </>
  )
}
