import React, { useState, useEffect, useCallback } from 'react';
import { Patient } from './types';
import { api } from './api/client';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PatientForm } from './components/PatientForm';
import { PatientDetail } from './components/PatientDetail';
import { TeamManagement } from './components/TeamManagement';
import { ActivityLogView } from './components/ActivityLogView';
import { SettingsView } from './components/SettingsView';
import { BulkExportModal } from './components/BulkExportModal';
import { Loader2 } from 'lucide-react';

type ViewMode = 'dashboard' | 'add-patient' | 'edit-patient' | 'patient-detail' | 'team' | 'activity' | 'settings';

export function OrthoVaultApp() {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkExportOpen, setBulkExportOpen] = useState(false);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listPatients();
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patient records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handlePatientSaved = (saved: Patient) => {
    setPatients((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setSelectedPatient(saved);
    setCurrentView('patient-detail');
  };

  const handleDeletePatient = async (id: string) => {
    try {
      await api.deletePatient(id);
      setPatients((prev) => prev.filter((p) => p.id !== id));
      setSelectedPatient(null);
      setCurrentView('dashboard');
    } catch (err) {
      console.error('Failed to delete patient:', err);
    }
  };

  const handleUpdatePatient = (updated: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedPatient(updated);
  };

  // Overdue count calculation for header banner
  const overdueCount = patients.filter((p) => {
    if (!p.date_of_surgery) return false;
    const surgeryTime = new Date(p.date_of_surgery).getTime();
    const interval = p.followup_days || 14;
    return Date.now() > surgeryTime + interval * 86400000;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Header
        currentView={currentView === 'edit-patient' ? 'add-patient' : currentView}
        onNavigate={(view) => {
          if (view === 'dashboard') setSelectedPatient(null);
          setCurrentView(view);
        }}
        onOpenBulkExport={() => setBulkExportOpen(true)}
        patientCount={patients.length}
        overdueCount={overdueCount}
      />

      <main className="flex-1 pb-16">
        {loading && patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium tracking-wide">
              Loading OrthoVault Surgical Records...
            </p>
          </div>
        ) : currentView === 'dashboard' ? (
          <Dashboard
            patients={patients}
            onSelectPatient={(p) => {
              setSelectedPatient(p);
              setCurrentView('patient-detail');
            }}
            onAddPatient={() => {
              setSelectedPatient(null);
              setCurrentView('add-patient');
            }}
            onOpenBulkExport={() => setBulkExportOpen(true)}
          />
        ) : currentView === 'add-patient' ? (
          <PatientForm
            initialData={null}
            onSave={handlePatientSaved}
            onCancel={() => setCurrentView('dashboard')}
          />
        ) : currentView === 'edit-patient' && selectedPatient ? (
          <PatientForm
            initialData={selectedPatient}
            onSave={handlePatientSaved}
            onCancel={() => setCurrentView('patient-detail')}
          />
        ) : currentView === 'patient-detail' && selectedPatient ? (
          <PatientDetail
            patient={selectedPatient}
            onBack={() => {
              setSelectedPatient(null);
              setCurrentView('dashboard');
            }}
            onEdit={() => setCurrentView('edit-patient')}
            onDelete={handleDeletePatient}
            onUpdate={handleUpdatePatient}
          />
        ) : currentView === 'team' ? (
          <TeamManagement />
        ) : currentView === 'activity' ? (
          <ActivityLogView />
        ) : currentView === 'settings' ? (
          <SettingsView />
        ) : null}
      </main>

      <BulkExportModal
        isOpen={bulkExportOpen}
        onClose={() => setBulkExportOpen(false)}
        patients={patients}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <OrthoVaultApp />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
