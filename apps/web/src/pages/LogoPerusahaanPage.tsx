import { useState, type FormEvent } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { SharingPdfPreviewModal } from '../components/ui/SharingPdfPreviewModal.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiPatch, apiPost } from '../lib/api.ts';
import { formatDateShort } from '../lib/format.ts';
import { LogoPerusahaanReportDocument } from '../pdf/LogoPerusahaanReportDocument.tsx';
import '../components/ui/ui.css';

interface LogoPerusahaanItem {
  readonly id: string;
  readonly namaKlinik: string;
  readonly logoTandaTangan: string | null;
  readonly logoPerusahaan: string | null;
}

export function LogoPerusahaanPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<LogoPerusahaanItem>('/api/logo-perusahaan', queryParams);
  const reload = useMutationReload(reloadList);

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [namaKlinik, setNamaKlinik] = useState('');
  const [logoTandaTangan, setLogoTandaTangan] = useState<string | null>(null);
  const [logoPerusahaan, setLogoPerusahaan] = useState<string | null>(null);

  const [printingId, setPrintingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFilename, setPreviewFilename] = useState('Kop_Surat.pdf');

  function resetForm() {
    setNamaKlinik('');
    setLogoTandaTangan(null);
    setLogoPerusahaan(null);
    setEditingId(null);
  }

  function openAdd() {
    resetForm();
    setModalMode('add');
  }

  function openEdit(item: LogoPerusahaanItem) {
    setEditingId(item.id);
    setNamaKlinik(item.namaKlinik);
    setLogoTandaTangan(item.logoTandaTangan);
    setLogoPerusahaan(item.logoPerusahaan);
    setModalMode('edit');
  }

  function handleFileChange(setter: (value: string | null) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setter(reader.result);
        }
      };
      reader.readAsDataURL(file);
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { namaKlinik, logoTandaTangan, logoPerusahaan };
    try {
      if (modalMode === 'add') {
        await apiPost('/api/logo-perusahaan', body);
      } else if (editingId) {
        await apiPatch(`/api/logo-perusahaan/${editingId}`, body);
      }
      setModalMode(null);
      resetForm();
      await reload({ resetPage: modalMode === 'add' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await apiDelete(`/api/logo-perusahaan/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handlePreview(item: LogoPerusahaanItem) {
    setPrintingId(item.id);
    try {
      const blob = await pdf(
        <LogoPerusahaanReportDocument
          data={{
            namaKlinik: item.namaKlinik,
            logoPerusahaan: item.logoPerusahaan,
            logoTandaTangan: item.logoTandaTangan,
            tanggalCetak: formatDateShort(new Date().toISOString()),
          }}
        />,
      ).toBlob();
      setPreviewFilename(`Contoh_Kop_Surat_${item.namaKlinik.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
      setPreviewBlob(blob);
      setPreviewOpen(true);
    } finally {
      setPrintingId(null);
    }
  }

  const form = (
    <form onSubmit={(e) => void onSubmit(e)} className="form-grid">
      <div className="form-field form-field--full">
        <label htmlFor="lp-nama-klinik">Nama Klinik</label>
        <input id="lp-nama-klinik" required value={namaKlinik} onChange={(e) => setNamaKlinik(e.target.value)} />
      </div>
      <div className="form-field form-field--full">
        <label htmlFor="lp-logo-perusahaan">Logo Perusahaan</label>
        <input id="lp-logo-perusahaan" type="file" accept="image/*" onChange={handleFileChange(setLogoPerusahaan)} />
        {logoPerusahaan && (
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={logoPerusahaan}
              alt="Preview logo perusahaan"
              style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff' }}
            />
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setLogoPerusahaan(null)}
              style={{ border: '1px solid var(--color-border)' }}
            >
              Hapus Logo
            </button>
          </div>
        )}
      </div>
      <div className="form-field form-field--full">
        <label htmlFor="lp-logo-ttd">Logo Tanda Tangan</label>
        <input id="lp-logo-ttd" type="file" accept="image/*" onChange={handleFileChange(setLogoTandaTangan)} />
        {logoTandaTangan && (
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={logoTandaTangan}
              alt="Preview tanda tangan"
              style={{ width: 120, height: 64, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff' }}
            />
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setLogoTandaTangan(null)}
              style={{ border: '1px solid var(--color-border)' }}
            >
              Hapus Logo
            </button>
          </div>
        )}
      </div>
      <ModalFormFooter onCancel={() => setModalMode(null)} submitLabel="Simpan" loading={saving} />
    </form>
  );

  return (
    <>
      <ListPageShell
        title="Logo Perusahaan"
        subtitle="Nama klinik, logo perusahaan, dan logo tanda tangan untuk kop surat resmi"
        action={
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Tambah Logo Perusahaan
          </button>
        }
        metrics={[
          {
            label: 'Total data',
            value: String(pagination.total),
            tone: 'blue',
            iconKind: 'clipboard',
          },
        ]}
        searchPlaceholder="Cari nama klinik…"
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
              <th>Logo Perusahaan</th>
              <th>Nama Klinik</th>
              <th>Logo Tanda Tangan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4}>Belum ada data logo perusahaan.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.logoPerusahaan ? (
                      <img
                        src={item.logoPerusahaan}
                        alt={item.namaKlinik}
                        style={{ width: 56, height: 56, objectFit: 'contain', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{item.namaKlinik}</td>
                  <td>
                    {item.logoTandaTangan ? (
                      <img
                        src={item.logoTandaTangan}
                        alt={`Tanda tangan ${item.namaKlinik}`}
                        style={{ width: 80, height: 44, objectFit: 'contain', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <TableRowActions
                      onEdit={() => openEdit(item)}
                      onDelete={() => setDeleteTarget({ id: item.id, label: item.namaKlinik })}
                      onPrint={() => void handlePreview(item)}
                      printLabel={printingId === item.id ? 'Membuat PDF…' : 'Cetak / Preview Kop Surat'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ListPageShell>

      <Modal
        open={modalMode === 'add'}
        title="Tambah Logo Perusahaan"
        onClose={() => setModalMode(null)}
      >
        {form}
      </Modal>
      <Modal
        open={modalMode === 'edit'}
        title="Ubah Logo Perusahaan"
        onClose={() => setModalMode(null)}
      >
        {form}
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus logo perusahaan"
        message={`Yakin hapus "${deleteTarget?.label ?? ''}"?`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <SharingPdfPreviewModal
        open={previewOpen}
        blob={previewBlob}
        filename={previewFilename}
        onClose={() => setPreviewOpen(false)}
        title="Pratinjau Contoh Kop Surat"
      />
    </>
  );
}
