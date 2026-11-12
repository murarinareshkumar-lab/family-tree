import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import OnboardSurnamePage from './pages/OnboardSurnamePage';
import AddMemberPage from './pages/AddMemberPage';
import JoinRequestPage from './pages/JoinRequestPage';
import RequestTicketPage from './pages/RequestTicketPage';
import TicketStatusPage from './pages/TicketStatusPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import { apiRequest } from './utils/api';
import { GitBranch } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState('tree');
  const [pageParams, setPageParams] = useState({});
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const resolveTargetPage = (pathname, hash, search) => {
    const cleanPath = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const cleanHash = hash.replace(/^#+/, '').toLowerCase();
    const params = new URLSearchParams(search);
    const pageParam = params.get('page')?.toLowerCase();

    const target = pageParam || cleanPath || cleanHash;
    if (target === 'admin' || target === 'admin-dashboard') return 'admin';
    if (['onboard', 'add-member', 'join', 'request', 'ticket-status', 'tree'].includes(target)) {
      return target;
    }
    return 'tree';
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key') || urlParams.get('admin_key');
    if (key) {
      sessionStorage.setItem('ft_admin_key', key);
    }

    const syncPageFromUrl = () => {
      const page = resolveTargetPage(window.location.pathname, window.location.hash, window.location.search);
      if (page === 'admin' || key) {
        checkAdminSession(true);
      } else {
        checkAdminSession(false);
        setActivePage(page);
      }
    };

    syncPageFromUrl();

    const handlePopState = () => syncPageFromUrl();
    const handleHashChange = () => syncPageFromUrl();

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handlePageChange = (page, params = {}) => {
    setActivePage(page);
    setPageParams(params);
    let targetPath = '/';
    if (page === 'admin' || page === 'admin-dashboard') {
      targetPath = '/admin';
    } else if (page !== 'tree') {
      targetPath = `/${page}`;
    }
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.pushState({ page }, '', targetPath);
    }
  };

  const checkAdminSession = async (autoSwitchToAdmin = false) => {
    try {
      const res = await apiRequest('/admin/me');
      if (res.authenticated) {
        setIsAdminLoggedIn(true);
        setAdminUser(res.admin || { email: res.email });
        if (autoSwitchToAdmin) {
          setActivePage('admin-dashboard');
          if (window.location.pathname !== '/admin') {
            window.history.replaceState({ page: 'admin' }, '', '/admin');
          }
        }
      } else {
        setIsAdminLoggedIn(false);
        setAdminUser(null);
        if (autoSwitchToAdmin) {
          setActivePage('admin');
          if (window.location.pathname !== '/admin') {
            window.history.replaceState({ page: 'admin' }, '', '/admin');
          }
        }
      }
    } catch (_) {
      setIsAdminLoggedIn(false);
      setAdminUser(null);
      if (autoSwitchToAdmin) {
        setActivePage('admin');
        if (window.location.pathname !== '/admin') {
          window.history.replaceState({ page: 'admin' }, '', '/admin');
        }
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ft_admin_key');
    setIsAdminLoggedIn(false);
    setAdminUser(null);
    setActivePage('tree');
    window.history.pushState({ page: 'tree' }, '', '/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-900 selection:text-emerald-100">
      <Navbar
        activePage={activePage}
        setActivePage={handlePageChange}
        isAdminLoggedIn={isAdminLoggedIn}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activePage === 'tree' && <HomePage onNavigate={handlePageChange} initialParams={pageParams} />}
        {activePage === 'onboard' && <OnboardSurnamePage onNavigate={handlePageChange} initialParams={pageParams} />}
        {activePage === 'add-member' && <AddMemberPage onNavigate={handlePageChange} initialParams={pageParams} />}
        {activePage === 'join' && <JoinRequestPage onNavigate={handlePageChange} initialParams={pageParams} />}
        {activePage === 'request' && <RequestTicketPage onNavigate={handlePageChange} initialParams={pageParams} />}
        {activePage === 'ticket-status' && <TicketStatusPage />}
        {(activePage === 'admin-dashboard' || activePage === 'admin') && (
          isAdminLoggedIn ? (
            <AdminDashboardPage onLogout={handleLogout} />
          ) : (
            <AdminLoginPage onLoginSuccess={(admin) => {
              setIsAdminLoggedIn(true);
              setAdminUser(admin);
              setActivePage('admin-dashboard');
              if (window.location.pathname !== '/admin') {
                window.history.replaceState({ page: 'admin' }, '', '/admin');
              }
            }} />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/90 py-5 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">Family Tree Portal</span>
            <span>•</span>
            <span>Google Sheets Architecture</span>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            <button onClick={() => handlePageChange('tree')} className="hover:text-emerald-400 transition-colors">Lineages</button>
            <button onClick={() => handlePageChange('onboard')} className="hover:text-emerald-400 transition-colors">Onboard Surname</button>
            <button onClick={() => handlePageChange('ticket-status')} className="hover:text-emerald-400 transition-colors">Track Ticket</button>
            <button onClick={() => handlePageChange('admin')} className="hover:text-emerald-400 transition-colors font-medium">Admin Portal</button>
          </div>

          <div className="flex items-center space-x-1 text-slate-500">
            <span>Formula-sanitized &amp; strictly whitelisted</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
