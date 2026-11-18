export interface LeaderboardRow {
  username?: string;
  score?: number;
  totalTimeMs?: number;
}

// Quote a value when it holds a comma, quote or line break, and keep a name
// that starts with = + - @ from being run as a formula by Excel or Sheets.
function cell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Rows are expected in final order. The time column explains why equal
// scores are ranked the way they are.
export function leaderboardToCsv(rows: LeaderboardRow[]): string {
  const lines = ['Rank,Name,Score,Time (s)'];
  rows.forEach((row, i) => {
    const seconds =
      typeof row.totalTimeMs === 'number' ? (row.totalTimeMs / 1000).toFixed(1) : '';
    lines.push([String(i + 1), cell(row.username ?? ''), String(row.score ?? 0), seconds].join(','));
  });
  return lines.join('\r\n') + '\r\n';
}

export function leaderboardFilename(sessionId: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const id = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `rexial-leaderboard-${id ? id + '-' : ''}${day}.csv`;
}

export function downloadLeaderboardCsv(rows: LeaderboardRow[], sessionId: string): void {
  // The BOM makes Excel read the file as UTF-8, so non-ASCII names survive.
  const blob = new Blob(['﻿', leaderboardToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = leaderboardFilename(sessionId);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
