
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './utils/LanguageContext';
import { DialogProvider } from './utils/DialogContext';

// Register Service Worker manually
try {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      try {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('SW registered'))
          .catch(err => console.warn('SW registration failed (non-fatal):', err));
      } catch (err) {
        console.warn('SW registration failed synchronously (non-fatal):', err);
      }
    });
  }
} catch (e) {
  console.warn('Service worker is not supported or accessible (non-fatal):', e);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </LanguageProvider>
  </React.StrictMode>
);
