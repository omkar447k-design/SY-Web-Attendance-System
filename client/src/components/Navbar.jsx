import React from 'react';
import { GraduationCap, LogOut } from 'lucide-react';

export function Navbar({ role, user, onLogout }) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
            <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight truncate">
                SY Attendance
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex-shrink-0">
                PWA
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block truncate">
              Engineering Multi-Department Portal
            </p>
          </div>
        </div>

        {/* User Info & Role Badge */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
          {role && (
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-100 border border-slate-200 rounded-full px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
              <span className="text-slate-700 font-bold uppercase tracking-wider whitespace-nowrap">
                {role === 'admin' ? '👑 Admin' : role === 'teacher' ? '👨‍🏫 Faculty' : '🎓 Student'}
              </span>
              {user?.name && (
                <span className="text-slate-500 border-l border-slate-300 pl-2 hidden lg:inline font-medium truncate max-w-[120px]">
                  {user.name} {user.rollNo ? `(#${user.rollNo})` : ''}
                </span>
              )}
            </div>
          )}

          {role && (
            <button
              onClick={onLogout}
              className="flex items-center space-x-1 sm:space-x-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 hover:border-rose-200 transition-all duration-150 active:scale-95"
              title="Switch Account / Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Exit</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
