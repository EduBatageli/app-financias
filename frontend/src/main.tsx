import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Não foi possível registrar o service worker:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
