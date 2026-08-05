import { useState } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiPatch, apiPost } from '../lib/api.ts';
import '../components/ui/ui.css';

interface AiFotoItem {
  readonly id: string;
  readonly namaPasien: string;
  readonly pemeriksaan: string | null;
  readonly namaPenyakit: string | null;
  readonly fotoDataUrl: string;
  readonly kesan: string | null;
  readonly isDraftAi: boolean;
  readonly radiologNama: string | null;
  readonly tanggal: string;
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
  pemeriksaan: '',
  namaPenyakit: '',
  fotoDataUrl: '',
  kesan: '',
  radiologNama: '',
};

export function AiFotoPage() {
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
  } = usePaginatedList<AiFotoItem>('/api/analisa-foto-ai', queryParams);
  const reload = useMutationReload(reloadList);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AiFotoItem | null>(null);
  const [deleting, setDeleting] = useState<AiFotoItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Apakah nama penyakit/kesan pada form saat ini berasal dari AI (belum ditinjau).
  const [isDraftAi, setIsDraftAi] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setIsDraftAi(false);
    setConfirmReviewed(false);
    setAnalyzeError(null);
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(item: AiFotoItem) {
    setForm({
      namaPasien: item.namaPasien,
      pemeriksaan: item.pemeriksaan ?? '',
      namaPenyakit: item.namaPenyakit ?? '',
      fotoDataUrl: item.fotoDataUrl,
      kesan: item.kesan ?? '',
      radiologNama: item.radiologNama ?? '',
    });
    setIsDraftAi(item.isDraftAi);
    setConfirmReviewed(false);
    setAnalyzeError(null);
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
        setAnalyzeError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleStartAnalyze() {
    if (!form.fotoDataUrl) {
      setAnalyzeError('Unggah foto terlebih dahulu sebelum memulai analisa AI.');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await apiPost<{ namaPenyakit: string; kesan: string }>('/api/analisa-foto-ai/analyze', {
        fotoDataUrl: form.fotoDataUrl,
        pemeriksaan: form.pemeriksaan || undefined,
        namaPasien: form.namaPasien || undefined,
      });
      setForm((f) => ({ ...f, namaPenyakit: res.namaPenyakit, kesan: res.kesan }));
      setIsDraftAi(true);
      setConfirmReviewed(false);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Gagal menganalisa foto dengan AI');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fotoDataUrl) {
      setError('Foto wajib diunggah');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        namaPasien: form.namaPasien,
        pemeriksaan: form.pemeriksaan || undefined,
        namaPenyakit: form.namaPenyakit || undefined,
        fotoDataUrl: form.fotoDataUrl,
        kesan: form.kesan || undefined,
        radiologNama: form.radiologNama || undefined,
        isDraftAi: isDraftAi && !confirmReviewed,
      };
      if (editing) {
        await apiPatch(`/api/analisa-foto-ai/${editing.id}`, body);
      } else {
        await apiPost('/api/analisa-foto-ai', body);
      }
      closeModal();
      await reload({ resetPage: !editing });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data AI Foto');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/analisa-foto-ai/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data AI Foto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ListPageShell
        title="AI Foto"
        subtitle="Analisa foto anatomi dengan bantuan AI vision — hasil selalu berupa DRAFT yang wajib ditinjau ulang oleh radiolog/dokter, bukan diagnosa final"
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
            + Tambah AI Foto
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
                <th>Nama Penyakit</th>
                <th>Kesan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Belum ada data AI Foto.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <img src={item.fotoDataUrl} alt={`Foto ${item.namaPasien}`} className="aifoto-thumb" />
                    </td>
                    <td>{formatTanggalDisplay(item.tanggal)}</td>
                    <td style={{ fontWeight: 600 }}>{item.namaPasien}</td>
                    <td>{item.pemeriksaan || '—'}</td>
                    <td>{item.namaPenyakit || '—'}</td>
                    <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>
                      {item.isDraftAi && (
                        <span className="badge badge--warn" style={{ display: 'inline-block', marginBottom: '0.3rem' }}>
                          ⚠️ DRAFT AI — belum ditinjau
                        </span>
                      )}
                      <div>{item.kesan || '—'}</div>
                    </td>
                    <td>
                      <TableRowActions
                        onEdit={() => openEdit(item)}
                        onDelete={() => setDeleting(item)}
                        editLabel="Ubah / tinjau data"
                        deleteLabel="Hapus data"
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
          title={editing ? 'Ubah / Tinjau AI Foto' : 'Tambah AI Foto'}
          onClose={closeModal}
          size="lg"
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
            <div className="form-field">
              <label htmlFor="ai-nama">Nama Pasien *</label>
              <input
                id="ai-nama"
                required
                value={form.namaPasien}
                onChange={(e) => setForm((f) => ({ ...f, namaPasien: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ai-pemeriksaan">Pemeriksaan</label>
              <input
                id="ai-pemeriksaan"
                value={form.pemeriksaan}
                onChange={(e) => setForm((f) => ({ ...f, pemeriksaan: e.target.value }))}
                placeholder="Contoh: Foto luka tungkai kanan"
              />
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="ai-foto">Foto *</label>
              {!form.fotoDataUrl ? (
                <label htmlFor="ai-foto" className="aifoto-upload" style={{ cursor: 'pointer' }}>
                  <span className="aifoto-upload__icon">📤</span>
                  <strong>Klik untuk unggah foto</strong>
                  <p className="aifoto-upload__hint">JPEG, PNG, GIF, atau WEBP</p>
                </label>
              ) : (
                <div className="aifoto-preview">
                  <img src={form.fotoDataUrl} alt="Preview foto" />
                </div>
              )}
              <input
                id="ai-foto"
                type="file"
                accept="image/*"
                onChange={handleFotoFileChange}
                style={form.fotoDataUrl ? { marginTop: '0.5rem' } : { display: 'none' }}
              />
            </div>

            <div className="form-field form-field--full">
              <button
                type="button"
                className="aifoto-analyze-btn"
                disabled={analyzing || !form.fotoDataUrl}
                onClick={() => void handleStartAnalyze()}
              >
                {analyzing ? '⏳ Menganalisa foto...' : '✨ Start — Analisa Foto dengan AI'}
              </button>
              {analyzeError && (
                <p className="alert alert--error" style={{ marginTop: '0.5rem' }}>
                  {analyzeError}
                </p>
              )}
            </div>

            {isDraftAi && (
              <div className="form-field form-field--full aifoto-draft-banner">
                <strong style={{ color: '#92400e' }}>⚠️ Draft AI — belum final.</strong>{' '}
                <span style={{ color: '#78350f', fontSize: '0.85rem' }}>
                  Nama penyakit dan kesan di bawah dihasilkan otomatis oleh AI dan WAJIB diperiksa ulang oleh
                  radiolog/dokter sebelum dipakai. Periksa dan edit bila perlu, lalu centang konfirmasi berikut
                  sebelum menyimpan sebagai hasil final.
                </span>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.6rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#78350f',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmReviewed}
                    onChange={(e) => setConfirmReviewed(e.target.checked)}
                  />
                  Saya (radiolog/dokter) sudah meninjau ulang hasil ini dan menyatakannya benar
                </label>
              </div>
            )}

            <div className="form-field form-field--full">
              <label htmlFor="ai-penyakit">Nama Penyakit</label>
              <input
                id="ai-penyakit"
                value={form.namaPenyakit}
                onChange={(e) => setForm((f) => ({ ...f, namaPenyakit: e.target.value }))}
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="ai-radiolog">Nama Radiolog/Dokter</label>
              <input
                id="ai-radiolog"
                value={form.radiologNama}
                onChange={(e) => setForm((f) => ({ ...f, radiologNama: e.target.value }))}
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="ai-kesan">Kesan</label>
              <textarea
                id="ai-kesan"
                rows={4}
                value={form.kesan}
                onChange={(e) => setForm((f) => ({ ...f, kesan: e.target.value }))}
              />
            </div>

            <ModalFormFooter
              onCancel={closeModal}
              submitLabel={editing ? 'Simpan Perubahan' : 'Simpan'}
              loading={submitting}
            />
          </form>
        </Modal>
      )}

      <ConfirmModal
        open={deleting !== null}
        title="Hapus AI Foto"
        message={`Yakin hapus data AI Foto "${deleting?.namaPasien ?? ''}"?`}
        loading={submitting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
