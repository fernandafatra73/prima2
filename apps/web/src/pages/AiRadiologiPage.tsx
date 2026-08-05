import { useEffect, useState } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiPatch, apiPost } from '../lib/api.ts';
import { applyPhotoAdjustments } from '../lib/imageAdjust.ts';
import '../components/ui/ui.css';

interface AiRadiologiItem {
  readonly id: string;
  readonly namaPasien: string;
  readonly namaPemeriksaan: string | null;
  readonly fotoDataUrl: string;
  readonly bacaan: string | null;
  readonly kesan: string | null;
  readonly isDraftAi: boolean;
  readonly radiologNama: string | null;
  readonly tanggal: string;
}

const emptyForm = {
  namaPasien: '',
  namaPemeriksaan: '',
  fotoDataUrl: '',
  bacaan: '',
  kesan: '',
  radiologNama: '',
};

export function AiRadiologiPage() {
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
  } = usePaginatedList<AiRadiologiItem>('/api/analisa-radiologi-ai', queryParams);
  const reload = useMutationReload(reloadList);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AiRadiologiItem | null>(null);
  const [deleting, setDeleting] = useState<AiRadiologiItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [zoomedThumbId, setZoomedThumbId] = useState<string | null>(null);

  function handleCopyText(fieldKey: string, text: string | null) {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField((c) => (c === fieldKey ? null : c)), 2000);
  }

  function handleToggleThumbZoom(item: AiRadiologiItem) {
    setZoomedThumbId((c) => (c === item.id ? null : item.id));
  }

  // Apakah bacaan/kesan pada form saat ini berasal dari AI (belum ditinjau).
  const [isDraftAi, setIsDraftAi] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Foto asli (belum dipengaruhi slider) — kontras/detail selalu dihitung ulang dari sini.
  const [rawFotoDataUrl, setRawFotoDataUrl] = useState('');
  const [contrast, setContrast] = useState(0);
  const [detail, setDetail] = useState(0);
  const [adjustingPhoto, setAdjustingPhoto] = useState(false);
  const [fotoZoomOpen, setFotoZoomOpen] = useState(false);

  useEffect(() => {
    if (!rawFotoDataUrl) return;
    let cancelled = false;
    setAdjustingPhoto(true);
    applyPhotoAdjustments(rawFotoDataUrl, { contrast, detail })
      .then((result) => {
        if (!cancelled) setForm((f) => ({ ...f, fotoDataUrl: result }));
      })
      .catch(() => {
        if (!cancelled) setForm((f) => ({ ...f, fotoDataUrl: rawFotoDataUrl }));
      })
      .finally(() => {
        if (!cancelled) setAdjustingPhoto(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rawFotoDataUrl, contrast, detail]);

  function openCreate() {
    setForm(emptyForm);
    setIsDraftAi(false);
    setConfirmReviewed(false);
    setAnalyzeError(null);
    setError(null);
    setRawFotoDataUrl('');
    setContrast(0);
    setDetail(0);
    setCreateOpen(true);
  }

  function openEdit(item: AiRadiologiItem) {
    setForm({
      namaPasien: item.namaPasien,
      namaPemeriksaan: item.namaPemeriksaan ?? '',
      fotoDataUrl: item.fotoDataUrl,
      bacaan: item.bacaan ?? '',
      kesan: item.kesan ?? '',
      radiologNama: item.radiologNama ?? '',
    });
    setIsDraftAi(item.isDraftAi);
    setConfirmReviewed(false);
    setAnalyzeError(null);
    setError(null);
    setRawFotoDataUrl(item.fotoDataUrl);
    setContrast(0);
    setDetail(0);
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
        setContrast(0);
        setDetail(0);
        setRawFotoDataUrl(reader.result);
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
      const res = await apiPost<{ namaPemeriksaan: string; bacaan: string; kesan: string }>(
        '/api/analisa-radiologi-ai/analyze',
        {
          fotoDataUrl: form.fotoDataUrl,
          namaPemeriksaan: form.namaPemeriksaan || undefined,
          namaPasien: form.namaPasien || undefined,
        },
      );
      setForm((f) => ({
        ...f,
        namaPemeriksaan: f.namaPemeriksaan || res.namaPemeriksaan,
        bacaan: res.bacaan,
        kesan: res.kesan,
      }));
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
        namaPemeriksaan: form.namaPemeriksaan || undefined,
        fotoDataUrl: form.fotoDataUrl,
        bacaan: form.bacaan || undefined,
        kesan: form.kesan || undefined,
        radiologNama: form.radiologNama || undefined,
        isDraftAi: isDraftAi && !confirmReviewed,
      };
      if (editing) {
        await apiPatch(`/api/analisa-radiologi-ai/${editing.id}`, body);
      } else {
        await apiPost('/api/analisa-radiologi-ai', body);
      }
      closeModal();
      await reload({ resetPage: !editing });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data AI Radiologi');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/analisa-radiologi-ai/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data AI Radiologi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ListPageShell
        title="AI Radiologi"
        subtitle="Baca foto rontgen dengan bantuan AI vision — bacaan & kesan selalu berupa DRAFT yang wajib ditinjau ulang oleh radiolog, bukan diagnosa final"
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
            + Tambah AI Radiologi
          </button>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Pasien</th>
                <th>Nama Pemeriksaan</th>
                <th>Foto</th>
                <th>Bacaan</th>
                <th>Kesan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Belum ada data AI Radiologi.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.namaPasien}</td>
                    <td>{item.namaPemeriksaan || '—'}</td>
                    <td>
                      <img
                        src={item.fotoDataUrl}
                        alt={`Foto ${item.namaPasien}`}
                        className={`aifoto-thumb${zoomedThumbId === item.id ? ' aifoto-thumb--zoomed' : ''}`}
                        onDoubleClick={() => handleToggleThumbZoom(item)}
                        title="Klik 2 kali untuk perbesar/perkecil"
                      />
                    </td>
                    <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>
                      {item.isDraftAi && (
                        <span className="badge badge--warn" style={{ display: 'inline-block', marginBottom: '0.3rem' }}>
                          ⚠️ DRAFT AI — belum ditinjau
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <div style={{ flex: 1 }}>{item.bacaan || '—'}</div>
                        {item.bacaan && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs"
                            onClick={() => handleCopyText(`bacaan-${item.id}`, item.bacaan)}
                            title="Salin bacaan"
                            style={{ flexShrink: 0 }}
                          >
                            {copiedField === `bacaan-${item.id}` ? '✅' : '📋'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: '220px', whiteSpace: 'normal' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <div style={{ flex: 1 }}>{item.kesan || '—'}</div>
                        {item.kesan && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs"
                            onClick={() => handleCopyText(`kesan-${item.id}`, item.kesan)}
                            title="Salin kesan"
                            style={{ flexShrink: 0 }}
                          >
                            {copiedField === `kesan-${item.id}` ? '✅' : '📋'}
                          </button>
                        )}
                      </div>
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
          title={editing ? 'Ubah / Tinjau AI Radiologi' : 'Tambah AI Radiologi'}
          onClose={closeModal}
          size="lg"
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
            <div className="form-field form-field--full">
              <label htmlFor="ar-foto">Foto *</label>
              {!form.fotoDataUrl ? (
                <label htmlFor="ar-foto" className="aifoto-upload" style={{ cursor: 'pointer' }}>
                  <span className="aifoto-upload__icon">📤</span>
                  <strong>Klik untuk unggah foto</strong>
                  <p className="aifoto-upload__hint">JPEG, PNG, GIF, atau WEBP</p>
                </label>
              ) : (
                <div className="aifoto-preview aifoto-preview--lg">
                  <img
                    src={form.fotoDataUrl}
                    alt="Preview foto — klik untuk perbesar"
                    onClick={() => setFotoZoomOpen(true)}
                    style={{ cursor: 'zoom-in', opacity: adjustingPhoto ? 0.6 : 1 }}
                  />
                  {adjustingPhoto && <p className="aifoto-upload__hint">Memproses foto…</p>}
                </div>
              )}
              <input
                id="ar-foto"
                type="file"
                accept="image/*"
                onChange={handleFotoFileChange}
                style={form.fotoDataUrl ? { marginTop: '0.5rem' } : { display: 'none' }}
              />

              {form.fotoDataUrl && (
                <div className="aifoto-adjust">
                  <div className="aifoto-adjust__row">
                    <label htmlFor="ar-kontras">Kontras</label>
                    <input
                      id="ar-kontras"
                      type="range"
                      min={-50}
                      max={50}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                    />
                    <span className="aifoto-adjust__value">{contrast}</span>
                  </div>
                  <div className="aifoto-adjust__row">
                    <label htmlFor="ar-detail">Ketajaman</label>
                    <input
                      id="ar-detail"
                      type="range"
                      min={0}
                      max={100}
                      value={detail}
                      onChange={(e) => setDetail(Number(e.target.value))}
                    />
                    <span className="aifoto-adjust__value">{detail}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="ar-nama">Nama Pasien *</label>
              <input
                id="ar-nama"
                required
                value={form.namaPasien}
                onChange={(e) => setForm((f) => ({ ...f, namaPasien: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ar-pemeriksaan">Nama Pemeriksaan</label>
              <input
                id="ar-pemeriksaan"
                value={form.namaPemeriksaan}
                onChange={(e) => setForm((f) => ({ ...f, namaPemeriksaan: e.target.value }))}
                placeholder="Contoh: Thorax PA"
              />
            </div>

            <div className="form-field form-field--full">
              <button
                type="button"
                className="aifoto-analyze-btn"
                disabled={analyzing || !form.fotoDataUrl}
                onClick={() => void handleStartAnalyze()}
              >
                {analyzing ? '⏳ Menganalisa foto...' : '✨ Start — Analisa Foto dengan AI Radiologi'}
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
                  Bacaan dan kesan di bawah dihasilkan otomatis oleh AI dan WAJIB diperiksa ulang oleh
                  radiolog sebelum dipakai. Periksa dan edit bila perlu, lalu centang konfirmasi berikut
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
                  Saya (radiolog) sudah meninjau ulang hasil ini dan menyatakannya benar
                </label>
              </div>
            )}

            <div className="form-field form-field--full">
              <label htmlFor="ar-bacaan">Bacaan</label>
              <textarea
                id="ar-bacaan"
                rows={5}
                value={form.bacaan}
                onChange={(e) => setForm((f) => ({ ...f, bacaan: e.target.value }))}
                placeholder="Temuan detail per struktur..."
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="ar-kesan">Kesan</label>
              <textarea
                id="ar-kesan"
                rows={3}
                value={form.kesan}
                onChange={(e) => setForm((f) => ({ ...f, kesan: e.target.value }))}
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="ar-radiolog">Nama Radiolog/Dokter</label>
              <input
                id="ar-radiolog"
                value={form.radiologNama}
                onChange={(e) => setForm((f) => ({ ...f, radiologNama: e.target.value }))}
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

      <Modal open={fotoZoomOpen} title="Foto" onClose={() => setFotoZoomOpen(false)} size="xl">
        {form.fotoDataUrl && (
          <img
            src={form.fotoDataUrl}
            alt="Foto diperbesar"
            style={{ width: '100%', display: 'block', borderRadius: '8px' }}
          />
        )}
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title="Hapus AI Radiologi"
        message={`Yakin hapus data AI Radiologi "${deleting?.namaPasien ?? ''}"?`}
        loading={submitting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
