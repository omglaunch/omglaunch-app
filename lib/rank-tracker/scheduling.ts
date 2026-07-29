import type { TrackingFrequency } from '@/lib/rank-tracker/types';

const FREQUENCY_HOURS: Record<TrackingFrequency, number> = {
  DAILY: 24,
  EVERY_3_DAYS: 72,
  WEEKLY: 168,
};

export function computeNextCheckAt(
  trackingFrequency: TrackingFrequency,
  from: Date = new Date()
): Date {
  const hours = FREQUENCY_HOURS[trackingFrequency] ?? FREQUENCY_HOURS.WEEKLY;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function isTrackingFrequency(value: string): value is TrackingFrequency {
  return value === 'DAILY' || value === 'EVERY_3_DAYS' || value === 'WEEKLY';
}
