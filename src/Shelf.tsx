import { useMemo, useState, type FormEvent } from 'react'
import { useAddShelfMutation, useGetShelfQuery, useResetShelfMutation } from './logApi'
import type { ShelfKind } from './types'
import { useUi, type KindFilter } from './uiStore'

const PAGE = 4

const labels: Record<ShelfKind, string> = {
  ear: 'музыка',
  game: 'игра',
  head: 'другое',
}

const filters: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'все' },
  { id: 'ear', label: 'музыка' },
  { id: 'game', label: 'игра' },
  { id: 'head', label: 'другое' },
]

export function Shelf() {
  const { data, isLoading, isError, refetch } = useGetShelfQuery()
  const [addShelf, { isLoading: saving }] = useAddShelfMutation()
  const [resetShelf, { isLoading: resetting }] = useResetShelfMutation()
  const q = useUi((s) => s.q)
  const kind = useUi((s) => s.kind)
  const page = useUi((s) => s.page)
  const draft = useUi((s) => s.draft)
  const setQ = useUi((s) => s.setQ)
  const setKind = useUi((s) => s.setKind)
  const setPage = useUi((s) => s.setPage)
  const setDraft = useUi((s) => s.setDraft)
  const clearDraft = useUi((s) => s.clearDraft)
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return (data ?? []).filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false
      if (!query) return true
      return `${item.title} ${item.note}`.toLowerCase().includes(query)
    })
  }, [data, q, kind])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const safePage = Math.min(page, pages)
  const slice = filtered.slice((safePage - 1) * PAGE, safePage * PAGE)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const title = draft.title.trim()
    const note = draft.note.trim()
    if (!title) {
      setFormError('напиши, что запомнить')
      return
    }
    if (title.length > 48 || note.length > 140) {
      setFormError('короче пиши')
      return
    }
    setFormError('')
    try {
      await addShelf({ title, note, kind: draft.kind }).unwrap()
      clearDraft()
      setPage(1)
      setSaved(true)
    } catch {
      setFormError('не записалось')
    }
  }

  return (
    <div className="shelf">
      <form className="log-form" onSubmit={onSubmit}>
        <label>
          что
          <input value={draft.title} maxLength={48} autoComplete="off" onChange={(e) => setDraft({ title: e.target.value })} />
        </label>
        <label>
          тип
          <select value={draft.kind} onChange={(e) => setDraft({ kind: e.target.value as ShelfKind })}>
            <option value="ear">музыка</option>
            <option value="game">игра</option>
            <option value="head">другое</option>
          </select>
        </label>
        <label className="span-2">
          коммент
          <input value={draft.note} maxLength={140} autoComplete="off" onChange={(e) => setDraft({ note: e.target.value })} />
        </label>
        <div className="form-actions span-2">
          <button type="submit" disabled={saving}>{saving ? 'пишу…' : 'записать'}</button>
          {formError && <span className="form-msg bad">{formError}</span>}
          {saved && !formError && <span className="form-msg">записал</span>}
        </div>
      </form>

      <div className="toolbar">
        <label className="search">
          найти
          <input value={q} placeholder="найди" onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="фильтр заметок">
          {filters.map((f) => (
            <button key={f.id} type="button" className={kind === f.id ? 'chip on' : 'chip'} onClick={() => setKind(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p>сек…</p>}
      {isError && (
        <p>
          не прочиталось. <button type="button" onClick={() => refetch()}>ещё раз</button>
        </p>
      )}
      {!isLoading && !isError && filtered.length === 0 && <p>пусто. допиши или сбрось фильтр.</p>}

      {slice.length > 0 && (
        <ul className="notes">
          {slice.map((item) => (
            <li key={item.id}>
              <b>{item.title}</b>
              <span>{labels[item.kind]}</span>
              {item.note && <p>{item.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {filtered.length > PAGE && (
        <div className="pager">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>назад</button>
          <span>{safePage} / {pages}</span>
          <button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>дальше</button>
        </div>
      )}

      <button
        type="button"
        className="text-btn"
        disabled={resetting}
        onClick={() => {
          resetShelf()
          setPage(1)
          setSaved(false)
        }}
      >
        сбросить заметки
      </button>
    </div>
  )
}
