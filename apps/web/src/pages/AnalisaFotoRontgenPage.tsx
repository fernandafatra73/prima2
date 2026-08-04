import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.ts';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import {
  AnalisaFotoRontgenReportDocument,
  type AnalisaFotoRontgenReportData,
} from '../pdf/AnalisaFotoRontgenReportDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { pdf } from '@react-pdf/renderer';
import '../components/ui/ui.css';

interface AnalisaFotoRontgenItem {
  readonly id: string;
  readonly namaPasien: string;
  readonly regCode: string | null;
  readonly jenisPemeriksaan: string | null;
  readonly tanggal: string;
  readonly fotoDataUrl: string;
  readonly ukuranFoto: string;
  readonly kesan: string | null;
  readonly diagnosa: string | null;
  readonly radiologNama: string | null;
}

interface DuplikatRadiologiOption {
  readonly id: string;
  readonly regCode: string;
  readonly nama: string;
  readonly pemeriksaanNama: string;
}

interface RadiologOption {
  readonly id: string;
  readonly nama: string;
}

const UKURAN_FOTO_OPTIONS = ['3 x 4 cm', '4 x 6 cm', '2 x 3 cm', 'Original'];

interface KopSuratData {
  readonly namaKlinik: string;
  readonly alamat: string;
  readonly telepon: string;
  readonly logoDataUrl: string | null;
}

interface KesanTemplateItem {
  readonly id: string;
  readonly judul: string;
  readonly isi: string;
}

function formatTanggalDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

const emptyForm = {
  namaPasien: '',
  regCode: '',
  jenisPemeriksaan: '',
  tanggal: new Date().toISOString().split('T')[0]!,
  fotoDataUrl: '',
  ukuranFoto: UKURAN_FOTO_OPTIONS[0]!,
  kesan: '',
  diagnosa: '',
  radiologNama: '',
};

export function AnalisaFotoRontgenPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const {
    items,
    pagination,
    setPage,
    loading,
    error,
    setError,
    reload: reloadList,
  } = usePaginatedList<AnalisaFotoRontgenItem>('/api/analisa-foto-rontgen', queryParams);
  const reload = useMutationReload(reloadList);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AnalisaFotoRontgenItem | null>(null);
  const [deleting, setDeleting] = useState<AnalisaFotoRontgenItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [duplikatOptions, setDuplikatOptions] = useState<DuplikatRadiologiOption[]>([]);
  const [radiologOptions, setRadiologOptions] = useState<RadiologOption[]>([]);

  const loadDuplikatOptions = useCallback(async () => {
    try {
      const res = await apiGet<{ items: DuplikatRadiologiOption[] }>(
        '/api/pasien-duplikat?modul=RADIOLOGI&limit=200',
      );
      setDuplikatOptions(res.items);
    } catch {
      setDuplikatOptions([]);
    }
  }, []);

  const loadRadiologOptions = useCallback(async () => {
    try {
      const res = await apiGet<{ items: RadiologOption[] }>('/api/radiolog?limit=200');
      setRadiologOptions(res.items);
    } catch {
      setRadiologOptions([]);
    }
  }, []);

  useEffect(() => {
    void loadDuplikatOptions();
    void loadRadiologOptions();
  }, [loadDuplikatOptions, loadRadiologOptions]);

  const [kesanSearchOpen, setKesanSearchOpen] = useState(false);
  const [kesanSearchQuery, setKesanSearchQuery] = useState('');
  const debouncedKesanQuery = useDebouncedValue(kesanSearchQuery);
  const [kesanSearchResults, setKesanSearchResults] = useState<KesanTemplateItem[]>([]);
  const [kesanSearchLoading, setKesanSearchLoading] = useState(false);

  useEffect(() => {
    if (!kesanSearchOpen) return;
    let ignore = false;
    async function search() {
      setKesanSearchLoading(true);
      try {
        const params = debouncedKesanQuery.trim()
          ? `?q=${encodeURIComponent(debouncedKesanQuery.trim())}&limit=30`
          : '?limit=30';
        const res = await apiGet<{ items: KesanTemplateItem[] }>(`/api/kesan-template${params}`);
        if (!ignore) setKesanSearchResults(res.items);
      } catch {
        if (!ignore) setKesanSearchResults([]);
      } finally {
        if (!ignore) setKesanSearchLoading(false);
      }
    }
    void search();
    return () => {
      ignore = true;
    };
  }, [kesanSearchOpen, debouncedKesanQuery]);

  function openKesanSearch() {
    setKesanSearchQuery('');
    setKesanSearchOpen(true);
  }

  function pilihKesanTemplate(template: KesanTemplateItem) {
    setForm((f) => ({
      ...f,
      kesan: template.isi,
      diagnosa: f.diagnosa || template.judul,
    }));
    setKesanSearchOpen(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(item: AnalisaFotoRontgenItem) {
    setForm({
      namaPasien: item.namaPasien,
      regCode: item.regCode ?? '',
      jenisPemeriksaan: item.jenisPemeriksaan ?? '',
      tanggal: item.tanggal.split('T')[0]!,
      fotoDataUrl: item.fotoDataUrl,
      ukuranFoto: item.ukuranFoto || UKURAN_FOTO_OPTIONS[0]!,
      kesan: item.kesan ?? '',
      diagnosa: item.diagnosa ?? '',
      radiologNama: item.radiologNama ?? '',
    });
    setError(null);
    setEditing(item);
  }

  function closeModal() {
    setCreateOpen(false);
    setEditing(null);
  }

  function handleFotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((f) => ({ ...f, fotoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fotoDataUrl) {
      setError('Foto rontgen wajib diunggah');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        namaPasien: form.namaPasien,
        regCode: form.regCode || undefined,
        jenisPemeriksaan: form.jenisPemeriksaan || undefined,
        tanggal: form.tanggal,
        fotoDataUrl: form.fotoDataUrl,
        ukuranFoto: form.ukuranFoto || undefined,
        kesan: form.kesan || undefined,
        diagnosa: form.diagnosa || undefined,
        radiologNama: form.radiologNama || undefined,
      };
      if (editing) {
        await apiPatch(`/api/analisa-foto-rontgen/${editing.id}`, body);
      } else {
        await apiPost('/api/analisa-foto-rontgen', body);
      }
      closeModal();
      await reload({ resetPage: !editing });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data analisa foto rontgen');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/analisa-foto-rontgen/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data analisa foto rontgen');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrint(item: AnalisaFotoRontgenItem) {
    setPrintingId(item.id);
    try {
      const [logoRes, kopSurat] = await Promise.all([
        loadLogoDataUrl().catch(() => ''),
        apiGet<{ item: KopSuratData }>('/api/kop-surat').catch(() => null),
      ]);
      const data: AnalisaFotoRontgenReportData = {
        logoSrc: kopSurat?.item.logoDataUrl || logoRes,
        namaKlinik: kopSurat?.item.namaKlinik || 'KLINIK PRIMA HUSADA',
        alamatKlinik: kopSurat?.item.alamat || '',
        teleponKlinik: kopSurat?.item.telepon || '',
        namaPasien: item.namaPasien,
        regCode: item.regCode || '',
        jenisPemeriksaan: item.jenisPemeriksaan || '',
        tanggalLabel: formatTanggalDisplay(item.tanggal),
        fotoDataUrl: item.fotoDataUrl,
        kesan: item.kesan || '',
        diagnosa: item.diagnosa || '',
        radiologNama: item.radiologNama || '',
        tanggalCetak: new Date().toLocaleDateString('id-ID', {
          day: '2-digit', month: 'long', year: 'numeric',
        }),
      };
      const blob = await pdf(<AnalisaFotoRontgenReportDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Analisa_Foto_Rontgen_${item.namaPasien}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <>
      <ListPageShell
        title="Analisa Foto Rontgen"
        subtitle="Arsip foto rontgen pasien beserta kesan & diagnosa yang diisi manual oleh radiolog/dokter (bukan deteksi otomatis AI)"
        metrics={[
          { label: 'Total Data', value: String(pagination.total), tone: 'blue', iconKind: 'clipboard' },
        ]}
        searchPlaceholder="Cari nama pasien..."
        searchValue={search}
        onSearchChange={setSearch}
        onRefresh={() => void reload()}
        error={error}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        action={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            + Tambah Analisa Foto
          </button>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Tanggal</th>
                <th>Nama Pasien</th>
                <th>Pemeriksaan</th>
                <th>Kesan</th>
                <th>Radiolog</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Belum ada data analisa foto rontgen.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <img
                        src={item.fotoDataUrl}
                        alt={`Foto rontgen ${item.namaPasien}`}
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                      />
                    </td>
                    <td>{formatTanggalDisplay(item.tanggal)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {item.namaPasien}
                      {item.regCode && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{item.regCode}</div>
                      )}
                    </td>
                    <td>{item.jenisPemeriksaan || '—'}</td>
                    <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>{item.kesan || '—'}</td>
                    <td>{item.radiologNama || '—'}</td>
                    <td>
                      <TableRowActions
                        onEdit={() => openEdit(item)}
                        onDelete={() => setDeleting(item)}
                        onPrint={() => void handlePrint(item)}
                        editLabel="Ubah data analisa"
                        deleteLabel="Hapus data analisa"
                        printLabel={printingId === item.id ? 'Membuat PDF...' : 'Cetak hasil analisa'}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ListPageShell>

      {(createOpen || editing) && (
        <Modal
          open={true}
          title={editing ? 'Ubah Analisa Foto Rontgen' : 'Tambah Analisa Foto Rontgen'}
          onClose={closeModal}
          size="lg"
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
            <div className="form-field form-field--full">
              <label htmlFor="afr-pilih-duplikat">Pilih dari Duplikat Radiologi (Opsional)</label>
              <select
                id="afr-pilih-duplikat"
                value=""
                onChange={(e) => {
                  const selected = duplikatOptions.find((d) => d.id === e.target.value);
                  if (selected) {
                    setForm((f) => ({
                      ...f,
                      namaPasien: selected.nama,
                      regCode: selected.regCode,
                      jenisPemeriksaan: selected.pemeriksaanNama,
                    }));
                  }
                }}
              >
                <option value="">-- Pilih Pasien / Ketik Manual di Bawah --</option>
                {duplikatOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama} — {d.pemeriksaanNama} ({d.regCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="afr-nama">Nama Pasien *</label>
              <input
                id="afr-nama"
                required
                value={form.namaPasien}
                onChange={(e) => setForm((f) => ({ ...f, namaPasien: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="afr-regcode">No. Reg</label>
              <input
                id="afr-regcode"
                value={form.regCode}
                onChange={(e) => setForm((f) => ({ ...f, regCode: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="afr-jenis">Jenis Pemeriksaan</label>
              <input
                id="afr-jenis"
                value={form.jenisPemeriksaan}
                onChange={(e) => setForm((f) => ({ ...f, jenisPemeriksaan: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="afr-tanggal">Tanggal *</label>
              <input
                id="afr-tanggal"
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="afr-foto">Foto Rontgen *</label>
              <input id="afr-foto" type="file" accept="image/*" onChange={handleFotoFileChange} />
              {form.fotoDataUrl && (
                <img
                  src={form.fotoDataUrl}
                  alt="Preview foto rontgen"
                  style={{ marginTop: '0.5rem', maxWidth: '240px', maxHeight: '240px', objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                />
              )}
            </div>
            <div className="form-field">
              <label htmlFor="afr-ukuran-foto">Ukuran Foto</label>
              <select
                id="afr-ukuran-foto"
                value={form.ukuranFoto}
                onChange={(e) => setForm((f) => ({ ...f, ukuranFoto: e.target.value }))}
              >
                {UKURAN_FOTO_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--full">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label htmlFor="afr-kesan" style={{ margin: 0 }}>Kesan (diisi manual oleh radiolog)</label>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={openKesanSearch}
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  🔍 Cari Penyakit
                </button>
              </div>
              <textarea
                id="afr-kesan"
                rows={3}
                value={form.kesan}
                onChange={(e) => setForm((f) => ({ ...f, kesan: e.target.value }))}
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="afr-diagnosa">Diagnosa (diisi manual oleh radiolog)</label>
              <textarea
                id="afr-diagnosa"
                rows={3}
                value={form.diagnosa}
                onChange={(e) => setForm((f) => ({ ...f, diagnosa: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="afr-radiolog">Nama Radiolog/Dokter</label>
              <select
                id="afr-radiolog"
                value={form.radiologNama}
                onChange={(e) => setForm((f) => ({ ...f, radiologNama: e.target.value }))}
              >
                <option value="">-- Pilih Radiolog --</option>
                {form.radiologNama && !radiologOptions.some((r) => r.nama === form.radiologNama) && (
                  <option value={form.radiologNama}>{form.radiologNama}</option>
                )}
                {radiologOptions.map((r) => (
                  <option key={r.id} value={r.nama}>
                    {r.nama}
                  </option>
                ))}
              </select>
            </div>
            <ModalFormFooter
              onCancel={closeModal}
              submitLabel={editing ? 'Simpan Perubahan' : 'Simpan'}
              loading={submitting}
            />
          </form>
        </Modal>
      )}

      <Modal
        open={kesanSearchOpen}
        title="Cari Penyakit — Master Kesan"
        onClose={() => setKesanSearchOpen(false)}
        size="lg"
      >
        <div className="form-field form-field--full" style={{ marginBottom: '0.75rem' }}>
          <input
            autoFocus
            type="text"
            placeholder="Cari nama penyakit / kesan..."
            value={kesanSearchQuery}
            onChange={(e) => setKesanSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {kesanSearchLoading ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>Memuat...</div>
          ) : kesanSearchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
              Tidak ada template kesan yang cocok. Kelola daftar di menu Master Kesan (Expertise).
            </div>
          ) : (
            kesanSearchResults.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pilihKesanTemplate(t)}
                style={{
                  textAlign: 'left',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{t.judul}</div>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--color-text-muted)',
                    marginTop: '0.2rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {t.isi}
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title="Hapus Analisa Foto Rontgen"
        message={`Yakin hapus data analisa foto rontgen "${deleting?.namaPasien ?? ''}"?`}
        loading={submitting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
