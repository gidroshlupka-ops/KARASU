import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { usePlayer } from './Playlist'

const INK = 0xff221e1c
const PAPER = 0xffffffff

type Pack = {
  w: number
  h: number
  fps: number
  count: number
  stride: number
  bits: Uint8Array
}

function decode(buf: ArrayBuffer): Pack {
  const src = new Uint8Array(buf)
  const view = new DataView(buf)
  if (src[0] !== 0x42 || src[1] !== 0x41 || src[2] !== 1) throw new Error('frames')
  const w = view.getUint16(3, true)
  const h = view.getUint16(5, true)
  const fps = view.getUint16(7, true)
  const count = view.getUint32(9, true)
  const stride = view.getUint32(13, true)
  const bits = new Uint8Array(count * stride)
  const prev = new Uint8Array(stride)
  let o = 17
  for (let f = 0; f < count; f++) {
    const len = view.getUint16(o, true)
    o += 2
    const frame = bits.subarray(f * stride, (f + 1) * stride)
    const end = o + len
    let i = 0
    while (o < end) {
      const n = src[o++]
      const v = src[o++]
      frame.fill(v, i, i + n)
      i += n
    }
    for (let b = 0; b < stride; b++) {
      prev[b] ^= frame[b]
      frame[b] = prev[b]
    }
  }
  return { w, h, fps, count, stride, bits }
}

export function BadApple() {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const player = usePlayer()
  const musicRef = useRef(player.playing)
  const [volume, setVolume] = useState(0.1)
  const volumeRef = useRef(volume)
  const syncRef = useRef<() => void>(() => {})
  const kickRef = useRef<() => void>(() => {})
  musicRef.current = player.playing
  volumeRef.current = volume

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    const audio = audioRef.current
    if (!box || !canvas || !audio) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let dead = false
    let visible = false
    let raf = 0
    let last = -1
    let pack: Pack | null = null
    let loading: Promise<void> | null = null
    let img: ImageData | null = null
    let pixels: Uint32Array | null = null
    const abort = new AbortController()

    const shown = (entry: IntersectionObserverEntry) => {
      if (!entry.isIntersecting) return false
      if (entry.intersectionRatio >= 0.45) return true
      return entry.intersectionRect.height >= window.innerHeight * 0.6
    }

    const ensure = () => {
      if (pack) return Promise.resolve()
      if (loading) return loading
      audio.preload = 'auto'
      loading = fetch('/reel/frames.bin', { signal: abort.signal })
        .then((res) => {
          if (!res.ok) throw new Error('frames')
          return res.arrayBuffer()
        })
        .then((buf) => {
          const next = decode(buf)
          pack = next
          canvas.width = next.w
          canvas.height = next.h
          img = ctx.createImageData(next.w, next.h)
          pixels = new Uint32Array(img.data.buffer)
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          loading = null
        })
      return loading
    }

    const draw = (index: number) => {
      if (!pack || !img || !pixels) return
      const src = pack.bits.subarray(index * pack.stride, (index + 1) * pack.stride)
      const n = pack.w * pack.h
      let p = 0
      for (let b = 0; b < src.length; b++) {
        let bits = src[b]
        const left = Math.min(8, n - p)
        for (let k = 0; k < left; k++, p++) {
          pixels[p] = bits & 0x80 ? INK : PAPER
          bits <<= 1
        }
      }
      ctx.putImageData(img, 0, 0)
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!pack || audio.paused) return
      let index = Math.floor(audio.currentTime * pack.fps)
      if (index < 0) index = 0
      if (index >= pack.count) index = pack.count - 1
      if (index === last) return
      draw(index)
      last = index
    }

    const halt = () => {
      audio.pause()
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    const arm = () => {
      if (dead || !visible || musicRef.current) return
      audio.volume = volumeRef.current
      void ensure()
      if (audio.ended) {
        audio.currentTime = 0
        last = -1
      }
      if (!raf) raf = requestAnimationFrame(tick)
      void audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
      })
    }

    const sync = () => {
      if (visible && !musicRef.current) arm()
      else halt()
    }
    syncRef.current = sync
    kickRef.current = () => {
      arm()
    }

    const playObserver = new IntersectionObserver(
      ([entry]) => {
        visible = shown(entry)
        sync()
      },
      { threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9] },
    )
    const warmObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void ensure()
      },
      { rootMargin: '700px 0px', threshold: 0 },
    )
    playObserver.observe(box)
    warmObserver.observe(box)

    return () => {
      dead = true
      syncRef.current = () => {}
      kickRef.current = () => {}
      playObserver.disconnect()
      warmObserver.disconnect()
      abort.abort()
      audio.pause()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    syncRef.current()
  }, [player.playing])

  function onVolume(event: ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value)
    setVolume(next)
    if (audioRef.current) audioRef.current.volume = next
  }

  return (
    <div className="reel-slot">
      <div className="reel" ref={boxRef}>
        <canvas ref={canvasRef} width={120} height={90} aria-label="чёрный силуэт в такт дорожке" />
        <audio ref={audioRef} src="/audio/reel.m4a" preload="none" />
      </div>
      <label className="reel-vol">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label="громкость силуэта"
          onChange={onVolume}
        />
      </label>
    </div>
  )
}
