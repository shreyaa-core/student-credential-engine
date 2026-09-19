import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Global Navigation Component
import Navbar from './components/Navbar';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Route Guards
import ProtectedRoute from './components/ProtectedRoute';

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
import Profile from './pages/Profile';
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
        <Route
          path="/verify/:id"
          element={
            <MainLayout>
              <Verify />
            </MainLayout>
          }
        />

        {/* Protected Dashboard & Workspace Pages */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <UploadCertificate />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/certificates"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Certificates />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/skills"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Skills />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/badges"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Badges />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Portfolio />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Profile />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transcript"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Transcript />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        {/* Strictly Guarded Admin Route */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin', 'Admin']}>
              <DashboardLayout>
                <Admin />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
