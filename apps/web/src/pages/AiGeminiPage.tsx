import '../components/ui/ui.css';

export function AiGeminiPage() {
  return (
    <div>
      <div className="page-heading">
        <h2 className="page-heading__title">AI Gemini</h2>
      </div>

      <section
        style={{
          background: 'linear-gradient(135deg, #4285f4, #9b72cb 55%, #d96570)',
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
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem' }}>Buka Google Gemini</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.92, maxWidth: '520px' }}>
            Sama seperti WhatsApp &amp; Telegram, Gemini tidak mengizinkan halamannya ditampilkan langsung
            di dalam aplikasi lain, jadi tombol ini membuka Google Gemini di tab baru menggunakan akun
            Google Anda.
          </p>
        </div>
        <a
          href="https://gemini.google.com/app"
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{
            background: '#ffffff',
            color: '#4285f4',
            fontWeight: 700,
            padding: '0.7rem 1.4rem',
            borderRadius: '8px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ✨ Masuk Gemini
        </a>
      </section>
    </div>
  );
}
