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
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import { formatDateShort, formatRupiah } from '../lib/format.ts';
import { terbilangRupiah } from '../lib/terbilang.ts';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import {
  FarmasiKwitansiReportDocument,
  type FarmasiKwitansiReportData,
} from '../pdf/FarmasiKwitansiReportDocument.tsx';
import '../components/ui/ui.css';

interface FarmasiKwitansiItem {
  readonly id: string;
  readonly farmasiBhpId: string;
  readonly nama: string;
  readonly qty: number;
  readonly hargaSatuan: string;
  readonly subtotal: string;
}

interface FarmasiKwitansiRecord {
  readonly id: string;
  readonly noKwitansi: string;
  readonly namaPasien: string;
  readonly tanggal: string;
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly petugasKasir: string | null;
  readonly totalHarga: string;
  readonly items: readonly FarmasiKwitansiItem[];
}

interface FarmasiBhpOption {
  readonly id: string;
  readonly nama: string;
  readonly satuan: string;
  readonly stok: number;
  readonly hargaJual: string;
}

interface PetugasKasirItem {
  readonly id: string;
  readonly nama: string;
}

interface PendaftaranUmumOption {
  readonly id: string;
  readonly noRegistrasi: string;
  readonly namaPasien: string;
}

interface CartRow {
  readonly farmasiBhpId: string;
  readonly qty: string;
}

const emptyCartRow: CartRow = { farmasiBhpId: '', qty: '1' };

