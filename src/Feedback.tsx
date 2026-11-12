import { useEffect, useState, type FormEvent } from 'react'

type Note = { id: string; name: string; text: string; at: string }

export function Feedback() {
  const [items, setItems] = useState<Note[]>([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let dead = false
    fetch('/api/feedback')
      .then((res) => res.json())
      .then((data: { items?: Note[] }) => {
        if (!dead) setItems(data.items ?? [])
      })
      .catch(() => {
        if (!dead) setMsg('куча пока не открылась')
      })
    return () => {
      dead = true
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, text }),
      })
      const data = (await res.json()) as { items?: Note[]; message?: string }
      if (!res.ok) {
        setMsg(data.message || 'не легло')
        return
      }
      setText('')
      setItems(data.items ?? [])
      setMsg('лежит. я уже почти читаю.')
    } catch {
      setMsg('не дошло')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="shelf">
      <p>Можете фидбекнуть.</p>
      <p className="vow">Я ОБЯЗАТЕЛЬНО всё прочитаю.</p>
      <p>
        Каждое. Дважды. С карандашом. Потом отвечу по пунктам и перескажу маме. Ну или оно ляжет в кучу на
        гитхабе и будет там лежать вечно. Это тоже считается за «прочитал».
      </p>
      <form className="log-form" onSubmit={onSubmit}>
        <label>
          кто
          <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="можно пусто" />
        </label>
        <label className="span-2">
          чего
          <input value={text} maxLength={400} required onChange={(event) => setText(event.target.value)} placeholder="можно не пусто" />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={busy}>{busy ? 'кладу…' : 'отправь, я же прочитаю'}</button>
          {msg && <span className="form-msg">{msg}</span>}
        </div>
      </form>
      <ul className="notes">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong>
            <span>{new Date(item.at).toLocaleDateString('ru')}</span>
            <p>{item.text}</p>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p>пока пусто. я уже готов читать.</p>}
    </section>
  )
}
