export interface PollOption {
  id: string;
  text: string;
  order: number;
  voteCount: number;
  percentage: number;
}

export interface Poll {
  id: string;
  sessionId: string;
  question: string;
  questionIndex?: number | null;
  status: 'ACTIVE' | 'ENDED';
  isRecorded: boolean;
  totalVotes: number;
  createdAt: number;
  endedAt?: number | null;
  recordedAt?: number | null;
  duration?: number | null;
  options: PollOption[];
  votedOptionId?: string | null;
}

export interface PollPreset {
  label: string;
  icon: string;
  question: string;
  options: string[];
}
