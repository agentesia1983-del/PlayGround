import { Game } from './game.js'

const bootEl = document.getElementById('boot')
const errorScreen = document.getElementById('error-screen')
const errorText = document.getElementById('error-text')

function fail(err) {
  console.error('[ZERO HOUR] failed to boot:', err)
  if (bootEl) bootEl.classList.add('done', 'hidden')
  if (errorScreen) errorScreen.classList.remove('hidden')
  if (errorText) errorText.textContent = err && err.message ? err.message : 'WebGL could not be initialized on this device.'
}

function launch() {
  try {
    const game = new Game()
    window.__zeroHour = game
    requestAnimationFrame(() => {
      if (bootEl) bootEl.classList.add('done')
    })
  } catch (err) {
    fail(err)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(launch, 0), { once: true })
} else {
  setTimeout(launch, 0)
}

window.addEventListener('error', e => {
  if (!window.__zeroHour) fail(e.error || new Error(e.message))
})
window.addEventListener('unhandledrejection', e => {
  if (!window.__zeroHour) fail(e.reason instanceof Error ? e.reason : new Error(String(e.reason)))
})
