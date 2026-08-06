import { useEffect, useState, type FormEvent } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { KesanRegioPicker } from '../components/KesanRegioPicker.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { apiDelete, apiPatch } from '../lib/api.ts';
import { clampClinicalInput } from '../lib/clinicalText.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { formatDateShort, formatRupiah, formatUmurDetail } from '../lib/format.ts';
import { formatRadiologName } from '../lib/pasienPrint.ts';
import { formatKlinisDisplay, parseKlinisData } from '../lib/penunjang.ts';
import { terbilangRupiah } from '../lib/terbilang.ts';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { KwitansiReportDocument, type KwitansiReportData } from '../pdf/KwitansiReportDocument.tsx';
import { printRadiologyReport } from '../pdf/printRadiologyReport.tsx';
import '../components/ui/ui.css';

interface PasienDuplikatItem {
  readonly id: string;
  readonly regCode: string;
  readonly nama: string;
  readonly umur: number;
  readonly tanggalLahir: string;
  readonly noTelepon: string | null;
  readonly alamat: string | null;
  readonly pengirimNama: string;
  readonly radiologNama: string | null;
  readonly klinis: string | null;
  readonly kesan: string | null;
  readonly hasilStatus: 'MENUNGGU_HASIL' | 'SELESAI';
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly pemeriksaanNama: string;
  readonly petugasKasir: string | null;
  readonly totalHarga: string;
  readonly createdAt: string;
}

const HASIL_TABS = [
  { id: 'all', label: 'Semua data' },
  { id: 'SELESAI', label: 'Selesai' },
  { id: 'MENUNGGU_HASIL', label: 'Menunggu hasil' },
] as const;

function formatDateDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function RadiologDuplikatPage() {
  const { search, setSearch } = useListSearch();
  const [hasilTab, setHasilTab] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [detailItem, setDetailItem] = useState<PasienDuplikatItem | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PasienDuplikatItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [logoSrc, setLogoSrc] = useState('');
  const [kwitansiItem, setKwitansiItem] = useState<PasienDuplikatItem | null>(null);
  const [quickEditItem, setQuickEditItem] = useState<PasienDuplikatItem | null>(null);
  const [quickEditNama, setQuickEditNama] = useState('');
  const [quickEditKesan, setQuickEditKesan] = useState('');
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);

  useEffect(() => {
    void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
  }, []);

  const queryParams = useListQueryParams(
    {
      modul: 'RADIOLOGI',
      ...(hasilTab !== 'all' ? { hasilStatus: hasilTab } : {}),
      ...(paymentFilter ? { paymentStatus: paymentFilter } : {}),
    },
    search,
  );

  const { items, pagination, setPage, loading, error, setError, reload } =
    usePaginatedList<PasienDuplikatItem>('/api/pasien-duplikat', queryParams);

  function combinedPemeriksaan(item: PasienDuplikatItem): string {
    const parsed = parseKlinisData(item.klinis);
    const list = [
      ...(item.pemeriksaanNama ? item.pemeriksaanNama.split(', ').filter(Boolean) : []),
      ...parsed.radTambahan.map((r) => `+Rad: ${r}`),
      ...parsed.labTambahan.map((l) => `+Lab: ${l}`),
    ];
    return list.join(', ') || '—';
  }

  function buildKwitansiData(item: PasienDuplikatItem): KwitansiReportData {
    return {
      logoSrc,
      noKwitansi: item.regCode,
      tanggal: formatDateShort(item.createdAt),
      namaPasien: item.nama,
      umur: formatUmurDetail(item.tanggalLahir, item.createdAt),
      alamat: item.alamat || '—',
      dokterPengirim: item.pengirimNama || '—',
      items: [
        { nama: combinedPemeriksaan(item), hargaFormatted: formatRupiah(item.totalHarga) },
      ],
      totalFormatted: formatRupiah(item.totalHarga),
      terbilang: terbilangRupiah(item.totalHarga),
      paymentStatus: item.paymentStatus,
      kasirNama: item.petugasKasir || '',
    };
  }

  async function handleDownloadKwitansi(item: PasienDuplikatItem) {
    const data = buildKwitansiData(item);
    const blob = await pdf(<KwitansiReportDocument data={data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Kwitansi_${item.regCode}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handlePrint(item: PasienDuplikatItem) {
    setPrintingId(item.id);
    try {
      await printRadiologyReport({
        regCode: item.regCode,
        nama: item.nama,
        umurLabel: formatUmurDetail(item.tanggalLahir, item.createdAt),
        tanggal: formatDateShort(item.createdAt),
        alamat: item.alamat?.trim() || '—',
        pemeriksaan: combinedPemeriksaan(item),
        dokterPengirim: item.pengirimNama,
        klinis: formatKlinisDisplay(item.klinis) || '—',
        kesan: item.kesan?.trim() || '—',
        radiologNama: formatRadiologName(item.radiologNama),
      });
    } finally {
      setPrintingId(null);
    }
  }

  function openQuickEdit(item: PasienDuplikatItem) {
    setQuickEditItem(item);
    setQuickEditNama(item.nama);
    setQuickEditKesan(item.kesan ?? '');
    setQuickEditError(null);
  }

  async function submitQuickEdit(e: FormEvent) {
    e.preventDefault();
    if (!quickEditItem) return;
    setQuickEditSaving(true);
    setQuickEditError(null);
    try {
      await apiPatch(`/api/pasien-duplikat/${quickEditItem.id}`, {
        nama: quickEditNama,
        kesan: quickEditKesan,
      });
      setQuickEditItem(null);
      await reload();
    } catch (err: unknown) {
      setQuickEditError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setQuickEditSaving(false);
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

  const metrics = [
    {
      label: 'Total data arsip',
      value: String(pagination.total),
      tone: 'slate' as const,
      iconKind: 'document' as const,
    },
    {
      label: 'Selesai',
      value: String(items.filter((i) => i.hasilStatus === 'SELESAI').length),
      tone: 'green' as const,
      iconKind: 'check' as const,
    },
    {
      label: 'Menunggu hasil',
      value: String(items.filter((i) => i.hasilStatus === 'MENUNGGU_HASIL').length),
      tone: 'amber' as const,
      iconKind: 'clock' as const,
    },
    {
      label: 'Jumlah Pendapatan Radiologi',
      value: formatRupiah(items.reduce((sum, i) => sum + Number(i.totalHarga || 0), 0)),
      tone: 'blue' as const,
      iconKind: 'document' as const,
    },
  ];

  return (
    <>
      <ListPageShell
        title="Duplikat Radiologi — Arsip Registrasi Radiologi"
        subtitle="Arsip salinan data registrasi radiologi — tetap tersimpan walau data aslinya dihapus dari Data & Registrasi Radiologi"
        metrics={metrics}
        tabs={HASIL_TABS.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={hasilTab}
        onTabChange={setHasilTab}
        selects={[
          {
            id: 'filter-bayar',
            label: 'Pembayaran',
            value: paymentFilter,
            placeholder: 'Semua',
            options: [
              { value: 'BELUM_LUNAS', label: 'Belum lunas' },
              { value: 'LUNAS', label: 'Lunas' },
            ],
            onChange: setPaymentFilter,
          },
        ]}
        searchPlaceholder="Cari nama, no. reg, telepon, dokter…"
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
              <th>Tgl / Reg</th>
              <th>Nama Pasien</th>
              <th>Umur</th>
              <th>Pengirim</th>
              <th>Pemeriksaan</th>
              <th>Hasil</th>
              <th>Bayar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8}>Tidak ada data arsip registrasi radiologi.</td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {formatDateDisplay(p.createdAt)}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.regCode}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.nama}</div>
                    {p.alamat && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {p.alamat}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatUmurDetail(p.tanggalLahir, p.createdAt)}</td>
                  <td>{p.pengirimNama}</td>
                  <td>{combinedPemeriksaan(p)}</td>
                  <td>
                    <span className={`badge ${p.hasilStatus === 'SELESAI' ? 'badge--ok' : 'badge--pending'}`}>
                      {p.hasilStatus === 'SELESAI' ? 'Selesai' : 'Menunggu'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${p.paymentStatus === 'LUNAS' ? 'badge--ok' : 'badge--unpaid'}`}>
                      {p.paymentStatus === 'LUNAS' ? 'Lunas' : 'Belum'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn--xs btn--ghost"
                        onClick={() => openQuickEdit(p)}
                        title="Edit cepat: nama & kesan"
                        style={{ border: '1px solid var(--color-border)' }}
                      >
                        Edit²
                      </button>
                      <TableRowActions
                        onEdit={() => setDetailItem(p)}
                        editLabel="Lihat detail & kesan radiologi"
                        onDelete={() => setDeleteTarget(p)}
                        deleteLabel="Hapus arsip"
                        onPrint={() => void handlePrint(p)}
                        printLabel={printingId === p.id ? 'Membuat PDF…' : 'Cetak / Preview hasil radiologi'}
                      />
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setKwitansiItem(p)}
                        title="Pratinjau & Cetak Kwitansi"
                      >
                        🧾 Kwitansi
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ListPageShell>

      <Modal
        open={detailItem !== null}
        title={detailItem ? `Detail Radiologi — ${detailItem.nama} (${detailItem.regCode})` : 'Detail'}
        onClose={() => setDetailItem(null)}
        size="lg"
      >
        {detailItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                background: 'var(--color-surface-2, #f8fafc)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                padding: '0.85rem 1rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.35rem 1.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>No. Reg</span>
                <br />
                <strong>{detailItem.regCode}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Umur</span>
                <br />
                <strong>{formatUmurDetail(detailItem.tanggalLahir, detailItem.createdAt)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Alamat</span>
                <br />
                <strong>{detailItem.alamat ?? '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>No. Telepon</span>
                <br />
                <strong>{detailItem.noTelepon ?? '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Dokter Pengirim</span>
                <br />
                <strong>{detailItem.pengirimNama}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Radiolog</span>
                <br />
                <strong>{detailItem.radiologNama ?? '—'}</strong>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pemeriksaan</span>
                <br />
                <strong>{combinedPemeriksaan(detailItem)}</strong>
              </div>
              {detailItem.klinis && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Klinis</span>
                  <br />
                  <strong>{formatKlinisDisplay(detailItem.klinis)}</strong>
                </div>
              )}
            </div>

            <div className="form-field">
              <label>Kesan & Saran Radiologi</label>
              <div
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  minHeight: '80px',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.9rem',
                }}
              >
                {detailItem.kesan || 'Belum diisi'}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={quickEditItem !== null}
        title="Edit Cepat: Nama & Kesan"
        onClose={() => setQuickEditItem(null)}
        size="xl"
      >
        <form onSubmit={(e) => void submitQuickEdit(e)} className="form-grid">
          {quickEditError && (
            <div className="alert alert--error form-grid--full">{quickEditError}</div>
          )}

          <div className="form-field form-grid--full">
            <KesanRegioPicker onSelect={(teks) => setQuickEditKesan(teks)} />
          </div>

          <div className="form-field form-grid--full">
            <label htmlFor="rd-qe-nama">Nama pasien</label>
            <input
              id="rd-qe-nama"
              required
              value={quickEditNama}
              onChange={(e) => setQuickEditNama(e.target.value)}
            />
          </div>
          <div className="form-field form-grid--full">
            <label htmlFor="rd-qe-kesan">Kesan</label>
            <textarea
              id="rd-qe-kesan"
              rows={4}
              value={quickEditKesan}
              onChange={(e) => setQuickEditKesan(clampClinicalInput(e.target.value))}
              placeholder="Isi kesan radiologi..."
            />
          </div>
          <ModalFormFooter
            onCancel={() => setQuickEditItem(null)}
            submitLabel="Simpan"
            loading={quickEditSaving}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus Arsip Duplikat Radiologi"
        message={`Yakin hapus permanen arsip "${deleteTarget?.nama ?? ''}" (${deleteTarget?.regCode ?? ''})? Tindakan ini tidak bisa dibatalkan.`}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />

      {kwitansiItem && (
        <Modal
          title={`Pratinjau Kwitansi — ${kwitansiItem.regCode}`}
          open={true}
          onClose={() => setKwitansiItem(null)}
          size="xl"
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void handleDownloadKwitansi(kwitansiItem)}
              style={{ fontWeight: 600 }}
            >
              ⬇️ Unduh / Cetak Kwitansi
            </button>
          </div>
          <div style={{ width: '100%', height: 'calc(100vh - 14rem)', minHeight: '600px' }}>
            <PDFViewer width="100%" height="100%" className="pdf-viewer">
              <KwitansiReportDocument data={buildKwitansiData(kwitansiItem)} />
            </PDFViewer>
          </div>
        </Modal>
      )}
    </>
  );
}
