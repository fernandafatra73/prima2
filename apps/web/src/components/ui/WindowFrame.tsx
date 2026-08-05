import { useState, type ReactNode } from 'react';
import './ui.css';

interface WindowFrameProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose?: () => void;
}

/**
 * Membungkus konten halaman dalam tampilan "jendela" ala aplikasi desktop
 * Windows: title bar + tombol minimize/maximize/close.
 */
export function WindowFrame({ title, children, onClose }: WindowFrameProps) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  return (
    <div
      className={`win-frame${maximized ? ' win-frame--maximized' : ''}`}
      role="group"
      aria-label={`Jendela ${title}`}
    >
      <div className="win-frame__titlebar" onDoubleClick={() => setMaximized((v) => !v)}>
        <span className="win-frame__title">{title}</span>
        <div className="win-frame__controls">
          <button
            type="button"
            className="win-frame__btn win-frame__btn--min"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => setMinimized((v) => !v)}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0" y="8.5" width="10" height="1.2" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="win-frame__btn win-frame__btn--max"
            title={maximized ? 'Restore' : 'Maximize'}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => setMaximized((v) => !v)}
          >
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1.5" y="0" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.1" />
                <rect x="0" y="2.5" width="7" height="7" fill="var(--win-titlebar-bg, #e2e8f0)" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="win-frame__btn win-frame__btn--close"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            disabled={!onClose}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" />
              <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>
      </div>
      {!minimized && <div className="win-frame__body">{children}</div>}
    </div>
  );
}
