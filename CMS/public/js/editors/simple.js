// Editors for families, firmware, software and services: a field spec, an
// optional rich-text body, and (for families/software/services) one image.
import { state, setDirty } from '../state.js';
import { fields, readFields, section, btn, esc } from '../form.js';
import { makeEditor } from '../quill-setup.js';
import { imageRow, readRows, bindRowList, bindDropZone, dropZoneHtml, fileRow } from '../media-rows.js';

const SPECS = {
  families: { label: 'Family', fields: [
    { key: 'name', label: 'Name' }, { key: 'slug', label: 'URL slug', mono: true },
    { key: 'tagline', label: 'Tagline', type: 'textarea', span: 2, rows: 2 },
    { key: 'category', label: 'Category', type: 'select', options: ['hardware', 'systems', 'software', 'tooling', 'lighting', 'art'].map((v) => ({ value: v, label: v })) },
    { key: 'order', label: 'Order', type: 'number', default: 100 },
    { key: 'portfolioSlug', label: 'Portfolio project slug', mono: true, nullable: true, help: 'chrismoore.me/projects/<slug>/ link on the family page' },
  ], body: 'description', image: 'heroImage' },
  firmware: { label: 'Firmware release', fields: [
    { key: 'name', label: 'Image name', placeholder: 'pxd-fw' }, { key: 'version', label: 'Version', mono: true, placeholder: '1.4.2' },
    { key: 'date', label: 'Release date', type: 'date' }, { key: 'slug', label: 'URL slug', mono: true },
    { key: 'downloadUrl', label: 'Download URL (if hosted elsewhere)', nullable: true, span: 2 },
    { key: 'webInstallerManifest', label: 'Web installer manifest URL', nullable: true, span: 2 },
    { key: 'repo', label: 'Source repo', nullable: true }, { key: 'sha256', label: 'SHA-256', mono: true, nullable: true },
    { key: 'ota', label: 'OTA capable', type: 'checkbox' },
  ], body: 'notes', bodyLabel: 'Release notes', targets: true, file: true },
  software: { label: 'Software', fields: [
    { key: 'name', label: 'Name' }, { key: 'slug', label: 'URL slug', mono: true },
    { key: 'summary', label: 'Summary', type: 'textarea', span: 2, rows: 2 },
    { key: 'version', label: 'Version', mono: true, nullable: true }, { key: 'order', label: 'Order', type: 'number', default: 100 },
    { key: 'platformsCsv', label: 'Platforms (comma separated: windows, macos, linux, web, raspberry-pi)', span: 2, mono: true },
    { key: 'repo', label: 'Source repo', nullable: true }, { key: 'releaseUrl', label: 'Download / release URL', nullable: true },
    { key: 'appUrl', label: 'Launch URL (web apps)', nullable: true }, { key: 'wip', label: 'Work in progress', type: 'checkbox' },
  ], body: 'description', image: 'screenshots', imageMulti: true },
  services: { label: 'Service', fields: [
    { key: 'name', label: 'Name' }, { key: 'slug', label: 'URL slug', mono: true },
    { key: 'summary', label: 'Summary', type: 'textarea', span: 2, rows: 2 },
    { key: 'startingPrice', label: 'Starting price (blank = by quote)', type: 'number', step: '0.01' }, { key: 'order', label: 'Order', type: 'number', default: 100 },
    { key: 'quoteUrl', label: 'Quote link (blank = site default)', nullable: true, span: 2 },
  ], body: 'description', image: 'image', relatedApps: true },
};

