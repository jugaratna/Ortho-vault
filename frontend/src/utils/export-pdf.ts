import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Patient, fileUrl, MediaFile } from '@/src/api/client';

function esc(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mediaBlock(title: string, files: MediaFile[]) {
  if (!files || files.length === 0) return `<div class="empty">No ${title.toLowerCase()} on record.</div>`;
  const images = files.filter((f) => f.kind === 'image');
  const other = files.filter((f) => f.kind !== 'image');
  const imgHtml = images
    .map((f) => `<div class="thumb"><img src="${fileUrl(f.storage_path)}" /><div class="cap">${esc(f.name)}</div></div>`)
    .join('');
  const otherHtml = other
    .map((f) => `<li><b>${esc(f.name)}</b> <span class="muted">(${esc(f.kind)})</span></li>`)
    .join('');
  return `${imgHtml ? `<div class="grid">${imgHtml}</div>` : ''}${otherHtml ? `<ul class="files">${otherHtml}</ul>` : ''}`;
}

const CSS = `
  @page { margin: 22mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0F172A; margin: 0; }
  .brand { color: #0F766E; font-weight: 800; letter-spacing: -0.5px; font-size: 22px; }
  .sub { color: #64748B; font-size: 12px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 4px 0; letter-spacing: -0.5px; }
  h2 { font-size: 13px; color: #0F766E; letter-spacing: 1px; text-transform: uppercase; margin-top: 20px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px; }
  .meta { color: #475569; font-size: 12px; margin: 4px 0 12px; }
  .info { display: table; width: 100%; border-collapse: collapse; margin-top: 8px; }
  .info .row { display: table-row; }
  .info .k { display: table-cell; padding: 6px 12px 6px 0; color: #64748B; font-size: 11px; width: 35%; border-bottom: 1px solid #F1F5F9; }
  .info .v { display: table-cell; padding: 6px 0; color: #0F172A; font-size: 12px; font-weight: 600; border-bottom: 1px solid #F1F5F9; }
  .note { padding: 10px; background: #F8FAFC; border-left: 3px solid #0F766E; margin-top: 6px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
  .grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .thumb { width: 160px; }
  .thumb img { width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #E2E8F0; }
  .cap { font-size: 9px; color: #64748B; margin-top: 4px; word-break: break-word; }
  .files { list-style: none; padding: 0; margin: 10px 0; font-size: 11px; }
  .files li { padding: 5px 10px; background: #F1F5F9; border-radius: 4px; margin-bottom: 4px; }
  .muted { color: #64748B; font-weight: normal; }
  .empty { font-style: italic; color: #94A3B8; font-size: 11px; padding: 6px 0; }
  .divider { border-top: 4px double #E2E8F0; margin: 32px 0 16px; }
  .pagebreak { page-break-after: always; }
  .foot { margin-top: 20px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #94A3B8; text-align: center; }
`;

function renderPatientBody(p: Patient) {
  return `
  <h1>${esc(p.name)}</h1>
  <div class="meta">${p.age}y • ${esc(p.sex)} • ${esc(p.country_code)} ${esc(p.mobile)}</div>

  <h2>Demographics</h2>
  <div class="info">
    <div class="row"><div class="k">Full Name</div><div class="v">${esc(p.name)}</div></div>
    <div class="row"><div class="k">Age</div><div class="v">${p.age} years</div></div>
    <div class="row"><div class="k">Sex</div><div class="v">${esc(p.sex)}</div></div>
    <div class="row"><div class="k">Mobile</div><div class="v">${esc(p.country_code)} ${esc(p.mobile)}</div></div>
    <div class="row"><div class="k">Diagnosis</div><div class="v">${esc(p.diagnosis || '—')}</div></div>
    <div class="row"><div class="k">Date of Surgery</div><div class="v">${esc(p.date_of_surgery || '—')}</div></div>
  </div>

  <h2>History &amp; Chief Complaints</h2>
  <div class="note">${esc(p.history || 'No history recorded.')}</div>

  <h2>Pre-operative Documents</h2>
  ${mediaBlock('Pre-op files', p.pre_op || [])}

  <h2>Post-operative Documents</h2>
  ${mediaBlock('Post-op files', p.post_op || [])}

  <h2>Result / Clinical Outcome</h2>
  <div class="note">${esc(p.result || 'No outcome recorded yet.')}</div>

  <h2>Videos</h2>
  ${(p.videos || []).length === 0
    ? '<div class="empty">No video documentation on record.</div>'
    : `<ul class="files">${p.videos.map((v) => `<li><b>${esc(v.name)}</b> <span class="muted">(video)</span></li>`).join('')}</ul>`}
`;
}

function wrap(bodyHtml: string, title: string, subtitle: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>${CSS}</style></head>
<body>
  <div class="brand">OrthoVault</div>
  <div class="sub">${esc(subtitle)}</div>
  ${bodyHtml}
  <div class="foot">OrthoVault • Confidential Patient Health Information • ${new Date().toISOString()}</div>
</body></html>`;
}

async function shareOrPrint(html: string, filename: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return null;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

export async function exportPatientPdf(patient: Patient) {
  const html = wrap(renderPatientBody(patient), 'Patient Summary', `Patient Clinical Summary • Generated ${new Date().toLocaleDateString()}`);
  return shareOrPrint(html, `${patient.name} - Clinical Summary`);
}

export async function exportBulkPdf(patients: Patient[], label: string) {
  const bodies = patients
    .map((p, i) => `${i > 0 ? '<div class="pagebreak"></div>' : ''}${renderPatientBody(p)}`)
    .join('\n');
  const html = wrap(bodies, 'Bulk Summary', `${label} • ${patients.length} patient${patients.length === 1 ? '' : 's'} • Generated ${new Date().toLocaleDateString()}`);
  return shareOrPrint(html, `OrthoVault - ${label}`);
}

export async function exportPatientNotesPdf(patient: Patient) {
  const body = `
    <h1>${esc(patient.name)} — Notes</h1>
    <div class="meta">${patient.age}y • ${esc(patient.sex)} • ${esc(patient.diagnosis || 'No diagnosis')} • ${esc(patient.date_of_surgery || 'No DOS')}</div>

    <h2>History &amp; Chief Complaints</h2>
    <div class="note">${esc(patient.history || 'No history recorded.')}</div>

    <h2>Result / Clinical Outcome</h2>
    <div class="note">${esc(patient.result || 'No outcome recorded yet.')}</div>
  `;
  const html = wrap(body, 'Notes', `Clinical Notes • ${new Date().toLocaleDateString()}`);
  return shareOrPrint(html, `${patient.name} - Notes`);
}

// ---- Download a single media file ----
export async function downloadMediaFile(file: MediaFile) {
  const url = fileUrl(file.storage_path);
  if (Platform.OS === 'web') {
    // Trigger browser download
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {}
    return;
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const localUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + safeName;
  try {
    const dl = await FileSystem.downloadAsync(url, localUri);
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(dl.uri, {
        mimeType: file.mime || 'application/octet-stream',
        dialogTitle: `Save ${file.name}`,
      });
    }
  } catch (e) {
    // ignore
  }
}
