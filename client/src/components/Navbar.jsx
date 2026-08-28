import React from 'react';
import { GraduationCap, LogOut } from 'lucide-react';

export function Navbar({ role, user, onLogout }) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">SY Attendance</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">Engineering Multi-Department Portal</p>
          </div>
        </div>

        {/* User Info & Role Badge */}
        <div className="flex items-center space-x-3">
          {role && (
            <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 rounded-full px-3.5 py-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-700 font-bold uppercase tracking-wider">
                {role === 'admin' ? '👑 Admin' : role === 'teacher' ? '👨‍🏫 Faculty' : '🎓 Student'}
              </span>
              {user?.name && (
                <span className="text-slate-500 border-l border-slate-300 pl-2 hidden md:inline font-medium">
                  {user.name} {user.rollNo ? `(#${user.rollNo})` : ''}
                </span>
              )}
            </div>
          )}

          {role && (
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 hover:border-rose-200 transition-all duration-150"
              title="Switch Account / Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
