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
import { playAlarm, SONGS } from '../lib/musicPlayer.ts';
import '../components/ui/ui.css';

interface HitunganLedItem {
  readonly id: string;
  readonly namaPasien: string;
  readonly jenisKelamin: 'L' | 'P';
  readonly jamPertama: string;
  readonly jamKedua: string;
  readonly tanggal: string;
}

const REF_JAM_1 = { L: 10, P: 15 };
const REF_JAM_2 = { L: 15, P: 20 };

function isAbnormal(item: HitunganLedItem): boolean {
  const j1 = Number(item.jamPertama);
  const j2 = Number(item.jamKedua);
  return j1 > REF_JAM_1[item.jenisKelamin] || j2 > REF_JAM_2[item.jenisKelamin];
}

function formatDateDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const TIMER_PRESETS = [
  { label: '5 Menit', seconds: 5 * 60 },
  { label: '15 Menit', seconds: 15 * 60 },
  { label: '30 Menit', seconds: 30 * 60 },
  { label: '1 Jam', seconds: 60 * 60 },
];

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const emptyForm = {
  namaPasien: '',
  jenisKelamin: 'L' as 'L' | 'P',
  jamPertama: '',
  jamKedua: '',
  tanggal: new Date().toISOString().split('T')[0]!,
};

