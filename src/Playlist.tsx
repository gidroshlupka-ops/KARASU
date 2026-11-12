import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const tracks = [
  { id: 'night', title: 'synthwave', src: '/audio/night.mp3' },
  { id: 'dream', title: 'dream', src: '/audio/dream.mp3' },
  { id: 'quiet', title: 'contemplation', src: '/audio/quiet.mp3' },
]

type PlayerApi = {
  trackId: string | null
  playing: boolean
  open: boolean
  volume: number
  pick: (id: string) => void
  toggle: () => void
  prev: () => void
  next: () => void
  setVolume: (volume: number) => void
  close: () => void
  silence: () => void
}

const PlayerCtx = createContext<PlayerApi | null>(null)

export function usePlayer() {
  const ctx = useContext(PlayerCtx)
  if (!ctx) throw new Error('player')
  return ctx
}

export function PlayerRoot({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const volumeRef = useRef(0.8)
  const trackRef = useRef<string | null>(null)
  const [trackId, setTrackId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [open, setOpen] = useState(false)
  const [volume, setVolumeState] = useState(0.8)

  function go(id: string) {
    const audio = audioRef.current
    const track = tracks.find((item) => item.id === id) ?? tracks[0]
    if (!audio) return
    if (audio.dataset.track !== track.id) {
      audio.src = track.src
      audio.dataset.track = track.id
    }
    audio.volume = volumeRef.current
    trackRef.current = track.id
    setTrackId(track.id)
    setOpen(true)
    setPlaying(true)
    window.dispatchEvent(new Event('karasu-dock'))
    void audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setPlaying(false)
    })
  }

  function step(dir: -1 | 1) {
    const current = tracks.findIndex((item) => item.id === trackRef.current)
    const index = current < 0 ? 0 : (current + dir + tracks.length) % tracks.length
    go(tracks[index].id)
  }

  const api: PlayerApi = {
    trackId,
    playing,
    open,
    volume,
    pick: (id) => {
      if (open && trackRef.current === id) {
        const audio = audioRef.current
        if (!audio) return
        if (audio.ended) audio.currentTime = 0
        if (audio.paused) {
          setPlaying(true)
          window.dispatchEvent(new Event('karasu-dock'))
          void audio.play().catch(() => setPlaying(false))
        } else {
          audio.pause()
          setPlaying(false)
        }
        return
      }
      go(id)
    },
    toggle: () => {
      const audio = audioRef.current
      if (!audio || !trackRef.current) return
      if (audio.paused) {
        setPlaying(true)
        window.dispatchEvent(new Event('karasu-dock'))
        void audio.play().catch(() => setPlaying(false))
      } else {
        audio.pause()
        setPlaying(false)
      }
    },
    prev: () => step(-1),
    next: () => step(1),
    setVolume: (value) => {
      const nextVolume = Math.min(1, Math.max(0, value))
      volumeRef.current = nextVolume
      setVolumeState(nextVolume)
      if (audioRef.current) audioRef.current.volume = nextVolume
    },
    close: () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
      setPlaying(false)
      setOpen(false)
    },
    silence: () => {
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      setPlaying(false)
    },
  }

  useEffect(() => {
    document.body.classList.toggle('player-on', open)
    return () => document.body.classList.remove('player-on')
  }, [open])

  const current = tracks.find((item) => item.id === trackId)

  return (
    <PlayerCtx.Provider value={api}>
      {children}
      <audio ref={audioRef} preload="none" onEnded={() => step(1)} />
      {open && current && (
        <div className="dock" role="region" aria-label="плеер">
          <span className="who">{current.title}</span>
          <button type="button" onClick={() => step(-1)}>назад</button>
          <button type="button" onClick={api.toggle}>{playing ? 'стоп' : 'играть'}</button>
          <button type="button" onClick={() => step(1)}>дальше</button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label="громкость"
            onChange={(event) => api.setVolume(Number(event.target.value))}
          />
          <button type="button" className="x" aria-label="убрать плеер и выключить" onClick={api.close}>×</button>
        </div>
      )}
    </PlayerCtx.Provider>
  )
}

export function Playlist() {
  const player = usePlayer()
  return (
    <div className="pl">
      <ol>
        {tracks.map((track, index) => (
          <li key={track.id} className={player.open && player.trackId === track.id ? 'on' : ''}>
            <button type="button" onClick={() => player.pick(track.id)}>
              {index + 1}. {track.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
