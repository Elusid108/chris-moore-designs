// Variant pills, quantity stepper and thumbnail swap for ProductHero.
interface PillData { productId: string; title: string; summary: string; price: string; sku: string; variantId: string | null; specs: string; url: string; family: string; eyebrow: string }

document.querySelectorAll<HTMLElement>('[data-product-hero]').forEach((hero) => {
  const q = <T extends Element>(sel: string) => hero.querySelector<T>(sel);
  const qty = q<HTMLInputElement>('[data-qty]');
  hero.querySelectorAll<HTMLButtonElement>('[data-qty-step]').forEach((b) => b.addEventListener('click', () => {
    if (!qty) return;
    qty.value = String(Math.max(1, (Number(qty.value) || 1) + Number(b.dataset.qtyStep)));
  }));

  const add = q<HTMLButtonElement>('[data-add-to-cart]');
  const ready = document.querySelector<HTMLElement>('[data-cart-drawer]')?.dataset.shopifyReady === '1';
  const pills = hero.querySelectorAll<HTMLButtonElement>('[data-pill]');
  pills.forEach((pill) => pill.addEventListener('click', () => {
    const d = JSON.parse(pill.dataset.pill || '{}') as PillData;
    pills.forEach((p) => p.setAttribute('aria-pressed', String(p === pill)));
    const set = (sel: string, html: string, asHtml = false) => { const el = q<HTMLElement>(sel); if (el) asHtml ? (el.innerHTML = html) : (el.textContent = html); };
    set('[data-hero-title]', d.title); set('[data-hero-summary]', d.summary, true); set('[data-hero-price]', d.price); set('[data-hero-sku]', d.sku); set('[data-hero-specs]', d.specs, true);
    const badge = q<HTMLElement>('[data-hero-badge]'); if (badge) { badge.textContent = d.eyebrow; badge.classList.toggle('hidden', !d.eyebrow); }
    const link = q<HTMLAnchorElement>('[data-hero-title-link]'); if (link) link.href = d.url;
    if (add) {
      const ok = ready && Boolean(d.variantId);
      if (d.variantId) add.dataset.variantId = d.variantId; else delete add.dataset.variantId;
      add.dataset.sku = d.sku; add.disabled = !ok; add.setAttribute('aria-disabled', String(!ok)); add.textContent = ok ? 'Add to cart' : 'Coming soon';
    }
  }));

  const main = hero.querySelector<HTMLImageElement>('img');
  hero.querySelectorAll<HTMLButtonElement>('[data-hero-thumb]').forEach((t) => t.addEventListener('click', () => {
    if (main && t.dataset.heroThumb) main.src = t.dataset.heroThumb;
    hero.querySelectorAll<HTMLButtonElement>('[data-hero-thumb]').forEach((x) => { x.classList.toggle('border-brand-accent', x === t); x.classList.toggle('border-brand-border-strong', x !== t); });
  }));
});
