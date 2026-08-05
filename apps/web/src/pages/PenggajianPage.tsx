import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { SharingPdfPreviewModal } from '../components/ui/SharingPdfPreviewModal.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import { formatRupiah } from '../lib/format.ts';
import {
  GajiKaryawanReportDocument,
  type GajiKaryawanReportData,
} from '../pdf/GajiKaryawanReportDocument.tsx';
import { SlipGajiReportDocument, type SlipGajiReportData } from '../pdf/SlipGajiReportDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { terbilangRupiah } from '../lib/terbilang.ts';
import { pdf } from '@react-pdf/renderer';
import '../components/ui/ui.css';

interface GajiKaryawanRecord {
  readonly id: string;
  readonly namaKaryawan: string;
  readonly jabatan: string | null;
  readonly bulan: string;
  readonly tanggal: string;
  readonly gajiPokok: string;
  readonly tunjangan: string;
  readonly potongan: string;
  readonly gajiBersih: string;
}

interface KaryawanItem {
  readonly id: string;
  readonly nama: string;
  readonly jabatan: string | null;
  readonly departemen: string;
}

interface KaryawanKlinikItem {
  readonly id: string;
  readonly nama: string;
  readonly spesialisasi: string | null;
}

/** Baris tabel penggajian — gabungan karyawan (semua departemen) dengan data gaji tersimpan (kalau ada) untuk bulan terpilih. */
interface PenggajianRow {
  readonly namaKaryawan: string;
  readonly jabatan: string | null;
  readonly departemen: string;
  readonly gaji: GajiKaryawanRecord | null;
}

