document.querySelectorAll<HTMLElement>('[data-shelf-filters]').forEach((group) => {
  const section = group.closest('section');
  const items = section?.querySelectorAll<HTMLElement>('[data-shelf-item]') || [];
  const empty = section?.querySelector<HTMLElement>('[data-shelf-empty]');
  group.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.filter || 'all';
      group.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('bg-brand-surface-raised', on); b.classList.toggle('border-brand-surface-raised', on); b.classList.toggle('text-white', on);
        b.classList.toggle('border-brand-border', !on); b.classList.toggle('text-brand-text-muted', !on);
      });
      let shown = 0;
      items.forEach((it) => {
        const show = key === 'all' || (key === 'bundles' ? it.dataset.bundle === '1' : it.dataset.family === key);
        it.classList.toggle('hidden', !show);
        if (show) shown++;
      });
      empty?.classList.toggle('hidden', shown > 0);
    });
  });
});
