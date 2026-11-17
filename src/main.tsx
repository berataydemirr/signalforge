import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './styles.css';

try {
  const fromUrl = new URLSearchParams(window.location.search).get('theme');
  const saved = fromUrl ?? localStorage.getItem('sf-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {
  /* storage unavailable: keep the default dark theme */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
