// Quill factory. Pasted colours/fonts are stripped so site typography stays consistent.
const stripStyles = [Node.ELEMENT_NODE, (node, delta) => { delta.ops.forEach((op) => { if (op.attributes) { delete op.attributes.color; delete op.attributes.background; delete op.attributes.font; delete op.attributes.size; } }); return delta; }];
const TOOLBARS = {
  short: [['bold', 'italic', 'underline', 'strike'], ['link', 'clean']],
  long: [['bold', 'italic', 'underline', 'strike'], [{ header: 2 }, { header: 3 }], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'clean']],
};
export function makeEditor(el, kind = 'long', { placeholder = '', onChange } = {}) {
  const q = new Quill(el, { theme: 'snow', placeholder, modules: { toolbar: TOOLBARS[kind] || TOOLBARS.long, clipboard: { matchers: [stripStyles] } } });
  if (onChange) q.on('text-change', (d, o, source) => { if (source === 'user') onChange(); });
  return {
    quill: q,
    get html() { const h = q.root.innerHTML; return h === '<p><br></p>' ? '' : h; },
    set html(v) { q.setContents([]); if (v) q.clipboard.dangerouslyPasteHTML(v, 'api'); },
    get text() { return q.getText().trim(); },
  };
}
