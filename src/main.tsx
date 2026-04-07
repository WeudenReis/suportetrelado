import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

// Capturar erros globais não tratados e mostrar na tela
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.error);
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="padding:40px;color:#f87171;background:#1d2125;min-height:100vh;font-family:monospace">
      <h2>Erro na aplicação</h2>
      <pre style="white-space:pre-wrap;color:#94a3b8">${e.error?.stack || e.message}</pre>
    </div>`;
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED PROMISE]', e.reason);
});

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error('[RENDER CRASH]', err);
    rootEl.innerHTML = `<div style="padding:40px;color:#f87171;background:#1d2125;min-height:100vh;font-family:monospace">
      <h2>Erro ao iniciar aplicação</h2>
      <pre style="white-space:pre-wrap;color:#94a3b8">${err instanceof Error ? err.stack : String(err)}</pre>
    </div>`;
  }
}
