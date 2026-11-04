import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import OnboardSurnamePage from './pages/OnboardSurnamePage';
import AddMemberPage from './pages/AddMemberPage';
import RequestTicketPage from './pages/RequestTicketPage';
import TicketStatusPage from './pages/TicketStatusPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import { apiRequest } from './utils/api';
import { GitBranch, Shield, Heart } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState('tree');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  // Check admin session on mount
  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      const res = await apiRequest('/admin/me');
      if (res.authenticated) {
        setIsAdminLoggedIn(true);
        setAdminUser(res.admin);
      } else {
        setIsAdminLoggedIn(false);
        setAdminUser(null);
      }
    } catch (_) {
      setIsAdminLoggedIn(false);
      setAdminUser(null);
    }
  };

  const handleLoginSuccess = (admin) => {
    setIsAdminLoggedIn(true);
    setAdminUser(admin);
    setActivePage('admin-dashboard');
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/admin/logout', { method: 'POST' });
    } catch (_) {}
    setIsAdminLoggedIn(false);
    setAdminUser(null);
    setActivePage('tree');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        isAdminLoggedIn={isAdminLoggedIn}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activePage === 'tree' && <HomePage onNavigate={setActivePage} />}
        {activePage === 'onboard' && <OnboardSurnamePage onNavigate={setActivePage} />}
        {activePage === 'add-member' && <AddMemberPage onNavigate={setActivePage} />}
        {activePage === 'request' && <RequestTicketPage onNavigate={setActivePage} />}
        {activePage === 'ticket-status' && <TicketStatusPage />}
        {activePage === 'admin-login' && (
          <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
        )}
        {activePage === 'admin-dashboard' && (
          isAdminLoggedIn ? (
            <AdminDashboardPage onLogout={handleLogout} />
          ) : (
            <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-700">Family Tree Portal</span>
            <span>•</span>
            <span>Serverless Architecture on Google Sheets</span>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => setActivePage('tree')} className="hover:text-emerald-700">Lineages</button>
            <button onClick={() => setActivePage('onboard')} className="hover:text-emerald-700">Onboard</button>
            <button onClick={() => setActivePage('ticket-status')} className="hover:text-emerald-700">Track Ticket</button>
            <button onClick={() => setActivePage('admin-login')} className="hover:text-emerald-700">Admin</button>
          </div>

          <div className="flex items-center space-x-1 text-slate-400">
            <span>Formula-sanitized & strictly whitelisted</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