// Estimasi kasar PPh 21 bulanan berbasis bracket penghasilan bruto (gaji pokok +
// tunjangan) — BUKAN tabel TER resmi DJP. Nilainya hanya perkiraan untuk
// gambaran potongan pajak. Sinkron dengan logika di GajiKaryawanPage.tsx.
function estimasiPph21(grossMonthly: number): number {
  if (grossMonthly <= 5_000_000) return 0;
  if (grossMonthly <= 10_000_000) return grossMonthly * 0.05;
  if (grossMonthly <= 20_000_000) return grossMonthly * 0.1;
  if (grossMonthly <= 50_000_000) return grossMonthly * 0.15;
  return grossMonthly * 0.25;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatBulanLabel(bulan: string): string {
  const [y, m] = bulan.split('-');
  if (!y || !m) return bulan;
  const names = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const idx = Number(m) - 1;
  return names[idx] ? `${names[idx]} ${y}` : bulan;
}

const DEPARTEMEN_LABEL: Record<string, string> = {
  RADIOLOGI: 'Radiologi',
  LABORATORIUM: 'Laboratorium',
  KLINIK: 'Klinik',
};

const emptyForm = {
  namaKaryawan: '',
  jabatan: '',
  bulan: currentMonth(),
  tanggal: new Date().toISOString().split('T')[0]!,
  gajiPokok: '',
  tunjangan: '0',
  potongan: '0',
};

export function PenggajianPage() {
  const [bulanFilter, setBulanFilter] = useState(currentMonth());
  const [search, setSearch] = useState('');

  const [karyawanList, setKaryawanList] = useState<KaryawanItem[]>([]);
  const [karyawanKlinikList, setKaryawanKlinikList] = useState<KaryawanKlinikItem[]>([]);
  const [gajiList, setGajiList] = useState<GajiKaryawanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [karyawanRes, klinikRes, gajiRes] = await Promise.all([
        apiGet<{ items: KaryawanItem[] }>('/api/karyawan?limit=500'),
        apiGet<{ items: KaryawanKlinikItem[] }>('/api/karyawan-klinik?limit=500'),
        apiGet<{ items: GajiKaryawanRecord[] }>(`/api/gaji-karyawan?bulan=${bulanFilter}&limit=500`),
      ]);
      setKaryawanList(karyawanRes.items);
      setKaryawanKlinikList(klinikRes.items);
      setGajiList(gajiRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data penggajian');
    } finally {
      setLoading(false);
    }
  }, [bulanFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GajiKaryawanRecord | null>(null);
  const [deleting, setDeleting] = useState<GajiKaryawanRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [printingPdf, setPrintingPdf] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [printingSlipFor, setPrintingSlipFor] = useState<string | null>(null);
  const [slipPreviewOpen, setSlipPreviewOpen] = useState(false);
  const [slipPreviewBlob, setSlipPreviewBlob] = useState<Blob | null>(null);
  const [slipPreviewFilename, setSlipPreviewFilename] = useState('Slip_Gaji.pdf');

  // Gabungkan semua karyawan (Radiologi + Laboratorium + Klinik) dengan data gaji
  // bulan terpilih (kalau sudah pernah diisi) — supaya setiap karyawan otomatis
  // tampil sebagai satu baris siap diisi, tanpa perlu klik "+ Tambah" satu-satu.
  const rows = useMemo<PenggajianRow[]>(() => {
    const gajiByNama = new Map(gajiList.map((g) => [g.namaKaryawan, g]));
    const combined: PenggajianRow[] = [
      ...karyawanList.map((k) => ({
        namaKaryawan: k.nama,
        jabatan: k.jabatan,
        departemen: k.departemen,
        gaji: gajiByNama.get(k.nama) ?? null,
      })),
      ...karyawanKlinikList.map((k) => ({
        namaKaryawan: k.nama,
        jabatan: k.spesialisasi,
        departemen: 'KLINIK',
        gaji: gajiByNama.get(k.nama) ?? null,
      })),
    ];
    const q = search.trim().toLowerCase();
    const filtered = q ? combined.filter((r) => r.namaKaryawan.toLowerCase().includes(q)) : combined;
    return filtered.sort((a, b) => a.namaKaryawan.localeCompare(b.namaKaryawan));
  }, [karyawanList, karyawanKlinikList, gajiList, search]);

  function computePph21(g: GajiKaryawanRecord): number {
    return estimasiPph21(Number(g.gajiPokok) + Number(g.tunjangan));
  }

  function computeTakeHome(g: GajiKaryawanRecord): number {
    return Number(g.gajiBersih) - computePph21(g);
  }

  const totals = useMemo(() => {
    const filled = rows.filter((r) => r.gaji);
    const totalGajiBersih = filled.reduce((sum, r) => sum + Number(r.gaji!.gajiBersih || 0), 0);
    const totalPph21 = filled.reduce((sum, r) => sum + computePph21(r.gaji!), 0);
    const totalTakeHome = filled.reduce((sum, r) => sum + computeTakeHome(r.gaji!), 0);
    return { totalGajiBersih, totalPph21, totalTakeHome, sudahDiisi: filled.length };
  }, [rows]);

  const gajiBersihPreview = useMemo(() => {
    const pokok = Number(form.gajiPokok) || 0;
    const tunj = Number(form.tunjangan) || 0;
    const pot = Number(form.potongan) || 0;
    return pokok + tunj - pot;
  }, [form.gajiPokok, form.tunjangan, form.potongan]);

  const pph21Preview = useMemo(() => {
    const pokok = Number(form.gajiPokok) || 0;
    const tunj = Number(form.tunjangan) || 0;
    return estimasiPph21(pokok + tunj);
  }, [form.gajiPokok, form.tunjangan]);

  function openFillRow(row: PenggajianRow) {
    setEditing(row.gaji);
    setForm({
      namaKaryawan: row.namaKaryawan,
      jabatan: row.jabatan ?? '',
      bulan: bulanFilter,
      tanggal: row.gaji?.tanggal.split('T')[0] ?? new Date().toISOString().split('T')[0]!,
      gajiPokok: row.gaji?.gajiPokok ?? '',
      tunjangan: row.gaji?.tunjangan ?? '0',
      potongan: row.gaji?.potongan ?? '0',
    });
    setFormError(null);
    setCreateOpen(true);
  }

  function closeModal() {
    setCreateOpen(false);
    setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const body = {
        namaKaryawan: form.namaKaryawan,
        jabatan: form.jabatan || undefined,
        bulan: form.bulan,
        tanggal: form.tanggal,
        gajiPokok: Number(form.gajiPokok),
        tunjangan: Number(form.tunjangan) || 0,
        potongan: Number(form.potongan) || 0,
      };
      if (editing) {
        await apiPatch(`/api/gaji-karyawan/${editing.id}`, body);
      } else {
        await apiPost('/api/gaji-karyawan', body);
      }
      closeModal();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data gaji');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/gaji-karyawan/${deleting.id}`);
      setDeleting(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data gaji');
    } finally {
      setSubmitting(false);
    }
  }

  async function buildReportData(): Promise<GajiKaryawanReportData> {
    const logoSrc = await loadLogoDataUrl().catch(() => '');
    const filled = rows.filter((r) => r.gaji);
    return {
      logoSrc,
      bulanLabel: formatBulanLabel(bulanFilter),
      tanggalCetak: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      items: filled.map((r, idx) => ({
        no: idx + 1,
        namaKaryawan: r.namaKaryawan,
        jabatan: r.jabatan || '—',
        gajiPokokFormatted: formatRupiah(r.gaji!.gajiPokok),
        tunjanganFormatted: formatRupiah(r.gaji!.tunjangan),
        potonganFormatted: formatRupiah(r.gaji!.potongan),
        gajiBersihFormatted: formatRupiah(r.gaji!.gajiBersih),
        pph21Formatted: formatRupiah(computePph21(r.gaji!)),
        takeHomeFormatted: formatRupiah(computeTakeHome(r.gaji!)),
      })),
      totalGajiBersihFormatted: formatRupiah(totals.totalGajiBersih),
      totalPph21Formatted: formatRupiah(totals.totalPph21),
      totalTakeHomeFormatted: formatRupiah(totals.totalTakeHome),
    };
  }

  async function handleCetakPdf() {
    setPrintingPdf(true);
    try {
      const data = await buildReportData();
      const blob = await pdf(<GajiKaryawanReportDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Penggajian_${bulanFilter}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setPrintingPdf(false);
    }
  }

  async function handlePreviewPdf() {
    setPreviewingPdf(true);
    try {
      const data = await buildReportData();
      const blob = await pdf(<GajiKaryawanReportDocument data={data} />).toBlob();
      setPreviewBlob(blob);
      setPreviewModalOpen(true);
    } finally {
      setPreviewingPdf(false);
    }
  }

  async function handleCetakSlip(row: PenggajianRow) {
    if (!row.gaji) return;
    setPrintingSlipFor(row.namaKaryawan);
    try {
      const logoSrc = await loadLogoDataUrl().catch(() => '');
      const takeHome = computeTakeHome(row.gaji);
      const data: SlipGajiReportData = {
        logoSrc,
        namaKaryawan: row.namaKaryawan,
        jabatan: row.jabatan || '',
        departemenLabel: DEPARTEMEN_LABEL[row.departemen] ?? row.departemen,
        bulanLabel: formatBulanLabel(bulanFilter),
        tanggalCetak: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
        gajiPokokFormatted: formatRupiah(row.gaji.gajiPokok),
        tunjanganFormatted: formatRupiah(row.gaji.tunjangan),
        potonganFormatted: formatRupiah(row.gaji.potongan),
        gajiBersihFormatted: formatRupiah(row.gaji.gajiBersih),
        pph21Formatted: formatRupiah(computePph21(row.gaji)),
        takeHomeFormatted: formatRupiah(takeHome),
        takeHomeTerbilang: terbilangRupiah(takeHome),
      };
      const blob = await pdf(<SlipGajiReportDocument data={data} />).toBlob();
      setSlipPreviewFilename(`Slip_Gaji_${row.namaKaryawan.replace(/[^a-zA-Z0-9]/g, '_')}_${bulanFilter}.pdf`);
      setSlipPreviewBlob(blob);
      setSlipPreviewOpen(true);
    } finally {
      setPrintingSlipFor(null);
    }
  }

  return (
    <>
      <ListPageShell
        title="Penggajian"
        subtitle="Gaji seluruh karyawan (Radiologi, Laboratorium, Klinik) per bulan — baris otomatis terisi dari Daftar Karyawan, tinggal isi nominal gajinya"
        metrics={[
          { label: 'Total Karyawan', value: String(rows.length), tone: 'blue', iconKind: 'clipboard' },
          { label: 'Sudah Diisi', value: `${totals.sudahDiisi} / ${rows.length}`, tone: 'violet', iconKind: 'document' },
          { label: 'Total Gaji Bersih', value: formatRupiah(totals.totalGajiBersih), tone: 'green', iconKind: 'percent' },
          { label: 'Take Home Pay', value: formatRupiah(totals.totalTakeHome), tone: 'green', iconKind: 'clipboard' },
        ]}
        searchPlaceholder="Cari nama karyawan..."
        searchValue={search}
        onSearchChange={setSearch}
        onRefresh={() => void loadAll()}
        filterExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="month"
              value={bulanFilter}
              onChange={(e) => setBulanFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              aria-label="Filter bulan"
            />
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => void handleCetakPdf()}
              disabled={printingPdf || previewingPdf}
            >
              🖨️ {printingPdf ? 'Membuat PDF...' : 'Cetak PDF'}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void handlePreviewPdf()}
              disabled={previewingPdf || printingPdf}
              style={{ border: '1px solid var(--color-border)' }}
            >
              👁️ {previewingPdf ? 'Memuat...' : 'Preview PDF'}
            </button>
          </div>
        }
        error={error}
        loading={loading}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Karyawan</th>
                <th>Jabatan</th>
                <th>Departemen</th>
                <th style={{ textAlign: 'right' }}>Gaji Pokok</th>
                <th style={{ textAlign: 'right' }}>Tunjangan</th>
                <th style={{ textAlign: 'right' }}>Potongan</th>
                <th style={{ textAlign: 'right' }}>Gaji Bersih</th>
                <th style={{ textAlign: 'right' }}>Take Home Pay</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Belum ada data karyawan. Tambahkan karyawan lewat menu Daftar Karyawan terlebih dahulu.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={`${row.departemen}-${row.namaKaryawan}`}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{row.namaKaryawan}</td>
                    <td>{row.jabatan || '—'}</td>
                    <td>{DEPARTEMEN_LABEL[row.departemen] ?? row.departemen}</td>
                    {row.gaji ? (
                      <>
                        <td style={{ textAlign: 'right' }}>{formatRupiah(row.gaji.gajiPokok)}</td>
                        <td style={{ textAlign: 'right' }}>{formatRupiah(row.gaji.tunjangan)}</td>
                        <td style={{ textAlign: 'right' }}>{formatRupiah(row.gaji.potongan)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatRupiah(row.gaji.gajiBersih)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                          {formatRupiah(computeTakeHome(row.gaji))}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
                              fontSize: '0.72rem', fontWeight: 700, color: '#15803d',
                              background: '#f0fdf4', border: '1px solid #bbf7d0',
                            }}
                          >
                            SUDAH DIISI
                          </span>
                        </td>
                        <td>
                          <TableRowActions
                            onEdit={() => openFillRow(row)}
                            onDelete={() => setDeleting(row.gaji)}
                            onPrint={() => void handleCetakSlip(row)}
                            editLabel="Ubah gaji"
                            deleteLabel="Hapus data gaji"
                            printLabel={printingSlipFor === row.namaKaryawan ? 'Menyiapkan slip...' : 'Preview slip gaji perorangan'}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Belum diisi untuk {formatBulanLabel(bulanFilter)}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
                              fontSize: '0.72rem', fontWeight: 700, color: '#b45309',
                              background: '#fffbeb', border: '1px solid #fde68a',
                            }}
                          >
                            BELUM DIISI
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--xs btn--primary"
                            onClick={() => openFillRow(row)}
                          >
                            + Isi Gaji
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ListPageShell>

      {createOpen && (
        <Modal
          open={true}
          title={editing ? 'Ubah Gaji Karyawan' : 'Isi Gaji Karyawan'}
          onClose={closeModal}
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
            {formError && <p className="alert alert--error">{formError}</p>}
            <div className="form-field form-field--full">
              <label htmlFor="pg-nama">Nama Karyawan</label>
              <input id="pg-nama" required value={form.namaKaryawan} readOnly disabled />
            </div>
            <div className="form-field">
              <label htmlFor="pg-jabatan">Jabatan</label>
              <input
                id="pg-jabatan"
                value={form.jabatan}
                onChange={(e) => setForm((f) => ({ ...f, jabatan: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="pg-bulan">Bulan *</label>
              <input id="pg-bulan" type="month" required value={form.bulan} readOnly disabled />
            </div>
            <div className="form-field">
              <label htmlFor="pg-tanggal">Tanggal *</label>
              <input
                id="pg-tanggal"
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="pg-pokok">Gaji Pokok (Rp) *</label>
              <input
                id="pg-pokok"
                type="number"
                min="0"
                step="1"
                required
                value={form.gajiPokok}
                onChange={(e) => setForm((f) => ({ ...f, gajiPokok: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="pg-tunjangan">Tunjangan (Rp)</label>
              <input
                id="pg-tunjangan"
                type="number"
                min="0"
                step="1"
                value={form.tunjangan}
                onChange={(e) => setForm((f) => ({ ...f, tunjangan: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="pg-potongan">Potongan (Rp)</label>
              <input
                id="pg-potongan"
                type="number"
                min="0"
                step="1"
                value={form.potongan}
                onChange={(e) => setForm((f) => ({ ...f, potongan: e.target.value }))}
              />
            </div>
            <div
              className="form-field form-field--full"
              style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.5rem 0', borderTop: '1px dashed var(--color-border)' }}
            >
              <span>Gaji Bersih</span>
              <span style={{ color: 'var(--color-primary)' }}>{formatRupiah(gajiBersihPreview)}</span>
            </div>
            <div
              className="form-field form-field--full"
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#b45309' }}
            >
              <span>Estimasi PPh 21 (perkiraan kasar)</span>
              <span>{formatRupiah(pph21Preview)}</span>
            </div>
            <div
              className="form-field form-field--full"
              style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.5rem 0', borderTop: '1px dashed var(--color-border)' }}
            >
              <span>Take Home Pay</span>
              <span style={{ color: '#15803d' }}>{formatRupiah(gajiBersihPreview - pph21Preview)}</span>
            </div>
            <ModalFormFooter onCancel={closeModal} submitLabel={editing ? 'Simpan Perubahan' : 'Simpan'} loading={submitting} />
          </form>
        </Modal>
      )}

      <ConfirmModal
        open={deleting !== null}
        title="Hapus Data Gaji"
        message={`Yakin hapus data gaji "${deleting?.namaKaryawan ?? ''}" untuk periode ${deleting ? formatBulanLabel(deleting.bulan) : ''}? Baris karyawan akan kembali berstatus "Belum Diisi".`}
        loading={submitting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />

      <SharingPdfPreviewModal
        open={previewModalOpen}
        blob={previewBlob}
        filename={`Penggajian_${bulanFilter}.pdf`}
        onClose={() => setPreviewModalOpen(false)}
        title="Pratinjau Penggajian"
      />

      <SharingPdfPreviewModal
        open={slipPreviewOpen}
        blob={slipPreviewBlob}
        filename={slipPreviewFilename}
        onClose={() => setSlipPreviewOpen(false)}
        title="Pratinjau Slip Gaji"
      />
    </>
  );
}
