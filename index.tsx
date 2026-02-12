
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for PWA with enhanced update logic
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 1000 * 60 * 60); // Check every hour

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // At this point, the old content will have been purged and
                // the fresh content will have been added to the cache.
                // We dispatch an event to the UI to show the "Update Available" toast.
                console.log('New content is available; please refresh.');
                window.dispatchEvent(new Event('sw-update-available'));
              } else {
                // Content is cached for offline use.
                console.log('Content is cached for offline use.');
              }
            }
          };
        };
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
