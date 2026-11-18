import { describe, expect, it } from 'vitest';
import { leaderboardFilename, leaderboardToCsv } from './leaderboardCsv';

describe('leaderboardToCsv', () => {
  it('writes a ranked row with seconds for each player', () => {
    const csv = leaderboardToCsv([
      { username: 'Aisha', score: 47, totalTimeMs: 38200 },
      { username: 'Marco', score: 44, totalTimeMs: 41000 },
    ]);
    expect(csv).toBe('Rank,Name,Score,Time (s)\r\n1,Aisha,47,38.2\r\n2,Marco,44,41.0\r\n');
  });

  it('quotes names with commas, quotes and line breaks', () => {
    const csv = leaderboardToCsv([{ username: 'Lee, "Ace"\nJr', score: 1, totalTimeMs: 1000 }]);
    expect(csv).toContain('1,"Lee, ""Ace""\nJr",1,1.0');
  });

  it('defuses names that would run as a spreadsheet formula', () => {
    const csv = leaderboardToCsv([{ username: '=SUM(A1)', score: 0 }]);
    expect(csv).toContain("1,'=SUM(A1),0,");
  });

  it('leaves the time blank when it is missing', () => {
    expect(leaderboardToCsv([{ username: 'Sam', score: 3 }])).toContain('1,Sam,3,\r\n');
  });
});

describe('leaderboardFilename', () => {
  it('includes the session and the date', () => {
    expect(leaderboardFilename('ab12-cd34-ef56', new Date('2026-11-18T10:00:00Z'))).toBe(
      'rexial-leaderboard-ab12cd34-2026-11-18.csv',
    );
  });
});
