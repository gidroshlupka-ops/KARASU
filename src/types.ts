export type ShelfKind = 'ear' | 'game' | 'head'

export type ShelfItem = {
  id: string
  title: string
  note: string
  kind: ShelfKind
  at: string
}

export type ShelfDraft = {
  title: string
  note: string
  kind: ShelfKind
}
