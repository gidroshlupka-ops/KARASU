import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const input = 'C:\\Users\\azurb\\Downloads\\цц.mp4'
const ffmpeg = fs.readFileSync(path.join(os.tmpdir(), 'ffmpeg-path.txt'), 'utf8').trim()
const rawPath = path.join(os.tmpdir(), 'karasu-reel.raw')
const audioOut = path.join(root, 'public', 'audio', 'reel.m4a')
const framesOut = path.join(root, 'public', 'reel', 'frames.bin')
const w = 120
const h = 90
const fps = 30

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'inherit'] })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg ${code}`))
    })
  })
}

function packFrame(raw, offset, pixels, stride) {
  const out = new Uint8Array(stride)
  for (let i = 0; i < pixels; i++) {
    if (raw[offset + i] < 128) out[i >> 3] |= 0x80 >> (i & 7)
  }
  return out
}

function rle(bytes) {
  const out = []
  for (let i = 0; i < bytes.length; ) {
    const v = bytes[i]
    let n = 1
    while (n < 255 && i + n < bytes.length && bytes[i + n] === v) n++
    out.push(n, v)
    i += n
  }
  return Uint8Array.from(out)
}

await run([
  '-y',
  '-i',
  input,
  '-an',
  '-vf',
  `scale=${w}:${h}:flags=area,format=gray`,
  '-f',
  'rawvideo',
  '-pix_fmt',
  'gray',
  rawPath,
])

await run(['-y', '-i', input, '-vn', '-c:a', 'copy', audioOut])

const raw = fs.readFileSync(rawPath)
const pixels = w * h
const count = raw.length / pixels
if (!Number.isInteger(count)) throw new Error(`raw length ${raw.length}`)
const stride = pixels / 8
const chunks = []
let prev = new Uint8Array(stride)
for (let f = 0; f < count; f++) {
  const cur = packFrame(raw, f * pixels, pixels, stride)
  const delta = new Uint8Array(stride)
  for (let i = 0; i < stride; i++) delta[i] = cur[i] ^ prev[i]
  prev = cur
  chunks.push(rle(delta))
}

const header = Buffer.alloc(17)
header.write('BA', 0, 'ascii')
header[2] = 1
header.writeUInt16LE(w, 3)
header.writeUInt16LE(h, 5)
header.writeUInt16LE(fps, 7)
header.writeUInt32LE(count, 9)
header.writeUInt32LE(stride, 13)

const body = []
for (const chunk of chunks) {
  const len = Buffer.alloc(2)
  len.writeUInt16LE(chunk.length)
  body.push(len, chunk)
}

fs.mkdirSync(path.dirname(framesOut), { recursive: true })
fs.writeFileSync(framesOut, Buffer.concat([header, ...body]))

const bin = fs.readFileSync(framesOut)
const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
let o = 17
const acc = new Uint8Array(stride)
for (let f = 0; f < count; f++) {
  const len = view.getUint16(o, true)
  o += 2
  const delta = new Uint8Array(stride)
  let i = 0
  const end = o + len
  while (o < end) {
    const n = bin[o++]
    const v = bin[o++]
    delta.fill(v, i, i + n)
    i += n
  }
  if (i !== stride) throw new Error(`short frame ${f}`)
  for (let b = 0; b < stride; b++) acc[b] ^= delta[b]
  const expect = packFrame(raw, f * pixels, pixels, stride)
  for (let b = 0; b < stride; b++) {
    if (acc[b] !== expect[b]) throw new Error(`mismatch frame ${f}`)
  }
}

const audioSize = fs.statSync(audioOut).size
console.log(`frames ${count} bin ${fs.statSync(framesOut).size} audio ${audioSize}`)
