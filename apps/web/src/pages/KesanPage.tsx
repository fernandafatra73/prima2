import { useEffect, useState, type FormEvent } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import '../components/ui/ui.css';

interface Template {
  readonly id: string;
  readonly judul: string;
  readonly isi: string;
  readonly gambar?: string | null;
}

interface BacaanItem {
  readonly id: string;
  readonly teks: string;
}

interface KategoriItem {
  readonly id: string;
  readonly nama: string;
  readonly bacaan: readonly BacaanItem[];
}

interface GrupItem {
  readonly id: string;
  readonly nama: string;
  readonly kategori: readonly KategoriItem[];
}

type BacaanModalState =
  | { readonly level: 'grup'; readonly mode: 'add' }
  | { readonly level: 'grup'; readonly mode: 'edit'; readonly id: string; readonly value: string }
  | { readonly level: 'kategori'; readonly mode: 'add'; readonly grupId: string }
  | { readonly level: 'kategori'; readonly mode: 'edit'; readonly id: string; readonly value: string }
  | { readonly level: 'bacaan'; readonly mode: 'add'; readonly kategoriId: string }
  | { readonly level: 'bacaan'; readonly mode: 'edit'; readonly id: string; readonly value: string };

type DeleteTarget = { readonly level: 'grup' | 'kategori' | 'bacaan'; readonly id: string; readonly label: string };

