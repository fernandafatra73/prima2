import { useEffect, useRef, useState } from 'react';
import { playSong, songDurationMs, SONGS, type Song } from '../lib/musicPlayer.ts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { ModalFormFooter } from '../components/ui/ModalFormFooter.tsx';
import '../components/ui/ui.css';

interface PlaylistItem {
  readonly id: string;
  readonly judul: string;
  readonly audioData: string;
  readonly lirik: string | null;
}

export function MusikPage() {
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(SONGS[0]!.id);
  const [isOn, setIsOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopTimeoutRef = useRef<number | null>(null);

  const [playlist, setPlaylist] = useState<readonly PlaylistItem[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(true);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [uploadingLagu, setUploadingLagu] = useState(false);
  const [deletingLaguId, setDeletingLaguId] = useState<string | null>(null);
  const [playingLaguId, setPlayingLaguId] = useState<string | null>(null);
  const playlistAudioRef = useRef<HTMLAudioElement | null>(null);
  const [lirikEditing, setLirikEditing] = useState<PlaylistItem | null>(null);
  const [lirikDraft, setLirikDraft] = useState('');
  const [savingLirik, setSavingLirik] = useState(false);

  const [addLaguOpen, setAddLaguOpen] = useState(false);
  const [addLaguFile, setAddLaguFile] = useState<File | null>(null);
  const [addLaguJudul, setAddLaguJudul] = useState('');
  const [addLaguLirik, setAddLaguLirik] = useState('');

  async function loadPlaylist() {
    setPlaylistLoading(true);
    setPlaylistError(null);
    try {
      const res = await apiGet<{ items: readonly PlaylistItem[] }>('/api/playlist-lagu');
      setPlaylist(res.items);
    } catch (err: unknown) {
      setPlaylistError(err instanceof Error ? err.message : 'Gagal memuat daftar lagu');
    } finally {
      setPlaylistLoading(false);
    }
  }

  useEffect(() => {
    void loadPlaylist();
  }, []);

  function openAddLagu() {
    setAddLaguFile(null);
    setAddLaguJudul('');
    setAddLaguLirik('');
    setPlaylistError(null);
    setAddLaguOpen(true);
  }

  function handleAddLaguFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddLaguFile(file);
    if (!addLaguJudul.trim()) {
      setAddLaguJudul(file.name.replace(/\.[^/.]+$/, ''));
    }
  }

  function submitAddLagu(e: React.FormEvent) {
    e.preventDefault();
    if (!addLaguFile || !addLaguJudul.trim()) return;
    setPlaylistError(null);
    setUploadingLagu(true);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          if (typeof reader.result !== 'string') throw new Error('Gagal membaca file audio');
          await apiPost('/api/playlist-lagu', {
            judul: addLaguJudul.trim(),
            audioData: reader.result,
            lirik: addLaguLirik.trim() || undefined,
          });
          setAddLaguOpen(false);
          await loadPlaylist();
        } catch (err: unknown) {
          setPlaylistError(err instanceof Error ? err.message : 'Gagal menambah lagu');
        } finally {
          setUploadingLagu(false);
        }
      })();
    };
    reader.onerror = () => {
      setPlaylistError('Gagal membaca file audio');
      setUploadingLagu(false);
    };
    reader.readAsDataURL(addLaguFile);
  }

  function playPlaylistItem(item: PlaylistItem) {
    turnOff();
    playlistAudioRef.current?.pause();
    const audio = new Audio(item.audioData);
    playlistAudioRef.current = audio;
    setPlayingLaguId(item.id);
    audio.onended = () => setPlayingLaguId((cur) => (cur === item.id ? null : cur));
    void audio.play();
  }

  function stopPlaylistItem() {
    playlistAudioRef.current?.pause();
    playlistAudioRef.current = null;
    setPlayingLaguId(null);
  }

  function openLirikEdit(item: PlaylistItem) {
    setLirikEditing(item);
    setLirikDraft(item.lirik ?? '');
  }

  async function saveLirik() {
    if (!lirikEditing) return;
    setSavingLirik(true);
    setPlaylistError(null);
    try {
      await apiPatch(`/api/playlist-lagu/${lirikEditing.id}`, { lirik: lirikDraft });
      setLirikEditing(null);
      await loadPlaylist();
    } catch (err: unknown) {
      setPlaylistError(err instanceof Error ? err.message : 'Gagal menyimpan lirik');
    } finally {
      setSavingLirik(false);
    }
  }

  async function deletePlaylistItem(id: string) {
    setDeletingLaguId(id);
    setPlaylistError(null);
    try {
      if (playingLaguId === id) stopPlaylistItem();
      await apiDelete(`/api/playlist-lagu/${id}`);
      await loadPlaylist();
    } catch (err: unknown) {
      setPlaylistError(err instanceof Error ? err.message : 'Gagal menghapus lagu');
    } finally {
      setDeletingLaguId(null);
    }
  }

  useEffect(() => {
    if (!customAudioUrl) return;
    return () => URL.revokeObjectURL(customAudioUrl);
  }, [customAudioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loop;
    }
  }, [loop, customAudioUrl]);

  useEffect(() => {
    return () => {
      if (loopTimeoutRef.current !== null) {
        window.clearTimeout(loopTimeoutRef.current);
      }
      audioRef.current?.pause();
      playlistAudioRef.current?.pause();
    };
  }, []);

  function stopLoop() {
    if (loopTimeoutRef.current !== null) {
      window.clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
  }

  function scheduleNextLoop(song: Song) {
    loopTimeoutRef.current = window.setTimeout(() => {
      playSong(song);
      scheduleNextLoop(song);
    }, songDurationMs(song));
  }

  function turnOn() {
    setIsOn(true);
    if (customAudioUrl && audioRef.current) {
      audioRef.current.loop = true;
      void audioRef.current.play();
      return;
    }
    const song = SONGS.find((s) => s.id === selectedSongId) ?? SONGS[0]!;
    playSong(song);
    scheduleNextLoop(song);
  }

  function turnOff() {
    setIsOn(false);
    stopLoop();
    audioRef.current?.pause();
  }

  function toggleMusic() {
    if (isOn) {
      turnOff();
    } else {
      turnOn();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    turnOff();
    setCustomAudioUrl(URL.createObjectURL(file));
    setCustomFileName(file.name);
    e.target.value = '';
  }

  function clearCustomAudio() {
    turnOff();
    setCustomAudioUrl(null);
    setCustomFileName(null);
  }

  const playingSong = playlist.find((p) => p.id === playingLaguId) ?? null;

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0 0 0.25rem' }}>🎵 Musik-PH</h2>
        {playingSong?.lirik && (
          <div className="musik-lirik-marquee" aria-hidden="true">
            <span className="musik-lirik-marquee__text">{playingSong.lirik}</span>
          </div>
        )}
      </div>
      <p style={{ margin: '0 0 1.5rem', color: '#64748b' }}>
        Putar musik pilihan Anda sendiri dari komputer, atau gunakan nada bawaan.
      </p>

      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <div
        style={{
          background: isOn ? '#f0f9ff' : '#fff',
          border: `2px solid ${isOn ? '#0369a1' : '#e2e8f0'}`,
          borderRadius: '14px',
          padding: '2rem',
          display: 'flex',
          flex: '1 1 280px',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <button
          type="button"
          onClick={toggleMusic}
          className={isOn ? 'musik-ph-toggle--on' : undefined}
          aria-pressed={isOn}
          title={isOn ? 'Matikan musik' : 'Nyalakan musik'}
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            background: isOn ? '#0369a1' : '#cbd5e1',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
          }}
        >
          {isOn ? '🔊' : '🔈'}
        </button>

        <div style={{ marginTop: '1rem', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
          Klinik Prima Husada
        </div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', fontWeight: 600, color: isOn ? '#0369a1' : '#94a3b8' }}>
          {isOn ? '● Musik Menyala' : '○ Musik Mati'}
        </div>

        {!customAudioUrl && (
          <select
            value={selectedSongId}
            onChange={(e) => {
              const wasOn = isOn;
              if (wasOn) turnOff();
              setSelectedSongId(e.target.value);
            }}
            style={{
              marginTop: '1rem',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
            }}
          >
            {SONGS.map((song) => (
              <option key={song.id} value={song.id}>
                {song.label}
              </option>
            ))}
          </select>
        )}
        {customAudioUrl && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#0369a1' }}>
            🎧 Sumber: {customFileName}
          </div>
        )}
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.25rem',
          flex: '1 1 280px',
        }}
      >
        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
          Musik dari PC
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label className="btn btn--sm btn--secondary" style={{ cursor: 'pointer', margin: 0 }}>
            📁 Pilih Musik dari PC
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
                fontSize: '0.85rem',
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
                title="Hapus file"
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#334155' }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Ulangi
          </label>
        </div>

        {customAudioUrl && (
          <audio
            ref={audioRef}
            src={customAudioUrl}
            controls
            loop={loop}
            style={{ width: '100%', marginTop: '1rem' }}
          />
        )}
      </div>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 700, color: '#0f172a' }}>Daftar Lagu</div>
          <button type="button" className="btn btn--sm btn--primary" onClick={openAddLagu}>
            + Tambah Lagu
          </button>
        </div>

        {playlistError && (
          <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{playlistError}</p>
        )}

        {playlistLoading ? (
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Memuat daftar lagu…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>No</th>
                <th>Judul Lagu</th>
                <th style={{ width: '160px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {playlist.length === 0 ? (
                <tr>
                  <td colSpan={3}>Belum ada lagu. Klik "+ Tambah Lagu" untuk menambahkan dari komputer.</td>
                </tr>
              ) : (
                playlist.map((item, idx) => {
                  const isPlaying = playingLaguId === item.id;
                  return (
                    <tr key={item.id} style={isPlaying ? { background: '#f0f9ff' } : undefined}>
                      <td>{idx + 1}</td>
                      <td>🎵 {item.judul}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn--sm btn--secondary"
                            onClick={() => (isPlaying ? stopPlaylistItem() : playPlaylistItem(item))}
                          >
                            {isPlaying ? '⏸️ Stop' : '▶️ Putar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--secondary"
                            onClick={() => openLirikEdit(item)}
                          >
                            📝 Lirik
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--danger"
                            onClick={() => void deletePlaylistItem(item.id)}
                            disabled={deletingLaguId === item.id}
                          >
                            🗑️ {deletingLaguId === item.id ? 'Menghapus…' : 'Hapus'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={addLaguOpen} title="Tambah Lagu" onClose={() => setAddLaguOpen(false)}>
        <form onSubmit={submitAddLagu} className="form-grid">
          <div className="form-field form-grid--full">
            <label htmlFor="add-lagu-file">File Audio *</label>
            <input id="add-lagu-file" type="file" accept="audio/*" required onChange={handleAddLaguFileChange} />
          </div>
          <div className="form-field form-grid--full">
            <label htmlFor="add-lagu-judul">Judul Lagu *</label>
            <input
              id="add-lagu-judul"
              type="text"
              required
              value={addLaguJudul}
              onChange={(e) => setAddLaguJudul(e.target.value)}
              placeholder="Judul lagu…"
            />
          </div>
          <div className="form-field form-grid--full">
            <label htmlFor="add-lagu-lirik">Lirik (Opsional)</label>
            <textarea
              id="add-lagu-lirik"
              rows={6}
              value={addLaguLirik}
              onChange={(e) => setAddLaguLirik(e.target.value)}
              placeholder="Tempel/ketik lirik lagu di sini…"
            />
          </div>
          <ModalFormFooter
            onCancel={() => setAddLaguOpen(false)}
            submitLabel={uploadingLagu ? 'Mengunggah…' : 'Simpan'}
            loading={uploadingLagu}
          />
        </form>
      </Modal>

      <Modal
        open={lirikEditing !== null}
        title={`Lirik — ${lirikEditing?.judul ?? ''}`}
        onClose={() => setLirikEditing(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveLirik();
          }}
          className="form-grid"
        >
          <div className="form-field form-grid--full">
            <label htmlFor="lirik-text">
              Teks lirik (ditampilkan sebagai running text biru saat lagu ini diputar)
            </label>
            <textarea
              id="lirik-text"
              rows={8}
              value={lirikDraft}
              onChange={(e) => setLirikDraft(e.target.value)}
              placeholder="Tempel/ketik lirik lagu di sini…"
            />
          </div>
          <ModalFormFooter
            onCancel={() => setLirikEditing(null)}
            submitLabel="Simpan"
            loading={savingLirik}
          />
        </form>
      </Modal>
    </div>
  );
}
