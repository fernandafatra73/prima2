import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { ListPageShell } from '../components/ui/ListPageShell.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { CetakALModal, type CetakALPasien } from '../components/CetakALModal.tsx';
import { ExpertiseModal } from '../components/ExpertiseModal.tsx';
import { KesanRegioPicker } from '../components/KesanRegioPicker.tsx';
import { useListQueryParams, useListSearch } from '../hooks/useListQueryParams.ts';
import { useMutationReload } from '../hooks/useMutationReload.ts';
import { usePaginatedList } from '../hooks/usePaginatedList.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import { clampClinicalInput } from '../lib/clinicalText.ts';
import type { PaginatedResponse } from '../lib/pagination.ts';
import { printPasienReport } from '../lib/pasienPrint.ts';
import { formatKlinisDisplay, parseKlinisData } from '../lib/penunjang.ts';
import { formatRupiah } from '../lib/format.ts';
import '../components/ui/ui.css';

interface AntreanItem {
  readonly id: string;
  readonly sourcePasienId: string;
  readonly regCode: string;
  readonly nama: string;
  readonly tanggalLahir: string;
  readonly umur: number;
  readonly noTelepon: string | null;
  readonly alamat: string | null;
  readonly klinis: string | null;
  readonly pengirimNama: string;
  readonly radiologNama: string | null;
  readonly pemeriksaanNama: string;
  readonly kesan: string | null;
  readonly hasilStatus: 'MENUNGGU_HASIL' | 'SELESAI';
  readonly paymentStatus: 'BELUM_LUNAS' | 'LUNAS';
  readonly totalHarga: string;
  readonly createdAt: string;
}

interface KesanTemplateItem {
  readonly id: string;
  readonly judul: string;
  readonly isi: string;
}

interface RadiologItem {
  readonly id: string;
  readonly nama: string;
}

const DEFAULT_KESAN_TEMPLATES: readonly KesanTemplateItem[] = [
  {
    id: 'default-normal',
    judul: 'Thorax Normal (Cor & Pulmo)',
    isi: 'Cor dan pulmo dalam batas normal.\nTidak tampak infiltrat maupun nodul.\nSinus dan diafragma baik.',
  },
  {
    id: 'default-thorax-tb',
    judul: 'Thorax - TB Paru Aktif',
    isi: 'Tampak bercak infiltrat pada apeks pulmo kanan dan kiri.\nKesan: TB Paru Aktif bilateral.\nSaran: Korelasi klinis dan pemeriksaan BTA / GeneXpert.',
  },
  {
    id: 'default-thorax-cardio',
    judul: 'Thorax - Cardiomegaly',
    isi: 'CTR > 55% dengan apex terdorong ke lateral.\nTampak bendungan pembuluh darah paru.\nKesan: Cardiomegali dengan tanda awal edema paru.',
  },
  {
    id: 'default-cranium',
    judul: 'Cranium Normal / Trauma',
    isi: 'Tulang-tulang calvaria cranii utuh, tidak tampak garis fraktur.\nSella turcica normal.\nSinus paranasalis cerah.',
  },
  {
    id: 'default-fracture',
    judul: 'Extremitas - Fraktur',
    isi: 'Tampak garis fraktur pada sepertiga tengah corpus os tibia/fibula dengan aposisi dan alinement cukup.\nTidak tampak pembengkakan jaringan lunak berlebih.',
  },
  {
    id: 'default-dental',
    judul: 'Dental Panoramic Normal',
    isi: 'Susunan gigi geligi rahang atas dan bawah dalam batas normal.\nTidak tampak lesi periapikal maupun kista rahang.',
  },
];

function RadiologTarifSummary({
  totalHarga,
}: {
  readonly totalHarga: string;
}) {
  const totalNum = Number(totalHarga) || 0;
  const sharingNum = Math.round(totalNum * 0.3); // 30% komisi radiolog standar

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        fontSize: '0.9rem',
      }}
    >
      <div>
        <span style={{ color: '#64748b' }}>Tarif Pemeriksaan Radiologi: </span>
        <strong style={{ color: '#0f172a' }}>{formatRupiah(totalNum)}</strong>
      </div>
      <div>
        <span style={{ color: '#64748b' }}>Estimasi Komisi Radiolog (30%): </span>
        <strong style={{ color: '#0284c7' }}>{formatRupiah(sharingNum)}</strong>
      </div>
    </div>
  );
}