function TemplateExpertiseSection() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<Template>('/api/kesan-template', queryParams);
  const reload = useMutationReload(reloadList);
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [gambar, setGambar] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openAdd() {
    setJudul('');
    setIsi('');
    setGambar(null);
    setEditingId(null);
    setModalMode('add');
  }

  function openEdit(t: Template) {
    setEditingId(t.id);
    setJudul(t.judul);
    setIsi(t.isi);
    setGambar(t.gambar || null);
    setModalMode('edit');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (modalMode === 'add') {
        await apiPost('/api/kesan-template', { judul, isi, gambar });
      } else if (editingId) {
        await apiPatch(`/api/kesan-template/${editingId}`, { judul, isi, gambar });
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
      await apiDelete(`/api/kesan-template/${deleteTarget.id}`);
      setDeleteTarget(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setGambar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <ListPageShell
        title="Manajemen Kesan (Template)"
        subtitle="Template kesan untuk pemeriksaan radiologi"
        action={
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Tambah Template
          </button>
        }
        metrics={[
          {
            label: 'Total template',
            value: String(pagination.total),
            tone: 'blue',
            iconKind: 'document',
          },
        ]}
        searchPlaceholder="Cari judul atau isi template…"
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
              <th>Judul</th>
              <th>Isi</th>
              <th>Gambar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3}>Belum ada template.</td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id}>
                  <td>{t.judul}</td>
                  <td>{t.isi}</td>
                  <td>
                    {t.gambar ? (
                      <img src={t.gambar} alt={t.judul} style={{ width: 60, height: 'auto', objectFit: 'contain' }} />
                    ) : (
                      <span className="text-sm text-gray-500" style={{ fontSize: 12 }}>Tidak ada</span>
                    )}
                  </td>
                  <td>
                    <TableRowActions
                      onEdit={() => openEdit(t)}
                      onDelete={() => setDeleteTarget({ id: t.id, label: t.judul })}
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
        title={modalMode === 'add' ? 'Tambah Template Kesan' : 'Ubah Template Kesan'}
        onClose={() => setModalMode(null)}
        size="lg"
      >
        <form onSubmit={(e) => void onSubmit(e)} className="form-grid">
          <div className="form-field form-grid--full">
            <label htmlFor="kj">Judul template</label>
            <input id="kj" required value={judul} onChange={(e) => setJudul(e.target.value)} />
          </div>
          <div className="form-field form-grid--full">
            <label htmlFor="ki">Isi template</label>
            <textarea id="ki" required value={isi} onChange={(e) => setIsi(e.target.value)} />
          </div>
          <div className="form-field form-grid--full">
            <label htmlFor="kg">Gambar referensi (opsional)</label>
            <input id="kg" type="file" accept="image/*" onChange={handleFileChange} />
            {gambar && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, marginBottom: 4 }}>Preview:</p>
                <img src={gambar} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }} />
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => setGambar(null)}
                  >
                    Hapus Gambar
                  </button>
                </div>
              </div>
            )}
          </div>
          <ModalFormFooter
            onCancel={() => setModalMode(null)}
            submitLabel="Simpan"
            loading={saving}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus template"
        message={`Yakin hapus "${deleteTarget?.label ?? ''}"?`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

function KategoriBacaanSection() {
  const [grupList, setGrupList] = useState<readonly GrupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<BacaanModalState | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: readonly GrupItem[] }>('/api/kesan-bacaan-grup');
      setGrupList(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openModal(state: BacaanModalState) {
    setValue(state.mode === 'edit' ? state.value : '');
    setModal(state);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modal || !value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (modal.level === 'grup') {
        if (modal.mode === 'add') {
          await apiPost('/api/kesan-bacaan-grup', { nama: value });
        } else {
          await apiPatch(`/api/kesan-bacaan-grup/${modal.id}`, { nama: value });
        }
      } else if (modal.level === 'kategori') {
        if (modal.mode === 'add') {
          await apiPost('/api/kesan-bacaan-kategori', { grupId: modal.grupId, nama: value });
        } else {
          await apiPatch(`/api/kesan-bacaan-kategori/${modal.id}`, { nama: value });
        }
      } else {
        if (modal.mode === 'add') {
          await apiPost('/api/kesan-bacaan', { kategoriId: modal.kategoriId, teks: value });
        } else {
          await apiPatch(`/api/kesan-bacaan/${modal.id}`, { teks: value });
        }
      }
      setModal(null);
      await load();
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
      const path =
        deleteTarget.level === 'grup'
          ? `/api/kesan-bacaan-grup/${deleteTarget.id}`
          : deleteTarget.level === 'kategori'
            ? `/api/kesan-bacaan-kategori/${deleteTarget.id}`
            : `/api/kesan-bacaan/${deleteTarget.id}`;
      await apiDelete(path);
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeleteLoading(false);
    }
  }

  const modalTitle = !modal
    ? ''
    : modal.level === 'grup'
      ? modal.mode === 'add'
        ? 'Tambah Grup (mis. Thorax)'
        : 'Ubah Nama Grup'
      : modal.level === 'kategori'
        ? modal.mode === 'add'
          ? 'Tambah Kategori'
          : 'Ubah Nama Kategori'
        : modal.mode === 'add'
          ? 'Tambah Bacaan'
          : 'Ubah Teks Bacaan';

  return (
    <div className="list-page">
      <header className="list-page__header">
        <div>
          <h2 className="list-page__title">Kategori & Bacaan Kesan (Quick Kesan)</h2>
          <p className="list-page__subtitle">
            Menu kesan bertingkat (grup → kategori → bacaan) untuk mengisi Kesan dengan sekali klik di
            halaman Registrasi Radiologi.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => openModal({ level: 'grup', mode: 'add' })}>
          + Tambah Grup
        </button>
      </header>

      <section className="data-card">
        {error && <p className="alert alert--error data-card__alert">{error}</p>}

        {loading ? (
          <p className="loading-text data-card__loading">Memuat data…</p>
        ) : grupList.length === 0 ? (
          <p style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>
            Belum ada grup. Klik "+ Tambah Grup" untuk membuat, misalnya "Thorax".
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem' }}>
            {grupList.map((grup) => (
              <div key={grup.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'var(--color-surface-alt, #f8fafc)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <strong>{grup.nama}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn--xs btn--ghost"
                      onClick={() => openModal({ level: 'kategori', mode: 'add', grupId: grup.id })}
                    >
                      + Kategori
                    </button>
                    <TableRowActions
                      onEdit={() => openModal({ level: 'grup', mode: 'edit', id: grup.id, value: grup.nama })}
                      onDelete={() => setDeleteTarget({ level: 'grup', id: grup.id, label: grup.nama })}
                    />
                  </div>
                </div>

                {grup.kategori.length === 0 ? (
                  <p style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    Belum ada kategori di grup ini.
                  </p>
                ) : (
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {grup.kategori.map((kategori) => (
                      <div key={kategori.id} style={{ border: '1px solid var(--color-border)', borderRadius: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{kategori.nama}</span>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn--xs btn--ghost"
                              onClick={() =>
                                openModal({ level: 'bacaan', mode: 'add', kategoriId: kategori.id })
                              }
                            >
                              + Bacaan
                            </button>
                            <TableRowActions
                              onEdit={() =>
                                openModal({ level: 'kategori', mode: 'edit', id: kategori.id, value: kategori.nama })
                              }
                              onDelete={() =>
                                setDeleteTarget({ level: 'kategori', id: kategori.id, label: kategori.nama })
                              }
                            />
                          </div>
                        </div>

                        {kategori.bacaan.length === 0 ? (
                          <p style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            Belum ada bacaan.
                          </p>
                        ) : (
                          <table className="data-table" style={{ marginBottom: 0 }}>
                            <tbody>
                              {kategori.bacaan.map((bacaan) => (
                                <tr key={bacaan.id}>
                                  <td>{bacaan.teks}</td>
                                  <td style={{ width: 100 }}>
                                    <TableRowActions
                                      onEdit={() =>
                                        openModal({
                                          level: 'bacaan',
                                          mode: 'edit',
                                          id: bacaan.id,
                                          value: bacaan.teks,
                                        })
                                      }
                                      onDelete={() =>
                                        setDeleteTarget({ level: 'bacaan', id: bacaan.id, label: bacaan.teks })
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={modal !== null} title={modalTitle} onClose={() => setModal(null)}>
        <form onSubmit={(e) => void onSubmit(e)} className="form-grid">
          <div className="form-field form-grid--full">
            <label htmlFor="kb-value">
              {modal?.level === 'bacaan' ? 'Teks bacaan' : 'Nama'}
            </label>
            {modal?.level === 'bacaan' ? (
              <textarea id="kb-value" required rows={2} value={value} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input id="kb-value" required value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </div>
          <ModalFormFooter onCancel={() => setModal(null)} submitLabel="Simpan" loading={saving} />
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus data"
        message={`Yakin hapus "${deleteTarget?.label ?? ''}"? Data di bawahnya (jika ada) ikut terhapus.`}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export function KesanPage() {
  const [tab, setTab] = useState<'template' | 'kategori'>('template');

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn btn--sm ${tab === 'template' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setTab('template')}
          style={tab !== 'template' ? { border: '1px solid var(--color-border)' } : {}}
        >
          Template Expertise
        </button>
        <button
          type="button"
          className={`btn btn--sm ${tab === 'kategori' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setTab('kategori')}
          style={tab !== 'kategori' ? { border: '1px solid var(--color-border)' } : {}}
        >
          Kategori & Bacaan
        </button>
      </div>

      {tab === 'template' ? <TemplateExpertiseSection /> : <KategoriBacaanSection />}
    </>
  );
}
