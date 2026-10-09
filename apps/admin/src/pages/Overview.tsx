import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../lib/api'
import { fmt } from '../lib/format'
import type { Overview as OverviewData } from '../lib/types'
import { Card, ErrorBox, Loading, PageHeader, RANGES, RowLink, Segmented, SessionBadge, Stat, Table } from '../components/ui'
import { BarList, ColumnChart, SegmentBar } from '../components/charts'

const RANGE_TEXT: Record<string, string> = { '1d': 'last 24h', '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days', '365d': 'last year' }

export default function Overview() {
  const [params, setParams] = useSearchParams()
  const range = params.get('range') ?? '30d'
  const { data, error, loading, reload } = useApi<OverviewData>(`/overview?range=${range}`, 30_000)

  const header = (
    <PageHeader
      title="Overview"
      subtitle="Platform-wide numbers. Refreshes every 30 seconds."
      actions={<Segmented value={range} options={RANGES} onChange={(v) => setParams({ range: v })} />}
    />
  )

  if (error && !data) return <>{header}<ErrorBox message={error} onRetry={reload} /></>
  if (!data) return <>{header}{loading && <Loading />}</>

  const { users, quizzes, sessions, participants, answers } = data
  const span = RANGE_TEXT[data.range]
  const liveCount = sessions.live
  const livePlayers = sessions.liveParticipants
  const series = (key: keyof OverviewData['series'][number]) =>
    data.series.map((r) => ({ bucket: r.bucket, value: r[key] as number }))
  const sum = (key: keyof OverviewData['series'][number]) => data.series.reduce((s, r) => s + (r[key] as number), 0)

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Users" value={users.total} hint={`+${fmt.full(users.new)} ${span}`} />
        <Stat label="Active users" value={users.active} hint={`logged in, ${span}`} />
        <Stat label="Quizzes" value={quizzes.total} hint={`+${fmt.full(quizzes.new)} ${span}`} />
        <Stat label="Quiz sessions" value={sessions.total} hint={`${fmt.full(sessions.completed)} completed`} />
        <Stat label="Participants" value={participants.total} hint={`+${fmt.full(participants.new)} ${span}`} />
        <Stat label="Live now" value={liveCount} hint={`${fmt.full(livePlayers)} players in them`} tone={liveCount > 0 ? 'good' : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Session outcomes (all time)">
          <SegmentBar
            parts={[
              { label: 'Completed', value: sessions.completed, color: 'bg-series' },
              { label: 'Live', value: liveCount, color: 'bg-good' },
              { label: 'Abandoned', value: sessions.stale, color: 'bg-warn' },
              { label: 'Cancelled', value: sessions.cancelled, color: 'bg-bad' },
            ]}
          />
          {sessions.stale > 0 && (
            <p className="mt-4 text-xs text-ink-3">
              {sessions.stale} session{sessions.stale > 1 ? 's' : ''} never finished and went idle for over {data.staleSessionHours}h.{' '}
              <Link to="/sessions?status=STALE" className="text-accent hover:underline">Review</Link>
            </p>
          )}
        </Card>
        <Card title="Quizzes by status">
          <SegmentBar
            parts={[
              { label: 'Draft', value: quizzes.draft, color: 'bg-ink-3' },
              { label: 'Active', value: quizzes.active, color: 'bg-good' },
              { label: 'Completed', value: quizzes.completed, color: 'bg-series' },
            ]}
          />
          <p className="mt-4 text-xs text-ink-3">{fmt.full(quizzes.questions)} questions written in total.</p>
        </Card>
        <Card title="Engagement">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-ink-3">Avg players / session</dt><dd className="tabular mt-0.5 text-lg font-semibold">{sessions.avgParticipants.toFixed(1)}</dd></div>
            <div><dt className="text-xs text-ink-3">Avg session length</dt><dd className="tabular mt-0.5 text-lg font-semibold">{fmt.duration(sessions.avgDurationSeconds)}</dd></div>
            <div><dt className="text-xs text-ink-3">Answers submitted</dt><dd className="tabular mt-0.5 text-lg font-semibold">{fmt.n(answers.total)}</dd></div>
            <div><dt className="text-xs text-ink-3">Answer accuracy</dt><dd className="tabular mt-0.5 text-lg font-semibold">{fmt.pct(answers.accuracy)}</dd></div>
            <div><dt className="text-xs text-ink-3">Guest players</dt><dd className="tabular mt-0.5 text-lg font-semibold">{fmt.n(participants.guests)}</dd></div>
            <div><dt className="text-xs text-ink-3">Signed-in players</dt><dd className="tabular mt-0.5 text-lg font-semibold">{fmt.n(participants.distinctRegisteredPlayers)}</dd></div>
          </dl>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title={<>New signups <span className="tabular ml-1 text-ink">{fmt.full(sum('signups'))}</span></>}>
          <ColumnChart data={series('signups')} unit={data.unit} />
        </Card>
        <Card title={<>Players joined <span className="tabular ml-1 text-ink">{fmt.full(sum('participants'))}</span></>}>
          <ColumnChart data={series('participants')} unit={data.unit} />
        </Card>
        <Card title={<>Sessions started <span className="tabular ml-1 text-ink">{fmt.full(sum('sessions'))}</span></>}>
          <ColumnChart data={series('sessions')} unit={data.unit} />
        </Card>
        <Card
          title={<>API requests <span className="tabular ml-1 text-ink">{fmt.full(sum('requests'))}</span></>}
          action={<Link to={`/traffic?range=${range}`} className="text-xs text-accent hover:underline">Traffic details</Link>}
        >
          <ColumnChart data={series('requests')} unit={data.unit} />
        </Card>
      </div>

      <Card title="Live sessions" className="mt-4" action={<Link to="/sessions?status=LIVE" className="text-xs text-accent hover:underline">All sessions</Link>}>
        <Table head={['Quiz', 'Status', 'Join code', 'Progress', 'Players', 'Started']} empty={!data.live.length}>
          {data.live.map((s) => (
            <tr key={s.id}>
              <td><RowLink to={`/sessions/${s.id}`}>{s.quizTitle}</RowLink></td>
              <td><SessionBadge status={s.status} /></td>
              <td className="font-mono text-xs">{s.joinCode ?? '—'}</td>
              <td className="tabular text-ink-2">{s.status === 'WAITING' ? 'Lobby' : `Q${s.currentQuestion + 1} / ${s.totalQuestions}`}</td>
              <td className="tabular">{s.participants}</td>
              <td className="text-ink-3">{fmt.ago(s.startedAt ?? s.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Most played quizzes" action={<Link to="/quizzes" className="text-xs text-accent hover:underline">All quizzes</Link>}>
          <BarList items={data.topQuizzes.map((q) => ({ label: q.title, value: q.participants, sub: `${q.sessions} sessions` }))} />
        </Card>
        <Card title="Newest users" action={<Link to="/users" className="text-xs text-accent hover:underline">All users</Link>}>
          <ul className="divide-y divide-line/60">
            {data.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <RowLink to={`/users/${u.id}`}>{u.name}</RowLink>
                  <div className="truncate text-xs text-ink-3">{u.email}</div>
                </div>
                <span className="shrink-0 text-xs text-ink-3">{fmt.ago(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
