// Simple to-do list for the store itself (never published).
import { api } from './api.js';
import { esc, btn } from './form.js';
import { toast } from './ui/toast.js';
const STATUSES = ['todo', 'in-progress', 'blocked', 'done'];
let tasks = [];
export async function openTasks(root) {
  tasks = (await api.get('/tasks')).tasks;
  render(root);
  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action; if (!a) return;
    if (a === 'task-add') { tasks.push({ id: `t-${Date.now().toString(36)}`, title: '', status: 'todo', notes: '', subtasks: [] }); render(root); }
    if (a === 'task-remove') { tasks = tasks.filter((t) => t.id !== e.target.closest('[data-task]').dataset.task); render(root); await save(); }
    if (a === 'task-save') await save();
  });
  root.addEventListener('change', async (e) => { const row = e.target.closest('[data-task]'); if (!row) return; const t = tasks.find((x) => x.id === row.dataset.task); if (!t) return; t.title = row.querySelector('[data-f=title]').value; t.status = row.querySelector('[data-f=status]').value; t.notes = row.querySelector('[data-f=notes]').value; await save(); });
}
function render(root) {
  root.innerHTML = `<div class="flex items-start justify-between gap-4 mb-4"><div><p class="font-mono text-[11px] uppercase tracking-widest text-purple-400">CMS</p><h2 class="text-2xl font-bold">Tasks</h2></div>${btn('<i class="ph ph-plus"></i> Task', 'task-add', 'primary')}</div>
    <div class="space-y-2">${tasks.map((t) => `<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-3 grid sm:grid-cols-[1fr_9rem_auto] gap-2" data-task="${t.id}"><input data-f="title" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm ${t.status === 'done' ? 'line-through text-zinc-500' : ''}" placeholder="What needs doing" value="${esc(t.title)}"><select data-f="status" class="bg-transparent border border-zinc-800 rounded px-2 py-1 text-sm">${STATUSES.map((s) => `<option ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button type="button" data-action="task-remove" class="text-zinc-500 hover:text-red-400 px-2"><i class="ph ph-trash"></i></button><textarea data-f="notes" rows="1" class="sm:col-span-3 bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs" placeholder="Notes">${esc(t.notes || '')}</textarea></div>`).join('') || '<p class="text-sm text-zinc-500">No tasks. Add one.</p>'}</div>`;
}
async function save() { try { await api.post('/tasks', { tasks }); } catch (e) { toast(e.message, 'err'); } }
