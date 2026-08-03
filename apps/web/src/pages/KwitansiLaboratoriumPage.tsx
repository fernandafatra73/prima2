import { useEffect, useState } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiPatch } from '../lib/api.ts';
import { formatDateShort, formatRupiah } from '../lib/format.ts';
import { terbilangRupiah } from '../lib/terbilang.ts';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { KwitansiReportDocument, type KwitansiReportData } from '../pdf/KwitansiReportDocument.tsx';
import '../components/ui/ui.css';

interface PasienDuplikatLabItem {
  readonly id: string;
  readonly regCode: string;
  readonly nama: string;
  readonly alamat: string | null;
  readonly pengirimNama: string;
  readonly pemeriksaanNama: string;
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly totalHarga: string;
  readonly createdAt: string;
}

export function KwitansiLaboratoriumPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({ modul: 'LABORATORIUM' }, search);
  const { items, pagination, setPage, loading, error, reload: reloadList } =
    usePaginatedList<PasienDuplikatLabItem>('/api/pasien-duplikat', queryParams);
  const reload = useMutationReload(reloadList);

  const [logoSrc, setLogoSrc] = useState('');
  const [previewItem, setPreviewItem] = useState<PasienDuplikatLabItem | null>(null);

  const [editItem, setEditItem] = useState<PasienDuplikatLabItem | null>(null);
  const [editPemeriksaanNama, setEditPemeriksaanNama] = useState('');
  const [editTotalHarga, setEditTotalHarga] = useState('0');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'BELUM_LUNAS' | 'LUNAS'>('BELUM_LUNAS');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
  }, []);

  function openEdit(item: PasienDuplikatLabItem) {
    setEditItem(item);
    setEditPemeriksaanNama(item.pemeriksaanNama);
    setEditTotalHarga(item.totalHarga);
    setEditPaymentStatus(item.paymentStatus);
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await apiPatch(`/api/pasien-duplikat/${editItem.id}`, {
        pemeriksaanNama: editPemeriksaanNama,
        totalHarga: Number(editTotalHarga) || 0,
        paymentStatus: editPaymentStatus,
      });
      setEditItem(null);
      await reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan kwitansi');
    } finally {
      setEditSaving(false);
    }
  }

  function buildKwitansiData(p: PasienDuplikatLabItem): KwitansiReportData {
    return {
      logoSrc,
      noKwitansi: p.regCode,
      tanggal: formatDateShort(p.createdAt),
      namaPasien: p.nama,
      alamat: p.alamat || '—',
      dokterPengirim: p.pengirimNama || '—',
      items: [{ nama: p.pemeriksaanNama || 'Pemeriksaan Laboratorium', hargaFormatted: formatRupiah(p.totalHarga) }],
      totalFormatted: formatRupiah(p.totalHarga),
      terbilang: terbilangRupiah(p.totalHarga),
      paymentStatus: p.paymentStatus,
      adminNama: '',
    };
  }

  async function handleDownload(p: PasienDuplikatLabItem) {
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
        title="Kwitansi Laboratorium"
        subtitle="Cetak kwitansi pembayaran pemeriksaan laboratorium, berdasarkan arsip Duplikat Registrasi Lab"
        metrics={[
          {
            label: 'Total Arsip',
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
                  Belum ada data arsip registrasi laboratorium.
                </td>
              </tr>
            ) : (
              items.map((p, idx) => {
                const rowNo = (pagination.page - 1) * pagination.limit + idx + 1;
                const tanggal = formatDateShort(p.createdAt);
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
                      <div style={{ fontWeight: 500, color: '#1e293b' }}>{p.pemeriksaanNama || '—'}</div>
                    </td>
                    <td>
                      <div style={{ color: '#334155' }}>{p.pengirimNama || '—'}</div>
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
                        editLabel="Ubah status bayar & pemeriksaan"
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
              <label htmlFor="edit-pemeriksaan-nama">Pemeriksaan</label>
              <input
                id="edit-pemeriksaan-nama"
                type="text"
                value={editPemeriksaanNama}
                onChange={(e) => setEditPemeriksaanNama(e.target.value)}
              />
            </div>

            <div className="form-field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="edit-total-harga">Total Biaya (Rp)</label>
              <input
                id="edit-total-harga"
                type="number"
                min="0"
                step="1"
                value={editTotalHarga}
                onChange={(e) => setEditTotalHarga(e.target.value)}
              />
            </div>

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

            <ModalFormFooter
              onCancel={() => setEditItem(null)}
              submitLabel="Simpan Perubahan"
              loading={editSaving}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
