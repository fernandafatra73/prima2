import { useState, useEffect, useMemo, useRef } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { useListRefresh } from '../context/ListRefreshContext.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import type { PaginatedResponse } from '../lib/pagination.ts';
import { PendaftaranReportDocument } from '../pdf/PendaftaranReportDocument.tsx';
import { PendaftaranKopSuratDocument } from '../pdf/PendaftaranKopSuratDocument.tsx';
import { loadLogoDataUrl } from '../pdf/loadLogoDataUrl.ts';
import { angkaKeKata } from '../lib/terbilang.ts';
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
  readonly foto: string | null;
  readonly status: 'MENUNGGU' | 'SELESAI';
}

/** Ambil nomor antrian dari 3 digit terakhir kode registrasi (mis. PH260805003 -> 3). */
function parseAntrianNumber(noRegistrasi: string): number | null {
  const match = /(\d{3})$/.exec(noRegistrasi);
  return match ? Number(match[1]) : null;
}

/** Umumkan nomor antrian berikutnya lewat speaker (Web Speech API, suara Indonesia). */
function announceAntrian(nomor: number) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(`Nomor antrian ${angkaKeKata(nomor)}. Silakan masuk.`);
  utter.lang = 'id-ID';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
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
  const [kopSuratPreviewItem, setKopSuratPreviewItem] = useState<PendaftaranUmumItem | null>(null);
  const [logoSrc, setLogoSrc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    noRegistrasi: '',
    namaPasien: '',
    umur: '',
    alamat: '',
    telpon: '',
    tanggalMasuk: '',
    dokterPengirim: '',
    klinis: '',
    admin: '',
    foto: ''
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
      admin: '',
      foto: ''
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
      admin: item.admin || '',
      foto: item.foto || ''
    });
    setError(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData((prev) => ({ ...prev, foto: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
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
        foto: formData.foto || undefined,
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
        foto: formData.foto || undefined,
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

  async function handleTandaiSelesai(item: PendaftaranUmumItem) {
    setError(null);
    try {
      await apiPatch(`/api/pendaftaran-umum/${item.id}`, { status: 'SELESAI' });
      await reload();

      const currentAntrian = parseAntrianNumber(item.noRegistrasi);
      if (currentAntrian === null) return;
      const nextAntrian = currentAntrian + 1;
      const prefix = item.noRegistrasi.slice(0, -3);
      const expectedNextCode = `${prefix}${String(nextAntrian).padStart(3, '0')}`;

      const today = todayDateStr();
      const res = await apiGet<PaginatedResponse<PendaftaranUmumItem>>(
        `/api/pendaftaran-umum?startDate=${today}&endDate=${today}&limit=200`,
      );
      const next = res.items.find((p) => p.noRegistrasi === expectedNextCode && p.status === 'MENUNGGU');
      if (next) {
        announceAntrian(nextAntrian);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menandai selesai');
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
            <tr style={{ background: '#e0f2fe' }}>
              <th style={{ color: '#0369a1' }}>No. Antrian</th>
              <th style={{ color: '#0369a1' }}>No Registrasi</th>
              <th style={{ color: '#0369a1' }}>Nama Pasien</th>
              <th style={{ color: '#0369a1' }}>Umur</th>
              <th style={{ color: '#0369a1' }}>Alamat</th>
              <th style={{ color: '#0369a1' }}>Telpon</th>
              <th style={{ color: '#0369a1' }}>Tanggal Masuk</th>
              <th style={{ color: '#0369a1' }}>Dokter Pengirim</th>
              <th style={{ color: '#0369a1' }}>Klinis</th>
              <th style={{ color: '#0369a1' }}>Status</th>
              <th style={{ color: '#0369a1' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
                  Belum ada data pendaftaran umum.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const antrian = parseAntrianNumber(item.noRegistrasi);
                return (
                <tr
                  key={item.id}
                  style={{
                    background: idx % 2 === 1 ? '#e0f2fe' : '#ffffff',
                    borderBottom: '1px solid #bae6fd',
                  }}
                >
                  <td style={{ fontWeight: 700, color: '#0369a1' }}>{antrian ?? '—'}</td>
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
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: item.status === 'SELESAI' ? '#15803d' : '#b45309',
                        background: item.status === 'SELESAI' ? '#f0fdf4' : '#fffbeb',
                        border: `1px solid ${item.status === 'SELESAI' ? '#bbf7d0' : '#fde68a'}`,
                      }}
                    >
                      {item.status === 'SELESAI' ? 'SELESAI' : 'MENUNGGU'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {item.status === 'MENUNGGU' && (
                        <button
                          type="button"
                          className="btn btn--xs btn--primary"
                          onClick={() => void handleTandaiSelesai(item)}
                          title="Tandai selesai & umumkan nomor antrian berikutnya"
                          style={{ padding: '0.3rem 0.6rem' }}
                        >
                          🔊 Selesai
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--xs btn--ghost"
                        onClick={() => setKopSuratPreviewItem(item)}
                        title="Cetak formulir dengan kop surat"
                        style={{ border: '1px solid var(--color-border)' }}
                      >
                        📄 Formulir
                      </button>
                      <TableRowActions
                        onEdit={() => openEdit(item)}
                        onDelete={() => setDeleting(item)}
                        onPrint={() => setPreviewItem(item)}
                        editLabel="Ubah pendaftaran"
                        deleteLabel="Hapus pendaftaran"
                        printLabel="Cetak pendaftaran"
                      />
                    </div>
                  </td>
                </tr>
                );
              })
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
            <fieldset className="legacy-groupbox">
              <legend>Data Pendaftaran</legend>
              <div className="legacy-form-layout">
                <div className="legacy-form-fields">
                  <div className="legacy-form-row">
                    <label htmlFor="noRegistrasi">No Registrasi</label>
                    <input
                      id="noRegistrasi"
                      name="noRegistrasi"
                      type="text"
                      value={formData.noRegistrasi}
                      onChange={handleChange}
                      placeholder="Otomatis sistem"
                      disabled={!!editing}
                    />
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="namaPasien">Nama Pasien</label>
                    <input
                      id="namaPasien"
                      name="namaPasien"
                      type="text"
                      required
                      value={formData.namaPasien}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="umur">Umur</label>
                    <input
                      id="umur"
                      name="umur"
                      type="text"
                      value={formData.umur}
                      onChange={handleChange}
                      placeholder="mis. 32 tahun / 24 bln"
                    />
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="telpon">Telpon</label>
                    <input
                      id="telpon"
                      name="telpon"
                      type="text"
                      value={formData.telpon}
                      onChange={handleChange}
                      placeholder="0812xxxx..."
                    />
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="alamat">Alamat</label>
                    <input
                      id="alamat"
                      name="alamat"
                      type="text"
                      value={formData.alamat}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="tanggalMasuk">Tanggal Masuk</label>
                    <input
                      id="tanggalMasuk"
                      name="tanggalMasuk"
                      type="date"
                      required
                      value={formData.tanggalMasuk}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="dokterPengirim">Dokter Pengirim</label>
                    <select
                      id="dokterPengirim"
                      name="dokterPengirim"
                      value={formData.dokterPengirim}
                      onChange={handleChange}
                    >
                      <option value="">-- Pilih Dokter --</option>
                      {dokterList.map((d) => (
                        <option key={d.id} value={d.nama}>
                          {d.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="admin">Admin Pendaftaran</label>
                    <select
                      id="admin"
                      name="admin"
                      value={formData.admin}
                      onChange={handleChange}
                    >
                      <option value="">-- Pilih Admin --</option>
                      {adminList.map((a) => (
                        <option key={a.id} value={a.nama}>
                          {a.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="legacy-form-row">
                    <label htmlFor="klinis">Klinis</label>
                    <input
                      id="klinis"
                      name="klinis"
                      type="text"
                      value={formData.klinis}
                      onChange={handleChange}
                      placeholder="Keluhan / keterangan medis..."
                    />
                  </div>
                </div>

                <div className="legacy-photo-panel">
                  {formData.foto ? (
                    <div className="legacy-photo-box">
                      <img src={formData.foto} alt="Foto pasien" />
                      <button
                        type="button"
                        className="legacy-photo-box__remove"
                        onClick={() => setFormData((prev) => ({ ...prev, foto: '' }))}
                        title="Hapus foto"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="legacy-photo-box">
                      <span className="legacy-photo-box__placeholder">📷</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => fotoInputRef.current?.click()}
                  >
                    Ambil Foto
                  </button>
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFotoChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </fieldset>

            <div className="form-actions form-actions--end form-grid--full">
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Menyimpan…' : 'Simpan'}
              </button>
              {editing && (
                <button type="button" className="btn btn--ghost" onClick={() => setPreviewItem(editing)}>
                  Cetak
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setCreateOpen(false); setEditing(null); }}
              >
                Batal
              </button>
            </div>
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

      {kopSuratPreviewItem && (
        <Modal
          title={`Preview Formulir — ${kopSuratPreviewItem.noRegistrasi}`}
          open={true}
          onClose={() => setKopSuratPreviewItem(null)}
          size="xl"
        >
          <div style={{ width: '100%', height: 'calc(100vh - 12rem)', minHeight: '600px' }}>
            <PDFViewer width="100%" height="100%" className="pdf-viewer">
              <PendaftaranKopSuratDocument
                data={{
                  noRegistrasi: kopSuratPreviewItem.noRegistrasi,
                  namaPasien: kopSuratPreviewItem.namaPasien,
                  umur: kopSuratPreviewItem.umur || '',
                  alamat: kopSuratPreviewItem.alamat || '',
                  telpon: kopSuratPreviewItem.telpon || '',
                  tanggalMasuk: new Date(kopSuratPreviewItem.tanggalMasuk).toLocaleDateString('id-ID'),
                  dokterPengirim: kopSuratPreviewItem.dokterPengirim || '',
                  klinis: kopSuratPreviewItem.klinis || '',
                  admin: kopSuratPreviewItem.admin || '',
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
