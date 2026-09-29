// AI copywriting for products via Google Gemini. The API key is sent by the
// browser on each request (stored in the browser, never on disk here).
const fs = require('fs');
const path = require('path');
const data = require('./data');

const GUIDE = () => fs.readFileSync(path.join(__dirname, '..', 'prompts', 'product-guide.md'), 'utf8');
const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function productBlock(p) {
  const fam = data.list('families').find((f) => f.id === p.family);
  const specs = (p.specsData || []).map((g) => `${g.title}: ` + g.items.map((i) => `${i.name} = ${i.qty ? i.qty + ' × ' : ''}${i.specs}`).join('; ')).join('\n');
  const variants = (p.variants || []).map((v) => `${v.title} (${v.sku}) ${v.price}`).join('; ');
  const fw = data.list('firmware').filter((f) => (p.firmware || []).includes(f.id)).map((f) => `${f.name} v${f.version}`).join(', ');
  const sw = data.list('software').filter((s) => (p.software || []).includes(s.id)).map((s) => s.name).join(', ');
  return [`Title: ${p.title}`, `SKU: ${p.sku}`, `Family: ${fam?.name || ''} — ${fam?.tagline || ''}`, `Variants: ${variants}`, specs ? `Specs:\n${specs}` : '', fw ? `Firmware: ${fw}` : '', sw ? `Software: ${sw}` : '', p.summary ? `Current summary: ${strip(p.summary)}` : '', p.description ? `Current description: ${strip(p.description)}` : '', p.notes ? `Author notes: ${p.notes}` : ''].filter(Boolean).join('\n');
}

// Only <p>, <ul>, <li>, <strong>, <em> survive; everything else is unwrapped.
function sanitizeHtml(html) {
  return String(html || '').replace(/<(?!\/?(p|ul|li|strong|em)\b)[^>]*>/gi, '').replace(/<(p|ul|li|strong|em)\s[^>]*>/gi, '<$1>');
}

async function runTask({ task, apiKey, modelId, product, messages = [] }) {
  if (!apiKey) throw Object.assign(new Error('Gemini API key missing (set it under Settings → AI)'), { status: 400 });
  if (!['summary', 'description', 'interview'].includes(task)) throw Object.assign(new Error('Unknown task'), { status: 400 });
  const model = modelId || 'gemini-2.5-flash';
  const temp = { summary: 0.4, description: 0.5, interview: 0.6 }[task];
  const user = `TASK: ${task}\n\nPRODUCT DATA:\n${productBlock(product || {})}${messages.length ? `\n\nINTERVIEW SO FAR:\n${messages.map((m) => `${m.role === 'user' ? 'Author' : 'You'}: ${m.text}`).join('\n')}` : ''}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: GUIDE() }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: temp, responseMimeType: 'application/json' } }),
  });
  if (!res.ok) { const t = await res.text(); throw Object.assign(new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`), { status: 502 }); }
  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '{}';
  let out; try { out = JSON.parse(raw); } catch { throw Object.assign(new Error('Gemini returned something that was not JSON'), { status: 502 }); }
  const tidy = (s) => String(s || '').replace(/\s[—–]\s/g, ', ').trim();
  if (task === 'summary') return { text: tidy(out.text) };
  if (task === 'interview') return { question: tidy(out.question) };
  return { html: sanitizeHtml(tidy(out.html) || (out.text ? `<p>${esc(out.text)}</p>` : '')) };
}

module.exports = { runTask, productBlock, sanitizeHtml };
