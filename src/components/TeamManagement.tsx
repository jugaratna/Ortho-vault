import React, { useState, useEffect } from 'react';
import { Users, Shield, UserPlus, Trash2, Mail, Check, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { User, Role, Invite } from '../types';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const TeamManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<'single' | 'bulk'>('single');
  const [singleEmail, setSingleEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uList, iList] = await Promise.all([
        api.listUsers().catch(() => []),
        api.listInvites().catch(() => []),
      ]);
      setUsers(uList);
      setInvites(iList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await api.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );
      setFeedback({ type: 'success', message: 'Role updated successfully' });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update user role' });
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      if (inviteMode === 'single') {
        if (!singleEmail.trim() || !singleEmail.includes('@')) {
          setFeedback({ type: 'error', message: 'Please enter a valid email address' });
          return;
        }
        await api.createInvite(singleEmail.trim(), inviteRole);
        setFeedback({ type: 'success', message: `Invitation sent to ${singleEmail}` });
        setSingleEmail('');
      } else {
        const list = bulkEmails
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter((s) => s.includes('@'));
        if (list.length === 0) {
          setFeedback({ type: 'error', message: 'No valid email addresses found' });
          return;
        }
        await api.bulkInvite(list, inviteRole);
        setFeedback({ type: 'success', message: `Sent ${list.length} invitations successfully` });
        setBulkEmails('');
      }
      setInviteModalOpen(false);
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to send invitations' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvite = async (email: string) => {
    try {
      await api.deleteInvite(email);
      setInvites((prev) => prev.filter((i) => i.email !== email));
      setFeedback({ type: 'success', message: `Revoked invite for ${email}` });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to revoke invite' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-150">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-700 dark:text-teal-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Surgical Team & Role Permissions
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage surgeons, fellows, surgical residents, and nurses with HIPAA-compliant role access
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setInviteModalOpen(true);
              setFeedback(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Colleague</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
              <Shield className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Admin (Surgeon-in-Chief)</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Full authority to create, edit, delete patient records, invite team members, assign permissions, and audit logs.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
              <Users className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Editor (Attending / Fellow)</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Can create records, document operative notes, upload radiographs/videos, and edit shared patients.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Users className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Viewer (Nurse / Observer)</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Read-only access for ward rounds, verifying post-op instructions, and reviewing discharge protocols.
          </p>
        </div>
      </div>

      {/* Active Team Members List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">
            Active Clinicians & Staff ({users.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Authenticated via Secure Workspace</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {users.map((u) => {
            const isSelf = u.user_id === currentUser?.user_id;
            return (
              <div key={u.user_id} className="p-4 sm:px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {u.picture ? (
                    <img src={u.picture} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 font-bold flex items-center justify-center text-sm">
                      {u.name?.charAt(0) || u.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{u.name || u.email}</span>
                      {isSelf && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={u.role}
                    disabled={isSelf}
                    onChange={(e) => handleRoleChange(u.user_id, e.target.value as Role)}
                    className="text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invites List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">
            Pending Invitations ({invites.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Awaiting user signup</span>
        </div>

        {invites.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No pending invitations. Click "Invite Colleague" above to add new team members.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {invites.map((inv) => (
              <div key={inv.email} className="p-4 sm:px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-xs text-slate-900 dark:text-white">{inv.email}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Role: <strong className="capitalize">{inv.role}</strong> • Invited {new Date(inv.invited_at || '').toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteInvite(inv.email)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                  title="Revoke Invite"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Invite Clinical Colleague
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Send an authorization email to grant access to OrthoVault.
            </p>

            <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setInviteMode('single')}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  inviteMode === 'single'
                    ? 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Single Invite
              </button>
              <button
                type="button"
                onClick={() => setInviteMode('bulk')}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  inviteMode === 'bulk'
                    ? 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Bulk Department Invite
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              {inviteMode === 'single' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="e.g. resident.ortho@hospital.org"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Addresses (one per line or comma-separated)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder="doctor1@hospital.org&#10;doctor2@hospital.org"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Access Level
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="editor">Editor (Can create & update patients)</option>
                  <option value="admin">Admin (Full department management)</option>
                  <option value="viewer">Viewer (Read-only clinical observer)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Sending...' : 'Send Invitation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
