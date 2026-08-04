const SATUAN = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
  'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas',
];

/** Ubah bilangan bulat non-negatif menjadi rangkaian kata bahasa Indonesia, mis. 2 -> "dua". */
export function angkaKeKata(n: number): string {
  if (n < 20) return SATUAN[n]!;
  if (n < 100) {
    const sisa = n % 10;
    return `${SATUAN[Math.floor(n / 10)]} puluh${sisa ? ` ${SATUAN[sisa]}` : ''}`;
  }
  if (n < 200) return `seratus${n - 100 ? ` ${angkaKeKata(n - 100)}` : ''}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${SATUAN[Math.floor(n / 100)]} ratus${sisa ? ` ${angkaKeKata(sisa)}` : ''}`;
  }
  if (n < 2000) return `seribu${n - 1000 ? ` ${angkaKeKata(n - 1000)}` : ''}`;
  if (n < 1_000_000) {
    const sisa = n % 1000;
    return `${angkaKeKata(Math.floor(n / 1000))} ribu${sisa ? ` ${angkaKeKata(sisa)}` : ''}`;
  }
  if (n < 1_000_000_000) {
    const sisa = n % 1_000_000;
    return `${angkaKeKata(Math.floor(n / 1_000_000))} juta${sisa ? ` ${angkaKeKata(sisa)}` : ''}`;
  }
  const sisa = n % 1_000_000_000;
  return `${angkaKeKata(Math.floor(n / 1_000_000_000))} miliar${sisa ? ` ${angkaKeKata(sisa)}` : ''}`;
}

function kapitalisasi(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Ubah nominal rupiah menjadi rangkaian kata, mis. 150000 -> "Seratus lima puluh ribu rupiah". */
export function terbilangRupiah(value: string | number): string {
  const n = Math.round(Math.abs(typeof value === 'string' ? Number(value) : value));
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return 'Nol rupiah';
  return `${kapitalisasi(angkaKeKata(n))} rupiah`;
}