function combinedPemeriksaan(item: AntreanItem): string {
  const parsed = parseKlinisData(item.klinis);
  const list = [
    ...(item.pemeriksaanNama ? item.pemeriksaanNama.split(', ').filter(Boolean) : []),
    ...parsed.radTambahan.map((r) => `+Rad: ${r}`),
    ...parsed.labTambahan.map((l) => `+Lab: ${l}`),
  ];
  return list.join(', ') || '—';
}

export function RadiologWorkPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams(
    { modul: 'RADIOLOGI', hasilStatus: 'MENUNGGU_HASIL' },
    search,
  );
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<AntreanItem>('/api/pasien-duplikat', queryParams);
  const reload = useMutationReload(reloadList);
  const [selected, setSelected] = useState<AntreanItem | null>(null);
  const [kesan, setKesan] = useState('');
  const [kesanTemplates, setKesanTemplates] = useState<KesanTemplateItem[]>([]);
  const [expertiseModalOpen, setExpertiseModalOpen] = useState(false);
  const [hasilStatus, setHasilStatus] = useState<'MENUNGGU_HASIL' | 'SELESAI'>('MENUNGGU_HASIL');
  const [paymentStatus, setPaymentStatus] = useState<'BELUM_LUNAS' | 'LUNAS'>('BELUM_LUNAS');
  const [radiologList, setRadiologList] = useState<RadiologItem[]>([]);
  const [radiologId, setRadiologId] = useState('');
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [labelItem, setLabelItem] = useState<AntreanItem | null>(null);
  const [quickEditItem, setQuickEditItem] = useState<AntreanItem | null>(null);
  const [quickEditNama, setQuickEditNama] = useState('');
  const [quickEditKesan, setQuickEditKesan] = useState('');
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [aiFotoOpen, setAiFotoOpen] = useState(false);
  const [aiFotoDataUrl, setAiFotoDataUrl] = useState('');
  const [aiFotoAnalyzing, setAiFotoAnalyzing] = useState(false);
  const [aiFotoError, setAiFotoError] = useState<string | null>(null);
  const [aiFotoNamaPenyakit, setAiFotoNamaPenyakit] = useState('');
  const [aiFotoKesan, setAiFotoKesan] = useState('');

  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<KesanTemplateItem>>('/api/kesan-template?page=1&limit=200');
      setKesanTemplates(res.items.length > 0 ? res.items : Array.from(DEFAULT_KESAN_TEMPLATES));
    } catch {
      setKesanTemplates(Array.from(DEFAULT_KESAN_TEMPLATES));
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    apiGet<PaginatedResponse<RadiologItem>>('/api/radiolog?page=1&limit=200')
      .then((res) => setRadiologList(res.items))
      .catch(() => setRadiologList([]));
  }, []);

  async function openEdit(item: AntreanItem) {
    setSelected(item);
    setKesan(item.kesan ?? '');
    setHasilStatus(item.hasilStatus);
    setPaymentStatus(item.paymentStatus);
    setRadiologId('');
    try {
      const detail = await apiGet<{ item: { radiolog: { id: string } | null } }>(
        `/api/pasien/${item.sourcePasienId}`,
      );
      setRadiologId(detail.item.radiolog?.id ?? '');
    } catch {
      setRadiologId('');
    }
  }

  function openAiFotoModal() {
    setAiFotoDataUrl('');
    setAiFotoError(null);
    setAiFotoNamaPenyakit('');
    setAiFotoKesan('');
    setAiFotoOpen(true);
  }

  function handleAiFotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAiFotoDataUrl(reader.result);
        setAiFotoError(null);
        setAiFotoNamaPenyakit('');
        setAiFotoKesan('');
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleAiFotoAnalyze() {
    if (!aiFotoDataUrl) {
      setAiFotoError('Unggah foto terlebih dahulu sebelum memulai analisa AI.');
      return;
    }
    setAiFotoAnalyzing(true);
    setAiFotoError(null);
    try {
      const res = await apiPost<{ namaPenyakit: string; kesan: string }>('/api/analisa-foto-ai/analyze', {
        fotoDataUrl: aiFotoDataUrl,
        namaPasien: selected?.nama || undefined,
      });
      setAiFotoNamaPenyakit(res.namaPenyakit);
      setAiFotoKesan(res.kesan);
    } catch (err) {
      setAiFotoError(err instanceof Error ? err.message : 'Gagal menganalisa foto dengan AI');
    } finally {
      setAiFotoAnalyzing(false);
    }
  }

  function handleUseAiFotoKesan() {
    const combined = aiFotoNamaPenyakit.trim()
      ? `Kemungkinan: ${aiFotoNamaPenyakit.trim()}\n\n${aiFotoKesan}`
      : aiFotoKesan;
    setKesan((prev) => clampClinicalInput(prev ? prev + '\n\n' + combined : combined));
    setAiFotoOpen(false);
  }

  function openQuickEdit(item: AntreanItem) {
    setQuickEditItem(item);
    setQuickEditNama(item.nama);
    setQuickEditKesan(item.kesan ?? '');
    setQuickEditError(null);
  }

  async function submitQuickEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickEditItem) return;
    setQuickEditSaving(true);
    setQuickEditError(null);
    try {
      await apiPatch(`/api/pasien/${quickEditItem.sourcePasienId}`, {
        nama: quickEditNama,
        kesan: quickEditKesan,
      });
      setQuickEditItem(null);
      await reload();
    } catch (err: unknown) {
      setQuickEditError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setQuickEditSaving(false);
    }
  }

  async function simpanHasil() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/api/pasien/${selected.sourcePasienId}`, {
        kesan,
        hasilStatus,
        paymentStatus,
        radiologId: radiologId || undefined,
      });
      setSelected(null);
      setKesan('');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint(id: string) {
    setPrintingId(id);
    setError(null);
    try {
      await printPasienReport(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membuat PDF');
    } finally {
      setPrintingId(null);
    }
  }

  function toCetakALPasien(item: AntreanItem): CetakALPasien {
    return {
      id: item.sourcePasienId,
      regCode: item.regCode,
      nama: item.nama,
      umur: item.umur,
      tanggalLahir: item.tanggalLahir,
      createdAt: item.createdAt,
      pengirim: { nama: item.pengirimNama },
      radiolog: item.radiologNama ? { nama: item.radiologNama } : null,
      pemeriksaan: item.pemeriksaanNama
        ? item.pemeriksaanNama.split(', ').filter(Boolean).map((nama) => ({ nama }))
        : [],
    };
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    setError(null);
    try {
      await apiDelete('/api/pasien/bulk-radiolog-antrean');
      setBulkDeleteOpen(false);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus semua data');
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <>
      <ListPageShell
        title="Radiolog — Antrean & Kesan"
        subtitle="Pasien menunggu hasil bacaan radiologi"
        metrics={[
          {
            label: 'Antrean aktif',
            value: String(pagination.total),
            tone: 'amber',
            iconKind: 'clock',
          },
          {
            label: 'Di halaman ini',
            value: String(items.length),
            tone: 'blue',
            iconKind: 'users',
          },
        ]}
        searchPlaceholder="Cari nama atau no. reg…"
        searchValue={search}
        onSearchChange={setSearch}
        onRefresh={() => void reload()}
        error={error}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        action={
          items.length > 0 ? (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setBulkDeleteOpen(true)}
            >
              🗑️ Hapus Semua
            </button>
          ) : undefined
        }
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Tgl / Reg</th>
              <th>Nama Pasien</th>
              <th>Umur / JK</th>
              <th>Pengirim</th>
              <th>Pemeriksaan</th>
              <th>Hasil</th>
              <th>Bayar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8}>Tidak ada antrean pasien.</td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {new Date(p.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.regCode}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.nama}</div>
                    {p.alamat && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{p.alamat}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.umur} thn
                  </td>
                  <td>{p.pengirimNama}</td>
                  <td>{combinedPemeriksaan(p)}</td>
                  <td>
                    <span className={`badge ${p.hasilStatus === 'SELESAI' ? 'badge--ok' : 'badge--pending'}`}>
                      {p.hasilStatus === 'SELESAI' ? 'Selesai' : 'Menunggu'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${p.paymentStatus === 'LUNAS' ? 'badge--ok' : 'badge--unpaid'}`}>
                      {p.paymentStatus === 'LUNAS' ? 'Lunas' : 'Belum'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn--xs btn--ghost"
                        onClick={() => openQuickEdit(p)}
                        title="Edit cepat: nama & kesan"
                        style={{ border: '1px solid var(--color-border)' }}
                      >
                        Edit²
                      </button>
                      <TableRowActions
                        onPrint={() => void handlePrint(p.sourcePasienId)}
                        onEdit={() => void openEdit(p)}
                        editLabel="Ubah kesan dan status"
                        printLabel={printingId === p.sourcePasienId ? 'Membuat PDF…' : 'Cetak hasil radiologi'}
                      />
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setLabelItem(p)}
                        title="Cetak label"
                      >
                        🏷️ Cetak Label
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ListPageShell>

      <Modal
        open={selected !== null}
        title={selected ? `Kesan Radiologi — ${selected.nama} (${selected.regCode})` : 'Ubah data'}
        onClose={() => setSelected(null)}
        size="lg"
      >
        {selected && (
          <form onSubmit={(e) => { e.preventDefault(); void simpanHasil(); }}>
            {/* Patient Info Card */}
            <div style={{
              background: 'var(--color-surface-2, #f8fafc)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.35rem 1.5rem',
              fontSize: '0.85rem',
            }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>No. Reg</span><br /><strong>{selected.regCode}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal</span><br /><strong>{new Date(selected.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Nama Pasien</span><br /><strong>{selected.nama}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Umur</span><br /><strong>{selected.umur} tahun</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Alamat</span><br /><strong>{selected.alamat ?? '—'}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>No. Telepon</span><br /><strong>{selected.noTelepon ?? '—'}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Pengirim</span><br /><strong>{selected.pengirimNama}</strong></div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Pemeriksaan</span><br />
                <strong>{combinedPemeriksaan(selected)}</strong>
              </div>
              {selected.klinis && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Klinis</span><br />
                  <strong>{formatKlinisDisplay(selected.klinis)}</strong>
                </div>
              )}
            </div>

            {/* Ringkasan Tarif Pemeriksaan & Komisi Radiolog */}
            <RadiologTarifSummary
              totalHarga={selected.totalHarga}
            />

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="hasil-r">Status hasil</label>
                <select
                  id="hasil-r"
                  value={hasilStatus}
                  onChange={(e) => setHasilStatus(e.target.value as 'MENUNGGU_HASIL' | 'SELESAI')}
                >
                  <option value="MENUNGGU_HASIL">Menunggu hasil</option>
                  <option value="SELESAI">Selesai</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="radiolog-r">Radiolog</label>
                <select
                  id="radiolog-r"
                  value={radiologId}
                  onChange={(e) => setRadiologId(e.target.value)}
                >
                  <option value="">-- Pilih Radiolog --</option>
                  {radiologList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="bayar-r">Status pembayaran</label>
                <select
                  id="bayar-r"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'BELUM_LUNAS' | 'LUNAS')}
                >
                  <option value="BELUM_LUNAS">Belum lunas</option>
                  <option value="LUNAS">Lunas</option>
                </select>
              </div>
              <div className="form-field form-grid--full">
                <div className="form-field__header">
                  <label htmlFor="kesan" style={{ margin: 0 }}>Kesan & saran</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn--xs btn--primary"
                      onClick={() => setExpertiseModalOpen(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <span>⚡</span> Expertise
                    </button>
                    <button
                      type="button"
                      className="btn btn--xs btn--ghost"
                      onClick={openAiFotoModal}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--color-border)' }}
                    >
                      <span>✨</span> AI Foto
                    </button>
                  </div>
                </div>
                <textarea
                  id="kesan"
                  value={kesan}
                  onChange={(e) => setKesan(clampClinicalInput(e.target.value))}
                  placeholder="Isi kesan & saran radiologi..."
                  rows={8}
                />
              </div>
            </div>
            <ModalFormFooter
              onCancel={() => setSelected(null)}
              submitLabel="Simpan perubahan"
              loading={saving}
            />
          </form>
        )}
      </Modal>

      <ExpertiseModal
        open={expertiseModalOpen}
        onClose={() => setExpertiseModalOpen(false)}
        onSelectTemplate={(isiText) => setKesan((prev) => clampClinicalInput(prev ? prev + '\n\n' + isiText : isiText))}
        templates={kesanTemplates}
        onTemplatesChanged={loadTemplates}
      />

      <Modal open={aiFotoOpen} title="✨ AI Foto — Analisa & Isi Kesan Otomatis" onClose={() => setAiFotoOpen(false)} size="md">
        <div className="form-grid">
          {aiFotoError && <div className="alert alert--error form-grid--full">{aiFotoError}</div>}

          <div className="form-field form-grid--full">
            <label htmlFor="rw-ai-foto">Foto</label>
            {!aiFotoDataUrl ? (
              <label htmlFor="rw-ai-foto" className="aifoto-upload" style={{ cursor: 'pointer' }}>
                <span className="aifoto-upload__icon">📤</span>
                <strong>Klik untuk unggah foto</strong>
                <p className="aifoto-upload__hint">JPEG, PNG, GIF, atau WEBP</p>
              </label>
            ) : (
              <div className="aifoto-preview">
                <img src={aiFotoDataUrl} alt="Preview foto" />
              </div>
            )}
            <input
              id="rw-ai-foto"
              type="file"
              accept="image/*"
              onChange={handleAiFotoFileChange}
              style={aiFotoDataUrl ? { marginTop: '0.5rem' } : { display: 'none' }}
            />
          </div>

          <div className="form-field form-grid--full">
            <button
              type="button"
              className="aifoto-analyze-btn"
              disabled={aiFotoAnalyzing || !aiFotoDataUrl}
              onClick={() => void handleAiFotoAnalyze()}
            >
              {aiFotoAnalyzing ? '⏳ Menganalisa foto...' : '✨ Start — Analisa Foto dengan AI'}
            </button>
          </div>

          {(aiFotoNamaPenyakit || aiFotoKesan) && (
            <>
              <div className="form-field form-grid--full">
                <label htmlFor="rw-ai-penyakit">Nama Penyakit</label>
                <input
                  id="rw-ai-penyakit"
                  value={aiFotoNamaPenyakit}
                  onChange={(e) => setAiFotoNamaPenyakit(e.target.value)}
                />
              </div>
              <div className="form-field form-grid--full">
                <label htmlFor="rw-ai-kesan">Kesan</label>
                <textarea
                  id="rw-ai-kesan"
                  rows={4}
                  value={aiFotoKesan}
                  onChange={(e) => setAiFotoKesan(e.target.value)}
                />
              </div>
              <div className="form-field form-grid--full">
                <button type="button" className="btn btn--primary" onClick={handleUseAiFotoKesan}>
                  Gunakan &amp; Masukkan ke Kesan
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={quickEditItem !== null}
        title="Edit Cepat: Nama & Kesan"
        onClose={() => setQuickEditItem(null)}
        size="xl"
      >
        <form onSubmit={(e) => void submitQuickEdit(e)} className="form-grid">
          {quickEditError && (
            <div className="alert alert--error form-grid--full">{quickEditError}</div>
          )}

          <div className="form-field form-grid--full">
            <KesanRegioPicker onSelect={(teks) => setQuickEditKesan(teks)} />
          </div>

          <div className="form-field form-grid--full">
            <label htmlFor="rw-qe-nama">Nama pasien</label>
            <input
              id="rw-qe-nama"
              required
              value={quickEditNama}
              onChange={(e) => setQuickEditNama(e.target.value)}
            />
          </div>
          <div className="form-field form-grid--full">
            <label htmlFor="rw-qe-kesan">Kesan</label>
            <textarea
              id="rw-qe-kesan"
              rows={4}
              value={quickEditKesan}
              onChange={(e) => setQuickEditKesan(clampClinicalInput(e.target.value))}
              placeholder="Isi kesan radiologi..."
            />
          </div>
          <ModalFormFooter
            onCancel={() => setQuickEditItem(null)}
            submitLabel="Simpan"
            loading={quickEditSaving}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Hapus Semua Data Pekerjaan Radiolog"
        message={`Yakin hapus SEMUA ${pagination.total} data pasien di antrean Pekerjaan Radiolog ini? Termasuk yang masih menunggu hasil. Data tetap tersimpan di arsip Duplikat Radiologi. Tindakan ini tidak bisa dibatalkan.`}
        loading={bulkDeleting}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void handleBulkDelete()}
      />

      <CetakALModal
        open={labelItem !== null}
        onClose={() => setLabelItem(null)}
        pasien={labelItem ? toCetakALPasien(labelItem) : null}
        initialMode="label"
      />
    </>
  );
}
