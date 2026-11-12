import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type { ShelfItem, ShelfKind } from './types'

const KEY = 'karasu-notes-v2'

const seed: ShelfItem[] = [
  {
    id: '1',
    title: 'synthwave',
    note: 'включил вместо той вечеринки',
    kind: 'ear',
    at: '2026-04-02T19:00:00.000Z',
  },
  {
    id: '2',
    title: 'nier',
    note: 'после титров ещё сидишь',
    kind: 'game',
    at: '2026-05-11T21:20:00.000Z',
  },
  {
    id: '3',
    title: 'сапёр',
    note: 'когда лень запускать что-то большое',
    kind: 'game',
    at: '2026-06-03T16:40:00.000Z',
  },
  {
    id: '4',
    title: 'юнити',
    note: 'одна сцена до конца, не пачка моделей',
    kind: 'head',
    at: '2026-09-01T12:15:00.000Z',
  },
]

function read(): ShelfItem[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(seed))
    return seed
  }
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('bad')
  return parsed as ShelfItem[]
}

function write(items: ShelfItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export const logApi = createApi({
  reducerPath: 'logApi',
  baseQuery: fakeBaseQuery<{ message: string }>(),
  tagTypes: ['Shelf'],
  endpoints: (build) => ({
    getShelf: build.query<ShelfItem[], void>({
      queryFn: () => {
        try {
          return { data: read() }
        } catch {
          return { error: { message: 'заметки не открылись' } }
        }
      },
      providesTags: ['Shelf'],
    }),
    addShelf: build.mutation<ShelfItem, { title: string; note: string; kind: ShelfKind }>({
      queryFn: (body) => {
        try {
          const items = read()
          const entry: ShelfItem = { ...body, id: crypto.randomUUID(), at: new Date().toISOString() }
          write([entry, ...items])
          return { data: entry }
        } catch {
          return { error: { message: 'не записалось' } }
        }
      },
      invalidatesTags: ['Shelf'],
    }),
    resetShelf: build.mutation<ShelfItem[], void>({
      queryFn: () => {
        write(seed)
        return { data: seed }
      },
      invalidatesTags: ['Shelf'],
    }),
  }),
})

export const { useGetShelfQuery, useAddShelfMutation, useResetShelfMutation } = logApi
