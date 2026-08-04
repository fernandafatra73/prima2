export type PendapatanRange = 'harian' | 'mingguan' | 'bulanan' | 'tahunan';

export const PENDAPATAN_BUCKET_COUNT: Record<PendapatanRange, number> = {
  harian: 14,
  mingguan: 12,
  bulanan: 12,
  tahunan: 5,
};

/** Senin sebagai awal minggu. */
export function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Tanggal awal setiap bucket (mis. tiap hari/minggu/bulan/tahun) dalam rentang, urut menaik. */
export function buildBucketStarts(range: PendapatanRange, now: Date): Date[] {
  const count = PENDAPATAN_BUCKET_COUNT[range];
  const starts: Date[] = [];
  if (range === 'harian') {
    const first = new Date(now);
    first.setHours(0, 0, 0, 0);
    first.setDate(first.getDate() - (count - 1));
    for (let i = 0; i < count; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() + i);
      starts.push(d);
    }
  } else if (range === 'mingguan') {
    const first = startOfWeek(now);
    first.setDate(first.getDate() - 7 * (count - 1));
    for (let i = 0; i < count; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() + 7 * i);
      starts.push(d);
    }
  } else if (range === 'bulanan') {
    for (let i = 0; i < count; i++) {
      starts.push(new Date(now.getFullYear(), now.getMonth() - (count - 1) + i, 1));
    }
  } else {
    for (let i = 0; i < count; i++) {
      starts.push(new Date(now.getFullYear() - (count - 1) + i, 0, 1));
    }
  }
  return starts;
}

/** Format tanggal lokal (bukan UTC) sebagai YYYY-MM-DD — konsisten dengan bucketLabelFor & buildBucketStarts. */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function bucketKeyFor(range: PendapatanRange, d: Date): string {
  if (range === 'harian') return localDateKey(d);
  if (range === 'mingguan') return localDateKey(startOfWeek(d));
  if (range === 'bulanan') return `${d.getFullYear()}-${d.getMonth()}`;
  return String(d.getFullYear());
}

export function bucketLabelFor(range: PendapatanRange, d: Date): string {
  if (range === 'harian') return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  if (range === 'mingguan') return startOfWeek(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  if (range === 'bulanan') return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  return String(d.getFullYear());
}
