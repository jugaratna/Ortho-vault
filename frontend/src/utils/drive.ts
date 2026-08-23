// Google Drive Backup + Restore helpers
import { fileUrl, MediaFile, Patient, api } from '@/src/api/client';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function driveFetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text().catch(() => '')}`);
  return res;
}

export async function createFolder(token: string, name: string): Promise<{ id: string; name: string }> {
  const res = await driveFetch(token, `${DRIVE}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return res.json();
}

export async function uploadBlob(token: string, folderId: string, name: string, mime: string, blob: Blob) {
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name, mimeType: mime, parents: [folderId] })], { type: 'application/json' }),
  );
  form.append('file', blob, name);
  const res = await driveFetch(token, `${UPLOAD}?uploadType=multipart&fields=id,name,size`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}

export async function uploadJson(token: string, folderId: string, name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  return uploadBlob(token, folderId, name, 'application/json', blob);
}

export async function uploadRemoteUrl(token: string, folderId: string, name: string, mime: string, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
  const blob = await res.blob();
  return uploadBlob(token, folderId, name, mime || blob.type || 'application/octet-stream', blob);
}

// ---- Restore helpers ----

export type BackupFolder = { id: string; name: string; createdTime?: string };
export type BackupManifest = {
  schemaVersion: 2;
  createdAt: string;
  patients: Patient[];
  files: { patientId: string; section: 'pre_op' | 'post_op' | 'video'; fileId: string; driveName: string; mime: string; name: string; localId: string }[];
};

export async function listBackupFolders(token: string): Promise<BackupFolder[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name contains 'OrthoVault Backup' and trashed=false");
  const res = await driveFetch(token, `${DRIVE}/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=50`);
  const data = await res.json();
  return data.files || [];
}

async function listFilesInFolder(token: string, folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await driveFetch(token, `${DRIVE}/files?q=${q}&fields=files(id,name,mimeType)&pageSize=1000`);
  const data = await res.json();
  return data.files as Array<{ id: string; name: string; mimeType: string }>;
}

async function downloadFile(token: string, fileId: string): Promise<Response> {
  return driveFetch(token, `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media`);
}

// Full backup: writes manifest.json (v2) + one blob per media file
export async function backupToDrive(token: string, onProgress?: (msg: string) => void): Promise<{ folder: BackupFolder; patients: number; files: number }> {
  const patients = await api.listPatients();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = await createFolder(token, `OrthoVault Backup ${stamp}`);

  const manifestFiles: BackupManifest['files'] = [];
  let idx = 0;
  const total = patients.reduce((n, p) => n + (p.pre_op?.length || 0) + (p.post_op?.length || 0) + (p.videos?.length || 0), 0);
  onProgress?.(`Uploading manifest…`);

  for (const p of patients) {
    const sections: [MediaFile[], 'pre_op' | 'post_op' | 'video'][] = [
      [p.pre_op || [], 'pre_op'],
      [p.post_op || [], 'post_op'],
      [p.videos || [], 'video'],
    ];
    for (const [files, section] of sections) {
      for (const f of files) {
        idx += 1;
        onProgress?.(`Uploading ${idx}/${total} — ${f.name}`);
        const driveName = `${p.id}__${section}__${f.id}__${f.name}`;
        try {
          const meta = await uploadRemoteUrl(token, folder.id, driveName, f.mime, fileUrl(f.storage_path));
          manifestFiles.push({
            patientId: p.id,
            section,
            fileId: meta.id,
            driveName,
            mime: f.mime,
            name: f.name,
            localId: f.id,
          });
        } catch {
          // skip
        }
      }
    }
  }

  const manifest: BackupManifest = {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    patients,
    files: manifestFiles,
  };
  await uploadJson(token, folder.id, 'manifest.json', manifest);

  return { folder, patients: patients.length, files: manifestFiles.length };
}

// Full restore: reads manifest.json, downloads each blob from Drive, re-uploads to backend, writes patient records
export async function restoreFromDrive(token: string, folderId: string, onProgress?: (msg: string) => void): Promise<{ patients: number; files: number }> {
  onProgress?.('Reading manifest…');
  const files = await listFilesInFolder(token, folderId);
  const manifestEntry = files.find((f) => f.name === 'manifest.json');
  if (!manifestEntry) throw new Error('manifest.json not found in this folder');

  const manifestRes = await downloadFile(token, manifestEntry.id);
  const manifest = (await manifestRes.json()) as BackupManifest;
  if (manifest.schemaVersion !== 2) throw new Error(`Unsupported backup schema v${manifest.schemaVersion}`);

  // Re-upload each media blob to backend and remap storage_path
  const remap = new Map<string, string>(); // localId -> new storage_path
  let idx = 0;
  for (const item of manifest.files) {
    idx += 1;
    onProgress?.(`Restoring ${idx}/${manifest.files.length} — ${item.name}`);
    try {
      const dl = await downloadFile(token, item.fileId);
      const blob = await dl.blob();
      const form = new FormData();
      form.append('file', blob, item.name);
      const up = await fetch(`${(process.env.EXPO_PUBLIC_BACKEND_URL || '')}/api/upload`, { method: 'POST', body: form });
      if (up.ok) {
        const data = await up.json();
        remap.set(item.localId, data.storage_path);
      }
    } catch {
      // skip failed
    }
  }

  // Insert each patient with remapped storage paths
  let patientCount = 0;
  for (const p of manifest.patients) {
    const patch = (arr: MediaFile[] | undefined): MediaFile[] => (arr || []).map((f) => ({ ...f, storage_path: remap.get(f.id) || f.storage_path }));
    const restored: any = {
      ...p,
      pre_op: patch(p.pre_op),
      post_op: patch(p.post_op),
      videos: patch(p.videos),
    };
    try {
      await api.upsertPatient(restored);
      patientCount += 1;
    } catch {
      // skip
    }
  }

  return { patients: patientCount, files: manifest.files.length };
}
