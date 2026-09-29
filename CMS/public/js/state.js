export const state = {
  collections: { families: [], products: [], firmware: [], software: [], services: [] },
  settings: {}, status: null,
  current: null,          // { type: 'product'|'family'|'firmware'|'software'|'service'|'settings'|'tasks', id }
  dirty: false,
  editor: null,           // active editor instance { save(), collect() }
};
export const byId = (name, id) => state.collections[name]?.find((i) => i.id === id) || null;
export const labelOf = (item) => item?.title || item?.name || '(untitled)';
export const familyName = (id) => byId('families', id)?.name || '—';
export function setDirty(v) { state.dirty = v; document.getElementById('dirty-dot')?.classList.toggle('hidden', !v); }
