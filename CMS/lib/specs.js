// Renders specsData (groups of name/qty/specs rows, same shape as the portfolio
// CMS) into the HTML the site shows. One implementation, used on save and publish.
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function specsDataToHtml(groups) {
  if (!Array.isArray(groups)) return '';
  return groups
    .filter((g) => g && Array.isArray(g.items) && g.items.some((i) => i && (i.name || i.specs)))
    .map((g) => {
      const rows = g.items
        .filter((i) => i && (i.name || i.specs))
        .map((i) => {
          const qty = String(i.qty || '').trim();
          const value = qty ? `${esc(qty)} × ${esc(i.specs)}` : esc(i.specs);
          return `<dt>${esc(i.name)}</dt><dd>${value}</dd>`;
        })
        .join('');
      const title = String(g.title || '').trim();
      return `${title ? `<h3>${esc(title)}</h3>` : ''}<dl>${rows}</dl>`;
    })
    .join('');
}

function normalizeSpecsData(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.map((g, gi) => ({
    id: String(g?.id || `g${gi + 1}`),
    title: String(g?.title || ''),
    items: (Array.isArray(g?.items) ? g.items : []).map((i, ii) => ({
      id: String(i?.id || `g${gi + 1}i${ii + 1}`), name: String(i?.name || ''), qty: String(i?.qty || ''), specs: String(i?.specs || ''),
    })),
  }));
}

module.exports = { specsDataToHtml, normalizeSpecsData, esc };
