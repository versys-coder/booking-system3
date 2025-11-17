import React from 'react';
import { createRoot } from 'react-dom/client';
import PoolIndicatorEmbed from '../src/PoolIndicatorEmbed.tsx';
import './pool-indicator.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <PoolIndicatorEmbed />
    </React.StrictMode>
  );
} else {
  const el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
  createRoot(el).render(
    <React.StrictMode>
      <PoolIndicatorEmbed />
    </React.StrictMode>
  );
}