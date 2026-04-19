export type Key = 'C' | 'Eb' | 'F#' | 'A' | 'Ab' | 'B' | 'D' | 'F' | 'E' | 'G' | 'Bb' | 'Db';

export type Category = 'Progressions' | 'Modes Study' | 'Quartals' | 'Upper Structures' | 'Vocabulary';

export interface PracticeSession {
  id: string;
  date: string; // ISO string
  category: Category;
  subCategory?: string;
  duration: number; // minutes
  key?: Key;
  notes?: string;
  intensity: number; // 1-5
}

export interface DailyGoal {
  category: Category;
  targetMinutes: number;
}

export const KEYS: Key[] = ['C', 'Eb', 'F#', 'A', 'Ab', 'B', 'D', 'F', 'E', 'G', 'Bb', 'Db'];

export const CATEGORIES: Category[] = [
  'Progressions',
  'Modes Study',
  'Quartals',
  'Upper Structures',
  'Vocabulary'
];
