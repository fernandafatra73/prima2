import { useState, useEffect, useMemo } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useListRefresh } from '../context/ListRefreshContext.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import type { PaginatedResponse } from '../lib/pagination.ts';
import { PendaftaranReportDocument } from '../pdf/PendaftaranReportDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import '../components/ui/ui.css';

function todayDateStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface PendaftaranUmumItem {
  readonly id: string;
  readonly noRegistrasi: string;
  readonly namaPasien: string;
  readonly umur: string | null;
  readonly alamat: string | null;
  readonly telpon: string | null;
  readonly tanggalMasuk: string;
  readonly dokterPengirim: string | null;
  readonly klinis: string | null;
  readonly admin: string | null;
}

function formatWhatsAppNumber(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('0')) {
    return '62' + cleaned.slice(1);
  }
  if (cleaned.startsWith('62')) {
    return cleaned;
  }
  return '62' + cleaned;
}

export function PendaftaranUmumPage() {
  const { search, setSearch } = useListSearch();
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateParams = useMemo(() => {
    if (timeFilter === 'all') return {};
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (timeFilter === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (timeFilter === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      const sy = start.getFullYear();
      const sm = String(start.getMonth() + 1).padStart(2, '0');
      const sd = String(start.getDate()).padStart(2, '0');
      return { startDate: `${sy}-${sm}-${sd}`, endDate: todayStr };
    }
    if (timeFilter === 'custom') {
      return {
        ...(customStart ? { startDate: customStart } : {}),
        ...(customEnd ? { endDate: customEnd } : {}),
      };
    }
    return {};
  }, [timeFilter, customStart, customEnd]);

  const queryParams = useListQueryParams({ ...(dateParams as Record<string, string>) }, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<PendaftaranUmumItem>('/api/pendaftaran-umum', queryParams);
  const reload = useMutationReload(reloadList);

  const { items: dokterList } = usePaginatedList<{ id: string; nama: string }>('/api/dokter', { limit: '100' });
  const { items: adminList } = usePaginatedList<{ id: string; nama: string }>('/api/admin-pendaftaran', { limit: '100' });

  const { version: listRefreshVersion } = useListRefresh();
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    const today = todayDateStr();
    apiGet<PaginatedResponse<PendaftaranUmumItem>>(
      `/api/pendaftaran-umum?startDate=${today}&endDate=${today}&limit=1`,
    )
      .then((res) => setTodayCount(res.pagination.total))
      .catch(() => setTodayCount(0));
  }, [listRefreshVersion]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PendaftaranUmumItem | null>(null);
  const [deleting, setDeleting] = useState<PendaftaranUmumItem | null>(null);
  const [previewItem, setPreviewItem] = useState<PendaftaranUmumItem | null>(null);
  const [logoSrc, setLogoSrc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    noRegistrasi: '',
    namaPasien: '',
    umur: '',
    alamat: '',
    telpon: '',
    tanggalMasuk: '',
    dokterPengirim: '',
    klinis: '',
    admin: ''
  });

  useEffect(() => {
    void loadLogoDataUrl().then(setLogoSrc).catch(() => setLogoSrc(''));
  }, []);

  function openCreate() {
    setFormData({
      noRegistrasi: '',
      namaPasien: '',
      umur: '',
      alamat: '',
      telpon: '',
      tanggalMasuk: new Date().toISOString().split('T')[0],
      dokterPengirim: '',
      klinis: '',
      admin: ''
    });
    setCreateOpen(true);
    setError(null);
  }

  function openEdit(item: PendaftaranUmumItem) {
    setEditing(item);
    setFormData({
      noRegistrasi: item.noRegistrasi,
      namaPasien: item.namaPasien,
      umur: item.umur || '',
      alamat: item.alamat || '',
      telpon: item.telpon || '',
      tanggalMasuk: item.tanggalMasuk.split('T')[0],
      dokterPengirim: item.dokterPengirim || '',
      klinis: item.klinis || '',
      admin: item.admin || ''
    });
    setError(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }


  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/api/pendaftaran-umum', {
        noRegistrasi: formData.noRegistrasi || undefined,
        namaPasien: formData.namaPasien,
        umur: formData.umur || undefined,
        alamat: formData.alamat || undefined,
        telpon: formData.telpon || undefined,
        tanggalMasuk: formData.tanggalMasuk,
        dokterPengirim: formData.dokterPengirim || undefined,
        klinis: formData.klinis || undefined,
        admin: formData.admin || undefined,
      });
      setCreateOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat pendaftaran');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPatch(`/api/pendaftaran-umum/${editing.id}`, {
        noRegistrasi: formData.noRegistrasi,
        namaPasien: formData.namaPasien,
        umur: formData.umur || undefined,
        alamat: formData.alamat || undefined,
        telpon: formData.telpon || undefined,
        tanggalMasuk: formData.tanggalMasuk,
        dokterPengirim: formData.dokterPengirim || undefined,
        klinis: formData.klinis || undefined,
        admin: formData.admin || undefined,
      });
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah pendaftaran');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/pendaftaran-umum/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus pendaftaran');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ListPageShell
      title="Pendaftaran Umum"
      metrics={[
        {
          label: 'Total Pendaftaran',
          value: String(pagination.total),
          tone: 'blue',
          iconKind: 'users',
        },
        {
          label: 'Nomor Antrian',
          value: String(todayCount + 1),
          tone: 'violet',
          iconKind: 'clock',
        },
      ]}
      searchPlaceholder="Cari nama pasien, no registrasi..."
      searchValue={search}
      onSearchChange={setSearch}
      onRefresh={() => void reload()}
      filterExtra={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'today' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTimeFilter(timeFilter === 'today' ? 'all' : 'today'); setPage(1); }}
            style={timeFilter !== 'today' ? { border: '1px solid var(--color-border)' } : {}}
          >
            📅 Pasien Hari Ini
          </button>
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'week' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTimeFilter(timeFilter === 'week' ? 'all' : 'week'); setPage(1); }}
            style={timeFilter !== 'week' ? { border: '1px solid var(--color-border)' } : {}}
          >
            🗓️ Pasien Per Minggu
          </button>
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'custom' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setTimeFilter(timeFilter === 'custom' ? 'all' : 'custom')}
            style={timeFilter !== 'custom' ? { border: '1px solid var(--color-border)' } : {}}
          >
            🔧 Custom
          </button>
          <button
            type="button"
            className={`btn btn--sm ${timeFilter === 'all' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setTimeFilter('all'); setPage(1); }}
            style={timeFilter !== 'all' ? { border: '1px solid var(--color-border)' } : {}}
          >
            Lihat Semua
          </button>
          {timeFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setPage(1); }}
                style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                aria-label="Tanggal mulai"
              />
              <span>–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setPage(1); }}
                style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                aria-label="Tanggal akhir"
              />
            </div>
          )}
        </div>
      }
      error={error}
      loading={loading}
      pagination={pagination}
      onPageChange={setPage}
      action={
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          + Tambah Pendaftaran
        </button>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No Registrasi</th>
              <th>Nama Pasien</th>
              <th>Umur</th>
              <th>Alamat</th>
              <th>Telpon</th>
              <th>Tanggal Masuk</th>
              <th>Dokter Pengirim</th>
              <th>Klinis</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                  Belum ada data pendaftaran umum.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{
                    background: idx % 2 === 1 ? '#e0f2fe' : '#ffffff',
                    borderBottom: '1px solid #bae6fd',
                  }}
                >
                  <td>{item.noRegistrasi}</td>
                  <td><strong>{item.namaPasien}</strong></td>
                  <td>{item.umur || '-'}</td>
                  <td>{item.alamat || '-'}</td>
                  <td>
                    {item.telpon ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{item.telpon}</span>
                        <a
                          href={`https://wa.me/${formatWhatsAppNumber(item.telpon)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Chat WhatsApp dengan ${item.namaPasien} (${item.telpon})`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            backgroundColor: '#e0f2fe',
                            color: '#16a34a',
                            border: '1px solid #7dd3fc',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#bae6fd';
                            e.currentTarget.style.borderColor = '#38bdf8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#e0f2fe';
                            e.currentTarget.style.borderColor = '#7dd3fc';
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                          </svg>
                          WhatsApp
                        </a>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{new Date(item.tanggalMasuk).toLocaleDateString('id-ID')}</td>
                  <td>{item.dokterPengirim || '-'}</td>
                  <td>{item.klinis || '-'}</td>
                  <td>
                    <TableRowActions
                      onEdit={() => openEdit(item)}
                      onDelete={() => setDeleting(item)}
                      onPrint={() => setPreviewItem(item)}
                      editLabel="Ubah pendaftaran"
                      deleteLabel="Hapus pendaftaran"
                      printLabel="Cetak pendaftaran"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(createOpen || editing) && (
        <Modal 
          open={true} 
          title={editing ? "Ubah Pendaftaran Umum" : "Tambah Pendaftaran Umum"} 
          onClose={() => { setCreateOpen(false); setEditing(null); }}
          size="lg"
        >
          <form onSubmit={editing ? handleUpdate : handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Section 1: Data Identitas & Registrasi (Biru Muda Card #f0f9ff) */}
            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.05)',
              }}
            >
              <h4
                style={{
                  margin: '0 0 1rem',
                  color: '#0369a1',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  borderBottom: '1px solid #e0f2fe',
                  paddingBottom: '0.5rem',
                }}
              >
                <span>📋</span> Data Identitas &amp; Registrasi Pasien
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label htmlFor="noRegistrasi" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    No. Registrasi (Otomatis)
                  </label>
                  <input
                    id="noRegistrasi"
                    name="noRegistrasi"
                    type="text"
                    value={formData.noRegistrasi}
                    onChange={handleChange}
                    placeholder="Otomatis sistem"
                    disabled={!!editing}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: editing ? '#e0f2fe' : '#ffffff',
                      color: '#0f172a',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="tanggalMasuk" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    Tanggal Masuk <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="tanggalMasuk"
                    name="tanggalMasuk"
                    type="date"
                    required
                    value={formData.tanggalMasuk}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="namaPasien" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    Nama Lengkap Pasien <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="namaPasien"
                    name="namaPasien"
                    type="text"
                    required
                    value={formData.namaPasien}
                    onChange={handleChange}
                    placeholder="Masukkan nama lengkap pasien..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="umur" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    Umur Pasien
                  </label>
                  <input
                    id="umur"
                    name="umur"
                    type="text"
                    value={formData.umur}
                    onChange={handleChange}
                    placeholder="mis. 32 tahun / 24 bln"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="telpon" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    id="telpon"
                    name="telpon"
                    type="text"
                    value={formData.telpon}
                    onChange={handleChange}
                    placeholder="0812xxxx..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="alamat" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    Alamat Lengkap Pasien
                  </label>
                  <textarea
                    id="alamat"
                    name="alamat"
                    rows={2}
                    value={formData.alamat}
                    onChange={handleChange}
                    placeholder="Nama jalan, RT/RW, kelurahan, kecamatan..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="klinis" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    Klinis (Keterangan Medis / Keluhan Pasien)
                  </label>
                  <textarea
                    id="klinis"
                    name="klinis"
                    rows={2}
                    value={formData.klinis}
                    onChange={handleChange}
                    placeholder="Keluhan utama, riwayat medis singkat, diagnosa sementara..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Informasi Medis, Dokter & Admin (Biru Muda Card #f0f9ff) */}
            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.05)',
              }}
            >
              <h4
                style={{
                  margin: '0 0 1rem',
                  color: '#0369a1',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  borderBottom: '1px solid #e0f2fe',
                  paddingBottom: '0.5rem',
                }}
              >
                <span>🩺</span> Informasi Medis, Dokter &amp; Petugas
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label htmlFor="dokterPengirim" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    Dokter Pemeriksa / Pengirim
                  </label>
                  <select
                    id="dokterPengirim"
                    name="dokterPengirim"
                    value={formData.dokterPengirim}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 600,
                    }}
                  >
                    <option value="">-- Pilih Dokter --</option>
                    {dokterList.map((d) => (
                      <option key={d.id} value={d.nama}>
                        {d.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="admin" style={{ display: 'block', fontWeight: 600, color: '#0c4a6e', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    Admin Pendaftaran
                  </label>
                  <select
                    id="admin"
                    name="admin"
                    value={formData.admin}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #7dd3fc',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 600,
                    }}
                  >
                    <option value="">-- Pilih Admin --</option>
                    {adminList.map((a) => (
                      <option key={a.id} value={a.nama}>
                        {a.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <ModalFormFooter
              onCancel={() => { setCreateOpen(false); setEditing(null); }}
              submitLabel={editing ? "Simpan Perubahan" : "Simpan Pendaftaran"}
              loading={submitting}
            />
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          open={true}
          title="Hapus Pendaftaran"
          message={`Apakah Anda yakin ingin menghapus pendaftaran "${deleting.namaPasien}"?`}
          confirmLabel="Hapus"
          onConfirm={() => void handleDeleteConfirm()}
          onClose={() => setDeleting(null)}
          loading={submitting}
        />
      )}

      {previewItem && (
        <Modal
          title={`Preview Cetak — ${previewItem.noRegistrasi}`}
          open={true}
          onClose={() => setPreviewItem(null)}
          size="xl"
        >
          <div style={{ width: '100%', height: 'calc(100vh - 12rem)', minHeight: '600px' }}>
            <PDFViewer width="100%" height="100%" className="pdf-viewer">
              <PendaftaranReportDocument
                data={{
                  noRegistrasi: previewItem.noRegistrasi,
                  namaPasien: previewItem.namaPasien,
                  umur: previewItem.umur || '',
                  alamat: previewItem.alamat || '',
                  telpon: previewItem.telpon || '',
                  tanggalMasuk: new Date(previewItem.tanggalMasuk).toLocaleDateString('id-ID'),
                  dokterPengirim: previewItem.dokterPengirim || '',
                  klinis: previewItem.klinis || '',
                  admin: previewItem.admin || '',
                  logoSrc,
                }}
              />
            </PDFViewer>
          </div>
        </Modal>
      )}
    </ListPageShell>
  );
}
