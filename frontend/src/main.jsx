import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/**
 * Main Application Entry Point
 * 
 * Mounts the top-level <App /> component into the `#root` element of index.html.
 * React.StrictMode activates additional checks and warnings during development.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
