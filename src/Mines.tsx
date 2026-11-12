import { useMemo, useState } from 'react'

const COLS = 9
const ROWS = 9
const MINES = 10

type Cell = { mine: boolean; open: boolean; flag: boolean; n: number }

function neighbors(i: number) {
  const x = i % COLS
  const y = Math.floor(i / COLS)
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue
      out.push(ny * COLS + nx)
    }
  }
  return out
}

function lay(safe: number): Cell[] {
  const total = COLS * ROWS
  const ban = new Set([safe, ...neighbors(safe)])
  const mines = new Set<number>()
  while (mines.size < MINES) {
    const i = Math.floor(Math.random() * total)
    if (!ban.has(i)) mines.add(i)
  }
  const cells: Cell[] = Array.from({ length: total }, (_, i) => ({
    mine: mines.has(i),
    open: false,
    flag: false,
    n: 0,
  }))
  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue
    cells[i].n = neighbors(i).filter((j) => cells[j].mine).length
  }
  return cells
}

function blank(): Cell[] {
  return Array.from({ length: COLS * ROWS }, () => ({ mine: false, open: false, flag: false, n: 0 }))
}

function flood(cells: Cell[], index: number) {
  const next = cells.map((c) => ({ ...c }))
  const stack = [index]
  const seen = new Set<number>()
  while (stack.length) {
    const i = stack.pop()!
    if (seen.has(i)) continue
    seen.add(i)
    const cell = next[i]
    if (cell.open || cell.flag) continue
    cell.open = true
    if (!cell.mine && cell.n === 0) {
      for (const n of neighbors(i)) stack.push(n)
    }
  }
  return next
}

export function Mines() {
  const [cells, setCells] = useState<Cell[]>(blank)
  const [ready, setReady] = useState(false)
  const [dead, setDead] = useState(false)
  const [flagMode, setFlagMode] = useState(false)

  const won = useMemo(
    () => ready && !dead && cells.every((c) => c.mine || c.open),
    [cells, ready, dead],
  )
  const flags = cells.filter((c) => c.flag).length

  function fresh() {
    setCells(blank())
    setReady(false)
    setDead(false)
  }

  function onCell(index: number, asFlag: boolean) {
    if (dead || won) return
    if (!ready) {
      const next = lay(index)
      if (asFlag) {
        next[index].flag = true
        setCells(next)
        setReady(true)
        return
      }
      setCells(flood(next, index))
      setReady(true)
      return
    }
    const cell = cells[index]
    if (cell.open) return
    if (asFlag) {
      setCells(cells.map((c, i) => (i === index ? { ...c, flag: !c.flag } : c)))
      return
    }
    if (cell.flag) return
    if (cell.mine) {
      setDead(true)
      setCells(cells.map((c) => (c.mine ? { ...c, open: true } : c)))
      return
    }
    setCells(flood(cells, index))
  }

  const status = dead ? 'проиграл' : won ? 'выиграл' : ready ? `мин: ${MINES - flags}` : 'новое поле'

  return (
    <div className="mines">
      <div className="mines-bar">
        <span>{status}</span>
        <button type="button" className={flagMode ? 'chip on' : 'chip'} onClick={() => setFlagMode((v) => !v)}>
          {flagMode ? 'флажок' : 'открыть'}
        </button>
        <button type="button" onClick={fresh}>
          заново
        </button>
      </div>
      <div className="grid" onContextMenu={(e) => e.preventDefault()}>
        {cells.map((cell, i) => {
          const shown = cell.open ? (cell.mine ? '●' : cell.n ? String(cell.n) : '') : cell.flag ? 'х' : ''
          const name = cell.open ? (cell.mine ? 'мина' : shown || 'пусто') : cell.flag ? 'флажок' : 'закрыто'
          return (
            <button
              key={i}
              type="button"
              className={`cell${cell.open ? ` open n${cell.n}` : ''}${cell.open && cell.mine ? ' boom' : ''}${!cell.open && cell.flag ? ' flagged' : ''}`}
              aria-label={name}
              onClick={() => onCell(i, flagMode)}
              onContextMenu={(e) => {
                e.preventDefault()
                onCell(i, true)
              }}
            >
              {shown}
            </button>
          )
        })}
      </div>
    </div>
  )
}
