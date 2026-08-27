import React, { useState } from 'react';
import { X, Printer, Download, CheckSquare, Square, FileText } from 'lucide-react';
import { Patient } from '../types';
import { useSettings } from '../context/SettingsContext';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
}

export const BulkExportModal: React.FC<BulkExportModalProps> = ({ isOpen, onClose, patients }) => {
  const { hospitalName } = useSettings();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => patients.map((p) => p.id));
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.length === patients.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(patients.map((p) => p.id));
    }
  };

  const togglePatient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedPatients = patients.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Operating Theater / Ward Morning Rounds List
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate formatted printable operative summary for daily clinical rounds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Toolbar (no-print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400 hover:underline"
            >
              {selectedIds.length === patients.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>
                {selectedIds.length === patients.length ? 'Deselect All' : 'Select All'} ({selectedIds.length}/{patients.length})
              </span>
            </button>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span>Include Operative Details & Implants</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs shadow-sm transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>

        {/* Printable List / Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 font-sans">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 printable-content">
            {/* Header for print */}
            <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    {hospitalName}
                  </h1>
                  <h2 className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                    DEPARTMENT OF ORTHOPEDICS & JOINT RECONSTRUCTION
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    SURGICAL WARD ROUNDS & OPERATING ROSTER
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600 dark:text-slate-400">
                  <p>Date: <strong>{new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</strong></p>
                  <p>Total Patients: <strong>{selectedPatients.length}</strong></p>
                </div>
              </div>
            </div>

            {selectedPatients.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No patients selected for the print roster.
              </div>
            ) : (
              <div className="space-y-6">
                {selectedPatients.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 break-inside-avoid relative"
                  >
                    <div className="no-print absolute top-3 right-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => togglePatient(p.id)}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-2 mb-1">
                          <span className="font-bold text-slate-900 dark:text-white text-base">
                            {p.name}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                            ({p.age}y / {p.sex})
                          </span>
                          {p.mobile && (
                            <span className="text-xs text-slate-400">
                              • Ph: {p.country_code} {p.mobile}
                            </span>
                          )}
                          {p.date_of_surgery && (
                            <span className="text-xs px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-medium ml-auto">
                              Surgery: {p.date_of_surgery}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-teal-900 dark:text-teal-300 mb-1">
                          Dx: {p.diagnosis || 'Diagnosis pending'}
                        </p>

                        {p.history && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                            <strong>History:</strong> {p.history}
                          </p>
                        )}

                        {includeNotes && p.operative_note && (
                          <div className="mt-2 text-xs bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {p.operative_note}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer Signature on Print */}
            <div className="mt-12 pt-6 border-t border-slate-300 dark:border-slate-700 flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <div>
                <p>Prepared by: Ortho Resident / Staff</p>
                <p className="mt-4">_______________________</p>
              </div>
              <div className="text-right">
                <p>Attending Orthopedic Surgeon</p>
                <p className="mt-4">_______________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
