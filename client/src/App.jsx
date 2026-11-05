import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import OnboardSurnamePage from './pages/OnboardSurnamePage';
import AddMemberPage from './pages/AddMemberPage';
import RequestTicketPage from './pages/RequestTicketPage';
import TicketStatusPage from './pages/TicketStatusPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import { apiRequest } from './utils/api';
import { GitBranch } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState('tree');
  const [pageParams, setPageParams] = useState({});
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    // Check if user arrived via direct link (e.g. #onboard, ?page=onboard, or private admin key)
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key') || urlParams.get('admin_key');
    const pageParam = urlParams.get('page');
    const hash = window.location.hash.replace('#', '');
    const path = window.location.pathname.replace(/^\//, '');

    if (key) {
      sessionStorage.setItem('ft_admin_key', key);
    }

    if (key || path.includes('admin') || hash.includes('admin')) {
      checkAdminSession(true);
    } else {
      checkAdminSession(false);
      const targetPage = pageParam || hash || path;
      if (['onboard', 'add-member', 'request', 'ticket-status', 'tree'].includes(targetPage)) {
        setActivePage(targetPage);
      }
    }

    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#', '');
      if (['onboard', 'add-member', 'request', 'ticket-status', 'tree'].includes(newHash)) {
        setActivePage(newHash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handlePageChange = (page, params = {}) => {
    setActivePage(page);
    setPageParams(params);
    window.location.hash = page;
  };

  const checkAdminSession = async (autoSwitchToAdmin = false) => {
    try {
      const res = await apiRequest('/admin/me');
      if (res.authenticated) {
        setIsAdminLoggedIn(true);
        setAdminUser(res.admin);
        if (autoSwitchToAdmin) {
          setActivePage('admin-dashboard');
        }
      } else {
        setIsAdminLoggedIn(false);
        setAdminUser(null);
      }
    } catch (_) {
      setIsAdminLoggedIn(false);
      setAdminUser(null);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ft_admin_key');
    setIsAdminLoggedIn(false);
    setAdminUser(null);
    setActivePage('tree');
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar
        activePage={activePage}
        setActivePage={handlePageChange}
        isAdminLoggedIn={isAdminLoggedIn}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activePage === 'tree' && <HomePage onNavigate={handlePageChange} />}
        {activePage === 'onboard' && <OnboardSurnamePage onNavigate={handlePageChange} />}
        {activePage === 'add-member' && <AddMemberPage onNavigate={handlePageChange} />}
        {activePage === 'request' && <RequestTicketPage onNavigate={handlePageChange} initialParams={pageParams} />}
        {activePage === 'ticket-status' && <TicketStatusPage />}
        {activePage === 'admin-dashboard' && (
          isAdminLoggedIn ? (
            <AdminDashboardPage onLogout={handleLogout} />
          ) : (
            <HomePage onNavigate={handlePageChange} />
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
            <span>Google Sheets Architecture</span>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => handlePageChange('tree')} className="hover:text-emerald-700">Lineages</button>
            <button onClick={() => handlePageChange('onboard')} className="hover:text-emerald-700">Onboard Surname</button>
            <button onClick={() => handlePageChange('ticket-status')} className="hover:text-emerald-700">Track Ticket</button>
          </div>

          <div className="flex items-center space-x-1 text-slate-400">
            <span>Formula-sanitized & strictly whitelisted</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
