import { fmt } from '../lib/format'
import type { QuestionStat } from '../lib/types'
import { Table } from './ui'

// Correct-rate per question; a low rate flags a question that is too hard
// or has the wrong answer marked.
export function QuestionTable({ questions }: { questions: (QuestionStat & { difficulty?: string })[] }) {
  return (
    <Table head={['#', 'Question', 'Answered', 'Correct rate', 'Avg time']} empty={!questions.length}>
      {questions.map((q) => {
        const rate = q.answered ? q.correct / q.answered : null
        return (
          <tr key={q.id}>
            <td className="tabular text-ink-3">{q.order}</td>
            <td className="max-w-md whitespace-normal">
              {q.text}
              {q.difficulty && <span className="ml-2 text-xs text-ink-3">{q.difficulty}</span>}
            </td>
            <td className="tabular text-ink-2">{fmt.full(q.answered)}</td>
            <td>
              {rate === null ? (
                <span className="text-ink-3">—</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full bg-white/5">
                    <div className="h-1.5 rounded-full bg-series" style={{ width: `${rate * 100}%` }} />
                  </div>
                  <span className="tabular text-xs">{fmt.pct(rate)}</span>
                </div>
              )}
            </td>
            <td className="tabular text-ink-2">{fmt.ms(q.avgTimeMs)}</td>
          </tr>
        )
      })}
    </Table>
  )
}
