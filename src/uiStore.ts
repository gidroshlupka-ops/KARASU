import { create } from 'zustand'
import type { ShelfDraft, ShelfKind } from './types'

export type KindFilter = 'all' | ShelfKind

type UiState = {
  q: string
  kind: KindFilter
  page: number
  draft: ShelfDraft
  setQ: (q: string) => void
  setKind: (kind: KindFilter) => void
  setPage: (page: number) => void
  setDraft: (patch: Partial<ShelfDraft>) => void
  clearDraft: () => void
}

const emptyDraft: ShelfDraft = { title: '', note: '', kind: 'head' }

export const useUi = create<UiState>((set) => ({
  q: '',
  kind: 'all',
  page: 1,
  draft: emptyDraft,
  setQ: (q) => set({ q, page: 1 }),
  setKind: (kind) => set({ kind, page: 1 }),
  setPage: (page) => set({ page }),
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  clearDraft: () => set({ draft: emptyDraft }),
}))
