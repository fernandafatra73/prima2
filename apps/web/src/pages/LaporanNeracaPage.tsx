import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { SharingPdfPreviewModal } from '../components/ui/SharingPdfPreviewModal.tsx';
import { apiGet, apiPut } from '../lib/api.ts';
import type { PaginatedResponse } from '../lib/pagination.ts';
import { formatRupiah } from '../lib/format.ts';
import {
  LaporanNeracaReportDocument,
  type LaporanNeracaReportData,
} from '../pdf/LaporanNeracaReportDocument.tsx';
import { Neraca1ReportDocument } from '../pdf/Neraca1ReportDocument.tsx';
import { Neraca2ReportDocument } from '../pdf/Neraca2ReportDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { pdf } from '@react-pdf/renderer';
import '../components/ui/ui.css';

interface NeracaData {
  readonly year: number;
  readonly namaPerusahaan: string;
  readonly kas: number;
  readonly bank: number;
  readonly piutang: number;
  readonly persediaan: number;
  readonly tanah: number;
  readonly gedung: number;
  readonly peralatan: number;
  readonly kendaraan: number;
  readonly utangUsaha: number;
  readonly utangPajak: number;
  readonly utangLainnya: number;
  readonly utangJangkaPanjang: number;
  readonly modalUsaha: number;
  readonly pendapatan: number;
  readonly biayaGaji: number;
  readonly biayaAtkBahan: number;
  readonly biayaListrik: number;
  readonly biayaTelpon: number;
  readonly biayaTransport: number;
  readonly biayaSewa: number;
  readonly biayaLainLain: number;
  readonly tempatTandaTangan: string;
  readonly tanggalTandaTangan: string;
  readonly namaPenandatangan: string;
  readonly logoPerusahaanId: string | null;
}

interface LogoPerusahaanOption {
  readonly id: string;
  readonly namaKlinik: string;
  readonly logoPerusahaan: string | null;
}

const emptyForm = {
  namaPerusahaan: 'CV. PRIMA MANDIRI NUSANTARA',
  kas: '0', bank: '0', piutang: '0', persediaan: '0',
  tanah: '0', gedung: '0', peralatan: '0', kendaraan: '0',
  utangUsaha: '0', utangPajak: '0', utangLainnya: '0',
  utangJangkaPanjang: '0', modalUsaha: '0',
  pendapatan: '0', biayaGaji: '0', biayaAtkBahan: '0', biayaListrik: '0',
  biayaTelpon: '0', biayaTransport: '0', biayaSewa: '0', biayaLainLain: '0',
  tempatTandaTangan: 'Sukabumi',
  tanggalTandaTangan: new Date().toISOString().split('T')[0]!,
  namaPenandatangan: '',
  logoPerusahaanId: '' as string,
};

function n(v: string): number {
  return Number(v) || 0;
}

interface LaporanNeracaPageProps {
  readonly modul?: 'RADIOLOGI' | 'LABORATORIUM';
}

