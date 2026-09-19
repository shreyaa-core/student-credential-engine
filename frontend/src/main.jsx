import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import './index.css';

/**
 * Main Application Entry Point
 * 
 * Mounts the top-level <App /> component into the `#root` element of index.html.
 * Wrapped with <AuthProvider> so authentication state is available throughout the app.
 * React.StrictMode activates additional checks and warnings during development.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

