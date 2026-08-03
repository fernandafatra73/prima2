import { getNavLabel, type AppViewId } from '../../config/navigation.ts';
import { useMusicPlayer } from '../../context/MusicPlayerContext.tsx';
import type { AuthUser } from '../../lib/auth.ts';
import { IconBell, IconLogout } from '../icons/NavIcons.tsx';
import './layout.css';

interface HeaderProps {
  readonly activeView: AppViewId;
  readonly authUser: AuthUser;
  readonly onLogout: () => void;
}

function getRoleLabel(role: AuthUser['role']): string {
  return role === 'ADMIN' ? 'Manajemen' : 'Pekerja';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Header({ activeView, authUser, onLogout }: HeaderProps) {
  const pageTitle = getNavLabel(activeView);
  const initials = getInitials(authUser.nama) || 'LP';
  const { playingId, playLoadingId, playlist, toggleQuickPlay } = useMusicPlayer();
  const isPlaying = playingId !== null;
  const isLoading = playLoadingId !== null;
  const playingSong = playlist.find((p) => p.id === playingId);
  const hasPlaylist = playlist.length > 0;

  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__brand">Klinik Prima Husada</span>
        <span className="app-header__brand" aria-hidden>
          /
        </span>
        <p className="app-header__breadcrumb">{pageTitle}</p>
      </div>

      <div className="app-header__actions">
        <button type="button" className="app-header__icon-btn" aria-label="Notifikasi">
          <IconBell />
        </button>

        <button
          type="button"
          className="app-header__icon-btn"
          aria-pressed={isPlaying}
          aria-label={isPlaying ? `Hentikan musik: ${playingSong?.judul ?? ''}` : 'Putar musik'}
          title={
            isLoading
              ? 'Memuat lagu…'
              : isPlaying
                ? `Hentikan musik: ${playingSong?.judul ?? ''}`
                : hasPlaylist
                  ? 'Putar musik dari Daftar Lagu'
                  : 'Belum ada lagu di Daftar Lagu (Musik-PH)'
          }
          onClick={toggleQuickPlay}
          disabled={isLoading || (!isPlaying && !hasPlaylist)}
          style={isPlaying ? { color: 'var(--color-primary)' } : undefined}
        >
          {isLoading ? '⏳' : isPlaying ? '⏸️' : '▶️'}
        </button>

        <div className="app-header__user">
          <div className="app-header__user-text">
            <p className="app-header__user-name">{authUser.nama}</p>
            <p className="app-header__user-role">{getRoleLabel(authUser.role)}</p>
          </div>
          <div className="app-header__avatar" aria-hidden>
            {initials}
          </div>
        </div>

        <button type="button" className="app-header__icon-btn" aria-label="Logout" onClick={onLogout}>
          <IconLogout />
        </button>
      </div>
    </header>
  );
}
