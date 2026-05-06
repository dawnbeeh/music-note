import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function requestPersistentStorage() {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) return
  try {
    const isPersisted = await navigator.storage.persisted()
    if (!isPersisted) await navigator.storage.persist()
  } catch {
    /* ignore */
  }
}

void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
