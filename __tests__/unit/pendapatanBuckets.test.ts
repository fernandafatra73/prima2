import { describe, expect, test } from 'vitest';
import {
  buildBucketStarts,
  bucketKeyFor,
  bucketLabelFor,
  startOfWeek,
} from '../../apps/api/src/lib/pendapatanBuckets.ts';

/** Format tanggal lokal (bukan UTC) sebagai YYYY-MM-DD, untuk dibandingkan pada assertion. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('startOfWeek', () => {
  test('returns the same Monday for any day within that week', () => {
    const monday = startOfWeek(new Date('2026-08-05T10:00:00')); // Wednesday
    expect(monday.getDay()).toBe(1);
    expect(localDateStr(monday)).toBe('2026-08-03');
  });

  test('treats Sunday as the last day of the previous week', () => {
    const monday = startOfWeek(new Date('2026-08-09T10:00:00')); // Sunday
    expect(localDateStr(monday)).toBe('2026-08-03');
  });
});

describe('buildBucketStarts', () => {
  test('harian returns 14 consecutive days ending today', () => {
    const now = new Date('2026-08-04T15:30:00');
    const starts = buildBucketStarts('harian', now);
    expect(starts).toHaveLength(14);
    expect(localDateStr(starts[0]!)).toBe('2026-07-22');
    expect(localDateStr(starts[13]!)).toBe('2026-08-04');
  });

  test('bulanan returns 12 consecutive months ending this month', () => {
    const now = new Date('2026-08-04T15:30:00');
    const starts = buildBucketStarts('bulanan', now);
    expect(starts).toHaveLength(12);
    expect(starts[0]).toEqual(new Date(2025, 8, 1));
    expect(starts[11]).toEqual(new Date(2026, 7, 1));
  });

  test('tahunan returns 5 consecutive years ending this year', () => {
    const now = new Date('2026-08-04T15:30:00');
    const starts = buildBucketStarts('tahunan', now);
    expect(starts.map((d) => d.getFullYear())).toEqual([2022, 2023, 2024, 2025, 2026]);
  });
});

describe('bucketKeyFor / bucketLabelFor', () => {
  test('harian keys are stable per calendar day', () => {
    const a = new Date('2026-08-04T01:00:00');
    const b = new Date('2026-08-04T23:00:00');
    expect(bucketKeyFor('harian', a)).toBe(bucketKeyFor('harian', b));
  });

  test('mingguan keys are stable across the same week', () => {
    const monday = new Date('2026-08-03T08:00:00');
    const sunday = new Date('2026-08-09T20:00:00');
    expect(bucketKeyFor('mingguan', monday)).toBe(bucketKeyFor('mingguan', sunday));
  });

  test('tahunan label is just the year', () => {
    expect(bucketLabelFor('tahunan', new Date('2026-08-04'))).toBe('2026');
  });
});
