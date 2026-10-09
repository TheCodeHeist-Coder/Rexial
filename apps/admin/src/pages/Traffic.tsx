import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../lib/api'
import { fmt } from '../lib/format'
import type { Traffic as TrafficData } from '../lib/types'
import { Card, ErrorBox, Loading, PageHeader, RANGES, RowLink, Segmented, Stat, StatusCode, Table } from '../components/ui'
import { BarList, ColumnChart } from '../components/charts'

const METRICS = [
  { value: 'requests', label: 'Requests' },
  { value: 'visitors', label: 'Unique IPs' },
  { value: 'errors', label: '5xx errors' },
  { value: 'p95Ms', label: 'p95 latency' },
] as const
type Metric = (typeof METRICS)[number]['value']

export default function Traffic() {
  const [params, setParams] = useSearchParams()
  const range = params.get('range') ?? '7d'
  const [metric, setMetric] = useState<Metric>('requests')
  const { data, error, loading, reload } = useApi<TrafficData>(`/traffic?range=${range}`, 60_000)

  const header = (
    <PageHeader
      title="API traffic"
      subtitle="Every request to the main API (http-server). Kept for 30 days by default."
      actions={<Segmented value={range} options={RANGES} onChange={(v) => setParams({ range: v })} />}
    />
  )

  if (error && !data) return <>{header}<ErrorBox message={error} onRetry={reload} /></>
  if (!data) return <>{header}{loading && <Loading />}</>

  const t = data.totals
  const errorTone = t.errorRate > 0.05 ? 'bad' : t.errorRate > 0.01 ? 'warn' : 'good'
  const statusClasses = [2, 3, 4, 5].map((c) => ({
    label: `${c}xx`,
    value: data.statuses.filter((s) => Math.floor(s.statusCode / 100) === c).reduce((sum, s) => sum + s.requests, 0),
  }))

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Requests" value={t.requests} />
        <Stat label="Unique IPs" value={t.visitors} hint="distinct client addresses" />
        <Stat label="Signed-in users" value={t.users} hint="made at least one call" />
        <Stat label="Server errors" value={fmt.pct(t.errorRate)} hint={`${fmt.full(t.serverErrors)} × 5xx, ${fmt.full(t.clientErrors)} × 4xx`} tone={errorTone} />
        <Stat label="Avg latency" value={fmt.ms(t.avgMs)} />
        <Stat label="p95 latency" value={fmt.ms(t.p95Ms)} tone={t.p95Ms > 1000 ? 'bad' : t.p95Ms > 300 ? 'warn' : undefined} />
      </div>

      <Card className="mt-4" title={METRICS.find((m) => m.value === metric)!.label} action={<Segmented value={metric} options={[...METRICS]} onChange={setMetric} />}>
        <ColumnChart
          height={220}
          unit={data.unit}
          data={data.series.map((r) => ({ bucket: r.bucket, value: r[metric] ?? 0 }))}
          format={metric === 'p95Ms' ? fmt.ms : fmt.full}
        />
      </Card>

      <Card title="Endpoints" className="mt-4">
        <Table head={['Endpoint', 'Requests', 'Errors', 'Avg', 'p95']} empty={!data.endpoints.length}>
          {data.endpoints.map((e) => (
            <tr key={`${e.method} ${e.path}`}>
              <td className="font-mono text-xs"><span className="inline-block w-12 text-ink-3">{e.method}</span>{e.path}</td>
              <td className="tabular">{fmt.full(e.requests)}</td>
              <td className="tabular text-ink-2">
                {fmt.full(e.errors)}
                <span className="ml-1.5 text-xs text-ink-3">{fmt.pct(e.errors / e.requests)}</span>
              </td>
              <td className="tabular text-ink-2">{fmt.ms(e.avg_ms)}</td>
              <td className="tabular text-ink-2">{fmt.ms(e.p95_ms)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Status codes">
          <BarList items={statusClasses} />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
            {data.statuses.map((s) => (
              <span key={s.statusCode}><StatusCode code={s.statusCode} /> <span className="tabular">{fmt.full(s.requests)}</span></span>
            ))}
          </div>
        </Card>
        <Card title="Browsers">
          <BarList items={data.clients.browsers.map((b) => ({ label: b.name, value: b.requests }))} />
        </Card>
        <Card title="Platforms">
          <BarList items={data.clients.platforms.map((p) => ({ label: p.name, value: p.requests }))} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Top IP addresses">
          <Table head={['IP', 'Requests', 'Users', 'Errors', 'Last seen']} empty={!data.topIps.length}>
            {data.topIps.map((ip) => (
              <tr key={ip.ip ?? 'unknown'}>
                <td className="font-mono text-xs">{ip.ip ?? 'unknown'}</td>
                <td className="tabular">{fmt.full(ip.requests)}</td>
                <td className="tabular text-ink-2">{ip.users}</td>
                <td className="tabular text-ink-2">{fmt.full(ip.errors)}</td>
                <td className="text-ink-3">{fmt.ago(ip.lastSeen)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Recent failed requests">
          <div className="max-h-[560px] overflow-y-auto">
          <Table head={['Time', 'Request', 'Status', 'IP', 'User']} empty={!data.recentErrors.length}>
            {data.recentErrors.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-ink-3">{fmt.dateTime(r.createdAt)}</td>
                <td className="font-mono text-xs"><span className="text-ink-3">{r.method}</span> {r.path}</td>
                <td><StatusCode code={r.statusCode} /></td>
                <td className="font-mono text-xs text-ink-3">{r.ip ?? '—'}</td>
                <td>{r.userId ? <RowLink to={`/users/${r.userId}`}><span className="text-xs font-normal text-ink-2">view</span></RowLink> : <span className="text-ink-3">—</span>}</td>
              </tr>
            ))}
          </Table>
          </div>
        </Card>
      </div>
    </>
  )
}
