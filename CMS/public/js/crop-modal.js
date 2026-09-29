// Focal-point / zoom / rotate editor (ported from the portfolio CMS). A "fit" is
// { scale, x, y, rotate } and is applied with object-position/transform.
export function parseFit(raw) { if (!raw) return null; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch { return null; } }
function coverScale(iw, ih, w, h, th) { const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th)); if (!iw || !ih) return 1; return Math.max((w * c + h * s) / iw, (w * s + h * c) / ih); }
function clearLayout(el) { for (const k of ['position', 'maxWidth', 'width', 'height', 'left', 'top', 'right', 'bottom', 'objectFit', 'objectPosition', 'transform', 'transformOrigin']) el.style[k] = ''; }
export function layoutFitImage(img, box, fit) {
  if (!img || !box) return false;
  const w = box.clientWidth, h = box.clientHeight, iw = img.naturalWidth, ih = img.naturalHeight;
  if (!w || !h || !iw || !ih) return false;
  fit = parseFit(fit) || {};
  const th = ((Number(fit.rotate) || 0) * Math.PI) / 180, us = Math.max(1, Number(fit.scale) || 1);
  const fx = (Number.isFinite(Number(fit.x)) ? Number(fit.x) : 50) / 100, fy = (Number.isFinite(Number(fit.y)) ? Number(fit.y) : 50) / 100;
  const cover = coverScale(iw, ih, w, h, th) * us, dw = iw * cover, dh = ih * cover, rot = Number(fit.rotate) || 0;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  Object.assign(img.style, { position: 'absolute', maxWidth: 'none', width: dw + 'px', height: dh + 'px', left: w * fx - dw * fx + 'px', top: h * fy - dh * fy + 'px', right: 'auto', bottom: 'auto', objectFit: 'fill', objectPosition: '50% 50%', transform: rot ? `rotate(${rot}deg)` : '', transformOrigin: `${fx * 100}% ${fy * 100}%` });
  return true;
}
export function applyFitStyle(el, fit) {
  if (!el) return; fit = parseFit(el._fitValue = fit);
  if (!fit) { clearLayout(el); return; }
  const paint = () => { const f = el._fitValue; if (!f) return clearLayout(el); if (Number(f.rotate) || 0) return layoutFitImage(el, el.parentElement, f); clearLayout(el); const x = f.x ?? 50, y = f.y ?? 50, s = Number(f.scale); el.style.objectPosition = `${x}% ${y}%`; if (Number.isFinite(s) && s > 1) { el.style.transform = `scale(${s})`; el.style.transformOrigin = `${x}% ${y}%`; } };
  if (!el.complete || !el.naturalWidth) el.addEventListener('load', paint, { once: true });
  paint();
  if (el.parentElement && !el._fitRO && typeof ResizeObserver !== 'undefined') { el._fitRO = new ResizeObserver(paint); el._fitRO.observe(el.parentElement); }
}

const state = { x: 50, y: 50, scale: 1, rotate: 0, dragging: false, lastX: 0, lastY: 0, onSave: null };
const $ = (id) => document.getElementById(id);
function update() {
  layoutFitImage($('crop-preview-img'), $('crop-preview-box'), state);
  $('crop-zoom-slider').value = state.scale; $('crop-rotate-slider').value = state.rotate;
  $('crop-readout').textContent = `Zoom ${state.scale.toFixed(2)}×  ·  X ${Math.round(state.x)}%  ·  Y ${Math.round(state.y)}%  ·  R ${Math.round(state.rotate)}°`;
}
export function openCropModal(src, aspectW, aspectH, label, currentFit, onSave) {
  const f = parseFit(currentFit) || {};
  Object.assign(state, { x: f.x ?? 50, y: f.y ?? 50, scale: f.scale ?? 1, rotate: Number(f.rotate) || 0, dragging: false, onSave });
  $('crop-modal-label').textContent = label;
  const box = $('crop-preview-box'); const maxW = Math.min(560, document.documentElement.clientWidth - 80);
  box.style.width = maxW + 'px'; box.style.height = Math.round((maxW * aspectH) / aspectW) + 'px';
  const img = $('crop-preview-img'); img.onload = update; img.src = `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`;
  $('crop-modal').classList.remove('hidden'); requestAnimationFrame(update);
}
export function bindCropModal() {
  const box = $('crop-preview-box'), modal = $('crop-modal');
  box.addEventListener('pointerdown', (e) => { state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => { if (!state.dragging) return; const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY; state.lastX = e.clientX; state.lastY = e.clientY; state.x = Math.max(0, Math.min(100, state.x - (dx / box.clientWidth) * 100)); state.y = Math.max(0, Math.min(100, state.y - (dy / box.clientHeight) * 100)); update(); });
  box.addEventListener('pointerup', () => (state.dragging = false));
  box.addEventListener('wheel', (e) => { e.preventDefault(); state.scale = Math.max(1, Math.min(4, state.scale - e.deltaY * 0.002)); update(); }, { passive: false });
  $('crop-zoom-slider').addEventListener('input', (e) => { state.scale = Number(e.target.value); update(); });
  $('crop-rotate-slider').addEventListener('input', (e) => { state.rotate = Number(e.target.value); update(); });
  modal.querySelector('[data-crop-reset]').addEventListener('click', () => { Object.assign(state, { x: 50, y: 50, scale: 1, rotate: 0 }); update(); });
  modal.querySelector('[data-crop-save]').addEventListener('click', () => { state.onSave?.({ scale: +state.scale.toFixed(3), x: +state.x.toFixed(1), y: +state.y.toFixed(1), rotate: +state.rotate.toFixed(1) }); modal.classList.add('hidden'); });
  modal.querySelectorAll('[data-crop-cancel]').forEach((b) => b.addEventListener('click', () => modal.classList.add('hidden')));
}
