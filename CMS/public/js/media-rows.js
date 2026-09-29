// Image list (drag to reorder, alt text, focal crop, remove), gallery rows and
// file rows for the product editor. Rows carry their model as JSON.
import { esc, btn } from './form.js';
import { openCropModal, applyFitStyle } from './crop-modal.js';
import { uploadQueue } from './upload-queue.js';
import { api } from './api.js';
import { setDirty } from './state.js';

const readRow = (row) => JSON.parse(row.dataset.model || '{}');
const writeRow = (row, m) => { row.dataset.model = JSON.stringify(m); };

export function imageRow(img) {
  const row = document.createElement('div');
  row.className = 'flex gap-3 items-start rounded-lg border border-zinc-800 bg-zinc-950 p-2';
  row.draggable = true; row.dataset.row = 'image';
  writeRow(row, img);
  row.innerHTML = `<span class="cursor-grab text-zinc-600 pt-6" title="Drag to reorder"><i class="ph ph-dots-six-vertical"></i></span>
    <div class="w-24 h-16 rounded overflow-hidden bg-black shrink-0 relative"><img class="w-full h-full object-cover" src="${esc(img.thumb || img.url)}" alt=""></div>
    <div class="flex-1 min-w-0 space-y-1.5"><input class="w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Alt text (what the photo shows)" value="${esc(img.alt || '')}" data-field="alt">
      <div class="font-mono text-[10px] text-zinc-500 truncate">${esc(img.url)}</div></div>
    <div class="flex flex-col gap-1">${btn('<i class="ph ph-crop"></i> Crop', 'img-crop')}${btn('<i class="ph ph-trash"></i>', 'img-remove', 'danger')}</div>`;
  applyFitStyle(row.querySelector('img'), img.fit);
  row.querySelector('[data-field="alt"]').addEventListener('input', (e) => { const m = readRow(row); m.alt = e.target.value; writeRow(row, m); setDirty(true); });
  return row;
}
export function galleryRow(g) {
  const row = document.createElement('div');
  row.className = 'flex gap-3 items-start rounded-lg border border-zinc-800 bg-zinc-950 p-2'; row.draggable = true; row.dataset.row = 'gallery'; writeRow(row, g);
  row.innerHTML = `<span class="cursor-grab text-zinc-600 pt-6"><i class="ph ph-dots-six-vertical"></i></span>
    <div class="w-24 h-16 rounded overflow-hidden bg-black shrink-0 flex items-center justify-center text-zinc-500">${g.type === 'video' ? (g.poster ? `<img class="w-full h-full object-cover" src="${esc(g.thumb || g.poster)}" alt="">` : '<i class="ph ph-video text-2xl"></i>') : `<img class="w-full h-full object-cover" src="${esc(g.thumb || g.url)}" alt="">`}</div>
    <div class="flex-1 min-w-0 space-y-1.5"><input class="w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Caption" value="${esc(g.caption || '')}" data-field="caption"><div class="font-mono text-[10px] text-zinc-500 truncate">${esc(g.type)} · ${esc(g.url)}</div></div>
    <div>${btn('<i class="ph ph-trash"></i>', 'row-remove', 'danger')}</div>`;
  row.querySelector('[data-field="caption"]').addEventListener('input', (e) => { const m = readRow(row); m.caption = e.target.value; writeRow(row, m); setDirty(true); });
  return row;
}
export function fileRow(f) {
  const row = document.createElement('div');
  row.className = 'flex gap-3 items-start rounded-lg border border-zinc-800 bg-zinc-950 p-2'; row.draggable = true; row.dataset.row = 'file'; writeRow(row, f);
  row.innerHTML = `<span class="cursor-grab text-zinc-600 pt-2"><i class="ph ph-dots-six-vertical"></i></span>
    <div class="flex-1 min-w-0 grid sm:grid-cols-2 gap-2"><input class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Label" value="${esc(f.name || '')}" data-field="name"><input class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm" placeholder="Description" value="${esc(f.description || '')}" data-field="description"><div class="sm:col-span-2 font-mono text-[10px] text-zinc-500 truncate">${esc(f.url)}${f.size ? ` · ${(f.size / 1024).toFixed(0)} KB` : ''}${f.sha256 ? ` · sha256 ${f.sha256.slice(0, 12)}…` : ''}</div></div>
    <div>${btn('<i class="ph ph-trash"></i>', 'row-remove', 'danger')}</div>`;
  row.querySelectorAll('[data-field]').forEach((el) => el.addEventListener('input', (e) => { const m = readRow(row); m[e.target.dataset.field] = e.target.value; writeRow(row, m); setDirty(true); }));
  return row;
}
export function readRows(list) { return [...list.querySelectorAll('[data-row]')].map(readRow); }

