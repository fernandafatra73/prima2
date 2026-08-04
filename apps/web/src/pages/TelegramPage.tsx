import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api.ts';
import '../components/ui/ui.css';

interface DaftarTelponItem {
  readonly id: string;
  readonly nama: string;
  readonly telpon: string | null;
  readonly namaInstansi: string | null;
}

function formatTelegramPhone(phone: string | null): string | null {
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

export function TelegramPage() {
  const [items, setItems] = useState<DaftarTelponItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGet<{ items: DaftarTelponItem[] }>('/api/daftar-telpon?limit=200')
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat daftar kontak'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return item.nama.toLowerCase().includes(q) || (item.namaInstansi ?? '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="page-heading">
        <h2 className="page-heading__title">Telegram</h2>
      </div>

      <section
        style={{
          background: 'linear-gradient(135deg, #2aabee, #229ed9)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          color: '#ffffff',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem' }}>Buka Telegram Web</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.92, maxWidth: '520px' }}>
            Sama seperti WhatsApp, Telegram tidak mengizinkan halamannya ditampilkan langsung di dalam
            aplikasi lain (dibatasi dari pihak Telegram sendiri), jadi tombol ini membuka Telegram Web
            di tab baru — cukup scan QR sekali dan sesi akan tetap tersimpan di browser ini.
          </p>
        </div>
        <a
          href="https://web.telegram.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{
            background: '#ffffff',
            color: '#229ed9',
            fontWeight: 700,
            padding: '0.7rem 1.4rem',
            borderRadius: '8px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ✈️ Buka Telegram Web
        </a>
      </section>

      <h3 style={{ margin: '0 0 0.75rem', color: '#0f172a' }}>Chat Cepat ke Kontak</h3>
      <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.85rem' }}>
        Diambil dari data Daftar Telpon. Klik untuk membuka chat Telegram dengan kontak tersebut —
        hanya berhasil jika nomor itu terdaftar di Telegram dan mengizinkan ditemukan lewat nomor telepon.
      </p>

      <div className="form-field" style={{ maxWidth: '320px', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Cari nama atau instansi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="alert alert--error">{error}</p>}
      {loading ? (
        <p className="loading-text">Memuat…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#64748b' }}>Belum ada kontak dengan nomor telepon di Daftar Telpon.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {filtered.map((item) => {
            const tgPhone = formatTelegramPhone(item.telpon);
            return (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e0e7ff',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.nama}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {item.telpon || 'Tidak ada nomor'}
                    {item.namaInstansi ? ` · ${item.namaInstansi}` : ''}
                  </div>
                </div>
                {tgPhone ? (
                  <a
                    href={`https://t.me/+${tgPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Chat Telegram dengan ${item.nama}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: '#e0f2fe',
                      color: '#229ed9',
                      border: '1px solid #7dd3fc',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✈️ Chat
                  </a>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
