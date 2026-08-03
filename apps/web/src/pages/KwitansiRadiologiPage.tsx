import { useEffect, useMemo, useState } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch } from '../lib/api.ts';
import { formatDateShort, formatRupiah } from '../lib/format.ts';
import { terbilangRupiah } from '../lib/terbilang.ts';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { KwitansiReportDocument, type KwitansiReportData } from '../pdf/KwitansiReportDocument.tsx';
import '../components/ui/ui.css';

interface KwitansiPasienItem {
  readonly id: string;
  readonly regCode: string;
  readonly nama: string;
  readonly alamat: string | null;
  readonly createdAt: string;
  readonly admin: string | null;
  readonly petugasKasir: string | null;
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly totalHarga: string;
  readonly pengirim: { readonly nama: string };
  readonly pemeriksaan: readonly { readonly jenisPemeriksaanId: string; readonly nama: string; readonly harga: string }[];
}

interface JenisItem {
  readonly id: string;
  readonly nama: string;
  readonly harga: string | null;
}

interface PetugasKasirItem {
  readonly id: string;
  readonly nama: string;
}

export function KwitansiRadiologiPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({ modul: 'RADIOLOGI' }, search);
  const { items, pagination, setPage, loading, error, reload: reloadList } =
    usePaginatedList<KwitansiPasienItem>('/api/pasien', queryParams);
  const reload = useMutationReload(reloadList);

  const [logoSrc, setLogoSrc] = useState('');
  const [previewItem, setPreviewItem] = useState<KwitansiPasienItem | null>(null);

  const [jenisList, setJenisList] = useState<JenisItem[]>([]);
  const [kasirList, setKasirList] = useState<PetugasKasirItem[]>([]);
  const [editItem, setEditItem] = useState<KwitansiPasienItem | null>(null);
  const [editSelectedJenis, setEditSelectedJenis] = useState<string[]>([]);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'BELUM_LUNAS' | 'LUNAS'>('BELUM_LUNAS');
  const [editPetugasKasir, setEditPetugasKasir] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<KwitansiPasienItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
  }, []);

  useEffect(() => {
    apiGet<{ items: JenisItem[] }>('/api/jenis-pemeriksaan?limit=200')
      .then((res) => setJenisList(res.items.filter((j) => j.harga !== null)))
      .catch(() => setJenisList([]));
  }, []);

  useEffect(() => {
    apiGet<{ items: PetugasKasirItem[] }>('/api/petugas-kasir?limit=200')
      .then((res) => setKasirList(res.items))
      .catch(() => setKasirList([]));
  }, []);

  const editTotalHarga = useMemo(
    () =>
      jenisList
        .filter((j) => editSelectedJenis.includes(j.id))
        .reduce((sum, j) => sum + Number(j.harga ?? 0), 0),
    [jenisList, editSelectedJenis],
  );

  function openEdit(item: KwitansiPasienItem) {
    setEditItem(item);
    setEditSelectedJenis(item.pemeriksaan.map((x) => x.jenisPemeriksaanId));
    setEditPaymentStatus(item.paymentStatus);
    setEditPetugasKasir(item.petugasKasir ?? '');
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    if (editSelectedJenis.length === 0) {
      setEditError('Pilih minimal satu jenis pemeriksaan');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await apiPatch(`/api/pasien/${editItem.id}`, {
        paymentStatus: editPaymentStatus,
        petugasKasir: editPetugasKasir,
        jenisPemeriksaanIds: editSelectedJenis,
      });
      setEditItem(null);
      await reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan kwitansi');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiDelete(`/api/pasien/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus data');
    } finally {
      setDeleteLoading(false);
    }
  }

  function buildKwitansiData(p: KwitansiPasienItem): KwitansiReportData {
    return {
      logoSrc,
      noKwitansi: p.regCode,
      tanggal: formatDateShort(p.createdAt),
      namaPasien: p.nama,
      alamat: p.alamat || '—',
      dokterPengirim: p.pengirim.nama,
      items: p.pemeriksaan.map((x) => ({ nama: x.nama, hargaFormatted: formatRupiah(x.harga) })),
      totalFormatted: formatRupiah(p.totalHarga),
      terbilang: terbilangRupiah(p.totalHarga),
      paymentStatus: p.paymentStatus,
      kasirNama: p.petugasKasir || '',
    };
  }

  async function handleDownload(p: KwitansiPasienItem) {
    const data = buildKwitansiData(p);
    const blob = await pdf(<KwitansiReportDocument data={data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Kwitansi_${p.regCode}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ListPageShell
        title="Kwitansi Radiologi"
        subtitle="Cetak kwitansi pembayaran pemeriksaan radiologi per pasien"
        metrics={[
          {
            label: 'Total Pasien',
            value: String(pagination.total),
            tone: 'blue',
            iconKind: 'document',
          },
        ]}
        searchPlaceholder="Cari nama pasien, no. reg, dokter pengirim..."
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
              <th style={{ width: '60px' }}>No</th>
              <th style={{ width: '160px' }}>Tanggal &amp; No. Reg</th>
              <th style={{ width: '220px' }}>Nama Pasien</th>
              <th>Pemeriksaan</th>
              <th style={{ width: '180px' }}>Dokter Pengirim</th>
              <th style={{ width: '140px', textAlign: 'right' }}>Total Biaya</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Kwitansi</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  Belum ada data pasien radiologi yang ditemukan.
                </td>
              </tr>
            ) : (
              items.map((p, idx) => {
                const rowNo = (pagination.page - 1) * pagination.limit + idx + 1;
                const tanggal = formatDateShort(p.createdAt);
                const jenisNames = p.pemeriksaan.map((x) => x.nama).join(', ') || '—';
                const isLunas = p.paymentStatus === 'LUNAS';

                return (
                  <tr key={p.id}>
                    <td>{rowNo}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0369a1' }}>{p.regCode}</div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{tanggal}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.nama}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#1e293b' }}>{jenisNames}</div>
                    </td>
                    <td>
                      <div style={{ color: '#334155' }}>{p.pengirim.nama}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {formatRupiah(p.totalHarga)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: isLunas ? '#15803d' : '#b91c1c',
                          background: isLunas ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${isLunas ? '#bbf7d0' : '#fecaca'}`,
                        }}
                      >
                        {isLunas ? 'LUNAS' : 'BELUM LUNAS'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn--xs btn--primary"
                        onClick={() => setPreviewItem(p)}
                        title="Pratinjau & Cetak Kwitansi"
                        style={{ padding: '0.35rem 0.65rem', fontWeight: 600 }}
                      >
                        🧾 Kwitansi
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <TableRowActions
                        onEdit={() => openEdit(p)}
                        onDelete={() => setDeleteTarget(p)}
                        editLabel="Ubah status bayar & pemeriksaan"
                        deleteLabel="Hapus pasien"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ListPageShell>

      {previewItem && (
        <Modal
          title={`Pratinjau Kwitansi — ${previewItem.regCode}`}
          open={true}
          onClose={() => setPreviewItem(null)}
          size="xl"
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void handleDownload(previewItem)}
              style={{ fontWeight: 600 }}
            >
              ⬇️ Unduh / Cetak Kwitansi
            </button>
          </div>
          <div style={{ width: '100%', height: 'calc(100vh - 14rem)', minHeight: '600px' }}>
            <PDFViewer width="100%" height="100%" className="pdf-viewer">
              <KwitansiReportDocument data={buildKwitansiData(previewItem)} />
            </PDFViewer>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal
          title={`Ubah Kwitansi — ${editItem.regCode}`}
          open={true}
          onClose={() => setEditItem(null)}
          size="lg"
        >
          <form onSubmit={(e) => void handleSaveEdit(e)}>
            {editError && <p className="alert alert--error">{editError}</p>}

            <div className="form-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="edit-payment-status">Status Pembayaran</label>
              <select
                id="edit-payment-status"
                value={editPaymentStatus}
                onChange={(e) => setEditPaymentStatus(e.target.value as 'BELUM_LUNAS' | 'LUNAS')}
              >
                <option value="BELUM_LUNAS">BELUM LUNAS</option>
                <option value="LUNAS">LUNAS</option>
              </select>
            </div>

            <div className="form-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="edit-petugas-kasir">Petugas Kasir</label>
              <select
                id="edit-petugas-kasir"
                value={editPetugasKasir}
                onChange={(e) => setEditPetugasKasir(e.target.value)}
              >
                <option value="">-- Pilih Petugas Kasir --</option>
                {kasirList.map((k) => (
                  <option key={k.id} value={k.nama}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="form-field"
              style={{ padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)' }}
            >
              <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Jenis Pemeriksaan &amp; Harga
              </label>
              <div className="checkbox-list" style={{ flexDirection: 'row', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto' }}>
                {jenisList.map((j) => (
                  <label key={j.id} style={{ minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={editSelectedJenis.includes(j.id)}
                        onChange={() => {
                          setEditSelectedJenis((prev) =>
                            prev.includes(j.id) ? prev.filter((id) => id !== j.id) : [...prev, j.id],
                          );
                        }}
                      />
                      {j.nama}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatRupiah(j.harga ?? '0')}
                    </span>
                  </label>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.75rem',
                  paddingTop: '0.6rem',
                  borderTop: '1px dashed var(--color-border)',
                  fontWeight: 700,
                }}
              >
                <span>Total Harga Pemeriksaan</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatRupiah(editTotalHarga)}</span>
              </div>
            </div>

            <ModalFormFooter
              onCancel={() => setEditItem(null)}
              submitLabel="Simpan Perubahan"
              loading={editSaving}
            />
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          open={true}
          title="Hapus Kwitansi"
          message={`Apakah Anda yakin ingin menghapus data pasien "${deleteTarget.nama}" (${deleteTarget.regCode})? Tindakan ini akan menghapus data pasien beserta kwitansinya.`}
          confirmLabel="Hapus"
          onConfirm={() => void handleDeleteConfirm()}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}
