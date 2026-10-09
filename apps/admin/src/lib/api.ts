import { useCallback, useEffect, useState } from 'react'

// Checked at build time in vite.config.ts.
const BASE: string = import.meta.env.VITE_ADMIN_API_URL
const TOKEN_KEY = 'rexial-admin-token'

export const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY)
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
  },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`)
  if (init.body) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (res.status === 401 && path !== '/auth/login') {
    auth.clear()
    window.location.assign('/login')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error || `Request failed (${res.status})`)
  }
  return res
}

export async function apiGet<T>(path: string): Promise<T> {
  return (await request(path)).json()
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return (await request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })).json()
}

// The CSV endpoint needs the auth header, so a plain <a href> won't do.
export async function apiDownload(path: string, filename: string) {
  const blob = await (await request(path)).blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Fetches `path` and refetches whenever it changes; `refreshMs` polls.
export function useApi<T>(path: string | null, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!path) return
    let cancelled = false
    setLoading(true)
    apiGet<T>(path)
      .then((d) => {
        if (cancelled) return
        setData(d)
        setError(null)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [path, tick])

  useEffect(() => {
    if (!refreshMs) return
    const id = setInterval(reload, refreshMs)
    return () => clearInterval(id)
  }, [refreshMs, reload])

  return { data, error, loading, reload }
}
