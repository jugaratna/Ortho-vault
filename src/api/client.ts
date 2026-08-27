import { Patient, MediaFile, Colleague, ActivityEvent, User, Invite } from '../types';

export const API_BASE = '/api';

export function fileUrl(storagePath: string, fallbackUrl?: string) {
  if (fallbackUrl) return fallbackUrl;
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('data:')) {
    return storagePath;
  }
  return `${API_BASE}/files/${storagePath}`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export const api = {
  async listPatients(): Promise<Patient[]> {
    const res = await fetch(`${API_BASE}/patients`);
    return json<Patient[]>(res);
  },

  async getPatient(id: string): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients/${id}`);
    return json<Patient>(res);
  },

  async upsertPatient(p: Partial<Patient>): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    return json<Patient>(res);
  },

  async deletePatient(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/patients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },

  async uploadFile(file: File): Promise<{
    storage_path: string;
    size: number;
    name: string;
    mime: string;
    kind: 'image' | 'pdf' | 'doc' | 'video' | 'dicom' | 'other';
    dataUrl: string;
  }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: form,
    });
    return json(res);
  },

  async draftDischarge(input: {
    name: string;
    age: number;
    sex: string;
    diagnosis: string;
    date_of_surgery: string | null;
    operative_note: string;
    result: string;
  }): Promise<string> {
    const res = await fetch(`${API_BASE}/ai/draft-discharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await json<{ draft: string }>(res);
    return data.draft;
  },

  async listUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/auth/users`);
    return json<User[]>(res);
  },

  async updateUserRole(userId: string, role: 'admin' | 'editor' | 'viewer'): Promise<void> {
    await fetch(`${API_BASE}/auth/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
  },

  async listInvites(): Promise<Invite[]> {
    const res = await fetch(`${API_BASE}/auth/invites`);
    return json<Invite[]>(res);
  },

  async createInvite(email: string, role: 'admin' | 'editor' | 'viewer'): Promise<Invite> {
    const res = await fetch(`${API_BASE}/auth/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    return json<Invite>(res);
  },

  async bulkInvite(emails: string[], role: 'admin' | 'editor' | 'viewer'): Promise<{ invited: Invite[]; emailed: number }> {
    const res = await fetch(`${API_BASE}/auth/invites/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, role }),
    });
    return json(res);
  },

  async deleteInvite(email: string): Promise<void> {
    await fetch(`${API_BASE}/auth/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });
  },

  async listColleagues(): Promise<Colleague[]> {
    const res = await fetch(`${API_BASE}/auth/colleagues`);
    return json<Colleague[]>(res);
  },

  async sharePatient(pid: string, userId: string, scope: 'read' | 'edit') {
    const res = await fetch(`${API_BASE}/patients/${pid}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, scope }),
    });
    return json(res);
  },

  async unsharePatient(pid: string, userId: string) {
    const res = await fetch(`${API_BASE}/patients/${pid}/share/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    return json(res);
  },

  async listActivity(limit = 100): Promise<ActivityEvent[]> {
    const res = await fetch(`${API_BASE}/activity?limit=${limit}`);
    return json<ActivityEvent[]>(res);
  },
};
