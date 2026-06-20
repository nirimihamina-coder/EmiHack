import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { SocketProvider } from './context/SocketProvider.tsx';

const getToken = () => localStorage.getItem('token') ?? '';

// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker
//       .register('/sw.js', { scope: '/' })
//       .then((reg) => console.log('[SW] Enregistré:', reg.scope))
//       .catch((err) => console.warn('[SW] Erreur:', err));
//   });
// }

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <SocketProvider token={getToken()}>
      <App />
    </SocketProvider>
  </BrowserRouter>
);
