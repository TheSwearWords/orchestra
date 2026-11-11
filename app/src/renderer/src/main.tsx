import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { holdSerifWidths } from './serifHold'

// Nocturne is the default look; localStorage.theme = 'v2' brings the light one back.
let theme: string | null = null
try {
  theme = localStorage.getItem('theme')
} catch {
  // no storage: stay on the default
}
if (theme !== 'v2') document.documentElement.classList.add('nocturne')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
holdSerifWidths()
