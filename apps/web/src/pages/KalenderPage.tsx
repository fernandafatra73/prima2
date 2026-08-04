import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import { TableRowActions } from '../components/ui/TableRowActions.tsx';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import '../components/ui/ui.css';

interface HariLiburItem {
  readonly id: string;
  readonly tanggal: string;
  readonly keterangan: string;
}

const BULAN_NAMA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const HARI_NAMA = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Hari libur nasional bertanggal tetap (tidak berubah tiap tahun) — sisanya (Idul Fitri, Idul Adha, cuti bersama, dll.) diinput manual di bawah sesuai kalender resmi tahun berjalan. */
function fixedHolidayLabel(month: number, day: number): string | null {
  if (month === 1 && day === 1) return 'Tahun Baru';
  if (month === 5 && day === 1) return 'Hari Buruh';
  if (month === 6 && day === 1) return 'Hari Lahir Pancasila';
  if (month === 8 && day === 17) return 'HUT Kemerdekaan RI';
  if (month === 12 && day === 25) return 'Hari Natal';
  return null;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayDateStr(): string {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const emptyForm = { tanggal: todayDateStr(), keterangan: '' };

function MonthGrid({
  year,
  month,
  holidayByDate,
}: {
  readonly year: number;
  readonly month: number;
  readonly holidayByDate: Map<string, string>;
}) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay();
  const todayKey = todayDateStr();

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '0.75rem' }}>
      <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: '0.5rem', textAlign: 'center' }}>
        {BULAN_NAMA[month - 1]}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '2px' }}>
        {HARI_NAMA.map((h) => (
          <div key={h} style={{ textAlign: 'center' }}>{h}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const key = dateKey(year, month, day);
          const weekday = (startWeekday + day - 1) % 7;
          const isSunday = weekday === 0;
          const fixedLabel = fixedHolidayLabel(month, day);
          const customLabel = holidayByDate.get(key);
          const holidayLabel = customLabel ?? fixedLabel;
          const isHoliday = isSunday || holidayLabel !== null;
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              title={holidayLabel ?? undefined}
              style={{
                textAlign: 'center',
                padding: '0.2rem 0',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontWeight: isHoliday ? 700 : 500,
                color: isHoliday ? '#dc2626' : '#0f172a',
                background: isToday ? '#dbeafe' : 'transparent',
                border: isToday ? '1px solid #60a5fa' : '1px solid transparent',
                cursor: holidayLabel ? 'help' : 'default',
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KalenderPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<HariLiburItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<HariLiburItem | null>(null);
  const [deleting, setDeleting] = useState<HariLiburItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: HariLiburItem[] }>(`/api/hari-libur?year=${year}`);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat hari libur');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const holidayByDate = new Map(items.map((h) => [h.tanggal, h.keterangan]));

  function openCreate() {
    setForm({ tanggal: dateKey(year, 1, 1), keterangan: '' });
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(item: HariLiburItem) {
    setForm({ tanggal: item.tanggal, keterangan: item.keterangan });
    setError(null);
    setEditing(item);
  }

  function closeModal() {
    setCreateOpen(false);
    setEditing(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = { tanggal: form.tanggal, keterangan: form.keterangan };
      if (editing) {
        await apiPatch(`/api/hari-libur/${editing.id}`, body);
      } else {
        await apiPost('/api/hari-libur', body);
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan hari libur');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/hari-libur/${deleting.id}`);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus hari libur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <h2 className="page-heading__title">Kalender {year}</h2>
      </div>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        Kalender Januari–Desember. Hari Minggu dan 5 hari libur nasional bertanggal tetap ditandai
        otomatis; hari libur lain (Idul Fitri, Idul Adha, cuti bersama, dll.) input manual di bawah.
      </p>

      {error && <p className="alert alert--error">{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => setYear((y) => y - 1)}>
          ← {year - 1}
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setYear(currentYear)} style={{ border: '1px solid var(--color-border)' }}>
          Tahun Ini
        </button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => setYear((y) => y + 1)}>
          {year + 1} →
        </button>
        <button type="button" className="btn btn--primary" onClick={openCreate} style={{ marginLeft: 'auto' }}>
          + Tambah Hari Libur
        </button>
      </div>

      {loading ? (
        <p className="loading-text">Memuat…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {BULAN_NAMA.map((_, idx) => (
            <MonthGrid key={idx} year={year} month={idx + 1} holidayByDate={holidayByDate} />
          ))}
        </div>
      )}

      <h3 style={{ margin: '0 0 0.75rem', color: '#0f172a' }}>Daftar Hari Libur Tambahan {year}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Keterangan</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem' }}>
                Belum ada hari libur tambahan untuk tahun {year}.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>
                  {new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </td>
                <td>{item.keterangan}</td>
                <td>
                  <TableRowActions
                    onEdit={() => openEdit(item)}
                    onDelete={() => setDeleting(item)}
                    editLabel="Ubah hari libur"
                    deleteLabel="Hapus hari libur"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {(createOpen || editing) && (
        <Modal open={true} title={editing ? 'Ubah Hari Libur' : 'Tambah Hari Libur'} onClose={closeModal}>
          <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
            <div className="form-field">
              <label htmlFor="hl-tanggal">Tanggal *</label>
              <input
                id="hl-tanggal"
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="hl-keterangan">Keterangan *</label>
              <input
                id="hl-keterangan"
                required
                placeholder="mis. Idul Fitri 1447 H"
                value={form.keterangan}
                onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
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
        title="Hapus Hari Libur"
        message={`Yakin hapus hari libur "${deleting?.keterangan ?? ''}"?`}
        loading={submitting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}
