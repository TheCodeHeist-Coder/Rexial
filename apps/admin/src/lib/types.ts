export type Paged<T> = { total: number; page: number; pageSize: number; items: T[] }

export type Person = { id: string; name: string; email: string }

export type SessionStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type QuizStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED'

export type Overview = {
  range: string
  unit: 'hour' | 'day'
  staleSessionHours: number
  users: { total: number; new: number; active: number }
  quizzes: { total: number; new: number; draft: number; active: number; completed: number; questions: number }
  sessions: {
    total: number
    waiting: number
    inProgress: number
    completed: number
    cancelled: number
    stale: number
    live: number
    liveParticipants: number
    avgParticipants: number
    avgDurationSeconds: number
  }
  participants: { total: number; new: number; guests: number; registered: number; distinctRegisteredPlayers: number }
  answers: { total: number; correct: number; accuracy: number }
  live: {
    id: string
    status: SessionStatus
    quizId: string
    quizTitle: string
    joinCode: string | null
    currentQuestion: number
    totalQuestions: number
    participants: number
    startedAt: string | null
    createdAt: string
  }[]
  topQuizzes: { id: string; title: string; creator: string; sessions: number; participants: number }[]
  recentUsers: (Person & { createdAt: string })[]
  series: {
    bucket: string
    signups: number
    sessions: number
    completed: number
    participants: number
    requests: number
    visitors: number
  }[]
}

export type QuizRow = {
  id: string
  title: string
  status: QuizStatus
  joinCode: string | null
  createdAt: string
  creator: Person
  questions: number
  sessions: number
  organizers: number
  participants: number
  lastPlayed: string | null
}

export type QuestionStat = {
  id: string
  text: string
  order: number
  answered: number
  correct: number
  avgTimeMs: number | null
}

export type SessionRow = {
  id: string
  status: SessionStatus
  stale: boolean
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  participants: number
}

export type QuizDetail = {
  id: string
  title: string
  description: string | null
  status: QuizStatus
  joinCode: string | null
  createdAt: string
  updatedAt: string
  creator: Person
  organizers: {
    id: string
    role: 'OWNER' | 'CO_ORGANIZER'
    inviteStatus: 'PENDING' | 'ACCEPTED'
    inviteEmail: string | null
    user: Person | null
  }[]
  questions: (QuestionStat & {
    timeLimit: number
    difficulty: 'Low' | 'Medium' | 'High'
    answers: { id: string; text: string; isCorrect: boolean }[]
  })[]
  sessions: SessionRow[]
  totalParticipants: number
}

export type SessionListRow = SessionRow & {
  quiz: { id: string; title: string }
  host: Person
  currentQuestion: number
  totalQuestions: number
}

export type SessionDetail = SessionRow & {
  currentQuestion: number
  quiz: { id: string; title: string }
  host: Person
  participants: {
    id: string
    rank: number
    username: string
    score: number
    joinedAt: string
    user: Person | null
    answered: number
    correct: number
  }[]
  questions: QuestionStat[]
}

export type UserRow = Person & {
  createdAt: string
  lastLoginAt: string | null
  lastSeenAt: string | null
  requests: number
  quizzesCreated: number
  quizzesPlayed: number
  totalScore: number
}

export type RequestRow = {
  id: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  ip: string | null
  userId?: string | null
  createdAt: string
}

export type UserDetail = Person & {
  createdAt: string
  lastLoginAt: string | null
  stats: {
    quizzesCreated: number
    quizzesPlayed: number
    totalScore: number
    answered: number
    correct: number
    requests30d: number
  }
  quizzes: { id: string; title: string; status: QuizStatus; createdAt: string; questions: number; sessions: number }[]
  coOrganizing: { id: string; title: string; inviteStatus: string }[]
  participations: {
    id: string
    username: string
    score: number
    joinedAt: string
    answered: number
    sessionId: string
    sessionStatus: SessionStatus
    quiz: { id: string; title: string }
  }[]
  devices: { ip: string | null; userAgent: string | null; requests: number; lastSeen: string }[]
  recentRequests: RequestRow[]
}

export type Traffic = {
  range: string
  unit: 'hour' | 'day'
  totals: {
    requests: number
    visitors: number
    users: number
    clientErrors: number
    serverErrors: number
    errorRate: number
    avgMs: number
    p95Ms: number
  }
  series: { bucket: string; requests: number; visitors: number; errors: number; p95Ms: number | null }[]
  endpoints: { method: string; path: string; requests: number; errors: number; avg_ms: number; p95_ms: number }[]
  statuses: { statusCode: number; requests: number }[]
  topIps: { ip: string | null; requests: number; users: number; errors: number; lastSeen: string }[]
  clients: { browsers: { name: string; requests: number }[]; platforms: { name: string; requests: number }[] }
  recentErrors: RequestRow[]
}
