import { useEffect, useRef, useState } from 'react';

// Modul-level (bukan ref komponen) supaya kamera tetap menyala terus saat
// pindah halaman lain di aplikasi — FatraPage unmount tidak akan mematikan
// stream ini, sehingga saat kembali ke halaman Fatra video langsung tampil
// tanpa minta izin kamera ulang.
let sharedCameraStreamPromise: Promise<MediaStream> | null = null;

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

type RecordingState = 'idle' | 'recording' | 'paused';

/** Rekaman dipotong otomatis tiap 5 menit supaya file tidak menumpuk jadi satu video raksasa. */
const SEGMENT_DURATION_MS = 5 * 60 * 1000;

export function FatraPage() {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [savedCount, setSavedCount] = useState(0);
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStateRef = useRef<RecordingState>('idle');

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
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
        if (cancelled) return;
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error ? `Gagal mengakses kamera: ${err.message}` : 'Gagal mengakses kamera.',
          );
        }
      }
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

  return (
    <div>
      <h2 style={{ margin: '0 0 0.25rem' }}>📹 Fatra — CCTV Monitor</h2>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        Live view kamera dari komputer ini. Rekaman otomatis terpotong &amp; tersimpan (terunduh)
        tiap 5 menit selama merekam, dan segmen terakhir tersimpan saat Anda menekan Stop.
      </p>

      {cameraError && (
        <div
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontWeight: 600,
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
          }}
        >
          {recordingError}
        </div>
      )}

      <div
        style={{
          background: '#000',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '2px solid #1e293b',
          maxWidth: '960px',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
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

        <span
          style={{
            marginLeft: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color:
              recordingState === 'recording' ? '#dc2626' : recordingState === 'paused' ? '#d97706' : '#94a3b8',
          }}
        >
          {recordingState === 'recording' && '● Merekam'}
          {recordingState === 'paused' && '❙❙ Dijeda'}
          {recordingState === 'idle' && '○ Tidak merekam'}
        </span>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
        File tersimpan: {savedCount}
        {lastSavedName && ` (terakhir: ${lastSavedName})`}.
      </div>
    </div>
  );
}
