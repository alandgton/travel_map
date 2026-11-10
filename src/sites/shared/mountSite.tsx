import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';

/** Shared bootstrap so every site entry mounts the same way. */
export function mountSite(element: React.ReactElement): void {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{element}</React.StrictMode>
  );
}
