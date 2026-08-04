import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { SharingPdfPreviewModal } from '../components/ui/SharingPdfPreviewModal.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api.ts';
import {
  SuratKeteranganSehatDocument,
  type SuratKeteranganSehatData,
} from '../pdf/SuratKeteranganSehatDocument.tsx';
import {
  SuratKeteranganRujukanDocument,
  type SuratKeteranganRujukanData,
} from '../pdf/SuratKeteranganRujukanDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { KopSuratPreviewDocument } from '../pdf/KopSuratPreviewDocument.tsx';
import { pdf } from '@react-pdf/renderer';
import '../components/ui/ui.css';

interface KopSuratData {
  readonly namaKlinik: string;
  readonly alamat: string;
  readonly telepon: string;
  readonly logoDataUrl: string | null;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]!;
}

function formatTanggalLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function resolveLogoSrc(kopSuratLogo: string | null): Promise<string> {
  if (kopSuratLogo) return kopSuratLogo;
  return loadLogoDataUrl().catch(() => '');
}

const KOP_SURAT_DEFAULTS: KopSuratData = {
  namaKlinik: 'KLINIK PRIMA HUSADA',
  alamat: 'Jl. Siliwangi Ruko Palapa No 2 Parung Kuda',
  telepon: '0857-1932-5557',
  logoDataUrl: null,
};

