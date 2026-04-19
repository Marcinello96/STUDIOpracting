import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { KEYS } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getTodayKeys(date: Date): [string, string] {
  const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday...
  if (dayOfWeek === 0) return ['Review', 'Rest']; // Sunday
  
  // Mon=1 -> Index 0,1
  // Tue=2 -> Index 2,3
  // ...
  const idx = Math.max(0, (dayOfWeek - 1) * 2);
  return [KEYS[idx], KEYS[idx + 1]];
}
