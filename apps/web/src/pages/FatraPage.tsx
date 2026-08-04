import { useEffect, useRef, useState } from 'react';
import '../components/ui/ui.css';

// Modul-level (bukan ref komponen) supaya kamera tetap menyala terus saat
// pindah halaman lain di aplikasi — FatraPage unmount tidak akan mematikan
// stream ini, sehingga saat kembali ke halaman Fatra video langsung tampil
// tanpa minta izin kamera ulang.
let sharedCameraStreamPromise: Promise<MediaStream> | null = null;

/** ~10 x 10 cm di layar (96dpi: 1cm ≈ 37.8px). */
const MONITOR_SIZE_PX = 378;

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return '';
}

function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function formatOverlayTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type RecordingState = 'idle' | 'recording' | 'paused';

/** Rekaman dipotong otomatis tiap 5 menit supaya file tidak menumpuk jadi satu video raksasa. */
const SEGMENT_DURATION_MS = 5 * 60 * 1000;

export function FatraPage() {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [savedCount, setSavedCount] = useState(0);
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStateRef = useRef<RecordingState>('idle');

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Jam overlay di layar monitor, gaya timestamp CCTV — jalan terus selama halaman aktif.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * Ambil (atau, kalau forceNew, minta ulang) stream kamera dan pasang ke <video>.
   * Dipakai saat mount halaman maupun saat tombol Refresh ditekan.
   */
  async function connectCamera(forceNew: boolean): Promise<void> {
    if (forceNew) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      sharedCameraStreamPromise = null;
    }
    try {
      // Cache promise-nya di modul (bukan ref komponen) supaya kalau efek ini
      // dipanggil dua kali (React StrictMode di mode dev) atau komponen
      // di-mount ulang setelah pindah halaman, kamera tidak diminta ulang /
      // dibuka dua kali berbarengan. Semua invocation cukup menunggu promise
      // yang sama, dan streamnya tidak pernah dihentikan saat unmount.
      if (!sharedCameraStreamPromise) {
        sharedCameraStreamPromise = navigator.mediaDevices
          .getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
          .catch((err: unknown) => {
            sharedCameraStreamPromise = null;
            throw err;
          });
      }
      const stream = await sharedCameraStreamPromise;
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError(null);
      setCameraReady(true);
    } catch (err) {
      setCameraReady(false);
      setCameraError(
        err instanceof Error ? `Gagal mengakses kamera: ${err.message}` : 'Gagal mengakses kamera.',
      );
    }
  }

  function handleRefresh() {
    if (recordingState !== 'idle' || refreshing) return;
    setRefreshing(true);
    void connectCamera(true).finally(() => setRefreshing(false));
  }

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (cancelled) return;
      await connectCamera(false);
    }

    void setup();

    return () => {
      cancelled = true;
      stopSegmentTimer();
      recorderRef.current?.stop();
    };
  }, []);

  function finalizeSegment() {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: pickMimeType() || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const filename = `cctv-fatra-${timestampForFilename()}.webm`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSavedCount((n) => n + 1);
    setLastSavedName(filename);
  }

  function createRecorder(): MediaRecorder | null {
    const stream = streamRef.current;
    if (!stream) return null;
    // Rekam dari clone stream, bukan stream asli, supaya video live di <video>
    // tidak pernah kena imbas start/stop/rotasi recorder dan tetap terus berjalan.
    const recordingStream = stream.clone();
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      recordingStream.getTracks().forEach((track) => track.stop());
      finalizeSegment();
    };
    return recorder;
  }

  /** Tutup segmen berjalan (unduh) lalu langsung lanjut merekam segmen baru, tanpa mengubah status Merekam. */
  function rotateSegment() {
    if (recordingStateRef.current !== 'recording') return;
    recorderRef.current?.stop();
    const recorder = createRecorder();
    if (!recorder) return;
    recorderRef.current = recorder;
    recorder.start();
  }

  function stopSegmentTimer() {
    if (segmentTimerRef.current !== null) {
      clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }

  function handleStart() {
    if (recordingState !== 'idle') return;
    if (!cameraReady) {
      setRecordingError('Kamera belum siap. Tunggu video live tampil, lalu coba lagi.');
      return;
    }
    setRecordingError(null);
    let recorder: MediaRecorder | null;
    try {
      recorder = createRecorder();
    } catch (err) {
      setRecordingError(
        err instanceof Error ? `Gagal memulai rekaman: ${err.message}` : 'Gagal memulai rekaman.',
      );
      return;
    }
    if (!recorder) {
      setRecordingError('Gagal memulai rekaman: stream kamera tidak tersedia.');
      return;
    }
    recorderRef.current = recorder;
    recorder.start();
    setRecordingState('recording');
    stopSegmentTimer();
    segmentTimerRef.current = setInterval(rotateSegment, SEGMENT_DURATION_MS);
  }

  function handlePauseResume() {
    if (recordingState === 'recording') {
      recorderRef.current?.pause();
      setRecordingState('paused');
    } else if (recordingState === 'paused') {
      recorderRef.current?.resume();
      setRecordingState('recording');
    }
  }

  function handleStop() {
    if (recordingState === 'idle') return;
    stopSegmentTimer();
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecordingState('idle');
  }

  function handleSaveImage() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const filename = `cctv-fatra-foto-${timestampForFilename()}.png`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSavedCount((n) => n + 1);
      setLastSavedName(filename);
    }, 'image/png');
  }

  const statusLabel =
    recordingState === 'recording' ? 'REC' : recordingState === 'paused' ? 'PAUSED' : cameraReady ? 'LIVE' : 'MENGHUBUNGKAN…';
  const statusColor =
    recordingState === 'recording' ? '#ef4444' : recordingState === 'paused' ? '#f59e0b' : cameraReady ? '#22c55e' : '#94a3b8';

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', color: '#0f172a' }}>📹 Fatra — CCTV Monitor</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
          Live view kamera laptop ini pada monitor mini 10 × 10 cm. Rekaman otomatis terpotong &amp;
          tersimpan (terunduh) tiap 5 menit selama merekam, dan segmen terakhir tersimpan saat Anda
          menekan Stop.
        </p>
      </div>

      {cameraError && (
        <div
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontWeight: 600,
            maxWidth: `${MONITOR_SIZE_PX}px`,
          }}
        >
          {cameraError}
        </div>
      )}

      {recordingError && (
        <div
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontWeight: 600,
            maxWidth: `${MONITOR_SIZE_PX}px`,
          }}
        >
          {recordingError}
        </div>
      )}

      {/* Bezel monitor — bingkai ganda ala CCTV fisik, ukuran layar ~10x10cm */}
      <div
        style={{
          width: `${MONITOR_SIZE_PX}px`,
          maxWidth: '100%',
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          borderRadius: '18px',
          padding: '10px',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: '#000',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #334155',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />

          {!cameraReady && !cameraError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                color: '#94a3b8',
              }}
            >
              <span style={{ fontSize: '2rem' }}>📷</span>
              <span style={{ fontSize: '0.8rem' }}>Menghubungkan kamera…</span>
            </div>
          )}

          {/* Status badge */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(2px)',
              padding: '0.25rem 0.55rem',
              borderRadius: '999px',
            }}
          >
            <span
              className={recordingState === 'recording' ? 'fatra-rec-dot' : undefined}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                background: statusColor,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', color: '#f1f5f9' }}>
              {statusLabel}
            </span>
          </div>

          {/* Label kamera */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: '#e2e8f0',
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(2px)',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
            }}
          >
            CAM-01
          </div>

          {/* Timestamp overlay ala CCTV */}
          {cameraReady && (
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '10px',
                fontSize: '0.62rem',
                fontFamily: 'monospace',
                color: '#e2e8f0',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {formatOverlayTimestamp(now)}
            </div>
          )}
        </div>

        {/* Bar bawah bezel — dekorasi kecil ala monitor fisik */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 4px 2px',
          }}
        >
          <span style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.06em' }}>FATRA MONITOR · 10×10cm</span>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '999px',
              background: cameraReady ? '#22c55e' : '#475569',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          marginTop: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleStart}
          disabled={recordingState !== 'idle' || !cameraReady}
        >
          ⏺️ Start Rekaman
        </button>
        <button type="button" className="btn btn--secondary" onClick={handlePauseResume} disabled={recordingState === 'idle'}>
          {recordingState === 'paused' ? '▶️ Lanjutkan' : '⏸️ Pause'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={handleStop} disabled={recordingState === 'idle'}>
          ⏹️ Stop
        </button>
        <button type="button" className="btn btn--secondary" onClick={handleSaveImage} disabled={!cameraReady}>
          📷 Simpan Gambar
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleRefresh}
          disabled={recordingState !== 'idle' || refreshing}
          title={recordingState !== 'idle' ? 'Stop rekaman dulu sebelum refresh' : 'Sambungkan ulang kamera'}
          style={{ border: '1px solid var(--color-border)' }}
        >
          {refreshing ? '⏳ Menyambungkan…' : '🔄 Refresh'}
        </button>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
        File tersimpan: {savedCount}
        {lastSavedName && ` (terakhir: ${lastSavedName})`}.
      </div>
    </div>
  );
}
