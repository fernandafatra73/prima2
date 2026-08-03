import { useState } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete } from '../lib/api.ts';
import { formatUmurTahun } from '../lib/format.ts';
import { groupLabRowsForPdf, parseLabKesan } from '../lib/labKesan.ts';
import { LabReportDocument, type LabReportData } from '../pdf/LabReportDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import '../components/ui/ui.css';

interface PasienDuplikatItem {
  readonly id: string;
  readonly regCode: string;
  readonly nama: string;
  readonly umur: number;
  readonly noTelepon: string | null;
  readonly alamat: string | null;
  readonly pengirimNama: string;
  readonly klinis: string | null;
  readonly kesan: string | null;
  readonly hasilStatus: 'MENUNGGU_HASIL' | 'SELESAI';
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly pemeriksaanNama: string;
  readonly createdAt: string;
}

function formatDateDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LabDuplikatPage() {
  const { search, setSearch } = useListSearch();
  const [hasilTab, setHasilTab] = useState<string>('all');
  const [hasilItem, setHasilItem] = useState<PasienDuplikatItem | null>(null);
  const [previewItem, setPreviewItem] = useState<PasienDuplikatItem | null>(null);
  const [logoSrc, setLogoSrc] = useState('');
  const [printing, setPrinting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PasienDuplikatItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const queryParams = useListQueryParams(
    { modul: 'LABORATORIUM', ...(hasilTab !== 'all' ? { hasilStatus: hasilTab } : {}) },
    search,
  );

  const { items, pagination, setPage, loading, error, setError, reload } =
    usePaginatedList<PasienDuplikatItem>('/api/pasien-duplikat', queryParams);

  const waitingCount = items.filter((i) => i.hasilStatus === 'MENUNGGU_HASIL').length;
  const doneCount = items.filter((i) => i.hasilStatus === 'SELESAI').length;

  function buildLabReportData(item: PasienDuplikatItem): LabReportData {
    const parsed = parseLabKesan(item.kesan);
    return {
      logoSrc,
      regCode: item.regCode,
      dokterNama: item.pengirimNama || '—',
      tanggalPemeriksaan: formatDateDisplay(item.createdAt),
      namaPasien: item.nama,
      umurLabel: formatUmurTahun(item.umur),
      alamat: item.alamat || '—',
      rows: groupLabRowsForPdf(parsed.rows),
      petugasLabNama: parsed.analisNama || undefined,
    };
  }

  function openPreview(item: PasienDuplikatItem) {
    setPreviewItem(item);
    if (!logoSrc) {
      void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
    }
  }

  async function handlePrint(item: PasienDuplikatItem) {
    setPrinting(true);
    try {
      const blob = await pdf(<LabReportDocument data={buildLabReportData(item)} />).toBlob();
      const cleanName = item.nama.trim().replace(/[/\\?%*:|"<>]/g, '_') || 'Pasien';
      downloadBlob(blob, `Hasil_Lab_${cleanName}.pdf`);
    } finally {
      setPrinting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/api/pasien-duplikat/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus arsip');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ListPageShell
      title="Duplikat Registrasi Lab"
      subtitle="Arsip salinan data registrasi laboratorium — tetap tersimpan walau data aslinya dihapus dari Registrasi Lab"
      metrics={[
        {
          label: 'Total data arsip',
          value: String(pagination.total),
          tone: 'blue',
          iconKind: 'clipboard',
        },
        {
          label: 'Menunggu hasil',
          value: String(waitingCount),
          tone: 'violet',
          iconKind: 'stethoscope',
        },
        {
          label: 'Selesai pemeriksaan',
          value: String(doneCount),
          tone: 'green',
          iconKind: 'document',
        },
      ]}
      tabs={[
        { id: 'all', label: 'Semua data' },
        { id: 'SELESAI', label: 'Selesai' },
        { id: 'MENUNGGU_HASIL', label: 'Menunggu hasil' },
      ]}
      activeTab={hasilTab}
      onTabChange={setHasilTab}
      searchPlaceholder="Cari nama pasien, reg code, alamat..."
      searchValue={search}
      onSearchChange={setSearch}
      onRefresh={() => void reload()}
      error={error}
      loading={loading}
      pagination={pagination}
      onPageChange={setPage}
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>Reg Code & Tanggal</th>
            <th>Nama Pasien</th>
            <th>Umur</th>
            <th>Dokter Pengirim</th>
            <th>Pemeriksaan</th>
            <th>Status Hasil</th>
            <th>Bayar</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                Belum ada data arsip registrasi laboratorium.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.regCode}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {formatDateDisplay(item.createdAt)}
                  </div>
                </td>
                <td>
                  <strong>{item.nama}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {item.alamat || '—'}
                  </div>
                </td>
                <td>{formatUmurTahun(item.umur)}</td>
                <td>{item.pengirimNama}</td>
                <td>{item.pemeriksaanNama || '—'}</td>
                <td>
                  <span
                    className={`badge ${item.hasilStatus === 'SELESAI' ? 'badge--ok' : 'badge--pending'}`}
                  >
                    {item.hasilStatus === 'SELESAI' ? 'SELESAI' : 'MENUNGGU HASIL'}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${item.paymentStatus === 'LUNAS' ? 'badge--ok' : 'badge--unpaid'}`}
                  >
                    {item.paymentStatus === 'LUNAS' ? 'Lunas' : 'Belum'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setHasilItem(item)}
                    >
                      ⚡ Hasil
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => openPreview(item)}
                      title="Preview & Cetak hasil lab"
                    >
                      🖨️ Cetak Preview
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setDeleteTarget(item)}
                      style={{ border: '1px solid var(--color-border)', color: '#ef4444' }}
                      title="Hapus arsip"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {hasilItem && (
        <Modal
          title={`Hasil Laboratorium — ${hasilItem.nama} (${hasilItem.regCode})`}
          open={true}
          onClose={() => setHasilItem(null)}
          size="lg"
        >
          <div
            style={{
              background: 'var(--color-surface-2, #f8fafc)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.35rem 1.5rem',
              fontSize: '0.85rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>No. Reg</span>
              <br />
              <strong>{hasilItem.regCode}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Dokter Pengirim</span>
              <br />
              <strong>{hasilItem.pengirimNama}</strong>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Klinis</span>
              <br />
              <strong>{hasilItem.klinis || '—'}</strong>
            </div>
          </div>

          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Klasifikasi</th>
                <th>Pemeriksaan</th>
                <th>Hasil</th>
                <th>Nilai Rujukan</th>
              </tr>
            </thead>
            <tbody>
              {parseLabKesan(hasilItem.kesan).rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.klasifikasi || '—'}</td>
                  <td>{row.pemeriksaan || '—'}</td>
                  <td>{row.hasil || '—'}</td>
                  <td>{row.nilaiRujukan || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {previewItem && (
        <Modal
          title={`Preview Hasil Lab — ${previewItem.nama} (${previewItem.regCode})`}
          open={true}
          onClose={() => setPreviewItem(null)}
          size="xl"
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void handlePrint(previewItem)}
              disabled={printing}
            >
              {printing ? 'Membuat PDF...' : '🖨️ Cetak PDF'}
            </button>
          </div>
          <div
            style={{
              width: '100%',
              height: '600px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              background: '#525659',
            }}
          >
            <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
              <LabReportDocument data={buildLabReportData(previewItem)} />
            </PDFViewer>
          </div>
        </Modal>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus Arsip"
        message={`Yakin hapus permanen arsip "${deleteTarget?.nama ?? ''}" (${deleteTarget?.regCode ?? ''})? Tindakan ini tidak bisa dibatalkan.`}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </ListPageShell>
  );
}
