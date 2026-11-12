import { useEffect, useRef } from 'react'

type Line = {
  text: string
  x: string
  y: string
  pink?: boolean
  side?: boolean
  low?: boolean
}

function paintCut(img: HTMLImageElement, canvas: HTMLCanvasElement) {
  const maxW = 760
  const scale = Math.min(1, maxW / img.naturalWidth)
  const w = Math.max(2, Math.round(img.naturalWidth * scale))
  const h = Math.max(2, Math.round(img.naturalHeight * scale))
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = w
  srcCanvas.height = h
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
  if (!srcCtx) return
  srcCtx.drawImage(img, 0, 0, w, h)
  const snap = srcCtx.getImageData(0, 0, w, h)
  const px = snap.data
  const dark = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < px.length; i += 4, p += 1) {
    if (px[i] < 16 && px[i + 1] < 16 && px[i + 2] < 16) dark[p] = 1
  }
  const bg = new Uint8Array(w * h)
  const queue: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const idx = y * w + x
    if (bg[idx] || !dark[idx]) return
    bg[idx] = 1
    queue.push(idx)
  }
  for (let x = 0; x < w; x += 1) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y)
    push(w - 1, y)
  }
  while (queue.length) {
    const idx = queue.pop() as number
    const x = idx % w
    const y = (idx / w) | 0
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }

  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x
      if (seen[start] || bg[start] || !dark[start]) continue
      stack.push(start)
      seen[start] = 1
      const comp: number[] = []
      while (stack.length) {
        const idx = stack.pop() as number
        comp.push(idx)
        const cx = idx % w
        const cy = (idx / w) | 0
        const take = (nx: number, ny: number) => {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) return
          const n = ny * w + nx
          if (seen[n] || bg[n] || !dark[n]) return
          seen[n] = 1
          stack.push(n)
        }
        take(cx - 1, cy)
        take(cx + 1, cy)
        take(cx, cy - 1)
        take(cx, cy + 1)
      }
      if (comp.length < w * h * 0.08) {
        for (const idx of comp) bg[idx] = 1
      }
    }
  }

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x
      const o = idx * 4
      if (bg[idx]) {
        px[o + 3] = 0
        continue
      }
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX <= minX || maxY <= minY) return

  const pad = 8
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(w - 1, maxX + pad)
  maxY = Math.min(h - 1, maxY + pad)
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const cut = srcCtx.createImageData(cw, ch)
  for (let y = 0; y < ch; y += 1) {
    cut.data.set(px.subarray((minY + y) * w * 4 + minX * 4, (minY + y) * w * 4 + (minX + cw) * 4), y * cw * 4)
  }

  const outW = cw
  const outH = Math.round(ch * 1.06)
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const drawn = ctx.createImageData(outW, outH)
  const od = drawn.data
  const s = cut.data
  for (let y = 0; y < outH; y += 1) {
    const v = y / (outH - 1)
    const sv = Math.pow(v, 1.14)
    const sy = Math.min(ch - 1, (sv * (ch - 1)) | 0)
    const bulge = Math.sin(v * Math.PI) * 0.055
    const wobble = Math.sin(v * 11.5) * 0.01
    for (let x = 0; x < outW; x += 1) {
      const u = x / (outW - 1)
      const su = Math.min(1, Math.max(0, (u - 0.5) / (1 + bulge) + 0.5 + wobble))
      const sx = Math.min(cw - 1, (su * (cw - 1)) | 0)
      const so = (sy * cw + sx) * 4
      if (s[so + 3] < 24) continue
      const oo = (y * outW + x) * 4
      const q = (n: number) => Math.round(Math.max(0, Math.min(255, n)) / 24) * 24
      od[oo] = q(s[so] * 0.58 + 22)
      od[oo + 1] = q(s[so + 1] * 0.54 + 28)
      od[oo + 2] = q(s[so + 2] * 0.74 + 24)
      od[oo + 3] = 255
    }
  }
  ctx.putImageData(drawn, 0, 0)

  ctx.fillStyle = '#1c1e22'
  const step = 3
  for (let y = 1; y < outH - 1; y += step) {
    for (let x = 1; x < outW - 1; x += step) {
      const a = od[(y * outW + x) * 4 + 3]
      const around =
        od[(y * outW + x - 1) * 4 + 3] +
        od[(y * outW + x + 1) * 4 + 3] +
        od[((y - 1) * outW + x) * 4 + 3] +
        od[((y + 1) * outW + x) * 4 + 3]
      const edge = a < 20 ? around > 40 : around < 800
      if (!edge || (x * 2 + y) % 5 === 0) continue
      ctx.globalAlpha = 0.72
      ctx.fillRect(x + ((y + x) % 3) - 1, y, 2, 2)
    }
  }
  ctx.globalAlpha = 1
}

function paint(img: HTMLImageElement, canvas: HTMLCanvasElement) {
  const maxW = 760
  const scale = Math.min(1, maxW / img.naturalWidth)
  const w = Math.max(2, Math.round(img.naturalWidth * scale))
  const h = Math.max(2, Math.round(img.naturalHeight * scale))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  ctx.drawImage(img, 0, 0, w, h)

  ctx.globalCompositeOperation = 'multiply'
  const dusk = ctx.createLinearGradient(0, 0, w, h)
  dusk.addColorStop(0, '#3a1848')
  dusk.addColorStop(0.55, '#1a1840')
  dusk.addColorStop(1, '#102028')
  ctx.fillStyle = dusk
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'screen'
  const wash = ctx.createLinearGradient(0, 0, w, 0)
  wash.addColorStop(0, 'rgba(255, 43, 214, 0.42)')
  wash.addColorStop(0.5, 'rgba(40, 16, 48, 0.05)')
  wash.addColorStop(1, 'rgba(45, 226, 255, 0.38)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  const snap = ctx.getImageData(0, 0, w, h)
  const src = snap.data
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11
  }

  const step = 3
  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const gx =
        -at(x - 1, y - 1) +
        at(x + 1, y - 1) -
        2 * at(x - 1, y) +
        2 * at(x + 1, y) -
        at(x - 1, y + 1) +
        at(x + 1, y + 1)
      const gy =
        -at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1) +
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1)
      const mag = Math.hypot(gx, gy)
      if (mag < 78) continue
      if ((x * 3 + y) % 4 === 0) continue
      const hot = (x + y) % 6 < 3
      ctx.globalAlpha = Math.min(0.95, mag / 200)
      ctx.fillStyle = hot ? '#ff4ad8' : '#7ef6ff'
      ctx.fillRect(x, y, 2, 2)
      ctx.globalAlpha *= 0.55
      ctx.fillStyle = hot ? '#7ef6ff' : '#ff4ad8'
      ctx.fillRect(x + 2, y, 2, 2)
    }
  }

  ctx.globalAlpha = 0.16
  ctx.fillStyle = '#000'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  ctx.globalAlpha = 1
}

export function Trace({
  src,
  alt,
  lines,
  cut,
}: {
  src: string
  alt: string
  lines: Line[]
  cut?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => (cut ? paintCut(img, canvas) : paint(img, canvas))
    img.src = src
  }, [src, cut])

  return (
    <figure className={cut ? 'trace cut' : 'trace'}>
      <canvas ref={ref} aria-label={alt} />
      {lines.map((line) => (
        <p
          key={line.text}
          className={[line.pink ? 'pink' : '', line.side ? 'side' : '', line.low ? 'low' : ''].filter(Boolean).join(' ') || undefined}
          style={line.side ? undefined : { left: line.x, top: line.y }}
        >
          {line.text}
        </p>
      ))}
    </figure>
  )
}
