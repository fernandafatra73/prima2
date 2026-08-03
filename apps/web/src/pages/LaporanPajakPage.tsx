import { useCallback, useEffect, useState } from 'react';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { SharingPdfPreviewModal } from '../components/ui/SharingPdfPreviewModal.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { apiDelete, apiGet, apiPatch } from '../lib/api.ts';
import { formatRupiah } from '../lib/format.ts';
import {
  LaporanPajakReportDocument,
  type LaporanPajakReportData,
} from '../pdf/LaporanPajakReportDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { pdf } from '@react-pdf/renderer';
import '../components/ui/ui.css';

interface BulanPajakItem {
  readonly no: number;
  readonly bulan: string;
  readonly jumlahPasien: number;
  readonly harga: number;
  readonly totalPenerimaan: number;
  readonly pajak: number;
  readonly isOverride: boolean;
}

interface LaporanPajakData {
  readonly year: number;
  readonly tarifPajak: number;
  readonly bulan: readonly BulanPajakItem[];
  readonly totalJumlahPasien: number;
  readonly totalPenerimaan: number;
  readonly totalPajak: number;
}

interface LaporanPajakPageProps {
  readonly modul?: 'RADIOLOGI' | 'LABORATORIUM';
}

export function LaporanPajakPage({ modul = 'RADIOLOGI' }: LaporanPajakPageProps) {
  const currentYear = new Date().getFullYear();
  const moduleLabel = modul === 'RADIOLOGI' ? 'Radiologi' : 'Laboratorium';
  const [year, setYear] = useState<number>(currentYear);
  const [data, setData] = useState<LaporanPajakData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [printingPdf, setPrintingPdf] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const [editing, setEditing] = useState<BulanPajakItem | null>(null);
  const [editForm, setEditForm] = useState({ jumlahPasien: '0', harga: '0' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingBulan, setResettingBulan] = useState<number | null>(null);
  const [bulananJumlahPasien, setBulananJumlahPasien] = useState<Record<number, number>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<LaporanPajakData>(
        `/api/laporan/pajak?year=${year}&modul=${modul}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan pajak');
    } finally {
      setLoading(false);
    }
  }, [year, modul]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    apiGet<{ bulan: readonly { readonly no: number; readonly jumlahPasien: number }[] }>(
      `/api/laporan/pajak-bulanan?year=${year}&modul=${modul}`,
    )
      .then((res) => {
        const map: Record<number, number> = {};
        for (const b of res.bulan) map[b.no] = b.jumlahPasien;
        setBulananJumlahPasien(map);
      })
      .catch(() => setBulananJumlahPasien({}));
  }, [year, modul]);

  const yearOptions = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  function openEdit(item: BulanPajakItem) {
    const jumlahPasienOtomatis = bulananJumlahPasien[item.no];
    setEditForm({
      jumlahPasien: String(jumlahPasienOtomatis ?? item.jumlahPasien),
      harga: String(item.harga),
    });
    setError(null);
    setEditing(item);
  }

  const editTotalPenerimaan = (Number(editForm.jumlahPasien) || 0) * (Number(editForm.harga) || 0);

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setError(null);
    try {
      await apiPatch('/api/laporan/pajak/override', {
        year,
        bulan: editing.no,
        modul,
        jumlahPasien: Number(editForm.jumlahPasien) || 0,
        harga: Number(editForm.harga) || 0,
      });
      setEditing(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan koreksi pajak');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleReset(item: BulanPajakItem) {
    setResettingBulan(item.no);
    setError(null);
    try {
      await apiDelete(`/api/laporan/pajak/override?year=${year}&bulan=${item.no}&modul=${modul}`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal reset ke hitungan otomatis');
    } finally {
      setResettingBulan(null);
    }
  }

  async function buildReportData(): Promise<LaporanPajakReportData> {
    const logoSrc = await loadLogoDataUrl().catch(() => '');
    return {
      logoSrc,
      moduleLabel,
      year,
      tanggalCetak: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      items: (data?.bulan ?? []).map((b) => ({
        no: b.no,
        bulan: b.bulan,
        jumlahPasien: String(b.jumlahPasien),
        hargaFormatted: formatRupiah(b.harga),
        totalPenerimaanFormatted: formatRupiah(b.totalPenerimaan),
        pajakFormatted: formatRupiah(b.pajak),
      })),
      totalJumlahPasien: String(data?.totalJumlahPasien ?? 0),
      totalPenerimaanFormatted: formatRupiah(data?.totalPenerimaan ?? 0),
      totalPajakFormatted: formatRupiah(data?.totalPajak ?? 0),
    };
  }

  async function handleCetakPdf() {
    setPrintingPdf(true);
    try {
      const reportData = await buildReportData();
      const blob = await pdf(<LaporanPajakReportDocument data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Laporan_Pajak_${moduleLabel}_${year}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setPrintingPdf(false);
    }
  }

  async function handlePreviewPdf() {
    setPreviewingPdf(true);
    try {
      const reportData = await buildReportData();
      const blob = await pdf(<LaporanPajakReportDocument data={reportData} />).toBlob();
      setPreviewBlob(blob);
      setPreviewModalOpen(true);
    } finally {
      setPreviewingPdf(false);
    }
  }

  return (
    <>
      <ListPageShell
        title={`Laporan Pajak ${moduleLabel}`}
        subtitle={`Rekap bulanan Jumlah Pasien & Total Penerimaan ${moduleLabel} beserta estimasi PPh Final UMKM (0.5% dari Total Penerimaan, sesuai PP 23/2018), dihitung dari arsip Duplikat ${moduleLabel} — bisa dikoreksi manual per bulan`}
        metrics={[
          {
            label: 'Total Pasien Setahun',
            value: String(data?.totalJumlahPasien ?? 0),
            tone: 'blue',
            iconKind: 'clipboard',
          },
          {
            label: 'Total Penerimaan Setahun',
            value: formatRupiah(data?.totalPenerimaan ?? 0),
            tone: 'green',
            iconKind: 'document',
          },
          {
            label: 'Total Pajak (0.5%)',
            value: formatRupiah(data?.totalPajak ?? 0),
            tone: 'amber',
            iconKind: 'percent',
          },
        ]}
        onRefresh={() => void fetchData()}
        error={error}
        loading={loading}
        filterExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="form-field" style={{ minWidth: '130px', margin: 0 }}>
              <label htmlFor="filter-year-pajak">Tahun</label>
              <select
                id="filter-year-pajak"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
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
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Bulan</th>
                <th style={{ textAlign: 'right' }}>Jumlah Pasien</th>
                <th style={{ textAlign: 'right' }}>Harga (Rata-rata)</th>
                <th style={{ textAlign: 'right' }}>Total Penerimaan</th>
                <th style={{ textAlign: 'right' }}>Pajak (0.5%)</th>
                <th style={{ width: '90px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!data || data.bulan.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Belum ada data untuk tahun {year}.
                  </td>
                </tr>
              ) : (
                data.bulan.map((b) => (
                  <tr key={b.no}>
                    <td>{b.no}</td>
                    <td style={{ fontWeight: 600 }}>
                      {b.bulan}
                      {b.isOverride && (
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#0369a1',
                            background: '#e0f2fe',
                            border: '1px solid #7dd3fc',
                            borderRadius: '999px',
                            padding: '0.1rem 0.5rem',
                          }}
                        >
                          Manual
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{b.jumlahPasien}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(b.harga)}</td>
                    <td style={{ textAlign: 'right' }}>{formatRupiah(b.totalPenerimaan)}</td>
                    <td style={{ textAlign: 'right', color: '#b45309', fontWeight: 600 }}>
                      {formatRupiah(b.pajak)}
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <TableRowActions onEdit={() => openEdit(b)} editLabel="Koreksi manual bulan ini" />
                        {b.isOverride && (
                          <button
                            type="button"
                            className="icon-btn"
                            title="Reset ke hitungan otomatis"
                            aria-label="Reset ke hitungan otomatis"
                            onClick={() => void handleReset(b)}
                            disabled={resettingBulan === b.no}
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data && data.bulan.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={2} style={{ textAlign: 'right' }}>
                    Total
                  </td>
                  <td style={{ textAlign: 'right' }}>{data.totalJumlahPasien}</td>
                  <td />
                  <td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>
                    {formatRupiah(data.totalPenerimaan)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b45309' }}>
                    {formatRupiah(data.totalPajak)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
          * Pajak dihitung 0.5% dari Total Penerimaan (estimasi PPh Final UMKM sesuai PP 23/2018),
          berdasarkan data pasien radiologi yang tercatat di sistem (arsip Duplikat Radiologi).
          Baris berlabel &quot;Manual&quot; sudah dikoreksi admin dan tidak lagi mengikuti hitungan
          otomatis sampai direset. Untuk pelaporan &amp; pembayaran resmi, gunakan portal DJP di{' '}
          <a href="https://sse2.pajak.go.id/index" target="_blank" rel="noopener noreferrer">
            sse2.pajak.go.id
          </a>
          .
        </p>
      </ListPageShell>

      {editing && (
        <Modal
          open={true}
          title={`Koreksi Manual — ${editing.bulan} ${year}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={(e) => void handleEditSubmit(e)} className="form-grid">
            <div className="form-field">
              <label htmlFor="pajak-edit-jumlah">Jumlah Pasien *</label>
              <input
                id="pajak-edit-jumlah"
                type="number"
                min="0"
                step="1"
                required
                value={editForm.jumlahPasien}
                onChange={(e) => setEditForm((f) => ({ ...f, jumlahPasien: e.target.value }))}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Otomatis terisi dari Jumlah Pasien di Laporan Pajak Bulanan — bisa diubah manual bila perlu.
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="pajak-edit-harga">Harga (Rata-rata, Rp) *</label>
              <input
                id="pajak-edit-harga"
                type="number"
                min="0"
                step="1"
                required
                value={editForm.harga}
                onChange={(e) => setEditForm((f) => ({ ...f, harga: e.target.value }))}
              />
            </div>
            <div
              className="form-field form-field--full"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                padding: '0.5rem 0',
                borderTop: '1px dashed var(--color-border)',
              }}
            >
              <span>Total Penerimaan (Jumlah Pasien × Harga)</span>
              <span style={{ color: 'var(--color-primary)' }}>
                {formatRupiah(editTotalPenerimaan)}
              </span>
            </div>
            <div
              className="form-field form-field--full"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                padding: '0.5rem 0',
                borderTop: '1px dashed var(--color-border)',
              }}
            >
              <span>Pajak (0.5% dari Total Penerimaan)</span>
              <span style={{ color: '#b45309' }}>
                {formatRupiah(editTotalPenerimaan * 0.005)}
              </span>
            </div>
            <ModalFormFooter
              onCancel={() => setEditing(null)}
              submitLabel="Simpan Koreksi"
              loading={savingEdit}
            />
          </form>
        </Modal>
      )}

      <SharingPdfPreviewModal
        open={previewModalOpen}
        blob={previewBlob}
        filename={`Laporan_Pajak_${moduleLabel}_${year}.pdf`}
        onClose={() => setPreviewModalOpen(false)}
        title={`Pratinjau Laporan Pajak ${moduleLabel}`}
      />
    </>
  );
}
