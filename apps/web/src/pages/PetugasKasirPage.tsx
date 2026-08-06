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

interface PetugasKasirItem {
  readonly id: string;
  readonly nama: string;
  readonly noHp: string | null;
  readonly createdAt: string;
}

export function PetugasKasirPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<PetugasKasirItem>('/api/petugas-kasir', queryParams);
  const reload = useMutationReload(reloadList);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PetugasKasirItem | null>(null);
  const [deleting, setDeleting] = useState<PetugasKasirItem | null>(null);

  const [nama, setNama] = useState('');
  const [noHp, setNoHp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setNama('');
    setNoHp('');
    setCreateOpen(true);
  }

  function openEdit(item: PetugasKasirItem) {
    setEditing(item);
    setNama(item.nama);
    setNoHp(item.noHp ?? '');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/api/petugas-kasir', {
        nama: nama.trim(),
        noHp: noHp.trim() || undefined,
      });
      setCreateOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat kasir');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !nama.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPatch(`/api/petugas-kasir/${editing.id}`, {
        nama: nama.trim(),
        noHp: noHp.trim() || undefined,
      });
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah kasir');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/petugas-kasir/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus kasir');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ListPageShell
      title="Manajemen Kasir"
      metrics={[
        {
          label: 'Total Kasir',
          value: String(pagination.total),
          tone: 'blue',
          iconKind: 'users',
        },
      ]}
      searchPlaceholder="Cari nama, no. HP..."
      searchValue={search}
      onSearchChange={setSearch}
      onRefresh={() => void reload()}
      error={error}
      loading={loading}
      pagination={pagination}
      onPageChange={setPage}
      action={
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          + Tambah Kasir
        </button>
      }
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Kasir</th>
            <th>No. HP</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                Belum ada data kasir.
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr key={item.id}>
                <td>{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                <td>
                  <strong>{item.nama}</strong>
                </td>
                <td>{item.noHp || '—'}</td>
                <td>
                  <TableRowActions
                    onEdit={() => openEdit(item)}
                    onDelete={() => setDeleting(item)}
                    editLabel="Ubah kasir"
                    deleteLabel="Hapus kasir"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {createOpen && (
        <Modal open={true} title="Tambah Kasir" onClose={() => setCreateOpen(false)}>
          <form onSubmit={(e) => void handleCreate(e)} className="form-grid">
            <div className="form-field form-field--full">
              <label htmlFor="kasir-nama">Nama Kasir *</label>
              <input
                id="kasir-nama"
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Siti Aminah"
              />
            </div>

            <div className="form-field">
              <label htmlFor="kasir-nohp">No. HP (Opsional)</label>
              <input
                id="kasir-nohp"
                type="text"
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                placeholder="Contoh: 0812-3456-7890"
              />
            </div>

            <ModalFormFooter
              onCancel={() => setCreateOpen(false)}
              submitLabel="Simpan"
              loading={submitting}
            />
          </form>
        </Modal>
      )}

      {editing && (
        <Modal open={true} title="Ubah Kasir" onClose={() => setEditing(null)}>
          <form onSubmit={(e) => void handleUpdate(e)} className="form-grid">
            <div className="form-field form-field--full">
              <label htmlFor="edit-kasir-nama">Nama Kasir *</label>
              <input
                id="edit-kasir-nama"
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-kasir-nohp">No. HP</label>
              <input
                id="edit-kasir-nohp"
                type="text"
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
              />
            </div>

            <ModalFormFooter
              onCancel={() => setEditing(null)}
              submitLabel="Simpan Perubahan"
              loading={submitting}
            />
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          open={true}
          title="Hapus Kasir"
          message={`Apakah Anda yakin ingin menghapus kasir "${deleting.nama}"?`}
          confirmLabel="Hapus"
          onConfirm={() => void handleDeleteConfirm()}
          onClose={() => setDeleting(null)}
          loading={submitting}
        />
      )}
    </ListPageShell>
  );
}
