// Promise-based confirm modal (#confirm-modal in index.html).
let resolver = null;
export function confirmAction({ title = 'Are you sure?', text = '', ok = 'Confirm', danger = false } = {}) {
  const m = document.getElementById('confirm-modal');
  m.querySelector('[data-confirm-title]').textContent = title;
  m.querySelector('[data-confirm-text]').textContent = text;
  const okBtn = m.querySelector('[data-confirm-ok]');
  okBtn.textContent = ok;
  okBtn.className = `px-4 py-2 rounded-lg font-bold ${danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-white text-black hover:bg-cyan-400'}`;
  m.classList.remove('hidden');
  return new Promise((resolve) => { resolver = resolve; });
}
export function bindConfirm() {
  const m = document.getElementById('confirm-modal');
  const close = (v) => { m.classList.add('hidden'); resolver?.(v); resolver = null; };
  m.querySelector('[data-confirm-ok]').addEventListener('click', () => close(true));
  m.querySelectorAll('[data-confirm-cancel]').forEach((b) => b.addEventListener('click', () => close(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.classList.contains('hidden')) close(false); });
}
