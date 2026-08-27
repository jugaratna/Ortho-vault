import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Share2,
  Printer,
  Sliders,
  Sparkles,
  Calendar,
  Phone,
  User,
  Activity,
  FileText,
  Video as VideoIcon,
  Image as ImageIcon,
  Copy,
  Check,
  Clock,
  Shield,
  UserPlus,
  X,
  ExternalLink,
  Download,
} from 'lucide-react';
import { Patient, MediaFile, Colleague, ShareEntry } from '../types';
import { api, fileUrl } from '../api/client';
import { CompareSliderModal } from './CompareSliderModal';
import { MediaViewerModal } from './MediaViewerModal';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updated: Patient) => void;
}

export const PatientDetail: React.FC<PatientDetailProps> = ({
  patient,
  onBack,
  onEdit,
  onDelete,
  onUpdate,
}) => {
  const { user } = useAuth();
  const { hospitalName } = useSettings();

  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'compare' | 'notes' | 'media' | 'sharing'>('info');
  const [copied, setCopied] = useState<string | null>(null);

  // Compare Slider Modal state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedPreIdx, setSelectedPreIdx] = useState(0);
  const [selectedPostIdx, setSelectedPostIdx] = useState(0);

  // Media Viewer Modal state
  const [activeMedia, setActiveMedia] = useState<MediaFile | null>(null);

  // Share Modal & Colleagues
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [selectedColleagueId, setSelectedColleagueId] = useState('');
  const [shareScope, setShareScope] = useState<'read' | 'edit'>('edit');
  const [sharingLoading, setSharingLoading] = useState(false);

  // AI draft discharge modal/inline
  const [draftingAi, setDraftingAi] = useState(false);

  useEffect(() => {
    api.listColleagues().then(setColleagues).catch(() => []);
  }, []);

  const preImages = patient.pre_op.filter((f) => f.kind === 'image');
  const postImages = patient.post_op.filter((f) => f.kind === 'image');
  const canCompare = preImages.length > 0 && postImages.length > 0;

  // Calculate follow-up status
  const getFollowupStatus = () => {
    if (!patient.date_of_surgery) return null;
    const surgeryDate = new Date(patient.date_of_surgery).getTime();
    const daysInterval = patient.followup_days || 14;
    const dueDate = surgeryDate + daysInterval * 86400000;
    const now = Date.now();
    const isOverdue = now > dueDate;
    const diffDays = Math.round(Math.abs(dueDate - now) / 86400000);

    return {
      dueDate: new Date(dueDate).toISOString().slice(0, 10),
      isOverdue,
      diffDays,
      daysInterval,
    };
  };

  const followupStatus = getFollowupStatus();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShareColleague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColleagueId) return;
    setSharingLoading(true);
    try {
      await api.sharePatient(patient.id, selectedColleagueId, shareScope);
      const updated = await api.getPatient(patient.id);
      onUpdate(updated);
      setSelectedColleagueId('');
      setShareModalOpen(false);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleUnshare = async (userId: string) => {
    try {
      await api.unsharePatient(patient.id, userId);
      const updated = await api.getPatient(patient.id);
      onUpdate(updated);
    } catch {}
  };

  const handleDraftDischarge = async () => {
    setDraftingAi(true);
    try {
      const draft = await api.draftDischarge({
        name: patient.name,
        age: patient.age,
        sex: patient.sex,
        diagnosis: patient.diagnosis,
        date_of_surgery: patient.date_of_surgery || null,
        operative_note: patient.operative_note,
        result: patient.result,
      });
      const updated = { ...patient, discharge_note: draft };
      const saved = await api.upsertPatient(updated);
      onUpdate(saved);
    } finally {
      setDraftingAi(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-150">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {patient.name}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {patient.age}y • {patient.sex}
              </span>
            </div>
            <p className="text-xs text-teal-800 dark:text-teal-400 font-semibold truncate max-w-lg mt-0.5">
              {patient.diagnosis || 'Orthopedic Record'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCompare && (
            <button
              onClick={() => setCompareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm transition"
            >
              <Sliders className="w-4 h-4" />
              <span>Compare Scans</span>
            </button>
          )}

          <button
            onClick={() => setShareModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Share2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">Share</span>
            {patient.shared_with && patient.shared_with.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 text-[10px] font-bold flex items-center justify-center">
                {patient.shared_with.length}
              </span>
            )}
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
            title="Print Record / Save PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Edit className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete patient record "${patient.name}"?`)) {
                onDelete(patient.id);
              }
            }}
            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
            title="Delete Record"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Follow-up banner if overdue or scheduled */}
      {followupStatus && (
        <div
          className={`mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            followupStatus.isOverdue
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
              : 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900 text-teal-900 dark:text-teal-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                followupStatus.isOverdue
                  ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
                  : 'bg-teal-200 dark:bg-teal-900 text-teal-900 dark:text-teal-200'
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm">
                {followupStatus.isOverdue
                  ? `Follow-up Check Overdue by ${followupStatus.diffDays} day${followupStatus.diffDays === 1 ? '' : 's'}`
                  : `Post-Operative Follow-up in ${followupStatus.diffDays} day${followupStatus.diffDays === 1 ? '' : 's'}`}
              </p>
              <p className="text-[11px] opacity-80">
                Scheduled for {followupStatus.dueDate} (POD {followupStatus.daysInterval}) • Suture removal & radiographic alignment check
              </p>
            </div>
          </div>

          {patient.mobile && (
            <a
              href={`tel:${patient.country_code}${patient.mobile}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm hover:bg-slate-100 transition self-start sm:self-center"
            >
              <Phone className="w-3.5 h-3.5 text-teal-600" />
              <span>Call Patient ({patient.country_code} {patient.mobile})</span>
            </a>
          )}
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto pb-1">
        {[
          { key: 'info', label: 'Summary & Info', icon: User },
          { key: 'history', label: 'Clinical History', icon: Activity },
          { key: 'compare', label: 'Scan Comparison', icon: Sliders, badge: canCompare ? 'Ready' : undefined },
          { key: 'notes', label: 'Operative & Discharge', icon: FileText },
          { key: 'media', label: `Media (${patient.pre_op.length + patient.post_op.length + patient.videos.length})`, icon: ImageIcon },
          { key: 'sharing', label: `Colleagues (${patient.shared_with?.length || 0})`, icon: Share2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap border-b-2 ${
                active
                  ? 'border-teal-600 text-teal-800 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Info / Demographics */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Details Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Patient Data
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Full Name</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{patient.name}</span>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-slate-500 block">Age</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.age} years</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sex</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.sex}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">Mobile</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {patient.mobile ? `${patient.country_code} ${patient.mobile}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Surgery Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {patient.date_of_surgery || 'Not scheduled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Radiograph Preview */}
            <div className="md:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Radiological Overview
                </h3>
                {canCompare && (
                  <button
                    onClick={() => setCompareModalOpen(true)}
                    className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Launch Comparison Curtain</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Pre-op Preview */}
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-video relative flex items-center justify-center group">
                  {preImages[0] ? (
                    <img
                      src={fileUrl(preImages[0].storage_path, preImages[0].dataUrl)}
                      alt="Pre-Op Radiograph"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setActiveMedia(preImages[0])}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <span className="text-[11px] text-slate-500">No Pre-Op Scan</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white rounded text-[10px] font-bold">
                    PRE-OP
                  </span>
                </div>

                {/* Post-op Preview */}
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-video relative flex items-center justify-center group">
                  {postImages[0] ? (
                    <img
                      src={fileUrl(postImages[0].storage_path, postImages[0].dataUrl)}
                      alt="Post-Op Radiograph"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setActiveMedia(postImages[0])}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <span className="text-[11px] text-slate-500">No Post-Op Scan</span>
                    </div>
                  )}
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-teal-600/90 text-white rounded text-[10px] font-bold">
                    POST-OP
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnosis & Outcome Summary banner */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Orthopedic Diagnosis
              </span>
              <p className="text-sm font-semibold text-teal-900 dark:text-teal-300">
                {patient.diagnosis || 'No formal diagnosis recorded.'}
              </p>
            </div>

            {patient.result && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Surgical Outcome & Alignment Result
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {patient.result}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Clinical History */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 mb-2">
              Diagnosis & ICD-10 Classification
            </h3>
            <p className="text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              {patient.diagnosis || 'Diagnosis not specified.'}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 mb-2">
              Chief Complaint & History of Presenting Illness
            </h3>
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
              {patient.history || 'No clinical history documented.'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Interactive Split Curtain Comparison */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          {!canCompare ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Sliders className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                Comparison Requires Both Pre-Op and Post-Op Images
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                Please upload at least one pre-operative radiograph and one post-operative radiograph to compare implant alignment and joint restoration.
              </p>
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
              >
                Upload Scans in Edit Mode
              </button>
            </div>
          ) : (
            <div className="bg-neutral-950 p-6 rounded-2xl border border-neutral-800 shadow-2xl text-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-teal-400" />
                    <span>Radiological Split Curtain Comparison</span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Compare Pre-op pathology with Post-op joint restoration & implant positioning
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {/* Select Pre-op scan */}
                  {preImages.length > 1 && (
                    <select
                      value={selectedPreIdx}
                      onChange={(e) => setSelectedPreIdx(Number(e.target.value))}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 rounded-lg"
                    >
                      {preImages.map((img, i) => (
                        <option key={img.id} value={i}>
                          Pre-Op: {img.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Select Post-op scan */}
                  {postImages.length > 1 && (
                    <select
                      value={selectedPostIdx}
                      onChange={(e) => setSelectedPostIdx(Number(e.target.value))}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 rounded-lg"
                    >
                      {postImages.map((img, i) => (
                        <option key={img.id} value={i}>
                          Post-Op: {img.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={() => setCompareModalOpen(true)}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition"
                  >
                    Open Lightbox Fullscreen
                  </button>
                </div>
              </div>

              {/* Inline Comparison preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="relative rounded-xl overflow-hidden bg-black border border-neutral-800 aspect-video flex items-center justify-center">
                  <img
                    src={fileUrl(preImages[selectedPreIdx]?.storage_path, preImages[selectedPreIdx]?.dataUrl)}
                    alt="Pre-Op"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() => setCompareModalOpen(true)}
                  />
                  <span className="absolute top-3 left-3 bg-slate-800 text-white px-2.5 py-0.5 rounded text-xs font-bold">
                    PRE-OP
                  </span>
                </div>

                <div className="relative rounded-xl overflow-hidden bg-black border border-neutral-800 aspect-video flex items-center justify-center">
                  <img
                    src={fileUrl(postImages[selectedPostIdx]?.storage_path, postImages[selectedPostIdx]?.dataUrl)}
                    alt="Post-Op"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() => setCompareModalOpen(true)}
                  />
                  <span className="absolute top-3 right-3 bg-teal-600 text-white px-2.5 py-0.5 rounded text-xs font-bold">
                    POST-OP
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Operative & Discharge Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          {/* Operative Note */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Operative Surgery Note</span>
              </h3>
              <button
                onClick={() => copyToClipboard(patient.operative_note, 'op_note')}
                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                {copied === 'op_note' ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'op_note' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed max-h-96 overflow-y-auto">
              {patient.operative_note || 'No operative note documented.'}
            </pre>
          </div>

          {/* Discharge Summary */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Discharge Summary & Medications</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDraftDischarge}
                  disabled={draftingAi}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${draftingAi ? 'animate-spin' : ''}`} />
                  <span>{draftingAi ? 'Drafting...' : 'Regenerate with AI'}</span>
                </button>

                <button
                  onClick={() => copyToClipboard(patient.discharge_note, 'dc_note')}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {copied === 'dc_note' ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'dc_note' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed max-h-96 overflow-y-auto">
              {patient.discharge_note || 'No discharge note documented. Click "Regenerate with AI" to create one automatically.'}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 5: Media Gallery (Pre-op, Post-op, Videos) */}
      {activeTab === 'media' && (
        <div className="space-y-6">
          {/* Pre-Op Gallery */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Pre-Operative Scans ({patient.pre_op.length})</span>
            </h3>

            {patient.pre_op.length === 0 ? (
              <p className="text-xs text-slate-400">No pre-op scans uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {patient.pre_op.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setActiveMedia(f)}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-video flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-teal-500 transition shadow-sm"
                  >
                    {f.kind === 'image' ? (
                      <img src={fileUrl(f.storage_path, f.dataUrl)} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-8 h-8 text-teal-400" />
                    )}
                    <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/70 px-1 py-0.5 rounded truncate">
                      {f.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Post-Op Gallery */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Post-Operative Scans ({patient.post_op.length})</span>
            </h3>

            {patient.post_op.length === 0 ? (
              <p className="text-xs text-slate-400">No post-op scans uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {patient.post_op.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setActiveMedia(f)}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-video flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-teal-500 transition shadow-sm"
                  >
                    {f.kind === 'image' ? (
                      <img src={fileUrl(f.storage_path, f.dataUrl)} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-8 h-8 text-teal-400" />
                    )}
                    <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/70 px-1 py-0.5 rounded truncate">
                      {f.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos Gallery */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Surgical & Gait Clinical Videos ({patient.videos.length})</span>
            </h3>

            {patient.videos.length === 0 ? (
              <p className="text-xs text-slate-400">No videos uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {patient.videos.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setActiveMedia(v)}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 aspect-video flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-teal-500 transition shadow-sm"
                  >
                    <VideoIcon className="w-10 h-10 text-teal-400" />
                    <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/70 px-1 py-0.5 rounded truncate">
                      {v.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Colleague Sharing & Audit */}
      {activeTab === 'sharing' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Shared Colleague Access
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Allow attending orthopedic colleagues or fellows to view or edit this patient file
                </p>
              </div>

              <button
                onClick={() => setShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Share with Doctor</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(!patient.shared_with || patient.shared_with.length === 0) ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  This patient record is currently private to your account.
                </p>
              ) : (
                patient.shared_with.map((s) => (
                  <div key={s.user_id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs text-slate-900 dark:text-white">{s.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {s.email} • Scope: <strong className="capitalize">{s.scope} Access</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => handleUnshare(s.user_id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-xs font-medium"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Modals */}
      {compareModalOpen && canCompare && (
        <CompareSliderModal
          isOpen={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          preOpUrl={preImages[selectedPreIdx]?.storage_path || preImages[0].storage_path}
          postOpUrl={postImages[selectedPostIdx]?.storage_path || postImages[0].storage_path}
          preOpTitle={`Pre-Op: ${preImages[selectedPreIdx]?.name || preImages[0].name}`}
          postOpTitle={`Post-Op: ${postImages[selectedPostIdx]?.name || postImages[0].name}`}
          patientName={patient.name}
        />
      )}

      {activeMedia && (
        <MediaViewerModal
          media={activeMedia}
          onClose={() => setActiveMedia(null)}
        />
      )}

      {/* Share with Colleague Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Share Patient Record
              </h3>
              <button
                onClick={() => setShareModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShareColleague} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Colleague
                </label>
                <select
                  required
                  value={selectedColleagueId}
                  onChange={(e) => setSelectedColleagueId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="">-- Choose Colleague --</option>
                  {colleagues.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Permission Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShareScope('read')}
                    className={`py-2 text-xs font-semibold rounded-lg border ${
                      shareScope === 'read'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Read Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareScope('edit')}
                    className={`py-2 text-xs font-semibold rounded-lg border ${
                      shareScope === 'edit'
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Can Edit & Upload
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sharingLoading || !selectedColleagueId}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {sharingLoading ? 'Sharing...' : 'Confirm Share'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
