import React, { useState } from 'react';
import { Settings, Sun, Moon, Monitor, Building2, Calendar, Shield, User, Check, Bookmark } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSettings, FollowupDays } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { TemplateEditorModal } from './TemplateEditorModal';

export const SettingsView: React.FC = () => {
  const { mode, setMode } = useTheme();
  const { followupDays, setFollowupDays, hospitalName, setHospitalName } = useSettings();
  const { user, switchRole } = useAuth();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [hospInput, setHospInput] = useState(hospitalName);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const saveHospital = (e: React.FormEvent) => {
    e.preventDefault();
    setHospitalName(hospInput);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-150 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-700 dark:text-teal-400" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Clinical Preferences & Settings
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize display theme, hospital header details, follow-up alarms, and operative templates
        </p>
      </div>

      {/* User Profile Card */}
      {user && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-14 h-14 rounded-full object-cover border-2 border-teal-500" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xl">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">{user.name}</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 uppercase tracking-wide">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Simulate Active Role:
            </span>
            <div className="flex gap-1.5">
              {(['admin', 'editor', 'viewer'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition ${
                    user.role === r
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Appearance */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Sun className="w-4 h-4 text-teal-600" />
          <span>Interface Appearance</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Select dark mode for high-contrast viewing of DICOM and X-ray images in operating theaters
        </p>

        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'light', label: 'Light', icon: Sun },
            { key: 'dark', label: 'Dark (Theater)', icon: Moon },
            { key: 'system', label: 'System Auto', icon: Monitor },
          ].map((item) => {
            const Icon = item.icon;
            const active = mode === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setMode(item.key as any)}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition ${
                  active
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-500'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hospital & Department Setup */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          <span>Hospital & Clinical Center Header</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Appears on all printed operative registers, discharge summaries, and round sheets
        </p>

        <form onSubmit={saveHospital} className="flex gap-2">
          <input
            type="text"
            value={hospInput}
            onChange={(e) => setHospInput(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            {savedFeedback ? 'Saved!' : 'Save'}
          </button>
        </form>
      </div>

      {/* Follow-up Alarm Preference */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-600" />
          <span>Default Post-Op Follow-up Interval</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Number of days post-surgery before the dashboard highlights the patient as needing checkup / suture removal
        </p>

        <div className="flex flex-wrap gap-2">
          {([7, 10, 14, 21, 30, 45, 60] as FollowupDays[]).map((days) => (
            <button
              key={days}
              onClick={() => setFollowupDays(days)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                followupDays === days
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {days} Days {days === 14 ? '(Standard POD 14)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Manager Button */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-teal-600" />
            <span>Surgical Note Templates</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure arthroscopy findings, joint replacement notes, and trauma summaries
          </p>
        </div>

        <button
          onClick={() => setTemplateModalOpen(true)}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-semibold transition"
        >
          Manage Templates
        </button>
      </div>

      <TemplateEditorModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
      />
    </div>
  );
};
