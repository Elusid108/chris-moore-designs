// Fetch wrapper for the CMS API (same shape as the portfolio CMS).
async function handle(res) {
  if (!res.ok) { let msg = await res.text(); try { const j = JSON.parse(msg); msg = j.error || msg; if (j.details?.errors) msg += '\n' + j.details.errors.join('\n'); } catch { /* text */ } throw new Error(msg || `HTTP ${res.status}`); }
  return res.json();
}
export const api = {
  get: (p) => fetch(`/api${p}`).then(handle),
  post: (p, body) => fetch(`/api${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(handle),
  del: (p) => fetch(`/api${p}`, { method: 'DELETE' }).then(handle),
  upload(file, fields, onProgress) { const f = new FormData(); f.append('file', file); for (const [k, v] of Object.entries(fields || {})) if (v != null) f.append(k, v); return uploadXhr('/api/media/upload', f, onProgress); },
  uploadFile(file, fields, onProgress) { const f = new FormData(); f.append('file', file); for (const [k, v] of Object.entries(fields || {})) if (v != null) f.append(k, v); return uploadXhr('/api/media/upload-file', f, onProgress); },
  uploadVideo(file, fields, onProgress) { const f = new FormData(); f.append('file', file); for (const [k, v] of Object.entries(fields || {})) if (v != null) f.append(k, v); return uploadXhr('/api/media/upload-video', f, onProgress); },
};
export function uploadXhr(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Invalid JSON response')); } } else { let m = xhr.responseText; try { m = JSON.parse(m).error || m; } catch { /* text */ } reject(new Error(m || `HTTP ${xhr.status}`)); } };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}
