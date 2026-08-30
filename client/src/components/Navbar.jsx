import React from 'react';
import { GraduationCap, LogOut } from 'lucide-react';

export function Navbar({ role, user, onLogout }) {
  return (
    <header className="bg-white border-b border-slate-300 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        
        {/* Brand */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-black flex items-center justify-center border border-slate-800 flex-shrink-0">
            <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-black text-base sm:text-lg text-black tracking-tight uppercase truncate">
                Attendance Portal
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold hidden sm:block truncate">
              Engineering Multi-Department Portal
            </p>
          </div>
        </div>

        {/* User Info & Role Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          {role && (
            <div className="flex items-center space-x-2 bg-slate-100 border border-slate-300 px-3 py-1 text-[11px] sm:text-xs font-bold">
              <span className="w-2 h-2 bg-sky-500 flex-shrink-0"></span>
              <span className="text-black uppercase tracking-wider whitespace-nowrap">
                {role === 'admin' ? '👑 Admin' : role === 'teacher' ? '👨‍🏫 Faculty' : '🎓 Student'}
              </span>
              {user?.name && (
                <span className="text-slate-600 border-l border-slate-300 pl-2 hidden lg:inline font-semibold truncate max-w-[140px]">
                  {user.name} {user.rollNo ? `(#${user.rollNo})` : ''}
                </span>
              )}
            </div>
          )}

          {role && (
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 bg-black hover:bg-slate-800 text-white border border-black transition-all active:scale-95"
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
