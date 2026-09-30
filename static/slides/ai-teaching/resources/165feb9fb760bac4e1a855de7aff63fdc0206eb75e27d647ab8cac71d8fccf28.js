
    (function () {
      function install() {
        const deck = window.Reveal;
        const pages = [...document.querySelectorAll('[data-demo-index]')];
        const active = () => deck.getCurrentSlide()?.hasAttribute('data-demo-index') && !deck.isOverview();
        function advance(direction) {
          if (direction > 0 ? deck.nextFragment() : deck.prevFragment()) return;
          const {h, v} = deck.getIndices();
          const index = Number(deck.getCurrentSlide().dataset.demoIndex);
          // Vertical navigation stops at the boundary of this branch.
          if (direction > 0 && index === pages.length - 1) return;
          deck.slide(h, v + direction, direction < 0 ? Infinity : -1);
        }
        window.addEventListener('keydown', event => {
          if (!active() || event.altKey || event.ctrlKey || event.metaKey ||
              event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
          const direction = (event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) ? 1 :
            (event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) ? -1 : 0;
          if (direction) { event.preventDefault(); event.stopImmediatePropagation(); advance(direction); }
          else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault(); event.stopImmediatePropagation();
            deck.slide(deck.getIndices().h + (event.key === 'ArrowRight' ? 1 : -1), 0);
          }
        }, true);
        window.addEventListener('click', event => {
          if (!active()) return;
          const direction = event.target.closest?.('.navigate-down') ? 1 : event.target.closest?.('.navigate-up') ? -1 : 0;
          if (direction) { event.preventDefault(); event.stopImmediatePropagation(); advance(direction); }
        }, true);
        function updateDown() {
          queueMicrotask(() => {
            if (!active()) return;
            const button = document.querySelector('.reveal > .controls .navigate-down');
            const canAdvance = Number(deck.getCurrentSlide().dataset.demoIndex) < pages.length - 1 || deck.availableFragments().next;
            if (button) { button.classList.toggle('enabled', canAdvance); button.disabled = !canAdvance; }
          });
        }
        deck.on('slidechanged', updateDown);
        deck.on('fragmentshown', updateDown);
        deck.on('fragmenthidden', updateDown);
        deck.on('overviewhidden', updateDown);
        if (/^#\/(demo-|quarto-demo-)/.test(location.hash) && !document.getElementById(location.hash.slice(2))) {
          const {h, v} = deck.getIndices(pages[0]); deck.slide(h, v);
        }
        updateDown();
      }
      function ready() {
        if (window.Reveal?.isReady()) install();
        else window.Reveal?.on('ready', install);
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
      else ready();
    })();
    