export function FarmasiKwitansiPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<FarmasiKwitansiRecord>('/api/farmasi-kwitansi', queryParams);
  const reload = useMutationReload(reloadList);

  const [logoSrc, setLogoSrc] = useState('');
  const [bhpOptions, setBhpOptions] = useState<FarmasiBhpOption[]>([]);
  const [kasirList, setKasirList] = useState<PetugasKasirItem[]>([]);
  const [pendaftaranOptions, setPendaftaranOptions] = useState<PendaftaranUmumOption[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [namaPasien, setNamaPasien] = useState('');
  const [petugasKasir, setPetugasKasir] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'BELUM_LUNAS' | 'LUNAS'>('LUNAS');
  const [cartRows, setCartRows] = useState<CartRow[]>([{ ...emptyCartRow }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<FarmasiKwitansiRecord | null>(null);
  const [editNamaPasien, setEditNamaPasien] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'BELUM_LUNAS' | 'LUNAS'>('LUNAS');
  const [editPetugasKasir, setEditPetugasKasir] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [previewItem, setPreviewItem] = useState<FarmasiKwitansiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FarmasiKwitansiRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
  }, []);

  useEffect(() => {
    apiGet<{ items: FarmasiBhpOption[] }>('/api/farmasi-bhp')
      .then((res) => setBhpOptions(res.items))
      .catch(() => setBhpOptions([]));
  }, []);

  useEffect(() => {
    apiGet<{ items: PetugasKasirItem[] }>('/api/petugas-kasir?limit=200')
      .then((res) => setKasirList(res.items))
      .catch(() => setKasirList([]));
  }, []);

  useEffect(() => {
    apiGet<{ items: PendaftaranUmumOption[] }>('/api/pendaftaran-umum?limit=200')
      .then((res) => setPendaftaranOptions(res.items))
      .catch(() => setPendaftaranOptions([]));
  }, []);

  const cartTotal = useMemo(() => {
    return cartRows.reduce((sum, row) => {
      const bhp = bhpOptions.find((b) => b.id === row.farmasiBhpId);
      const qty = Number(row.qty) || 0;
      return sum + (bhp ? Number(bhp.hargaJual) * qty : 0);
    }, 0);
  }, [cartRows, bhpOptions]);

  function openCreate() {
    setNamaPasien('');
    setPetugasKasir('');
    setPaymentStatus('LUNAS');
    setCartRows([{ ...emptyCartRow }]);
    setFormError(null);
    setCreateOpen(true);
  }

  function updateCartRow(idx: number, patch: Partial<CartRow>) {
    setCartRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addCartRow() {
    setCartRows((rows) => [...rows, { ...emptyCartRow }]);
  }

  function removeCartRow(idx: number) {
    setCartRows((rows) => rows.filter((_, i) => i !== idx));
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!namaPasien.trim()) {
      setFormError('Nama pasien wajib diisi');
      return;
    }
    const validRows = cartRows.filter((r) => r.farmasiBhpId && Number(r.qty) > 0);
    if (validRows.length === 0) {
      setFormError('Pilih minimal satu obat/BHP dengan jumlah valid');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiPost('/api/farmasi-kwitansi', {
        namaPasien: namaPasien.trim(),
        paymentStatus,
        petugasKasir: petugasKasir || undefined,
        items: validRows.map((r) => ({ farmasiBhpId: r.farmasiBhpId, qty: Number(r.qty) })),
      });
      setCreateOpen(false);
      await reload({ resetPage: true });
      apiGet<{ items: FarmasiBhpOption[] }>('/api/farmasi-bhp')
        .then((res) => setBhpOptions(res.items))
        .catch(() => {});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat kwitansi farmasi');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: FarmasiKwitansiRecord) {
    setEditItem(item);
    setEditNamaPasien(item.namaPasien);
    setEditPaymentStatus(item.paymentStatus);
    setEditPetugasKasir(item.petugasKasir ?? '');
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await apiPatch(`/api/farmasi-kwitansi/${editItem.id}`, {
        namaPasien: editNamaPasien.trim(),
        paymentStatus: editPaymentStatus,
        petugasKasir: editPetugasKasir || undefined,
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
      await apiDelete(`/api/farmasi-kwitansi/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
      apiGet<{ items: FarmasiBhpOption[] }>('/api/farmasi-bhp')
        .then((res) => setBhpOptions(res.items))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus kwitansi');
    } finally {
      setDeleteLoading(false);
    }
  }

  function buildReportData(k: FarmasiKwitansiRecord): FarmasiKwitansiReportData {
    return {
      logoSrc,
      noKwitansi: k.noKwitansi,
      tanggal: formatDateShort(k.tanggal),
      namaPasien: k.namaPasien,
      items: k.items.map((it) => ({
        nama: it.nama,
        qty: it.qty,
        hargaSatuanFormatted: formatRupiah(it.hargaSatuan),
        subtotalFormatted: formatRupiah(it.subtotal),
      })),
      totalFormatted: formatRupiah(k.totalHarga),
      terbilang: terbilangRupiah(k.totalHarga),
      paymentStatus: k.paymentStatus,
      kasirNama: k.petugasKasir || '',
    };
  }

  async function handleDownload(k: FarmasiKwitansiRecord) {
    const data = buildReportData(k);
    const blob = await pdf(<FarmasiKwitansiReportDocument data={data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Kwitansi_Farmasi_${k.noKwitansi}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ListPageShell
        title="Kwitansi Farmasi"
        subtitle="Penjualan obat & BHP ke pasien — otomatis mengurangi stok Farmasi & BHP"
        metrics={[
          { label: 'Total Kwitansi', value: String(pagination.total), tone: 'blue', iconKind: 'document' },
        ]}
        searchPlaceholder="Cari nama pasien atau no. kwitansi..."
        searchValue={search}
        onSearchChange={setSearch}
        onRefresh={() => void reload()}
        error={error}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        action={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            + Tambah Kwitansi Farmasi
          </button>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>No</th>
                <th style={{ width: '170px' }}>Tanggal &amp; No. Kwitansi</th>
                <th style={{ width: '200px' }}>Nama Pasien</th>
                <th>Item</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Total</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Kwitansi</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    Belum ada data kwitansi farmasi.
                  </td>
                </tr>
              ) : (
                items.map((k, idx) => {
                  const rowNo = (pagination.page - 1) * pagination.limit + idx + 1;
                  const itemNames = k.items.map((it) => `${it.nama} (${it.qty})`).join(', ') || '—';
                  const isLunas = k.paymentStatus === 'LUNAS';
                  return (
                    <tr key={k.id}>
                      <td>{rowNo}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0369a1' }}>{k.noKwitansi}</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{formatDateShort(k.tanggal)}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{k.namaPasien}</td>
                      <td style={{ color: '#1e293b' }}>{itemNames}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatRupiah(k.totalHarga)}
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
                          onClick={() => setPreviewItem(k)}
                          title="Pratinjau & Cetak Kwitansi"
                          style={{ padding: '0.35rem 0.65rem', fontWeight: 600 }}
                        >
                          🧾 Kwitansi
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <TableRowActions
                          onEdit={() => openEdit(k)}
                          onDelete={() => setDeleteTarget(k)}
                          editLabel="Ubah status bayar & kasir"
                          deleteLabel="Hapus kwitansi (stok dikembalikan)"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ListPageShell>

      {createOpen && (
        <Modal open={true} title="Tambah Kwitansi Farmasi" onClose={() => setCreateOpen(false)} size="lg">
          <form onSubmit={(e) => void handleCreateSubmit(e)}>
            {formError && <p className="alert alert--error">{formError}</p>}

            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-field form-field--full">
                <label htmlFor="fk-pendaftaran">Pilih dari Pendaftaran Umum (Opsional)</label>
                <select
                  id="fk-pendaftaran"
                  value=""
                  onChange={(e) => {
                    const selected = pendaftaranOptions.find((p) => p.id === e.target.value);
                    if (selected) setNamaPasien(selected.namaPasien);
                  }}
                >
                  <option value="">-- Pilih Pasien / Ketik Manual di Bawah --</option>
                  {pendaftaranOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.namaPasien} ({p.noRegistrasi})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="fk-nama">Nama Pasien *</label>
                <input id="fk-nama" required value={namaPasien} onChange={(e) => setNamaPasien(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="fk-status">Status Pembayaran</label>
                <select
                  id="fk-status"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'BELUM_LUNAS' | 'LUNAS')}
                >
                  <option value="LUNAS">LUNAS</option>
                  <option value="BELUM_LUNAS">BELUM LUNAS</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="fk-kasir">Kasir</label>
                <select id="fk-kasir" value={petugasKasir} onChange={(e) => setPetugasKasir(e.target.value)}>
                  <option value="">-- Pilih Kasir --</option>
                  {kasirList.map((k) => (
                    <option key={k.id} value={k.nama}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className="form-field"
              style={{ padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, margin: 0 }}>Obat / BHP yang Dibeli</label>
                <button type="button" className="btn btn--sm btn--ghost" onClick={addCartRow} style={{ border: '1px solid var(--color-border)' }}>
                  + Tambah Item
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cartRows.map((row, idx) => {
                  const bhp = bhpOptions.find((b) => b.id === row.farmasiBhpId);
                  const subtotal = bhp ? Number(bhp.hargaJual) * (Number(row.qty) || 0) : 0;
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={row.farmasiBhpId}
                        onChange={(e) => updateCartRow(idx, { farmasiBhpId: e.target.value })}
                        style={{ flex: '2 1 220px' }}
                      >
                        <option value="">-- Pilih Obat/BHP --</option>
                        {bhpOptions.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nama} (Stok: {b.stok} {b.satuan})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max={bhp?.stok ?? undefined}
                        value={row.qty}
                        onChange={(e) => updateCartRow(idx, { qty: e.target.value })}
                        style={{ flex: '0 1 80px' }}
                        placeholder="Qty"
                      />
                      <span style={{ flex: '1 1 120px', fontSize: '0.85rem', color: '#0369a1', fontWeight: 600, textAlign: 'right' }}>
                        {formatRupiah(subtotal)}
                      </span>
                      <button
                        type="button"
                        className="btn btn--xs btn--ghost"
                        onClick={() => removeCartRow(idx)}
                        disabled={cartRows.length === 1}
                        title="Hapus baris"
                        style={{ border: '1px solid var(--color-border)', color: '#ef4444' }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
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
                <span>Total Harga</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatRupiah(cartTotal)}</span>
              </div>
            </div>

            <ModalFormFooter
              onCancel={() => setCreateOpen(false)}
              submitLabel="Simpan Kwitansi"
              loading={submitting}
            />
          </form>
        </Modal>
      )}

      {previewItem && (
        <Modal title={`Pratinjau Kwitansi — ${previewItem.noKwitansi}`} open={true} onClose={() => setPreviewItem(null)} size="xl">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button type="button" className="btn btn--primary" onClick={() => void handleDownload(previewItem)} style={{ fontWeight: 600 }}>
              ⬇️ Unduh / Cetak Kwitansi
            </button>
          </div>
          <div style={{ width: '100%', height: 'calc(100vh - 14rem)', minHeight: '600px' }}>
            <PDFViewer width="100%" height="100%" className="pdf-viewer">
              <FarmasiKwitansiReportDocument data={buildReportData(previewItem)} />
            </PDFViewer>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title={`Ubah Kwitansi — ${editItem.noKwitansi}`} open={true} onClose={() => setEditItem(null)}>
          <form onSubmit={(e) => void handleEditSubmit(e)} className="form-grid">
            {editError && <p className="alert alert--error">{editError}</p>}
            <div className="form-field form-field--full">
              <label htmlFor="edit-fk-nama">Nama Pasien</label>
              <input id="edit-fk-nama" required value={editNamaPasien} onChange={(e) => setEditNamaPasien(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="edit-fk-status">Status Pembayaran</label>
              <select
                id="edit-fk-status"
                value={editPaymentStatus}
                onChange={(e) => setEditPaymentStatus(e.target.value as 'BELUM_LUNAS' | 'LUNAS')}
              >
                <option value="LUNAS">LUNAS</option>
                <option value="BELUM_LUNAS">BELUM LUNAS</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="edit-fk-kasir">Kasir</label>
              <select id="edit-fk-kasir" value={editPetugasKasir} onChange={(e) => setEditPetugasKasir(e.target.value)}>
                <option value="">-- Pilih Kasir --</option>
                {kasirList.map((k) => (
                  <option key={k.id} value={k.nama}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>
            <p className="form-hint" style={{ gridColumn: '1 / -1' }}>
              Item &amp; jumlah obat tidak bisa diubah di sini — hapus kwitansi ini (stok akan dikembalikan)
              lalu buat kwitansi baru jika perlu mengubah item.
            </p>
            <ModalFormFooter onCancel={() => setEditItem(null)} submitLabel="Simpan Perubahan" loading={editSaving} />
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          open={true}
          title="Hapus Kwitansi Farmasi"
          message={`Yakin hapus kwitansi "${deleteTarget.noKwitansi}" milik "${deleteTarget.namaPasien}"? Stok obat/BHP yang terjual akan dikembalikan.`}
          confirmLabel="Hapus"
          onConfirm={() => void handleDeleteConfirm()}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}
