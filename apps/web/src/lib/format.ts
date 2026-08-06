export function formatRupiah(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Hitung umur dalam tahun penuh (selaras dengan API `computeUmur`). */
export function computeUmurYears(tanggalLahir: string, refIso?: string): number | null {
  const birth = new Date(tanggalLahir);
  const ref = refIso ? new Date(refIso) : new Date();
  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) {
    return null;
  }
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age < 0 ? 0 : age;
}

/**
 * Terima input umur bebas (angka saja = tahun, atau "6 bulan", "10 hari", "2 minggu")
 * lalu ubah jadi tanggal lahir perkiraan. Null kalau teksnya tidak dikenali.
 */
export function parseUmurManualToTanggalLahir(value: string): string | null {
  const match = /^(\d+)\s*(tahun|thn|th|bulan|bln|bl|minggu|mgg|hari|hr)?$/i.exec(value.trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const unit = (match[2] ?? 'tahun').toLowerCase();

  if (unit.startsWith('th')) {
    const y = new Date().getFullYear() - amount;
    return `${y}-01-01`;
  }

  const d = new Date();
  if (unit.startsWith('b')) {
    d.setDate(d.getDate() - amount * 30);
  } else if (unit.startsWith('m')) {
    d.setDate(d.getDate() - amount * 7);
  } else {
    d.setDate(d.getDate() - amount);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Tampilan umur singkat di tabel/form, mis. "4 tahun". */
export function formatUmurTahun(years: number): string {
  if (!Number.isFinite(years) || years < 0) {
    return '—';
  }
  return `${years} tahun`;
}

/** Umur detail seperti "2 Thn 6 bln" untuk hasil bacaan. */
export function formatUmurDetail(tanggalLahir: string, refIso?: string): string {
  const birth = new Date(tanggalLahir);
  const ref = refIso ? new Date(refIso) : new Date();
  if (Number.isNaN(birth.getTime())) {
    return '—';
  }
  let months =
    (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  if (ref.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    months = 0;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) {
    return `${years} Thn ${rem} bln`;
  }
  if (years > 0) {
    return `${years} Thn`;
  }
  return `${rem} bln`;
}

export function formatDateId(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatCompactRupiah(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}jt`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}rb`;
  }
  return String(value);
}

export function computeAutoSharingAmount(
  dokterNama: string | undefined,
  selectedJenisNames: readonly string[],
  umurYears: number,
  defaultAmount: string
): string {
  const dokLower = (dokterNama || '').toLowerCase();
  const isEvaOrIman = dokLower.includes('eva') || dokLower.includes('iman');
  const isAnna = dokLower.includes('anna');

  const hasThorak = selectedJenisNames.some((name) => {
    const lower = (name || '').toLowerCase();
    return lower.includes('thorak') || lower.includes('thorax');
  });
  const hasLumbosacral = selectedJenisNames.some((name) => {
    const lower = (name || '').toLowerCase();
    return lower.includes('lumbosacral');
  });
  const hasShoulder = selectedJenisNames.some((name) => {
    const lower = (name || '').toLowerCase();
    return lower.includes('shoulder');
  });

  if (hasLumbosacral) {
    return '88000';
  }
  if (hasShoulder) {
    return '58000';
  }
  if (hasThorak) {
    if (isEvaOrIman) {
      return umurYears < 10 ? '33000' : '35000';
    }
    if (isAnna) {
      return umurYears < 10 ? '18000' : '20000';
    }
  }
  return defaultAmount;
}
