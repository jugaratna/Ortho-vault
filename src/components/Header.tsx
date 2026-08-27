import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Users,
  Settings,
  Plus,
  Sun,
  Moon,
  ShieldCheck,
  FileSpreadsheet,
  Stethoscope,
} from 'lucide-react';

interface HeaderProps {
  currentView: 'dashboard' | 'add-patient' | 'patient-detail' | 'team' | 'activity' | 'settings';
  onNavigate: (view: 'dashboard' | 'add-patient' | 'team' | 'activity' | 'settings') => void;
  onOpenBulkExport: () => void;
  patientCount: number;
  overdueCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenBulkExport,
  patientCount,
  overdueCount,
}) => {
  const { isDark, setMode, mode } = useTheme();
  const { user } = useAuth();

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-teal-700 dark:bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-900/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                  OrthoVault
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Clinical
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {patientCount} surgical record{patientCount === 1 ? '' : 's'}
                {overdueCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {' '}• {overdueCount} follow-up overdue
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={onOpenBulkExport}
              title="Operating List / Bulk PDF Export for Morning Rounds"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">Operating List</span>
            </button>

            <button
              onClick={() => onNavigate('team')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                currentView === 'team'
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden md:inline">Team</span>
            </button>

            <button
              onClick={() => onNavigate('activity')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                currentView === 'activity'
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span className="hidden md:inline">Activity</span>
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className={`p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                currentView === 'settings' ? 'bg-slate-100 dark:bg-slate-800 text-teal-600' : ''
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Add Patient Primary Action */}
            <button
              onClick={() => onNavigate('add-patient')}
              className="inline-flex items-center gap-1.5 ml-1 sm:ml-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Patient</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
