import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost, auth } from '../lib/api'
import { Button } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { token } = await apiPost<{ token: string }>('/auth/login', { email, password })
      auth.set(token)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-lg bg-panel-2 px-3 py-2 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-accent'

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent font-bold text-white">R</span>
          <div>
            <h1 className="font-semibold leading-tight">Rexial super-admin</h1>
            <p className="text-xs text-ink-3">Restricted area</p>
          </div>
        </div>
        <label className="mb-1.5 block text-xs text-ink-3" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} mb-4`} />
        <label className="mb-1.5 block text-xs text-ink-3" htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy} className="mt-6 w-full py-2">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