export function bindRowList(list) {
  let dragging = null;
  list.addEventListener('dragstart', (e) => { dragging = e.target.closest('[data-row]'); if (dragging) e.dataTransfer.effectAllowed = 'move'; });
  list.addEventListener('dragover', (e) => { if (!dragging) return; e.preventDefault(); const after = [...list.querySelectorAll('[data-row]:not(.dragging)')].find((r) => e.clientY <= r.getBoundingClientRect().top + r.offsetHeight / 2); list.insertBefore(dragging, after || null); });
  list.addEventListener('dragend', () => { dragging = null; setDirty(true); });
  list.addEventListener('click', (e) => {
    const row = e.target.closest('[data-row]'); if (!row) return;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'row-remove' || action === 'img-remove') { row.remove(); setDirty(true); }
    if (action === 'img-crop') { const m = readRow(row); openCropModal(m.hero || m.url, 4, 3, 'Hero crop (4:3)', m.fit, (fit) => { m.fit = fit; writeRow(row, m); applyFitStyle(row.querySelector('img'), fit); setDirty(true); }); }
  });
}

// Drop zone / picker that queues uploads and appends rows.
export function bindDropZone(zone, { list, kind, fields }) {
  const input = zone.querySelector('input[type=file]');
  const accept = (files) => {
    for (const file of files) {
      if (kind === 'image') uploadQueue.add(file.name, 'image', async (t) => { const r = await api.upload(file, fields(), (p) => t.setProgress(p * 0.5, `${p}% up`)); t.setProgress(90, 'Processing'); list.appendChild(imageRow(r)); setDirty(true); }, 4000);
      else if (kind === 'gallery') { const isVideo = /^video\//.test(file.type) || /\.(mp4|mov|webm|m4v)$/i.test(file.name); uploadQueue.add(file.name, isVideo ? 'video' : 'image', async (t) => { if (isVideo) { const jobId = `v${Date.now()}`; const es = new EventSource(`/api/media/video-progress/${jobId}`); es.onmessage = (m) => { try { const d = JSON.parse(m.data); if (d.pct != null) t.setProgress(50 + d.pct * 0.5, `${d.pct}% enc`); } catch { /* ignore */ } }; const r = await api.uploadVideo(file, { ...fields(), jobId }, (p) => t.setProgress(p * 0.5, `${p}% up`)); es.close(); list.appendChild(galleryRow(r)); } else { const r = await api.upload(file, fields(), (p) => t.setProgress(p, `${p}%`)); list.appendChild(galleryRow({ type: 'image', url: r.hero || r.url, thumb: r.thumb, caption: '' })); } setDirty(true); }, isVideo ? 60000 : 4000); }
      else uploadQueue.add(file.name, 'file', async (t) => { const r = await api.uploadFile(file, fields(), (p) => t.setProgress(p, `${p}%`)); list.appendChild(fileRow({ ...r, description: '' })); setDirty(true); }, 3000);
    }
  };
  input?.addEventListener('change', () => { accept(input.files); input.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('border-cyan-500'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('border-cyan-500'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('border-cyan-500'); accept(e.dataTransfer.files); });
}
export const dropZoneHtml = (label, accept, multiple = true) => `<label class="block border border-dashed border-zinc-700 rounded-lg p-4 text-center text-sm text-zinc-400 hover:border-cyan-500 cursor-pointer" data-dropzone><i class="ph ph-upload-simple text-xl block mb-1"></i>${esc(label)}<input type="file" class="hidden" accept="${accept}" ${multiple ? 'multiple' : ''}></label>`;
