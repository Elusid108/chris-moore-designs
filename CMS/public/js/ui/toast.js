export function toast(text, kind = 'ok') {
  const colors = { ok: '#22d3ee', err: '#ef4444', warn: '#f59e0b' };
  if (window.Toastify) Toastify({ text, duration: kind === 'err' ? 5000 : 2200, gravity: 'bottom', position: 'right', style: { background: colors[kind] || colors.ok, color: '#09090b', fontWeight: 600 } }).showToast();
  else console.log(`[${kind}] ${text}`);
}