export function HitunganLedPage() {
  const { search, setSearch } = useListSearch();
  const queryParams = useListQueryParams({}, search);
  const { items, pagination, setPage, loading, error, setError, reload: reloadList } =
    usePaginatedList<HitunganLedItem>('/api/hitungan-led', queryParams);
  const reload = useMutationReload(reloadList);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<HitunganLedItem | null>(null);
  const [deleting, setDeleting] = useState<HitunganLedItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLabel, setTimerLabel] = useState<string | null>(null);
  const [timerFinished, setTimerFinished] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(SONGS[0]!.id);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!customAudioUrl) return;
    return () => URL.revokeObjectURL(customAudioUrl);
  }, [customAudioUrl]);

  useEffect(() => {
    if (!timerRunning) return;
    if (timerSeconds <= 0) {
      setTimerRunning(false);
      setTimerFinished(true);
      playAlarm(customAudioUrl, selectedSongId);
      return;
    }
    const id = setTimeout(() => setTimerSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timerRunning, timerSeconds, selectedSongId, customAudioUrl]);

  function startTimer(seconds: number, label: string) {
    setTimerLabel(label);
    setTimerSeconds(seconds);
    setTimerRunning(true);
    setTimerFinished(false);
  }

  function stopTimer() {
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerLabel(null);
    setTimerFinished(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomAudioUrl(URL.createObjectURL(file));
    setCustomFileName(file.name);
    e.target.value = '';
  }

  function clearCustomAudio() {
    setCustomAudioUrl(null);
    setCustomFileName(null);
  }

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(item: HitunganLedItem) {
    setForm({
      namaPasien: item.namaPasien,
      jenisKelamin: item.jenisKelamin,
      jamPertama: item.jamPertama,
      jamKedua: item.jamKedua,
      tanggal: item.tanggal.split('T')[0]!,
    });
    setError(null);
    setEditing(item);
  }

  function closeModal() {
    setCreateOpen(false);
    setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        namaPasien: form.namaPasien,
        jenisKelamin: form.jenisKelamin,
        jamPertama: Number(form.jamPertama),
        jamKedua: Number(form.jamKedua),
        tanggal: form.tanggal,
      };
      if (editing) {
        await apiPatch(`/api/hitungan-led/${editing.id}`, body);
      } else {
        await apiPost('/api/hitungan-led', body);
      }
      closeModal();
      await reload({ resetPage: !editing });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan hitungan LED');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/hitungan-led/${deleting.id}`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus hitungan LED');
    } finally {
      setSubmitting(false);
    }
  }

  const abnormalCount = items.filter(isAbnormal).length;

  return (
    <>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 700, color: '#0f172a' }}>⏱️ Timer Hitungan LED</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {TIMER_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => startTimer(preset.seconds, preset.label)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {(timerRunning || timerSeconds > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: timerRunning ? '#0369a1' : '#dc2626',
              }}
            >
              {formatTimer(timerSeconds)}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{timerLabel}</span>
            <button type="button" className="btn btn--sm btn--secondary" onClick={stopTimer}>
              Stop
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginLeft: 'auto',
            paddingLeft: '1rem',
            borderLeft: '1px solid #e2e8f0',
          }}
        >
          <span style={{ fontWeight: 700, color: '#0f172a' }}>🎵 Musik Alarm</span>
          <select
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            disabled={customAudioUrl !== null}
            style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {SONGS.map((song) => (
              <option key={song.id} value={song.id}>
                {song.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>atau</span>
          <label className="btn btn--sm btn--secondary" style={{ cursor: 'pointer', margin: 0 }}>
            📁 Pilih dari PC
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
          {customFileName && (
            <span
              style={{
                fontSize: '0.8rem',
                color: '#0369a1',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              🎧 {customFileName}
              <button
                type="button"
                onClick={clearCustomAudio}
                title="Hapus file, kembali ke musik bawaan"
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: 0,
                }}
              >
                ✕
              </button>
            </span>
          )}
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            onClick={() => playAlarm(customAudioUrl, selectedSongId)}
          >
            ▶️ Coba
          </button>
        </div>

        {timerFinished && (
          <div
            style={{
              width: '100%',
              marginTop: '0.25rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: '#fee2e2',
              color: '#dc2626',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            ⏰ Waktu hitungan LED ({timerLabel}) selesai!
          </div>
        )}
      </div>

      <ListPageShell
        title="Hitungan LED"
        subtitle="Laju Endap Darah — nilai rujukan Jam I: L ≤10 / P ≤15 mm, Jam II: L ≤15 / P ≤20 mm"
        metrics={[
          {
            label: 'Total data',
            value: String(pagination.total),
            tone: 'blue',
            iconKind: 'clipboard',
          },
          {
            label: 'Abnormal (halaman ini)',
            value: String(abnormalCount),
            tone: 'amber',
            iconKind: 'stethoscope',
          },
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
            + Tambah Hitungan LED
          </button>
        }
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Pasien</th>
              <th>JK</th>
              <th>Jam I (mm)</th>
              <th>Jam II (mm)</th>
              <th>Status</th>
              <th>Tanggal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem' }}>
                  Belum ada data hitungan LED.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const abnormal = isAbnormal(item);
                return (
                  <tr key={item.id}>
                    <td>{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.namaPasien}</td>
                    <td>{item.jenisKelamin}</td>
                    <td>{item.jamPertama}</td>
                    <td>{item.jamKedua}</td>
                    <td>
                      <span className={`badge ${abnormal ? 'badge--pending' : 'badge--ok'}`}>
                        {abnormal ? 'Abnormal' : 'Normal'}
                      </span>
                    </td>
                    <td>{formatDateDisplay(item.tanggal)}</td>
                    <td>
                      <TableRowActions
                        onEdit={() => openEdit(item)}
                        onDelete={() => setDeleting(item)}
                        editLabel="Ubah hitungan LED"
                        deleteLabel="Hapus hitungan LED"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ListPageShell>

      {(createOpen || editing) && (
        <Modal
          open={true}
          title={editing ? 'Ubah Hitungan LED' : 'Tambah Hitungan LED'}
          onClose={closeModal}
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
            <div className="form-field form-field--full">
              <label htmlFor="led-nama">Nama Pasien *</label>
              <input
                id="led-nama"
                required
                value={form.namaPasien}
                onChange={(e) => setForm((f) => ({ ...f, namaPasien: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="led-jk">Jenis Kelamin *</label>
              <select
                id="led-jk"
                value={form.jenisKelamin}
                onChange={(e) => setForm((f) => ({ ...f, jenisKelamin: e.target.value as 'L' | 'P' }))}
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="led-tanggal">Tanggal *</label>
              <input
                id="led-tanggal"
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="led-jam1">Jam I (mm) *</label>
              <input
                id="led-jam1"
                type="number"
                min="0"
                step="1"
                required
                value={form.jamPertama}
                onChange={(e) => setForm((f) => ({ ...f, jamPertama: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="led-jam2">Jam II (mm) *</label>
              <input
                id="led-jam2"
                type="number"
                min="0"
                step="1"
                required
                value={form.jamKedua}
                onChange={(e) => setForm((f) => ({ ...f, jamKedua: e.target.value }))}
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
        title="Hapus Hitungan LED"
        message={`Yakin hapus data LED "${deleting?.namaPasien ?? ''}"?`}
        loading={submitting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
