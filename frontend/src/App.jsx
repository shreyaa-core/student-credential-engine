import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Global Navigation Component
import Navbar from './components/Navbar';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UploadCertificate from './pages/UploadCertificate';
import Certificates from './pages/Certificates';
import Skills from './pages/Skills';
import Badges from './pages/Badges';
import Portfolio from './pages/Portfolio';
import Transcript from './pages/Transcript';
import Verify from './pages/Verify';
import Admin from './pages/Admin';

/**
 * Root Application Component
 * 
 * Configures global Navbar and client-side routing with React Router.
 * The Navbar is placed directly inside BrowserRouter so it appears on every page
 * without duplication.
 */
function App() {
  return (
    <BrowserRouter>
      {/* Global Navbar rendered once across all routes */}
      <Navbar />

      <Routes>
        {/* Public Pages */}
        <Route
          path="/"
          element={
            <MainLayout>
              <Home />
            </MainLayout>
          }
        />
        <Route
          path="/login"
          element={
            <MainLayout>
              <Login />
            </MainLayout>
          }
        />
        <Route
          path="/register"
          element={
            <MainLayout>
              <Register />
            </MainLayout>
          }
        />
        <Route
          path="/verify"
          element={
            <MainLayout>
              <Verify />
            </MainLayout>
          }
        />

        {/* Dashboard & Workspace Pages */}
        <Route
          path="/dashboard"
          element={
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          }
        />
        <Route
          path="/upload"
          element={
            <DashboardLayout>
              <UploadCertificate />
            </DashboardLayout>
          }
        />
        <Route
          path="/certificates"
          element={
            <DashboardLayout>
              <Certificates />
            </DashboardLayout>
          }
        />
        <Route
          path="/skills"
          element={
            <DashboardLayout>
              <Skills />
            </DashboardLayout>
          }
        />
        <Route
          path="/badges"
          element={
            <DashboardLayout>
              <Badges />
            </DashboardLayout>
          }
        />
        <Route
          path="/portfolio"
          element={
            <DashboardLayout>
              <Portfolio />
            </DashboardLayout>
          }
        />
        <Route
          path="/transcript"
          element={
            <DashboardLayout>
              <Transcript />
            </DashboardLayout>
          }
        />
        <Route
          path="/admin"
          element={
            <DashboardLayout>
              <Admin />
            </DashboardLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
