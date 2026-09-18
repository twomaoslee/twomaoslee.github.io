document.querySelectorAll('[data-gallery-carousel], [data-publication-carousel]').forEach(gallery => {
  const strip = gallery.querySelector('.group-photo-strip, .featured-paper-strip');
  const previous = gallery.querySelector('.gallery-prev');
  const next = gallery.querySelector('.gallery-next');
  const update = () => {
    previous.disabled = strip.scrollLeft <= 1;
    next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
  };
  const move = direction => {
    const card = strip.firstElementChild;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(strip).gap);
    const step = card.getBoundingClientRect().width + gap;
    const count = Math.max(1, Math.floor((strip.clientWidth + gap + 1) / step));
    strip.scrollBy({left: direction * step * count,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  strip.addEventListener('scroll', update, {passive: true});
  new ResizeObserver(update).observe(strip);
  update();
});
