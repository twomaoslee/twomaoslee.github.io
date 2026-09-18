window.addEventListener('load', () => {
  const nav = document.getElementById('navbar-main');
  const button = nav?.querySelector('.navbar-toggler');
  const menu = document.getElementById('navbar-content');
  const $ = window.jQuery;
  if (!button || !menu || !$?.fn.collapse) return;

  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const compact = () => getComputedStyle(button).display !== 'none';
  let timer;
  const cancelClose = () => window.clearTimeout(timer);
  const closeAfterLeave = () => {
    cancelClose();
    timer = window.setTimeout(() => {
      if (hover.matches && compact() && !nav.matches(':hover') &&
          !nav.contains(document.activeElement)) {
        $(menu).collapse('hide');
      }
    }, 180);
  };

  button.addEventListener('mouseenter', () => {
    cancelClose();
    if (hover.matches && compact()) $(menu).collapse('show');
  });
  nav.addEventListener('mouseenter', cancelClose);
  nav.addEventListener('mouseleave', closeAfterLeave);
  nav.addEventListener('focusout', closeAfterLeave);
  // Bootstrap ignores hide requests during the opening transition.
  $(menu).on('shown.bs.collapse', closeAfterLeave);
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && compact()) {
      cancelClose();
      $(menu).collapse('hide');
      button.focus();
    }
  });
});
