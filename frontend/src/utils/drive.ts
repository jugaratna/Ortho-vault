// Google Drive Backup helpers - uses OAuth token from expo-auth-session
export type BackupItem = { name: string; mime: string; blob: Blob };

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
