import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Bookmark, FileText } from 'lucide-react';
import { Template, TplTarget, TEMPLATES } from '../data/templates';

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (body: string, target: TplTarget) => void;
}

export const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [customList, setCustomList] = useState<Template[]>(() => {
    const saved = localStorage.getItem('orthovault_custom_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'builtin' | 'custom'>('builtin');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState<TplTarget>('operative_note');
  const [body, setBody] = useState('');

  if (!isOpen) return null;

  const saveCustom = () => {
    if (!label.trim() || !body.trim()) return;
    const newTpl: Template = {
      id: editingId || `tpl_${Date.now()}`,
      label: label.trim(),
      target,
      body: body.trim(),
      builtin: false,
    };

    let updated: Template[];
    if (editingId) {
      updated = customList.map((t) => (t.id === editingId ? newTpl : t));
    } else {
      updated = [newTpl, ...customList];
    }
    setCustomList(updated);
    localStorage.setItem('orthovault_custom_templates', JSON.stringify(updated));
    resetForm();
  };

  const deleteCustom = (id: string) => {
    const updated = customList.filter((t) => t.id !== id);
    setCustomList(updated);
    localStorage.setItem('orthovault_custom_templates', JSON.stringify(updated));
    if (editingId === id) resetForm();
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setLabel(t.label);
    setTarget(t.target || 'operative_note');
    setBody(t.body);
    setActiveTab('custom');
  };

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setTarget('operative_note');
    setBody('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Surgical & Clinical Note Templates
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pre-formatted operative notes, arthroscopy findings, and discharge summaries
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

        {/* Tab switcher */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('builtin')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeTab === 'builtin'
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Standard Templates ({TEMPLATES.length})
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeTab === 'custom'
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Custom Templates ({customList.length})
            </button>
          </div>

          {activeTab === 'custom' && !editingId && (
            <button
              onClick={() => {
                resetForm();
                setEditingId('new');
              }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Template</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          {activeTab === 'custom' && editingId ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingId === 'new' ? 'Create New Template' : 'Edit Custom Template'}
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Title
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Spine Lumbar Fusion / Shoulder Bankart Repair"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Inserts Into
                </label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as TplTarget)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="operative_note">Operative Note</option>
                  <option value="discharge_note">Discharge Note</option>
                  <option value="result">Outcome / Result</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Content
                </label>
                <textarea
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type or paste standard operative steps, implant specs, findings..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-xs rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCustom}
                  className="px-4 py-2 text-xs rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-sm"
                >
                  Save Template
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(activeTab === 'builtin' ? TEMPLATES : customList).map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{t.label}</h4>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {t.target?.replace('_', ' ')}
                      </span>
                    </div>
                    <pre className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-6 font-mono whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 mb-4">
                      {t.body}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      {!t.builtin && (
                        <>
                          <button
                            onClick={() => startEdit(t)}
                            className="text-xs text-teal-700 dark:text-teal-400 hover:underline font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCustom(t.id)}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    {onSelectTemplate && (
                      <button
                        onClick={() => {
                          onSelectTemplate(t.body, t.target || 'operative_note');
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Insert Note</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
