import { spawn } from 'node:child_process'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

type Note = { id: string; name: string; text: string; at: string }

function run(args: string[], input?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('gh', args, { windowsHide: true, shell: process.platform === 'win32' })
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      out += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      err += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err.trim() || out.trim() || `gh ${code}`))
    })
    if (input === undefined) child.stdin.end()
    else child.stdin.end(input)
  })
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 4000) {
        reject(new Error('big'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function parseNotes(raw: string): Note[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .filter((item): item is Note => {
        if (!item || typeof item !== 'object') return false
        const note = item as Note
        return typeof note.id === 'string' && typeof note.name === 'string' && typeof note.text === 'string' && typeof note.at === 'string'
      })
      .slice(0, 80)
  } catch {
    return []
  }
}

function clean(value: string, max: number) {
  return value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function feedbackPlugin(root: string): Plugin {
  const idFile = path.join(root, 'feedback.gist')
  let chain = Promise.resolve()
  let gistId = fs.existsSync(idFile) ? fs.readFileSync(idFile, 'utf8').trim() : ''

  function gate<T>(job: () => Promise<T>) {
    const run = chain.then(job, job)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async function ensure() {
    if (gistId) return gistId
    const created = await run(
      ['gist', 'create', '--desc', 'karasu feedback', '--filename', 'feedback.json'],
      '[]\n',
    )
    const match = created.match(/gist\.github\.com\/[^/\s]+\/([0-9a-f]+)/i)
    if (!match) throw new Error('gist id')
    gistId = match[1]
    fs.writeFileSync(idFile, gistId)
    return gistId
  }

  async function load(): Promise<Note[]> {
    const id = await ensure()
    const raw = await run(['api', `gists/${id}`])
    const json = JSON.parse(raw) as { files?: Record<string, { content?: string }> }
    return parseNotes(json.files?.['feedback.json']?.content ?? '[]')
  }

  async function save(notes: Note[]) {
    const id = await ensure()
    await run(
      ['api', '--method', 'PATCH', `gists/${id}`, '--input', '-'],
      JSON.stringify({ files: { 'feedback.json': { content: JSON.stringify(notes) } } }),
    )
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    try {
      if (req.method === 'GET') {
        const items = await gate(load)
        send(res, 200, { items })
        return
      }
      if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as { name?: unknown; text?: unknown }
        const text = clean(typeof body.text === 'string' ? body.text : '', 400)
        if (!text) {
          send(res, 400, { message: 'напиши хоть строку' })
          return
        }
        const name = clean(typeof body.name === 'string' ? body.name : '', 24) || 'аноним'
        const items = await gate(async () => {
          const notes = await load()
          const next = [{ id: crypto.randomUUID(), name, text, at: new Date().toISOString() }, ...notes].slice(0, 80)
          await save(next)
          return next
        })
        send(res, 200, { items })
        return
      }
      send(res, 405, { message: 'нет' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'сбой'
      send(res, 500, { message: message.slice(0, 180) })
    }
  }

  function attach(server: { middlewares: Connect.Server }) {
    server.middlewares.use('/api/feedback', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'POST') {
        next()
        return
      }
      void handle(req, res)
    })
  }

  return {
    name: 'karasu-feedback',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
