import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { CrashBoundary } from './app/CrashBoundary';
import { installCrashLogging } from './app/crashLog';

installCrashLogging();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <CrashBoundary>
      <App />
    </CrashBoundary>
  </StrictMode>,
);
