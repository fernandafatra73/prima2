import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiGet } from '../lib/api.ts';
import { playSong, songDurationMs, SONGS, type Song } from '../lib/musicPlayer.ts';

export interface PlaylistItem {
  readonly id: string;
  readonly judul: string;
  readonly lirik: string | null;
}

interface MusicPlayerContextValue {
  readonly isOn: boolean;
  readonly selectedSongId: string;
  readonly setSelectedSongId: (id: string) => void;
  readonly turnOn: () => void;
  readonly turnOff: () => void;
  readonly toggleMusic: () => void;

  readonly playlist: readonly PlaylistItem[];
  readonly playlistLoading: boolean;
  readonly reloadPlaylist: () => Promise<void>;
  readonly playingId: string | null;
  readonly playLoadingId: string | null;
  readonly playItem: (item: PlaylistItem) => void;
  readonly stopPlaylist: () => void;
  readonly toggleQuickPlay: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function MusicPlayerProvider({ children }: { readonly children: ReactNode }) {
  const [isOn, setIsOn] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(SONGS[0]!.id);
  const loopTimeoutRef = useRef<number | null>(null);

  const [playlist, setPlaylist] = useState<readonly PlaylistItem[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playLoadingId, setPlayLoadingId] = useState<string | null>(null);
  const playlistAudioRef = useRef<HTMLAudioElement | null>(null);

  const reloadPlaylist = useCallback(async () => {
    setPlaylistLoading(true);
    try {
      const res = await apiGet<{ items: readonly PlaylistItem[] }>('/api/playlist-lagu');
      setPlaylist(res.items);
    } catch {
      // biarkan playlist kosong; halaman Musik-PH menampilkan pesan errornya sendiri
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadPlaylist();
  }, [reloadPlaylist]);

  useEffect(() => {
    return () => {
      playlistAudioRef.current?.pause();
    };
  }, []);

  const stopPlaylist = useCallback(() => {
    playlistAudioRef.current?.pause();
    playlistAudioRef.current = null;
    setPlayingId(null);
  }, []);

  const playItem = useCallback((item: PlaylistItem) => {
    playlistAudioRef.current?.pause();
    playlistAudioRef.current = null;
    setPlayingId(null);
    setPlayLoadingId(item.id);
    const audio = new Audio(`/api/playlist-lagu/${item.id}/audio`);
    playlistAudioRef.current = audio;
    audio.onended = () => setPlayingId((cur) => (cur === item.id ? null : cur));
    void audio
      .play()
      .then(() => {
        setPlayLoadingId(null);
        setPlayingId(item.id);
      })
      .catch(() => {
        setPlayLoadingId(null);
      });
  }, []);

  const toggleQuickPlay = useCallback(() => {
    if (playingId) {
      stopPlaylist();
      return;
    }
    const next = playlist[0];
    if (next) {
      playItem(next);
    }
  }, [playingId, playlist, playItem, stopPlaylist]);

  const stopLoop = useCallback(() => {
    if (loopTimeoutRef.current !== null) {
      window.clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
  }, []);

  const scheduleNextLoop = useCallback((song: Song) => {
    loopTimeoutRef.current = window.setTimeout(() => {
      playSong(song);
      scheduleNextLoop(song);
    }, songDurationMs(song));
  }, []);

  const turnOn = useCallback(() => {
    setIsOn(true);
    const song = SONGS.find((s) => s.id === selectedSongId) ?? SONGS[0]!;
    playSong(song);
    scheduleNextLoop(song);
  }, [selectedSongId, scheduleNextLoop]);

  const turnOff = useCallback(() => {
    setIsOn(false);
    stopLoop();
  }, [stopLoop]);

  const toggleMusic = useCallback(() => {
    if (isOn) {
      turnOff();
    } else {
      turnOn();
    }
  }, [isOn, turnOn, turnOff]);

  const value = useMemo(
    () => ({
      isOn,
      selectedSongId,
      setSelectedSongId,
      turnOn,
      turnOff,
      toggleMusic,
      playlist,
      playlistLoading,
      reloadPlaylist,
      playingId,
      playLoadingId,
      playItem,
      stopPlaylist,
      toggleQuickPlay,
    }),
    [
      isOn,
      selectedSongId,
      turnOn,
      turnOff,
      toggleMusic,
      playlist,
      playlistLoading,
      reloadPlaylist,
      playingId,
      playLoadingId,
      playItem,
      stopPlaylist,
      toggleQuickPlay,
    ],
  );

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

export function useMusicPlayer(): MusicPlayerContextValue {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  }
  return ctx;
}