function KopSuratSection() {
  const [item, setItem] = useState<KopSuratData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({ namaKlinik: '', alamat: '', telepon: '', logoDataUrl: null as string | null });
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const fetchKopSurat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ item: KopSuratData }>('/api/kop-surat');
      setItem(res.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat kop surat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKopSurat();
  }, [fetchKopSurat]);

  function openEdit() {
    if (!item) return;
    setForm({
      namaKlinik: item.namaKlinik,
      alamat: item.alamat,
      telepon: item.telepon,
      logoDataUrl: item.logoDataUrl,
    });
    setError(null);
    setEditing(true);
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((f) => ({ ...f, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPut('/api/kop-surat', form);
      setEditing(false);
      await fetchKopSurat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kop surat');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      await apiPut('/api/kop-surat', KOP_SURAT_DEFAULTS);
      await fetchKopSurat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus kop surat');
    } finally {
      setResetting(false);
    }
  }

  async function handlePreview() {
    if (!item) return;
    setPreviewing(true);
    try {
      const logoSrc = item.logoDataUrl || (await loadLogoDataUrl().catch(() => ''));
      const blob = await pdf(
        <KopSuratPreviewDocument
          data={{ namaKlinik: item.namaKlinik, alamat: item.alamat, telepon: item.telepon, logoSrc }}
        />,
      ).toBlob();
      setPreviewBlob(blob);
      setPreviewOpen(true);
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="list-page">
      <header className="list-page__header">
        <div>
          <h2 className="list-page__title">Kop Surat</h2>
          <p className="list-page__subtitle">Logo, nama klinik, alamat, dan telepon dipakai bersama oleh semua template surat.</p>
        </div>
      </header>
      <section className="data-card" style={{ padding: '1.25rem' }}>
        {error && <p className="alert alert--error data-card__alert">{error}</p>}
        {loading ? (
          <p className="loading-text">Memuat…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Nama Klinik</th>
                <th>Alamat</th>
                <th>Telepon</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {item && (
                <tr>
                  <td>
                    {item.logoDataUrl ? (
                      <img
                        src={item.logoDataUrl}
                        alt="Logo kop surat"
                        style={{ width: 48, height: 48, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                      />
                    ) : (
                      '— (default)'
                    )}
                  </td>
                  <td>{item.namaKlinik}</td>
                  <td>{item.alamat || '—'}</td>
                  <td>{item.telepon || '—'}</td>
                  <td>
                    <TableRowActions
                      onEdit={openEdit}
                      onDelete={() => void handleReset()}
                      onPrint={() => void handlePreview()}
                      editLabel="Ubah kop surat"
                      deleteLabel={resetting ? 'Menghapus…' : 'Hapus (kembalikan ke default)'}
                      printLabel={previewing ? 'Membuat preview…' : 'Preview cetak kop surat'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <Modal open={editing} title="Ubah Kop Surat" onClose={() => setEditing(false)}>
        <form onSubmit={(e) => void handleSave(e)} className="form-grid">
          <div className="form-field form-field--full">
            <label htmlFor="kop-nama-klinik">Nama Klinik</label>
            <input
              id="kop-nama-klinik"
              required
              value={form.namaKlinik}
              onChange={(e) => setForm((f) => ({ ...f, namaKlinik: e.target.value }))}
            />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="kop-alamat">Alamat</label>
            <input
              id="kop-alamat"
              value={form.alamat}
              onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="kop-telepon">Telepon</label>
            <input
              id="kop-telepon"
              value={form.telepon}
              onChange={(e) => setForm((f) => ({ ...f, telepon: e.target.value }))}
            />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="kop-logo">Logo</label>
            <input id="kop-logo" type="file" accept="image/*" onChange={handleLogoFileChange} />
            {form.logoDataUrl && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={form.logoDataUrl}
                  alt="Preview logo"
                  style={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                />
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => setForm((f) => ({ ...f, logoDataUrl: null }))}
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  Hapus Logo (Pakai Default)
                </button>
              </div>
            )}
          </div>
          <ModalFormFooter onCancel={() => setEditing(false)} submitLabel="Simpan Kop Surat" loading={saving} />
        </form>
      </Modal>

      <SharingPdfPreviewModal
        open={previewOpen}
        blob={previewBlob}
        filename={`Preview_Kop_Surat_${item?.namaKlinik.replace(/[^a-zA-Z0-9]/g, '_') ?? 'default'}.pdf`}
        onClose={() => setPreviewOpen(false)}
        title="Pratinjau Kop Surat"
      />
    </div>
  );
}

interface SuratSehatItem {
  readonly id: string;
  readonly nomorSurat: string | null;
  readonly namaPasien: string;
  readonly tempatTanggalLahir: string | null;
  readonly jenisKelamin: string;
  readonly pekerjaan: string | null;
  readonly alamatPasien: string | null;
  readonly hasilPemeriksaan: string | null;
  readonly keperluan: string | null;
  readonly tempatSurat: string | null;
  readonly tanggalSurat: string;
  readonly namaDokter: string | null;
  readonly jabatanDokter: string | null;
}

const emptySehatForm = {
  nomorSurat: '',
  namaPasien: '',
  tempatTanggalLahir: '',
  jenisKelamin: 'Laki-laki',
  pekerjaan: '',
  alamatPasien: '',
  hasilPemeriksaan: 'dalam keadaan SEHAT dan tidak menderita penyakit menular',
  keperluan: '',
  tempatSurat: 'Sukabumi',
  tanggalSurat: todayStr(),
  namaDokter: '',
  jabatanDokter: 'Dokter Pemeriksa',
};

function SuratSehatSection() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<SuratSehatItem>('/api/surat-keterangan-sehat', queryParams);
  const reload = useMutationReload(reloadList);

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptySehatForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [printingId, setPrintingId] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFilename, setPreviewFilename] = useState('Surat.pdf');

  function openAdd() {
    setForm(emptySehatForm);
    setEditingId(null);
    setModalMode('add');
  }

  function openEdit(item: SuratSehatItem) {
    setEditingId(item.id);
    setForm({
      nomorSurat: item.nomorSurat ?? '',
      namaPasien: item.namaPasien,
      tempatTanggalLahir: item.tempatTanggalLahir ?? '',
      jenisKelamin: item.jenisKelamin,
      pekerjaan: item.pekerjaan ?? '',
      alamatPasien: item.alamatPasien ?? '',
      hasilPemeriksaan: item.hasilPemeriksaan ?? '',
      keperluan: item.keperluan ?? '',
      tempatSurat: item.tempatSurat ?? '',
      tanggalSurat: item.tanggalSurat,
      namaDokter: item.namaDokter ?? '',
      jabatanDokter: item.jabatanDokter ?? '',
    });
    setModalMode('edit');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (modalMode === 'add') {
        await apiPost('/api/surat-keterangan-sehat', form);
      } else if (editingId) {
        await apiPatch(`/api/surat-keterangan-sehat/${editingId}`, form);
      }
      setModalMode(null);
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
      await apiDelete(`/api/surat-keterangan-sehat/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function buildData(item: SuratSehatItem): Promise<SuratKeteranganSehatData> {
    const kop = await apiGet<{ item: KopSuratData }>('/api/kop-surat');
    const logoSrc = await resolveLogoSrc(kop.item.logoDataUrl);
    return {
      logoSrc,
      namaKlinik: kop.item.namaKlinik,
      alamatKlinik: kop.item.alamat,
      teleponKlinik: kop.item.telepon,
      nomorSurat: item.nomorSurat ?? '',
      namaPasien: item.namaPasien,
      tempatTanggalLahir: item.tempatTanggalLahir ?? '',
      jenisKelamin: item.jenisKelamin,
      pekerjaan: item.pekerjaan ?? '',
      alamatPasien: item.alamatPasien ?? '',
      hasilPemeriksaan: item.hasilPemeriksaan ?? '',
      keperluan: item.keperluan ?? '',
      tempatSurat: item.tempatSurat ?? '',
      tanggalSurat: formatTanggalLabel(item.tanggalSurat),
      namaDokter: item.namaDokter ?? '',
      jabatanDokter: item.jabatanDokter ?? '',
    };
  }

  async function handlePreview(item: SuratSehatItem) {
    setPrintingId(item.id);
    try {
      const blob = await pdf(<SuratKeteranganSehatDocument data={await buildData(item)} />).toBlob();
      setPreviewFilename(`Surat_Keterangan_Sehat_${item.namaPasien || 'Pasien'}.pdf`);
      setPreviewBlob(blob);
      setPreviewModalOpen(true);
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <>
      <ListPageShell
        title="Surat Keterangan Sehat"
        subtitle="Daftar surat keterangan sehat yang tersimpan"
        action={
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Tambah Surat
          </button>
        }
        searchPlaceholder="Cari nama pasien, nomor surat…"
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
              <th>Nomor Surat</th>
              <th>Nama Pasien</th>
              <th>Tanggal Surat</th>
              <th>Dokter</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5}>Belum ada surat keterangan sehat.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.nomorSurat || '—'}</td>
                  <td>{item.namaPasien}</td>
                  <td>{formatTanggalLabel(item.tanggalSurat)}</td>
                  <td>{item.namaDokter || '—'}</td>
                  <td>
                    <TableRowActions
                      onPrint={() => void handlePreview(item)}
                      onEdit={() => openEdit(item)}
                      onDelete={() => setDeleteTarget({ id: item.id, label: item.namaPasien })}
                      printLabel={printingId === item.id ? 'Membuat PDF…' : 'Cetak / Preview'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ListPageShell>

      <Modal
        open={modalMode !== null}
        title={modalMode === 'add' ? 'Tambah Surat Keterangan Sehat' : 'Ubah Surat Keterangan Sehat'}
        onClose={() => setModalMode(null)}
        size="lg"
      >
        <form onSubmit={(e) => void onSubmit(e)} className="form-grid">
          <div className="form-field">
            <label htmlFor="sehat-nomor">Nomor Surat</label>
            <input id="sehat-nomor" value={form.nomorSurat} onChange={(e) => setForm((f) => ({ ...f, nomorSurat: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="sehat-nama">Nama Pasien *</label>
            <input id="sehat-nama" required value={form.namaPasien} onChange={(e) => setForm((f) => ({ ...f, namaPasien: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="sehat-ttl">Tempat/Tanggal Lahir</label>
            <input
              id="sehat-ttl"
              placeholder="Sukabumi, 01 Januari 1990"
              value={form.tempatTanggalLahir}
              onChange={(e) => setForm((f) => ({ ...f, tempatTanggalLahir: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sehat-jk">Jenis Kelamin</label>
            <select id="sehat-jk" value={form.jenisKelamin} onChange={(e) => setForm((f) => ({ ...f, jenisKelamin: e.target.value }))}>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="sehat-pekerjaan">Pekerjaan</label>
            <input id="sehat-pekerjaan" value={form.pekerjaan} onChange={(e) => setForm((f) => ({ ...f, pekerjaan: e.target.value }))} />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="sehat-alamat">Alamat Pasien</label>
            <input id="sehat-alamat" value={form.alamatPasien} onChange={(e) => setForm((f) => ({ ...f, alamatPasien: e.target.value }))} />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="sehat-hasil">Hasil Pemeriksaan</label>
            <input id="sehat-hasil" value={form.hasilPemeriksaan} onChange={(e) => setForm((f) => ({ ...f, hasilPemeriksaan: e.target.value }))} />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="sehat-keperluan">Keperluan</label>
            <input
              id="sehat-keperluan"
              placeholder="Contoh: melamar pekerjaan"
              value={form.keperluan}
              onChange={(e) => setForm((f) => ({ ...f, keperluan: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sehat-tempat-ttd">Tempat Surat</label>
            <input id="sehat-tempat-ttd" value={form.tempatSurat} onChange={(e) => setForm((f) => ({ ...f, tempatSurat: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="sehat-tanggal-ttd">Tanggal Surat</label>
            <input
              id="sehat-tanggal-ttd"
              type="date"
              value={form.tanggalSurat}
              onChange={(e) => setForm((f) => ({ ...f, tanggalSurat: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="sehat-nama-dokter">Nama Dokter</label>
            <input id="sehat-nama-dokter" value={form.namaDokter} onChange={(e) => setForm((f) => ({ ...f, namaDokter: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="sehat-jabatan-dokter">Jabatan</label>
            <input id="sehat-jabatan-dokter" value={form.jabatanDokter} onChange={(e) => setForm((f) => ({ ...f, jabatanDokter: e.target.value }))} />
          </div>
          <ModalFormFooter onCancel={() => setModalMode(null)} submitLabel="Simpan" loading={saving} />
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus surat"
        message={`Yakin hapus surat keterangan sehat "${deleteTarget?.label ?? ''}"?`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <SharingPdfPreviewModal
        open={previewModalOpen}
        blob={previewBlob}
        filename={previewFilename}
        onClose={() => setPreviewModalOpen(false)}
        title="Pratinjau Surat Keterangan Sehat"
      />
    </>
  );
}

interface SuratRujukanItem {
  readonly id: string;
  readonly nomorSurat: string | null;
  readonly namaPasien: string;
  readonly tempatTanggalLahir: string | null;
  readonly jenisKelamin: string;
  readonly alamatPasien: string | null;
  readonly dirujukKe: string | null;
  readonly diagnosaKeluhan: string | null;
  readonly alasanRujukan: string | null;
  readonly tempatSurat: string | null;
  readonly tanggalSurat: string;
  readonly namaDokter: string | null;
  readonly jabatanDokter: string | null;
}

const emptyRujukanForm = {
  nomorSurat: '',
  namaPasien: '',
  tempatTanggalLahir: '',
  jenisKelamin: 'Laki-laki',
  alamatPasien: '',
  dirujukKe: '',
  diagnosaKeluhan: '',
  alasanRujukan: '',
  tempatSurat: 'Sukabumi',
  tanggalSurat: todayStr(),
  namaDokter: '',
  jabatanDokter: 'Dokter Pengirim',
};

function SuratRujukanSection() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<SuratRujukanItem>('/api/surat-keterangan-rujukan', queryParams);
  const reload = useMutationReload(reloadList);

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyRujukanForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [printingId, setPrintingId] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFilename, setPreviewFilename] = useState('Surat.pdf');

  function openAdd() {
    setForm(emptyRujukanForm);
    setEditingId(null);
    setModalMode('add');
  }

  function openEdit(item: SuratRujukanItem) {
    setEditingId(item.id);
    setForm({
      nomorSurat: item.nomorSurat ?? '',
      namaPasien: item.namaPasien,
      tempatTanggalLahir: item.tempatTanggalLahir ?? '',
      jenisKelamin: item.jenisKelamin,
      alamatPasien: item.alamatPasien ?? '',
      dirujukKe: item.dirujukKe ?? '',
      diagnosaKeluhan: item.diagnosaKeluhan ?? '',
      alasanRujukan: item.alasanRujukan ?? '',
      tempatSurat: item.tempatSurat ?? '',
      tanggalSurat: item.tanggalSurat,
      namaDokter: item.namaDokter ?? '',
      jabatanDokter: item.jabatanDokter ?? '',
    });
    setModalMode('edit');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (modalMode === 'add') {
        await apiPost('/api/surat-keterangan-rujukan', form);
      } else if (editingId) {
        await apiPatch(`/api/surat-keterangan-rujukan/${editingId}`, form);
      }
      setModalMode(null);
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
      await apiDelete(`/api/surat-keterangan-rujukan/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function buildData(item: SuratRujukanItem): Promise<SuratKeteranganRujukanData> {
    const kop = await apiGet<{ item: KopSuratData }>('/api/kop-surat');
    const logoSrc = await resolveLogoSrc(kop.item.logoDataUrl);
    return {
      logoSrc,
      namaKlinik: kop.item.namaKlinik,
      alamatKlinik: kop.item.alamat,
      teleponKlinik: kop.item.telepon,
      nomorSurat: item.nomorSurat ?? '',
      namaPasien: item.namaPasien,
      tempatTanggalLahir: item.tempatTanggalLahir ?? '',
      jenisKelamin: item.jenisKelamin,
      alamatPasien: item.alamatPasien ?? '',
      dirujukKe: item.dirujukKe ?? '',
      diagnosaKeluhan: item.diagnosaKeluhan ?? '',
      alasanRujukan: item.alasanRujukan ?? '',
      tempatSurat: item.tempatSurat ?? '',
      tanggalSurat: formatTanggalLabel(item.tanggalSurat),
      namaDokter: item.namaDokter ?? '',
      jabatanDokter: item.jabatanDokter ?? '',
    };
  }

  async function handlePreview(item: SuratRujukanItem) {
    setPrintingId(item.id);
    try {
      const blob = await pdf(<SuratKeteranganRujukanDocument data={await buildData(item)} />).toBlob();
      setPreviewFilename(`Surat_Keterangan_Rujukan_${item.namaPasien || 'Pasien'}.pdf`);
      setPreviewBlob(blob);
      setPreviewModalOpen(true);
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <>
      <ListPageShell
        title="Surat Keterangan Rujukan"
        subtitle="Daftar surat keterangan rujukan yang tersimpan"
        action={
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Tambah Surat
          </button>
        }
        searchPlaceholder="Cari nama pasien, nomor surat…"
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
              <th>Nomor Surat</th>
              <th>Nama Pasien</th>
              <th>Dirujuk Ke</th>
              <th>Tanggal Surat</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5}>Belum ada surat keterangan rujukan.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.nomorSurat || '—'}</td>
                  <td>{item.namaPasien}</td>
                  <td>{item.dirujukKe || '—'}</td>
                  <td>{formatTanggalLabel(item.tanggalSurat)}</td>
                  <td>
                    <TableRowActions
                      onPrint={() => void handlePreview(item)}
                      onEdit={() => openEdit(item)}
                      onDelete={() => setDeleteTarget({ id: item.id, label: item.namaPasien })}
                      printLabel={printingId === item.id ? 'Membuat PDF…' : 'Cetak / Preview'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ListPageShell>

      <Modal
        open={modalMode !== null}
        title={modalMode === 'add' ? 'Tambah Surat Keterangan Rujukan' : 'Ubah Surat Keterangan Rujukan'}
        onClose={() => setModalMode(null)}
        size="lg"
      >
        <form onSubmit={(e) => void onSubmit(e)} className="form-grid">
          <div className="form-field">
            <label htmlFor="rujukan-nomor">Nomor Surat</label>
            <input id="rujukan-nomor" value={form.nomorSurat} onChange={(e) => setForm((f) => ({ ...f, nomorSurat: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="rujukan-nama">Nama Pasien *</label>
            <input id="rujukan-nama" required value={form.namaPasien} onChange={(e) => setForm((f) => ({ ...f, namaPasien: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="rujukan-ttl">Tempat/Tanggal Lahir</label>
            <input
              id="rujukan-ttl"
              placeholder="Sukabumi, 01 Januari 1990"
              value={form.tempatTanggalLahir}
              onChange={(e) => setForm((f) => ({ ...f, tempatTanggalLahir: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="rujukan-jk">Jenis Kelamin</label>
            <select id="rujukan-jk" value={form.jenisKelamin} onChange={(e) => setForm((f) => ({ ...f, jenisKelamin: e.target.value }))}>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="rujukan-alamat">Alamat Pasien</label>
            <input id="rujukan-alamat" value={form.alamatPasien} onChange={(e) => setForm((f) => ({ ...f, alamatPasien: e.target.value }))} />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="rujukan-dirujuk">Dirujuk Ke *</label>
            <input
              id="rujukan-dirujuk"
              required
              placeholder="Contoh: RSUD Sekarwangi / dr. Spesialis X"
              value={form.dirujukKe}
              onChange={(e) => setForm((f) => ({ ...f, dirujukKe: e.target.value }))}
            />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="rujukan-diagnosa">Diagnosa / Keluhan</label>
            <textarea id="rujukan-diagnosa" rows={2} value={form.diagnosaKeluhan} onChange={(e) => setForm((f) => ({ ...f, diagnosaKeluhan: e.target.value }))} />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="rujukan-alasan">Alasan Rujukan</label>
            <textarea id="rujukan-alasan" rows={2} value={form.alasanRujukan} onChange={(e) => setForm((f) => ({ ...f, alasanRujukan: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="rujukan-tempat-ttd">Tempat Surat</label>
            <input id="rujukan-tempat-ttd" value={form.tempatSurat} onChange={(e) => setForm((f) => ({ ...f, tempatSurat: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="rujukan-tanggal-ttd">Tanggal Surat</label>
            <input
              id="rujukan-tanggal-ttd"
              type="date"
              value={form.tanggalSurat}
              onChange={(e) => setForm((f) => ({ ...f, tanggalSurat: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="rujukan-nama-dokter">Nama Dokter</label>
            <input id="rujukan-nama-dokter" value={form.namaDokter} onChange={(e) => setForm((f) => ({ ...f, namaDokter: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="rujukan-jabatan-dokter">Jabatan</label>
            <input id="rujukan-jabatan-dokter" value={form.jabatanDokter} onChange={(e) => setForm((f) => ({ ...f, jabatanDokter: e.target.value }))} />
          </div>
          <ModalFormFooter onCancel={() => setModalMode(null)} submitLabel="Simpan" loading={saving} />
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus surat"
        message={`Yakin hapus surat keterangan rujukan "${deleteTarget?.label ?? ''}"?`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <SharingPdfPreviewModal
        open={previewModalOpen}
        blob={previewBlob}
        filename={previewFilename}
        onClose={() => setPreviewModalOpen(false)}
        title="Pratinjau Surat Keterangan Rujukan"
      />
    </>
  );
}

const TABS = [
  { id: 'kop-surat', label: 'Kop Surat' },
  { id: 'sehat', label: 'Surat Keterangan Sehat' },
  { id: 'rujukan', label: 'Surat Keterangan Rujukan' },
] as const;

export function TempletPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('kop-surat');

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn btn--sm ${activeTab === t.id ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab(t.id)}
            style={activeTab !== t.id ? { border: '1px solid var(--color-border)' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'kop-surat' && <KopSuratSection />}
      {activeTab === 'sehat' && <SuratSehatSection />}
      {activeTab === 'rujukan' && <SuratRujukanSection />}
    </div>
  );
}
