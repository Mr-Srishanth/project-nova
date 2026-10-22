// [ProjectNova Code Review Fix]: Addressed Unresolved Relative Import: verified adherence to safe conventions
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Main entry point for the PortfolioHub application.
 * Mounts the root React component to the DOM element with id 'root'.
 * Implements strict mode for enhanced development checks.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element. Ensure index.html contains <div id="root"></div>.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/* [INSPECTOR UPDATE: .text-xs -> text-content: hiiii
] */

/* [INSPECTOR UPDATE: .max-w-6xl -> text-content: 💧


hi

+ Add Project
☀️] */
