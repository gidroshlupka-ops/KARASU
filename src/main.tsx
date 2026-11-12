import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/neucha/cyrillic-400.css'
import '@fontsource/neucha/latin-400.css'
import '@fontsource/pixelify-sans/cyrillic-400.css'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/bad-script/cyrillic-400.css'
import '@fontsource/bad-script/latin-400.css'
import { App } from './App'
import { PlayerRoot } from './Playlist'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerRoot>
      <App />
    </PlayerRoot>
  </StrictMode>,
)