export function open(root, name, item) {
  const spec = SPECS[name];
  const it = item ? { ...item } : { published: false };
  if (name === 'software') it.platformsCsv = (it.platforms || []).join(', ');
  const mediaFields = () => ({ family: name === 'families' ? root.querySelector('[name=slug]')?.value || root.querySelector('[name=name]')?.value || 'family' : name, product: name === 'families' ? '' : root.querySelector('[name=slug]')?.value || root.querySelector('[name=name]')?.value || name, title: root.querySelector('[name=name]')?.value });
  const check = (label, list, selected, lab) => section(label, `<div class="grid sm:grid-cols-2 gap-1">${list.map((x) => `<label class="flex items-center gap-2 text-sm py-1"><input type="checkbox" class="accent-cyan-400" data-multi value="${x.id}" ${selected.includes(x.id) ? 'checked' : ''}> ${esc(lab(x))}</label>`).join('') || '<p class="text-sm text-zinc-500">Nothing yet.</p>'}</div>`);
  const images = spec.image ? (spec.imageMulti ? it[spec.image] || [] : it[spec.image] ? [it[spec.image]] : []) : [];
  root.innerHTML = `
    <div class="flex items-start justify-between gap-4 mb-4">
      <div><p class="font-mono text-[11px] uppercase tracking-widest text-cyan-400">${esc(spec.label)} ${it.published ? '<span class="text-emerald-400">· published</span>' : '<span class="text-amber-400">· draft (local only)</span>'}</p><h2 class="text-2xl font-bold" data-editor-title>${esc(it.name || `New ${spec.label.toLowerCase()}`)}</h2></div>
      <div class="flex gap-2 shrink-0">${it.id ? btn('<i class="ph ph-eye"></i> Preview', 'preview-item') : ''}${it.id ? (it.published ? btn('Unpublish', 'unpublish-item') : btn('Publish item', 'publish-item', 'primary')) : ''}${it.id ? btn('<i class="ph ph-trash"></i>', 'delete-item', 'danger') : ''}${btn('<i class="ph ph-floppy-disk"></i> Save', 'save', 'primary')}</div>
    </div>
    <div class="space-y-5">
      ${section('Details', fields(spec.fields, it))}
      ${spec.body ? section(spec.bodyLabel || 'Description', `<div class="quill-dark" data-quill></div>`) : ''}
      ${spec.targets ? check('Targets (products this release is for)', state.collections.products, it.targets || [], (p) => `${p.title} (${p.sku})`) : ''}
      ${spec.relatedApps ? check('Related tools', state.collections.software, it.relatedApps || [], (s) => s.name) : ''}
      ${spec.file ? section('Binary', `<p class="text-[11px] text-zinc-500">Upload the release file to host it here (SHA-256 is filled in automatically), or leave a download URL above.</p><div class="space-y-2" data-list="file">${''}</div>${dropZoneHtml('Drop the firmware file (.bin / .zip)', '*/*', false)}`) : ''}
      ${spec.image ? section(spec.imageMulti ? 'Screenshots' : 'Image', `<div class="space-y-2" data-list="images"></div>${dropZoneHtml(spec.imageMulti ? 'Drop screenshots' : 'Drop an image', 'image/*,.heic', spec.imageMulti)}`) : ''}
    </div>`;
  const body = spec.body ? makeEditor(root.querySelector('[data-quill]'), spec.body === 'notes' ? 'long' : 'long', { onChange: () => setDirty(true) }) : null;
  if (body) body.html = it[spec.body] || '';
  const imgList = root.querySelector('[data-list="images"]');
  if (imgList) { images.forEach((i) => imgList.appendChild(imageRow(i))); bindRowList(imgList); bindDropZone(root.querySelector('[data-list="images"] + [data-dropzone]'), { list: imgList, kind: 'image', fields: mediaFields }); }
  const fileList = root.querySelector('[data-list="file"]');
  if (fileList) { if (it.file?.url) fileList.appendChild(fileRow({ name: it.file.url.split('/').pop(), ...it.file })); bindRowList(fileList); bindDropZone(root.querySelector('[data-list="file"] + [data-dropzone]'), { list: fileList, kind: 'file', fields: mediaFields }); new MutationObserver(() => { const f = readRows(fileList)[0]; const sha = root.querySelector('[name=sha256]'); if (f?.sha256 && sha && !sha.value) { sha.value = f.sha256; setDirty(true); } }).observe(fileList, { childList: true }); }
  root.querySelector('[name=name]')?.addEventListener('input', (e) => { root.querySelector('[data-editor-title]').textContent = e.target.value; });
  return {
    type: name, id: it.id || null,
    collect() {
      const o = readFields(root, spec.fields);
      const out = { ...it, ...o };
      delete out.platformsCsv;
      if (name === 'software') out.platforms = String(o.platformsCsv || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (body) out[spec.body] = body.html;
      if (spec.targets) out.targets = [...root.querySelectorAll('[data-multi]:checked')].map((c) => c.value);
      if (spec.relatedApps) out.relatedApps = [...root.querySelectorAll('[data-multi]:checked')].map((c) => c.value);
      if (spec.image) { const imgs = readRows(imgList); out[spec.image] = spec.imageMulti ? imgs : imgs[0] || null; }
      if (spec.file) { const f = readRows(fileList)[0]; out.file = f ? { url: f.url, size: f.size || null } : null; if (f?.sha256 && !out.sha256) out.sha256 = f.sha256; }
      return out;
    },
    action() {},
    previewPath: name === 'families' ? `/families/${it.slug || ''}/` : `/${name}/#${it.slug || ''}`,
  };
}
