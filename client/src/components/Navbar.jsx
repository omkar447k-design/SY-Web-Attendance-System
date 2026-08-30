import React from 'react';
import { GraduationCap, LogOut } from 'lucide-react';

export function Navbar({ role, user, onLogout }) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center space-x-3 min-w-0">
          <GraduationCap className="w-7 h-7 text-slate-900 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight uppercase truncate">
                Attendance Portal
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block truncate">
              Engineering Multi-Department System
            </p>
          </div>
        </div>

        {/* User Info & Role Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          {role && (
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
              <span className="text-slate-800 uppercase tracking-wider whitespace-nowrap font-bold">
                {role === 'admin' ? 'HOD / Admin' : role === 'teacher' ? 'Faculty' : 'Student'}
              </span>
              {user?.name && (
                <span className="text-slate-500 border-l border-slate-200 pl-2 hidden lg:inline font-medium truncate max-w-[150px]">
                  {user.name} {user.rollNo ? `(#${user.rollNo})` : ''}
                </span>
              )}
            </div>
          )}

          {role && (
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 transition active:scale-95"
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
