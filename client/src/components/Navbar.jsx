import React, { useState } from 'react';
import { GitBranch, PlusCircle, UserPlus, UserCheck, FileText, CheckCircle, Shield, Menu, X, Moon, Sun } from 'lucide-react';

export default function Navbar({ activePage, setActivePage, isAdminLoggedIn, onLogout, isDarkMode, onToggleDarkMode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'tree', label: 'Explore Trees', icon: GitBranch },
    { id: 'onboard', label: 'Onboard Surname', icon: PlusCircle },
    { id: 'add-member', label: 'Add Member', icon: UserPlus },
    { id: 'join', label: 'Join Tree', icon: UserCheck },
    { id: 'request', label: 'Submit Request', icon: FileText },
    { id: 'ticket-status', label: 'Track Ticket', icon: CheckCircle },
  ];

  const handleNav = (id) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div 
            onClick={() => handleNav('tree')} 
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base sm:text-lg tracking-tight block leading-tight">
                Family Tree
              </span>
              <span className="text-[9px] font-bold text-emerald-400 tracking-wider uppercase block">
                Lineage Portal
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Theme Toggle & Admin */}
          <div className="hidden md:flex items-center space-x-2">
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                title={isDarkMode ? 'Switch to Light theme' : 'Switch to Dark theme'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-700/60 transition-colors"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {isAdminLoggedIn && (
              <button
                onClick={() => handleNav('admin-dashboard')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  activePage === 'admin-dashboard'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Portal</span>
              </button>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="md:hidden flex items-center space-x-1.5">
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-700/60"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-900 px-4 pt-2 pb-3 space-y-1 shadow-xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                  isActive
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          {isAdminLoggedIn && (
            <div className="pt-2 border-t border-slate-800 mt-2">
              <button
                onClick={() => handleNav('admin-dashboard')}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white"
              >
                <Shield className="w-4 h-4" />
                <span>Private Admin Portal</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
