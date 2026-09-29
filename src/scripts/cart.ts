// Cart drawer behaviour. Talks to Shopify's Storefront API with the public token
// when configured; otherwise it only explains that the store is opening soon.
import { cartCreate, cartGet, cartLinesAdd, cartLinesRemove, cartLinesUpdate, formatMoney, shopifyConfigured, type Cart } from '../lib/shopify';

const KEY = 'cmd.cartId';
let cart: Cart | null = null;
const drawer = document.querySelector<HTMLElement>('[data-cart-drawer]');
const lines = drawer?.querySelector<HTMLElement>('[data-cart-lines]');
const checkout = drawer?.querySelector<HTMLAnchorElement>('[data-cart-checkout]');
const note = drawer?.querySelector<HTMLElement>('[data-cart-note]');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

function render() {
  const count = cart?.totalQuantity ?? 0;
  const subtotal = cart ? formatMoney(cart.cost.subtotalAmount) : '$0.00';
  document.querySelectorAll<HTMLElement>('[data-cart-subtotal]').forEach((s) => (s.textContent = subtotal));
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((c) => { c.textContent = String(count); c.classList.toggle('hidden', count === 0); });
  if (!lines || !checkout) return;
  if (!cart || cart.lines.nodes.length === 0) {
    lines.innerHTML = `<p class="text-brand-text-muted">${shopifyConfigured ? 'Your cart is empty.' : 'The store is opening soon. Boards, the PixelPilot HAT and bundles will be orderable here, with checkout on Shopify.'}</p>`;
    checkout.classList.add('pointer-events-none', 'opacity-40');
    return;
  }
  checkout.classList.remove('pointer-events-none', 'opacity-40');
  checkout.href = cart.checkoutUrl;
  lines.innerHTML = cart.lines.nodes.map((l) => `
    <div class="flex items-start justify-between gap-3 py-3 border-b border-brand-border" data-line="${esc(l.id)}">
      <div class="min-w-0">
        <div class="font-semibold truncate">${esc(l.merchandise.product.title)}</div>
        <div class="text-brand-text-muted text-xs">${l.merchandise.title !== 'Default Title' ? esc(l.merchandise.title) : ''}</div>
        <div class="font-mono text-xs mt-1">${formatMoney(l.merchandise.price)}</div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" class="w-7 h-7 rounded border border-brand-border-strong hover:border-brand-accent" data-qty="-1" aria-label="Decrease quantity">−</button>
        <span class="font-mono w-6 text-center">${l.quantity}</span>
        <button type="button" class="w-7 h-7 rounded border border-brand-border-strong hover:border-brand-accent" data-qty="1" aria-label="Increase quantity">+</button>
        <button type="button" class="ml-1 text-brand-text-subtle hover:text-white" data-remove aria-label="Remove">✕</button>
      </div>
    </div>`).join('');
}

function open() { drawer?.classList.remove('hidden'); render(); }
function close() { drawer?.classList.add('hidden'); }

async function load() {
  if (!shopifyConfigured) return;
  try { const id = localStorage.getItem(KEY); if (id) cart = await cartGet(id); } catch { cart = null; }
  render();
}

async function add(merchandiseId: string, quantity: number) {
  if (!cart) {
    cart = await cartCreate([{ merchandiseId, quantity }]);
    try { localStorage.setItem(KEY, cart.id); } catch { /* storage unavailable */ }
  } else {
    cart = await cartLinesAdd(cart.id, [{ merchandiseId, quantity }]);
  }
}

document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-cart-open]')) { open(); return; }
  if (t.closest('[data-cart-close]')) { close(); return; }
  const addBtn = t.closest<HTMLButtonElement>('[data-add-to-cart]');
  if (addBtn) {
    const id = addBtn.dataset.variantId;
    if (!shopifyConfigured || !id) { open(); return; }
    const qtyEl = addBtn.dataset.quantityFrom ? document.getElementById(addBtn.dataset.quantityFrom) as HTMLInputElement | null : null;
    const qty = Math.max(1, Number(qtyEl?.value || addBtn.dataset.quantity || 1));
    addBtn.disabled = true;
    try { await add(id, qty); open(); }
    catch (err) { if (note) note.textContent = `Could not add to cart: ${(err as Error).message}`; open(); }
    finally { addBtn.disabled = false; }
    return;
  }
  const row = t.closest<HTMLElement>('[data-line]');
  if (row && cart) {
    const lineId = row.dataset.line!;
    const line = cart.lines.nodes.find((l) => l.id === lineId);
    if (!line) return;
    if (t.closest('[data-remove]')) { cart = await cartLinesRemove(cart.id, [lineId]); render(); return; }
    const step = t.closest<HTMLElement>('[data-qty]');
    if (step) { const q = line.quantity + Number(step.dataset.qty); cart = q <= 0 ? await cartLinesRemove(cart.id, [lineId]) : await cartLinesUpdate(cart.id, [{ id: lineId, quantity: q }]); render(); }
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
void load();
