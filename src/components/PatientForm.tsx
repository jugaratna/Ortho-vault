import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Bookmark,
  Upload,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Search,
  Check,
  AlertCircle,
  Calendar,
  Phone,
  User,
  Activity,
} from 'lucide-react';
import { Patient, MediaFile, Sex } from '../types';
import { api } from '../api/client';
import { ICD10_ORTHO, searchIcd, IcdCode } from '../data/icd10';
import { TemplateEditorModal } from './TemplateEditorModal';
import { TplTarget } from '../data/templates';
import { useSettings } from '../context/SettingsContext';

interface PatientFormProps {
  initialData?: Patient | null;
  onSave: (p: Patient) => void;
  onCancel: () => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({ initialData, onSave, onCancel }) => {
  const { followupDays: defaultFollowupDays } = useSettings();

  const [name, setName] = useState(initialData?.name || '');
  const [age, setAge] = useState<string>(initialData ? String(initialData.age) : '');
  const [sex, setSex] = useState<Sex>(initialData?.sex || 'Male');
  const [mobile, setMobile] = useState(initialData?.mobile || '');
  const [countryCode, setCountryCode] = useState(initialData?.country_code || '+91');
  const [diagnosis, setDiagnosis] = useState(initialData?.diagnosis || '');
  const [history, setHistory] = useState(initialData?.history || '');
  const [dateOfSurgery, setDateOfSurgery] = useState(initialData?.date_of_surgery || new Date().toISOString().slice(0, 10));
  const [followupDays, setFollowupDays] = useState<number>(initialData?.followup_days ?? defaultFollowupDays);
  const [operativeNote, setOperativeNote] = useState(initialData?.operative_note || '');
  const [dischargeNote, setDischargeNote] = useState(initialData?.discharge_note || '');
  const [result, setResult] = useState(initialData?.result || '');

  const [preOpFiles, setPreOpFiles] = useState<MediaFile[]>(initialData?.pre_op || []);
  const [postOpFiles, setPostOpFiles] = useState<MediaFile[]>(initialData?.post_op || []);
  const [videoFiles, setVideoFiles] = useState<MediaFile[]>(initialData?.videos || []);

  const [icdQuery, setIcdQuery] = useState('');
  const [icdResults, setIcdResults] = useState<IcdCode[]>([]);
  const [showIcdDropdown, setShowIcdDropdown] = useState(false);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [draftingAi, setDraftingAi] = useState(false);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const preOpInputRef = useRef<HTMLInputElement>(null);
  const postOpInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleIcdSearch = (q: string) => {
    setIcdQuery(q);
    if (q.trim().length >= 1) {
      setIcdResults(searchIcd(q));
      setShowIcdDropdown(true);
    } else {
      setIcdResults([]);
      setShowIcdDropdown(false);
    }
  };

  const selectIcd = (item: IcdCode) => {
    setDiagnosis(`${item.code} - ${item.label}`);
    setIcdQuery('');
    setShowIcdDropdown(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, section: 'pre_op' | 'post_op' | 'video') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingSection(section);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await api.uploadFile(file);
        const mediaObj: MediaFile = {
          id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: res.name,
          kind: res.kind,
          mime: res.mime,
          size: res.size,
          storage_path: res.storage_path,
          section,
          uploaded_at: new Date().toISOString(),
          dataUrl: res.dataUrl,
        };

        if (section === 'pre_op') {
          setPreOpFiles((prev) => [...prev, mediaObj]);
        } else if (section === 'post_op') {
          setPostOpFiles((prev) => [...prev, mediaObj]);
        } else {
          setVideoFiles((prev) => [...prev, mediaObj]);
        }
      }
    } catch (err: any) {
      setError('File upload failed: ' + (err?.message || 'Network error'));
    } finally {
      setUploadingSection(null);
      e.target.value = '';
    }
  };

  const removeFile = (id: string, section: 'pre_op' | 'post_op' | 'video') => {
    if (section === 'pre_op') setPreOpFiles((prev) => prev.filter((f) => f.id !== id));
    if (section === 'post_op') setPostOpFiles((prev) => prev.filter((f) => f.id !== id));
    if (section === 'video') setVideoFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDraftDischargeWithAi = async () => {
    if (!operativeNote && !diagnosis) {
      setError('Please fill in the Operative Note or Diagnosis first to generate an AI Discharge Summary.');
      return;
    }
    setDraftingAi(true);
    setError('');
    try {
      const draft = await api.draftDischarge({
        name,
        age: Number(age) || 0,
        sex,
        diagnosis,
        date_of_surgery: dateOfSurgery,
        operative_note: operativeNote,
        result,
      });
      setDischargeNote(draft);
    } catch (err: any) {
      setError('AI generation failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setDraftingAi(false);
    }
  };

  const handleInsertTemplate = (templateBody: string, target: TplTarget) => {
    if (target === 'discharge_note') {
      setDischargeNote((prev) => (prev ? `${prev}\n\n${templateBody}` : templateBody));
    } else if (target === 'result') {
      setResult((prev) => (prev ? `${prev}\n\n${templateBody}` : templateBody));
    } else {
      setOperativeNote((prev) => (prev ? `${prev}\n\n${templateBody}` : templateBody));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Patient name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload: Partial<Patient> = {
        id: initialData?.id,
        name: name.trim(),
        age: Number(age) || 0,
        sex,
        mobile: mobile.trim(),
        country_code: countryCode,
        diagnosis: diagnosis.trim(),
        history: history.trim(),
        date_of_surgery: dateOfSurgery || null,
        followup_days: Number(followupDays) || 14,
        operative_note: operativeNote,
        discharge_note: dischargeNote,
        result,
        pre_op: preOpFiles,
        post_op: postOpFiles,
        videos: videoFiles,
      };

      const saved = await api.upsertPatient(payload);
      onSave(saved);
    } catch (err: any) {
      setError('Failed to save patient: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {initialData ? 'Edit Surgical Record' : 'New Patient Record'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              HIPAA mindful orthopedic surgery admission and radiological tracking
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? 'Saving...' : 'Save Patient'}</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Demographics */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>1. Patient Demographics</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Age (Years)
              </label>
              <input
                type="number"
                min="0"
                max="125"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="62"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sex
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['Male', 'Female', 'Other'] as Sex[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition ${
                      sex === s
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Mobile Number
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="+91">+91 (IN)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+61">+61 (AU)</option>
                  <option value="+971">+971 (UAE)</option>
                </select>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9845012345"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date of Surgery
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateOfSurgery}
                  onChange={(e) => setDateOfSurgery(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDateOfSurgery(new Date().toISOString().slice(0, 10))}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  Today
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Clinical Diagnosis & History */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>2. Orthopedic Diagnosis (ICD-10) & Clinical History</span>
          </h2>

          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Diagnosis & ICD-10 Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. M17.11 - Osteoarthritis of Right Knee (Kellgren-Lawrence IV)"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              />
            </div>

            {/* ICD Quick Search helper */}
            <div className="mt-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={icdQuery}
                  onChange={(e) => handleIcdSearch(e.target.value)}
                  onFocus={() => {
                    if (!icdQuery) setIcdResults(ICD10_ORTHO.slice(0, 6));
                    setShowIcdDropdown(true);
                  }}
                  placeholder="Search ICD-10 orthopedic database (e.g. ACL, knee OA, Colles fracture, rotator cuff)..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {showIcdDropdown && icdResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {icdResults.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => selectIcd(item)}
                      className="w-full px-4 py-2 text-left text-xs hover:bg-teal-50 dark:hover:bg-teal-950/60 flex items-center justify-between group transition"
                    >
                      <div>
                        <span className="font-bold text-teal-800 dark:text-teal-400 mr-2">
                          {item.code}
                        </span>
                        <span className="text-slate-800 dark:text-slate-200">{item.label}</span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-teal-600 opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chief Complaint & History of Presenting Illness
            </label>
            <textarea
              rows={3}
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              placeholder="Mechanism of injury, symptom duration, previous conservative treatments, pain score..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 3: Operative Note */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>3. Surgical Operative Note</span>
            </h2>

            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-xs font-semibold hover:bg-teal-100 transition"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Insert Surgical Template</span>
            </button>
          </div>

          <textarea
            rows={8}
            value={operativeNote}
            onChange={(e) => setOperativeNote(e.target.value)}
            placeholder="Procedure name, surgical approach, intra-op findings, implant details (size/lot numbers), stability checks, tourniquet time, blood loss..."
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Section 4: AI Discharge Note Generator & Outcome */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>4. Discharge Summary & AI Generator</span>
            </h2>

            <button
              type="button"
              onClick={handleDraftDischargeWithAi}
              disabled={draftingAi}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${draftingAi ? 'animate-spin' : ''}`} />
              <span>{draftingAi ? 'Drafting Summary...' : 'Auto-Draft with Gemini AI'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automatically synthesize post-op mobility protocol, wound care, analgesia medications, and follow-up timeline from the operative note.
          </p>

          <textarea
            rows={8}
            value={dischargeNote}
            onChange={(e) => setDischargeNote(e.target.value)}
            placeholder="Discharge summary, range of motion, weight bearing guidelines, discharge medications..."
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Final Surgical Outcome / Examination Result
            </label>
            <input
              type="text"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="e.g. Deformity fully corrected, anatomical mechanical axis restored, stable joint."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 5: Media Uploads (Pre-Op, Post-Op, Video) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            <span>5. Clinical Radiographs, Scans & Surgical Videos</span>
          </h2>

          {/* Pre-Op Radiographs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Pre-Operative Radiographs / MRI / CT Scans ({preOpFiles.length})
              </label>
              <button
                type="button"
                onClick={() => preOpInputRef.current?.click()}
                disabled={uploadingSection === 'pre_op'}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Pre-Op Scans</span>
              </button>
              <input
                ref={preOpInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.dcm"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'pre_op')}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {preOpFiles.map((f) => (
                <div
                  key={f.id}
                  className="relative group rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-950 aspect-video flex items-center justify-center shadow-sm"
                >
                  {f.kind === 'image' ? (
                    <img src={f.dataUrl || f.storage_path} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-8 h-8 text-slate-400" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <button
                      type="button"
                      onClick={() => removeFile(f.id, 'pre_op')}
                      className="p-1.5 rounded-lg bg-rose-600 text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/70 px-1 py-0.5 rounded truncate">
                    {f.name}
                  </span>
                </div>
              ))}
              {preOpFiles.length === 0 && (
                <div
                  onClick={() => preOpInputRef.current?.click()}
                  className="col-span-2 sm:col-span-4 p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center cursor-pointer hover:border-teal-500 transition"
                >
                  <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Click to upload Pre-Op X-rays (AP/Lateral, MRI)</p>
                </div>
              )}
            </div>
          </div>

          {/* Post-Op Radiographs */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Post-Operative Radiographs / Implant Checks ({postOpFiles.length})
              </label>
              <button
                type="button"
                onClick={() => postOpInputRef.current?.click()}
                disabled={uploadingSection === 'post_op'}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Post-Op Scans</span>
              </button>
              <input
                ref={postOpInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.dcm"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'post_op')}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {postOpFiles.map((f) => (
                <div
                  key={f.id}
                  className="relative group rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-950 aspect-video flex items-center justify-center shadow-sm"
                >
                  {f.kind === 'image' ? (
                    <img src={f.dataUrl || f.storage_path} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-8 h-8 text-slate-400" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <button
                      type="button"
                      onClick={() => removeFile(f.id, 'post_op')}
                      className="p-1.5 rounded-lg bg-rose-600 text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/70 px-1 py-0.5 rounded truncate">
                    {f.name}
                  </span>
                </div>
              ))}
              {postOpFiles.length === 0 && (
                <div
                  onClick={() => postOpInputRef.current?.click()}
                  className="col-span-2 sm:col-span-4 p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center cursor-pointer hover:border-teal-500 transition"
                >
                  <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Click to upload Post-Op Check X-rays (Enables Compare Slider)</p>
                </div>
              )}
            </div>
          </div>

          {/* Videos */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Surgical & Clinical Videos (Gait Analysis, ROM, Arthroscopy Clips) ({videoFiles.length})
              </label>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingSection === 'video'}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Video</span>
              </button>
              <input
                ref={videoInputRef}
                type="file"
                multiple
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'video')}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {videoFiles.map((f) => (
                <div
                  key={f.id}
                  className="relative group rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-900 aspect-video flex items-center justify-center shadow-sm text-white"
                >
                  <VideoIcon className="w-8 h-8 text-teal-400" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <button
                      type="button"
                      onClick={() => removeFile(f.id, 'video')}
                      className="p-1.5 rounded-lg bg-rose-600 text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/70 px-1 py-0.5 rounded truncate">
                    {f.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer save actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Saving...' : 'Save Patient Record'}</span>
          </button>
        </div>
      </form>

      <TemplateEditorModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelectTemplate={handleInsertTemplate}
      />
    </div>
  );
};
