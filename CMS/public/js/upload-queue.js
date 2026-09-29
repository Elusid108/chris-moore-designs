// Bottom-right upload panel (ported from the portfolio CMS). Tasks run one at a time.
export const uploadQueue = {
  _tasks: [], _running: false, _hideTimer: null,
  add(label, type, taskFn, estimatedMs = 4000) {
    clearTimeout(this._hideTimer);
    const panel = document.getElementById('upload-queue'); panel.classList.remove('hidden');
    const el = document.createElement('div');
    el.className = 'px-4 py-2.5 transition-opacity duration-500';
    el.innerHTML = `<div class="flex justify-between items-center mb-1.5"><span class="text-xs font-medium text-zinc-300 truncate flex-1 mr-2"></span><span class="queue-status text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 flex-shrink-0">Queued</span></div><div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div class="queue-bar h-full rounded-full transition-[width] duration-300 ease-out bg-cyan-400" style="width:0%"></div></div>`;
    el.querySelector('span').textContent = label;
    document.getElementById('queue-items').appendChild(el);
    const bar = el.querySelector('.queue-bar'), badge = el.querySelector('.queue-status');
    const task = {
      el, estimatedMs, startTime: null, _timer: null, taskFn,
      setProgress(pct, text) { bar.style.width = pct + '%'; badge.textContent = text || Math.round(pct) + '%'; badge.className = 'queue-status text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-cyan-950 text-cyan-400'; uploadQueue._eta(); },
      startTimer() { this.startTime = Date.now(); this._timer = setInterval(() => { const pct = Math.min(95, ((Date.now() - this.startTime) / this.estimatedMs) * 100); bar.style.width = pct + '%'; badge.textContent = Math.round(pct) + '%'; badge.className = 'queue-status text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-cyan-950 text-cyan-400'; uploadQueue._eta(); }, 200); },
      stopTimer() { clearInterval(this._timer); },
      markDone(failed) { this.stopTimer(); bar.style.width = '100%'; badge.textContent = failed ? 'Failed' : 'Done'; badge.className = `queue-status text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${failed ? 'bg-red-950 text-red-400' : 'bg-emerald-950 text-emerald-400'}`; if (!failed) setTimeout(() => el.classList.add('opacity-40'), 400); },
    };
    this._tasks.push(task); this._eta(); this._run();
    return task;
  },
  async _run() {
    if (this._running) return; this._running = true;
    const icon = document.getElementById('queue-header-icon'), label = document.getElementById('queue-header-label');
    if (icon) icon.className = 'ph ph-spinner animate-spin text-cyan-400'; if (label) label.textContent = 'Processing uploads…';
    let failed = 0;
    while (this._tasks.length) {
      const t = this._tasks[0]; t.startTime = Date.now();
      let bad = false;
      try { await t.taskFn(t); } catch (err) { bad = true; failed++; console.error('Upload failed:', err); if (window.cmsToast) window.cmsToast(err.message, 'err'); }
      t.markDone(bad); this._tasks.shift(); this._eta();
    }
    this._running = false;
    if (icon) icon.className = failed ? 'ph ph-warning text-red-400' : 'ph ph-check-circle text-green-400'; if (label) label.textContent = failed ? `${failed} upload(s) failed` : 'All uploads complete';
    this._hideTimer = setTimeout(() => { document.getElementById('upload-queue').classList.add('hidden'); document.getElementById('queue-items').innerHTML = ''; }, failed ? 8000 : 2500);
  },
  _eta() {
    const el = document.getElementById('queue-eta'); if (!el) return;
    let ms = 0; this._tasks.forEach((t, i) => { ms += i === 0 && t.startTime ? Math.max(0, t.estimatedMs - (Date.now() - t.startTime)) : t.estimatedMs; });
    if (ms <= 0) { el.textContent = ''; return; } const s = Math.round(ms / 1000); el.textContent = s < 60 ? `~${s}s left` : `~${Math.round(s / 60)}m left`;
  },
};