export function LaporanNeracaPage({ modul = 'RADIOLOGI' }: LaporanNeracaPageProps) {
  const moduleLabel = modul === 'RADIOLOGI' ? 'Radiologi' : 'Laboratorium';
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [printingPdf, setPrintingPdf] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [printingNeraca1, setPrintingNeraca1] = useState(false);
  const [printingNeraca2, setPrintingNeraca2] = useState(false);
  const [logoOptions, setLogoOptions] = useState<readonly LogoPerusahaanOption[]>([]);

  useEffect(() => {
    apiGet<PaginatedResponse<LogoPerusahaanOption>>('/api/logo-perusahaan?limit=200')
      .then((res) => setLogoOptions(res.items))
      .catch(() => setLogoOptions([]));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ item: NeracaData }>(`/api/laporan/neraca?year=${year}&modul=${modul}`);
      const d = res.item;
      setForm({
        namaPerusahaan: d.namaPerusahaan,
        kas: String(d.kas), bank: String(d.bank), piutang: String(d.piutang), persediaan: String(d.persediaan),
        tanah: String(d.tanah), gedung: String(d.gedung), peralatan: String(d.peralatan), kendaraan: String(d.kendaraan),
        utangUsaha: String(d.utangUsaha), utangPajak: String(d.utangPajak), utangLainnya: String(d.utangLainnya),
        utangJangkaPanjang: String(d.utangJangkaPanjang), modalUsaha: String(d.modalUsaha),
        pendapatan: String(d.pendapatan), biayaGaji: String(d.biayaGaji), biayaAtkBahan: String(d.biayaAtkBahan),
        biayaListrik: String(d.biayaListrik), biayaTelpon: String(d.biayaTelpon),
        biayaTransport: String(d.biayaTransport), biayaSewa: String(d.biayaSewa), biayaLainLain: String(d.biayaLainLain),
        tempatTandaTangan: d.tempatTandaTangan,
        tanggalTandaTangan: d.tanggalTandaTangan,
        namaPenandatangan: d.namaPenandatangan,
        logoPerusahaanId: d.logoPerusahaanId ?? '',
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan neraca');
    } finally {
      setLoading(false);
    }
  }, [year, modul]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const yearOptions = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  const totals = useMemo(() => {
    const totalAktivaLancar = n(form.kas) + n(form.bank) + n(form.piutang) + n(form.persediaan);
    const totalAktivaTetap = n(form.tanah) + n(form.gedung) + n(form.peralatan) + n(form.kendaraan);
    const totalAktiva = totalAktivaLancar + totalAktivaTetap;
    const totalUtangJangkaPendek = n(form.utangUsaha) + n(form.utangPajak) + n(form.utangLainnya);
    const totalBiaya =
      n(form.biayaGaji) + n(form.biayaAtkBahan) + n(form.biayaListrik) + n(form.biayaTelpon) +
      n(form.biayaTransport) + n(form.biayaSewa) + n(form.biayaLainLain);
    const labaRugi = n(form.pendapatan) - totalBiaya;
    const totalModal = n(form.modalUsaha) + labaRugi;
    const totalPasiva = totalUtangJangkaPendek + n(form.utangJangkaPanjang) + totalModal;
    return { totalAktivaLancar, totalAktivaTetap, totalAktiva, totalUtangJangkaPendek, totalBiaya, labaRugi, totalModal, totalPasiva };
  }, [form]);

  const balanced = Math.abs(totals.totalAktiva - totals.totalPasiva) < 1;

  async function saveNeraca() {
    setSaving(true);
    setError(null);
    try {
      await apiPut('/api/laporan/neraca', {
        year,
        modul,
        namaPerusahaan: form.namaPerusahaan,
        kas: n(form.kas), bank: n(form.bank), piutang: n(form.piutang), persediaan: n(form.persediaan),
        tanah: n(form.tanah), gedung: n(form.gedung), peralatan: n(form.peralatan), kendaraan: n(form.kendaraan),
        utangUsaha: n(form.utangUsaha), utangPajak: n(form.utangPajak), utangLainnya: n(form.utangLainnya),
        utangJangkaPanjang: n(form.utangJangkaPanjang), modalUsaha: n(form.modalUsaha),
        pendapatan: n(form.pendapatan), biayaGaji: n(form.biayaGaji), biayaAtkBahan: n(form.biayaAtkBahan),
        biayaListrik: n(form.biayaListrik), biayaTelpon: n(form.biayaTelpon),
        biayaTransport: n(form.biayaTransport), biayaSewa: n(form.biayaSewa), biayaLainLain: n(form.biayaLainLain),
        tempatTandaTangan: form.tempatTandaTangan,
        tanggalTandaTangan: form.tanggalTandaTangan,
        namaPenandatangan: form.namaPenandatangan,
        logoPerusahaanId: form.logoPerusahaanId || null,
      });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan laporan neraca');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveNeraca();
  }

  function buildReportData(): LaporanNeracaReportData {
    return {
      logoSrc: '',
      namaPerusahaan: form.namaPerusahaan,
      year,
      tanggalCetak: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      kasFormatted: formatRupiah(n(form.kas)),
      bankFormatted: formatRupiah(n(form.bank)),
      piutangFormatted: formatRupiah(n(form.piutang)),
      persediaanFormatted: formatRupiah(n(form.persediaan)),
      totalAktivaLancarFormatted: formatRupiah(totals.totalAktivaLancar),
      tanahFormatted: formatRupiah(n(form.tanah)),
      gedungFormatted: formatRupiah(n(form.gedung)),
      peralatanFormatted: formatRupiah(n(form.peralatan)),
      kendaraanFormatted: formatRupiah(n(form.kendaraan)),
      totalAktivaTetapFormatted: formatRupiah(totals.totalAktivaTetap),
      totalAktivaFormatted: formatRupiah(totals.totalAktiva),
      utangUsahaFormatted: formatRupiah(n(form.utangUsaha)),
      utangPajakFormatted: formatRupiah(n(form.utangPajak)),
      utangLainnyaFormatted: formatRupiah(n(form.utangLainnya)),
      totalUtangJangkaPendekFormatted: formatRupiah(totals.totalUtangJangkaPendek),
      utangJangkaPanjangFormatted: formatRupiah(n(form.utangJangkaPanjang)),
      modalUsahaFormatted: formatRupiah(n(form.modalUsaha)),
      labaRugiFormatted: formatRupiah(totals.labaRugi),
      totalModalFormatted: formatRupiah(totals.totalModal),
      totalPasivaFormatted: formatRupiah(totals.totalPasiva),
      pendapatanFormatted: formatRupiah(n(form.pendapatan)),
      biayaGajiFormatted: formatRupiah(n(form.biayaGaji)),
      biayaAtkBahanFormatted: formatRupiah(n(form.biayaAtkBahan)),
      biayaListrikFormatted: formatRupiah(n(form.biayaListrik)),
      biayaTelponFormatted: formatRupiah(n(form.biayaTelpon)),
      biayaTransportFormatted: formatRupiah(n(form.biayaTransport)),
      biayaSewaFormatted: formatRupiah(n(form.biayaSewa)),
      biayaLainLainFormatted: formatRupiah(n(form.biayaLainLain)),
      totalBiayaFormatted: formatRupiah(totals.totalBiaya),
      tempatTandaTangan: form.tempatTandaTangan,
      tanggalTandaTanganLabel: new Date(form.tanggalTandaTangan).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric',
      }),
      namaPenandatangan: form.namaPenandatangan,
    };
  }

  async function handleCetakPdf() {
    setPrintingPdf(true);
    try {
      const logoSrc = await loadLogoDataUrl().catch(() => '');
      const reportData = { ...buildReportData(), logoSrc };
      const blob = await pdf(<LaporanNeracaReportDocument data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Laporan_Neraca_${moduleLabel}_${year}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setPrintingPdf(false);
    }
  }

  async function handlePreviewPdf() {
    setPreviewingPdf(true);
    try {
      const logoSrc = await loadLogoDataUrl().catch(() => '');
      const reportData = { ...buildReportData(), logoSrc };
      const blob = await pdf(<LaporanNeracaReportDocument data={reportData} />).toBlob();
      setPreviewBlob(blob);
      setPreviewModalOpen(true);
    } finally {
      setPreviewingPdf(false);
    }
  }

  function loadLogoPerusahaanStamp(): string {
    const selected = form.logoPerusahaanId
      ? logoOptions.find((o) => o.id === form.logoPerusahaanId)
      : logoOptions[0];
    return selected?.logoPerusahaan ?? '';
  }

  async function handleCetakNeraca1() {
    setPrintingNeraca1(true);
    try {
      const logoSrc = loadLogoPerusahaanStamp();
      const reportData = { ...buildReportData(), logoSrc };
      const blob = await pdf(<Neraca1ReportDocument data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPrintingNeraca1(false);
    }
  }

  async function handleCetakNeraca2() {
    setPrintingNeraca2(true);
    try {
      const logoSrc = loadLogoPerusahaanStamp();
      const reportData = { ...buildReportData(), logoSrc };
      const blob = await pdf(<Neraca2ReportDocument data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPrintingNeraca2(false);
    }
  }

  function field(key: keyof typeof form, label: string) {
    if (!isEditing) {
      return (
        <div className="form-field">
          <span className="form-field__static-label">{label}</span>
          <p className="form-field__static-value">{formatRupiah(n(form[key]))}</p>
        </div>
      );
    }
    return (
      <div className="form-field">
        <label htmlFor={`neraca-${key}`}>{label}</label>
        <input
          id={`neraca-${key}`}
          type="number"
          step="1"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <>
      <ListPageShell
        title={`Laporan Neraca ${moduleLabel}`}
        subtitle={`Neraca & Laporan Rugi Laba tahunan ${moduleLabel} — input manual per akun, Total Aktiva/Pasiva dan Laba(Rugi) dihitung otomatis`}
        onRefresh={() => void fetchData()}
        error={error}
        loading={loading}
        filterExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="form-field" style={{ minWidth: '130px', margin: 0 }}>
              <label htmlFor="filter-year-neraca">Tahun</label>
              <select id="filter-year-neraca" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => void saveNeraca()}
              disabled={saving}
              title="Simpan laporan neraca tahun ini"
            >
              💾 {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => void handleCetakPdf()}
              disabled={printingPdf || previewingPdf}
            >
              🖨️ {printingPdf ? 'Membuat PDF...' : 'Cetak PDF'}
            </button>
            {!isEditing && (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => setIsEditing(true)}
                style={{ border: '1px solid var(--color-border)' }}
              >
                ✏️ Edit
              </button>
            )}
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void handlePreviewPdf()}
              disabled={previewingPdf || printingPdf}
              style={{ border: '1px solid var(--color-border)' }}
            >
              👁️ {previewingPdf ? 'Memuat...' : 'Preview PDF'}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => void handleCetakNeraca1()}
              disabled={printingNeraca1}
            >
              🖨️ {printingNeraca1 ? 'Membuat PDF...' : 'Cetak Neraca1'}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => void handleCetakNeraca2()}
              disabled={printingNeraca2}
            >
              🖨️ {printingNeraca2 ? 'Membuat PDF...' : 'Cetak Neraca2'}
            </button>
          </div>
        }
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-field form-field--full" style={{ marginBottom: '1rem' }}>
            {isEditing ? (
              <>
                <label htmlFor="neraca-nama-perusahaan">Nama Perusahaan</label>
                <input
                  id="neraca-nama-perusahaan"
                  value={form.namaPerusahaan}
                  onChange={(e) => setForm((f) => ({ ...f, namaPerusahaan: e.target.value }))}
                />
              </>
            ) : (
              <>
                <span className="form-field__static-label">Nama Perusahaan</span>
                <p className="form-field__static-value">{form.namaPerusahaan}</p>
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* NERACA */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>NERACA — PER 31 DESEMBER {year}</h3>

              <h4 style={{ marginBottom: '0.5rem' }}>Aktiva Lancar</h4>
              <div className="form-grid">
                {field('kas', 'Kas (Rp)')}
                {field('bank', 'Bank (Rp)')}
                {field('piutang', 'Piutang (Rp)')}
                {field('persediaan', 'Persediaan (Rp)')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.4rem 0', borderTop: '1px dashed var(--color-border)' }}>
                <span>Total Aktiva Lancar</span>
                <span>{formatRupiah(totals.totalAktivaLancar)}</span>
              </div>

              <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>Aktiva Tetap</h4>
              <div className="form-grid">
                {field('tanah', 'Tanah (Rp)')}
                {field('gedung', 'Gedung (Rp)')}
                {field('peralatan', 'Peralatan (Rp)')}
                {field('kendaraan', 'Kendaraan (Rp)')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.4rem 0', borderTop: '1px dashed var(--color-border)' }}>
                <span>Total Aktiva Tetap</span>
                <span>{formatRupiah(totals.totalAktivaTetap)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', padding: '0.6rem 0', marginTop: '0.5rem', borderTop: '2px solid var(--color-border)', color: 'var(--color-primary)' }}>
                <span>TOTAL AKTIVA</span>
                <span>{formatRupiah(totals.totalAktiva)}</span>
              </div>

              <h4 style={{ marginBottom: '0.5rem', marginTop: '1.5rem' }}>Utang Jangka Pendek</h4>
              <div className="form-grid">
                {field('utangUsaha', 'Utang Usaha (Rp)')}
                {field('utangPajak', 'Utang Pajak (Rp)')}
                {field('utangLainnya', 'Utang Lainnya (Rp)')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.4rem 0', borderTop: '1px dashed var(--color-border)' }}>
                <span>Total Utang Jangka Pendek</span>
                <span>{formatRupiah(totals.totalUtangJangkaPendek)}</span>
              </div>

              <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>Utang Jangka Panjang</h4>
              <div className="form-grid">
                {field('utangJangkaPanjang', 'Utang Jangka Panjang (Rp)')}
              </div>

              <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>Modal</h4>
              <div className="form-grid">
                {field('modalUsaha', 'Modal Usaha (Rp)')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                <span>Laba Berjalan (otomatis dari Rugi Laba)</span>
                <span>{formatRupiah(totals.labaRugi)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.4rem 0', borderTop: '1px dashed var(--color-border)' }}>
                <span>Total Modal</span>
                <span>{formatRupiah(totals.totalModal)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', padding: '0.6rem 0', marginTop: '0.5rem', borderTop: '2px solid var(--color-border)', color: 'var(--color-primary)' }}>
                <span>TOTAL PASIVA</span>
                <span>{formatRupiah(totals.totalPasiva)}</span>
              </div>

              {!balanced && (
                <div className="alert alert--error" style={{ marginTop: '0.75rem' }}>
                  Total Aktiva ({formatRupiah(totals.totalAktiva)}) belum sama dengan Total Pasiva ({formatRupiah(totals.totalPasiva)}). Selisih: {formatRupiah(totals.totalAktiva - totals.totalPasiva)}.
                </div>
              )}
            </div>

            {/* LAPORAN RUGI LABA */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>LAPORAN RUGI LABA — PER 31 DESEMBER {year}</h3>

              <div className="form-grid">
                {field('pendapatan', 'Pendapatan (Rp)')}
              </div>

              <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>Biaya-Biaya</h4>
              <div className="form-grid">
                {field('biayaGaji', 'Biaya Gaji (Rp)')}
                {field('biayaAtkBahan', 'Biaya ATK (Bahan) (Rp)')}
                {field('biayaListrik', 'Biaya Listrik (Rp)')}
                {field('biayaTelpon', 'Biaya Telpon (Rp)')}
                {field('biayaTransport', 'Biaya Transport (Rp)')}
                {field('biayaSewa', 'Biaya Sewa (Rp)')}
                {field('biayaLainLain', 'Biaya dan Lain-lain (Rp)')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.4rem 0', borderTop: '1px dashed var(--color-border)' }}>
                <span>Total Biaya</span>
                <span>{formatRupiah(totals.totalBiaya)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  padding: '0.6rem 0',
                  marginTop: '0.5rem',
                  borderTop: '2px solid var(--color-border)',
                  color: totals.labaRugi >= 0 ? '#15803d' : '#b91c1c',
                }}
              >
                <span>LABA (RUGI)</span>
                <span>{formatRupiah(totals.labaRugi)}</span>
              </div>

              <h4 style={{ marginBottom: '0.5rem', marginTop: '1.5rem' }}>Tanda Tangan</h4>
              {isEditing ? (
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="neraca-tempat-ttd">Tempat</label>
                    <input
                      id="neraca-tempat-ttd"
                      value={form.tempatTandaTangan}
                      onChange={(e) => setForm((f) => ({ ...f, tempatTandaTangan: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="neraca-tanggal-ttd">Tanggal</label>
                    <input
                      id="neraca-tanggal-ttd"
                      type="date"
                      value={form.tanggalTandaTangan}
                      onChange={(e) => setForm((f) => ({ ...f, tanggalTandaTangan: e.target.value }))}
                    />
                  </div>
                  <div className="form-field form-field--full">
                    <label htmlFor="neraca-nama-ttd">Nama Penandatangan</label>
                    <input
                      id="neraca-nama-ttd"
                      value={form.namaPenandatangan}
                      onChange={(e) => setForm((f) => ({ ...f, namaPenandatangan: e.target.value }))}
                    />
                  </div>
                  <div className="form-field form-field--full">
                    <label htmlFor="neraca-logo-perusahaan">Pilihan Logo (Stempel Cetak Neraca1 &amp; Neraca2)</label>
                    <select
                      id="neraca-logo-perusahaan"
                      value={form.logoPerusahaanId}
                      onChange={(e) => setForm((f) => ({ ...f, logoPerusahaanId: e.target.value }))}
                    >
                      <option value="">-- Pilih Logo Perusahaan --</option>
                      {logoOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.namaKlinik}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.9rem' }}>
                  {form.tempatTandaTangan},{' '}
                  {new Date(form.tanggalTandaTangan).toLocaleDateString('id-ID', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                  <br />
                  <strong>{form.namaPenandatangan || '( ................................. )'}</strong>
                  <br />
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    Logo untuk Cetak Neraca1 &amp; Neraca2:{' '}
                    {logoOptions.find((o) => o.id === form.logoPerusahaanId)?.namaKlinik ?? '(default)'}
                  </span>
                </p>
              )}
            </div>
          </div>

          {isEditing && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void fetchData()}
                disabled={saving}
                style={{ border: '1px solid var(--color-border)' }}
              >
                Batal
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Laporan Neraca'}
              </button>
            </div>
          )}
        </form>
      </ListPageShell>

      <SharingPdfPreviewModal
        open={previewModalOpen}
        blob={previewBlob}
        filename={`Laporan_Neraca_${year}.pdf`}
        onClose={() => setPreviewModalOpen(false)}
        title="Pratinjau Laporan Neraca"
      />
    </>
  );
}
