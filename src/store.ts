import { configureStore } from '@reduxjs/toolkit'
import { logApi } from './logApi'

export const store = configureStore({
  reducer: {
    [logApi.reducerPath]: logApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(logApi.middleware),
})
