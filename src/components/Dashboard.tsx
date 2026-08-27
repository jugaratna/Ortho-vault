import React, { useState, useMemo } from 'react';
import {
  Search,
  Sliders,
  Calendar,
  Phone,
  User,
  Activity,
  Plus,
  Clock,
  ArrowUpDown,
  Filter,
  LayoutGrid,
  List,
  ChevronRight,
  Share2,
  Video as VideoIcon,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Patient, Sex } from '../types';
import { fileUrl } from '../api/client';
import { CompareSliderModal } from './CompareSliderModal';

interface DashboardProps {
  patients: Patient[];
  onSelectPatient: (p: Patient) => void;
  onAddPatient: () => void;
  onOpenBulkExport: () => void;
}

type SortOption =
  | 'updated_desc'
  | 'surgery_desc'
  | 'surgery_asc'
  | 'name_asc'
  | 'name_desc'
  | 'age_asc'
  | 'age_desc'
  | 'pre_op_count'
  | 'post_op_count';

export const Dashboard: React.FC<DashboardProps> = ({
  patients,
  onSelectPatient,
  onAddPatient,
  onOpenBulkExport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [filterSex, setFilterSex] = useState<Sex | 'All'>('All');
  const [filterWithVideo, setFilterWithVideo] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('updated_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Fast quick comparator trigger from card
  const [compareTarget, setCompareTarget] = useState<Patient | null>(null);

  // Helper to check follow-up overdue
  const isPatientOverdue = (p: Patient): boolean => {
    if (!p.date_of_surgery) return false;
    const surgeryTime = new Date(p.date_of_surgery).getTime();
    const interval = p.followup_days || 14;
    const dueTime = surgeryTime + interval * 86400000;
    return Date.now() > dueTime;
  };

  // Stats calculation
  const totalCount = patients.length;
  const overdueCount = patients.filter(isPatientOverdue).length;
  const withVideoCount = patients.filter((p) => p.videos && p.videos.length > 0).length;
  const totalScans = patients.reduce(
    (acc, p) => acc + (p.pre_op?.length || 0) + (p.post_op?.length || 0),
    0
  );

  // Filter and Sort patients
  const filteredPatients = useMemo(() => {
    return patients
      .filter((p) => {
        if (filterOverdueOnly && !isPatientOverdue(p)) return false;
        if (filterSex !== 'All' && p.sex !== filterSex) return false;
        if (filterWithVideo && (!p.videos || p.videos.length === 0)) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchDx = p.diagnosis.toLowerCase().includes(q);
          const matchPhone = (p.mobile || '').includes(q);
          const matchHistory = (p.history || '').toLowerCase().includes(q);
          const matchOp = (p.operative_note || '').toLowerCase().includes(q);
          if (!matchName && !matchDx && !matchPhone && !matchHistory && !matchOp) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'surgery_desc':
            return (
              new Date(b.date_of_surgery || 0).getTime() -
              new Date(a.date_of_surgery || 0).getTime()
            );
          case 'surgery_asc':
            return (
              new Date(a.date_of_surgery || '2099-01-01').getTime() -
              new Date(b.date_of_surgery || '2099-01-01').getTime()
            );
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'name_desc':
            return b.name.localeCompare(a.name);
          case 'age_asc':
            return (a.age || 0) - (b.age || 0);
          case 'age_desc':
            return (b.age || 0) - (a.age || 0);
          case 'pre_op_count':
            return (b.pre_op?.length || 0) - (a.pre_op?.length || 0);
          case 'post_op_count':
            return (b.post_op?.length || 0) - (a.post_op?.length || 0);
          case 'updated_desc':
          default:
            return (
              new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
            );
        }
      });
  }, [patients, searchQuery, filterOverdueOnly, filterSex, filterWithVideo, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Clinical Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Surgical Records</span>
            <Activity className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</p>
          <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
            Active department roster
          </span>
        </div>

        <div
          onClick={() => setFilterOverdueOnly((v) => !v)}
          className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition ${
            filterOverdueOnly
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 ring-2 ring-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Follow-up Overdue</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{overdueCount}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {filterOverdueOnly ? 'Filtering Active' : 'Click to filter overdue'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Radiographs</span>
            <ImageIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{totalScans}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Pre-op & Post-op scans</span>
        </div>

        <div
          onClick={() => setFilterWithVideo((v) => !v)}
          className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition ${
            filterWithVideo
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/50 ring-2 ring-teal-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Surgical Videos</span>
            <VideoIcon className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{withVideoCount}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">ROM & Arthroscopy clips</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ICD-10 code, diagnosis, surgery notes..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort & Layout toggle */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="updated_desc">Recently Modified</option>
                <option value="surgery_desc">Surgery Date (Newest)</option>
                <option value="surgery_asc">Surgery Date (Oldest)</option>
                <option value="name_asc">Patient Name (A-Z)</option>
                <option value="name_desc">Patient Name (Z-A)</option>
                <option value="age_asc">Age (Youngest first)</option>
                <option value="age_desc">Age (Eldest first)</option>
                <option value="pre_op_count">Most Pre-Op Scans</option>
                <option value="post_op_count">Most Post-Op Scans</option>
              </select>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          <button
            onClick={() => {
              setFilterOverdueOnly(false);
              setFilterSex('All');
              setFilterWithVideo(false);
              setSearchQuery('');
            }}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
          >
            Reset All
          </button>

          <button
            onClick={() => setFilterOverdueOnly((v) => !v)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              filterOverdueOnly
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Overdue Follow-up ({overdueCount})
          </button>

          <button
            onClick={() => setFilterWithVideo((v) => !v)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              filterWithVideo
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Has Video Clips ({withVideoCount})
          </button>

          <div className="flex items-center gap-1 ml-auto">
            {(['All', 'Male', 'Female'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterSex(s)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filterSex === s
                    ? 'bg-teal-700 text-white font-semibold shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Cards Grid */}
      {filteredPatients.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <Activity className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              No Matching Surgical Records Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try adjusting your search criteria or add a new patient.
            </p>
          </div>
          <button
            onClick={onAddPatient}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Patient</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPatients.map((p) => {
            const preImg = p.pre_op.find((x) => x.kind === 'image');
            const postImg = p.post_op.find((x) => x.kind === 'image');
            const canCompareThis = !!(preImg && postImg);
            const overdue = isPatientOverdue(p);

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top / Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div
                      onClick={() => onSelectPatient(p)}
                      className="cursor-pointer flex-1 min-w-0"
                    >
                      <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition truncate">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.age} yrs • {p.sex} {p.mobile ? `• ${p.country_code} ${p.mobile}` : ''}
                      </p>
                    </div>

                    {overdue ? (
                      <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        Overdue
                      </span>
                    ) : p.date_of_surgery ? (
                      <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        {p.date_of_surgery}
                      </span>
                    ) : null}
                  </div>

                  {/* Diagnosis snippet */}
                  <p
                    onClick={() => onSelectPatient(p)}
                    className="text-xs font-semibold text-teal-800 dark:text-teal-300 line-clamp-1 cursor-pointer"
                  >
                    {p.diagnosis || 'Orthopedic Case'}
                  </p>
                </div>

                {/* Pre / Post X-ray thumbnails preview */}
                <div className="px-5 py-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Pre-Op thumbnail */}
                    <div
                      onClick={() => onSelectPatient(p)}
                      className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      {preImg ? (
                        <img
                          src={fileUrl(preImg.storage_path, preImg.dataUrl)}
                          alt="Pre-Op"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <ImageIcon className="w-5 h-5 text-slate-600 mx-auto mb-0.5" />
                          <span className="text-[9px] text-slate-500">No Pre-Op</span>
                        </div>
                      )}
                      <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                        PRE
                      </span>
                    </div>

                    {/* Post-Op thumbnail */}
                    <div
                      onClick={() => onSelectPatient(p)}
                      className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      {postImg ? (
                        <img
                          src={fileUrl(postImg.storage_path, postImg.dataUrl)}
                          alt="Post-Op"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <ImageIcon className="w-5 h-5 text-slate-600 mx-auto mb-0.5" />
                          <span className="text-[9px] text-slate-500">No Post-Op</span>
                        </div>
                      )}
                      <span className="absolute top-1 right-1 bg-teal-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                        POST
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer action bar */}
                <div className="p-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {p.videos && p.videos.length > 0 && (
                      <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium">
                        <VideoIcon className="w-3.5 h-3.5" /> {p.videos.length}
                      </span>
                    )}
                    {p.shared_with && p.shared_with.length > 0 && (
                      <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                        <Share2 className="w-3.5 h-3.5" /> {p.shared_with.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canCompareThis && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompareTarget(p);
                        }}
                        className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[11px] font-bold rounded-lg border border-teal-200 dark:border-teal-800 hover:bg-teal-100 flex items-center gap-1 transition"
                        title="Quick Compare Pre & Post X-Rays"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Compare</span>
                      </button>
                    )}

                    <button
                      onClick={() => onSelectPatient(p)}
                      className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Roster View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Age / Sex</th>
                <th className="py-3.5 px-4">Diagnosis</th>
                <th className="py-3.5 px-4">Surgery Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Media</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPatients.map((p) => {
                const overdue = isPatientOverdue(p);
                const preImg = p.pre_op.find((x) => x.kind === 'image');
                const postImg = p.post_op.find((x) => x.kind === 'image');
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectPatient(p)}
                    className="hover:bg-slate-50/75 dark:hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {p.name}
                      {p.mobile && <span className="block text-[11px] font-normal text-slate-400">{p.country_code} {p.mobile}</span>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {p.age}y / {p.sex}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-teal-800 dark:text-teal-300 max-w-xs truncate">
                      {p.diagnosis || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {p.date_of_surgery || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {overdue ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Follow-up Overdue
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Recovering
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {p.pre_op.length + p.post_op.length} scans • {p.videos.length} vids
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {preImg && postImg && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompareTarget(p);
                          }}
                          className="mr-2 px-2 py-1 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 rounded text-[11px] font-semibold hover:bg-teal-100"
                        >
                          Compare
                        </button>
                      )}
                      <button
                        onClick={() => onSelectPatient(p)}
                        className="px-2.5 py-1 bg-teal-700 text-white rounded text-[11px] font-semibold hover:bg-teal-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Compare Lightbox from card click */}
      {compareTarget && (
        <CompareSliderModal
          isOpen={!!compareTarget}
          onClose={() => setCompareTarget(null)}
          preOpUrl={compareTarget.pre_op.find((x) => x.kind === 'image')?.storage_path || ''}
          postOpUrl={compareTarget.post_op.find((x) => x.kind === 'image')?.storage_path || ''}
          preOpTitle={`Pre-Op: ${compareTarget.name}`}
          postOpTitle={`Post-Op: ${compareTarget.name}`}
          patientName={compareTarget.name}
        />
      )}
    </div>
  );
};
