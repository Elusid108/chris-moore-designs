const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
toggle?.addEventListener('click', () => {
  const open = menu?.classList.toggle('hidden') === false;
  menu?.classList.toggle('flex', open);
  toggle.setAttribute('aria-expanded', String(open));
});
