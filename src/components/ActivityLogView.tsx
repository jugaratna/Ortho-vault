import React, { useState, useEffect } from 'react';
import { Activity, PlusCircle, Edit3, Trash2, Users, FileImage, RefreshCw, Filter } from 'lucide-react';
import { ActivityEvent } from '../types';
import { api } from '../api/client';

export const ActivityLogView: React.FC = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const loadActivity = async () => {
    try {
      setLoading(true);
      const list = await api.listActivity(100);
      setEvents(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'share') return e.action === 'share' || e.action === 'unshare';
    return e.action === filter;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'update':
        return <Edit3 className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'share':
      case 'unshare':
        return <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'media_added':
        return <FileImage className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-700 dark:text-teal-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              HIPAA Audit & Activity Log
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Immutable tracking of surgical record creations, edits, media uploads, and clinician shares
          </p>
        </div>

        <button
          onClick={loadActivity}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6 text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
        {[
          { key: 'all', label: 'All Events' },
          { key: 'create', label: 'Created' },
          { key: 'update', label: 'Updated' },
          { key: 'media_added', label: 'Media Added' },
          { key: 'share', label: 'Sharing' },
          { key: 'delete', label: 'Deleted' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filter === tab.key
                ? 'bg-teal-700 text-white font-semibold shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No activity events matching this filter.
          </div>
        ) : (
          filteredEvents.map((ev) => (
            <div key={ev.id} className="p-4 sm:p-5 flex items-start gap-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                {getActionIcon(ev.action)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs text-slate-900 dark:text-white">
                    <strong className="font-semibold">{ev.actor_name}</strong>{' '}
                    <span className="text-slate-600 dark:text-slate-400">
                      {ev.action === 'create' && 'created record for'}
                      {ev.action === 'update' && 'updated surgical details of'}
                      {ev.action === 'delete' && 'deleted patient'}
                      {ev.action === 'media_added' && 'uploaded clinical scans to'}
                      {ev.action === 'share' && `shared ${ev.entity_name} with ${ev.meta?.with_name || 'colleague'}`}
                      {ev.action === 'unshare' && `removed colleague access from`}
                    </span>{' '}
                    <strong className="text-teal-700 dark:text-teal-400 font-semibold">
                      {ev.entity_name}
                    </strong>
                  </p>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(ev.at).toLocaleString()}
                  </span>
                </div>

                {ev.meta && Object.keys(ev.meta).length > 0 && (
                  <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded inline-block">
                    {JSON.stringify(ev.meta)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
