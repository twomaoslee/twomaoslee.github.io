
    (() => {
      function install() {
        const deck = window.Reveal;
        // Keep main-slide numbering while distinguishing vertical examples.
        // The element itself is Reveal's native, unscaled .slide-number.
        deck.configure({slideNumber: function(slide) {
          const {h, v} = deck.getIndices(slide);
          const main = String(h + 1).padStart(2, '0');
          return [main + (v ? '·' + v : ''), '/', deck.getHorizontalSlides().length];
        }});
        // Treat each dialogue tab as a native Reveal step, including keyboard and controls.
        ['agent-task', 'prepare', 'visual-tools', 'lecture-drafting', 'slide-planning'].forEach(id => {
          const slide = document.getElementById(id);
          if (!slide || slide.dataset.tabStepsReady) return;
          slide.dataset.tabStepsReady = 'true';
          const tabs = [...slide.querySelectorAll('[role="tab"]')];
          const steps = [...slide.querySelectorAll('.dialogue-tab-step')];
          function render() {
            const index = steps.filter(step => step.classList.contains('visible')).length;
            const panel = document.getElementById(tabs[index].getAttribute('aria-controls'));
            const heading = slide.querySelector('[data-dialogue-heading]');
            if (heading && panel.dataset.dialogueTitle) heading.textContent = panel.dataset.dialogueTitle;
            tabs.forEach((tab, i) => {
              tab.setAttribute('aria-selected', String(i === index));
              tab.tabIndex = i === index ? 0 : -1;
              document.getElementById(tab.getAttribute('aria-controls')).hidden = i !== index;
            });
          }
          function choose(index) {
            deck.navigateFragment(index - 1);
            render();
          }
          tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => choose(index));
            tab.addEventListener('keydown', event => {
              let next;
              if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              event.stopPropagation();
              choose(next);
              tabs[next].focus();
            });
          });
          ['fragmentshown', 'fragmenthidden'].forEach(name => deck.on(name, event => {
            if (slide.contains(event.fragment)) render();
          }));
          deck.on('slidechanged', event => { if (event.currentSlide === slide) render(); });
          slide.querySelectorAll('.prepare-transcript').forEach(panel => {
            panel.addEventListener('wheel', event => event.stopPropagation(), {passive: true});
            panel.addEventListener('keydown', event => {
              if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) event.stopPropagation();
            });
          });
          slide.querySelectorAll('.prepare-transcript a').forEach(link => {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
          });
          slide.querySelectorAll('.draft-excerpt-jump').forEach(button => {
            button.addEventListener('click', () => {
              const panel = button.closest('.prepare-transcript');
              const excerpt = panel.querySelector('.planning-result-shot, .draft-note-excerpt');
              const scale = deck.getScale() || 1;
              panel.scrollTop += (excerpt.getBoundingClientRect().top - panel.getBoundingClientRect().top) / scale - 12;
            });
          });
          slide.querySelectorAll('.planning-shot-open').forEach(button => {
            button.addEventListener('click', () => {
              const figure = button.closest('figure');
              const dialog = document.createElement('dialog');
              dialog.className = 'planning-shot-lightbox';
              dialog.setAttribute('aria-label', button.querySelector('img').alt);
              const close = document.createElement('button');
              close.type = 'button';
              close.textContent = '关闭 ×';
              const picture = button.querySelector('img').cloneNode(true);
              const caption = document.createElement('p');
              caption.textContent = figure.querySelector('figcaption strong').textContent + ' · 修改后留存截图';
              dialog.append(close, picture, caption);
              document.body.appendChild(dialog);
              close.addEventListener('click', () => dialog.close());
              dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
              dialog.addEventListener('keydown', event => event.stopPropagation());
              dialog.addEventListener('close', () => { dialog.remove(); button.focus({preventScroll: true}); }, {once: true});
              dialog.showModal();
            });
          });
          slide.querySelectorAll('.dialogue-demo-expand').forEach(button => {
            button.addEventListener('click', async () => {
              const frame = button.closest('.dialogue-live-demo').querySelector('iframe');
              try { await frame.requestFullscreen(); }
              catch { button.textContent = '请用浏览器全屏'; }
            });
          });
          render();
        });
        // Load bundled local showcases on first entry and retain iframe navigation between slides.
        const showcases = Array.from(document.querySelectorAll('.result-browser'));
        const loadShowcases = () => showcases.forEach(panel => {
          const frame = panel.querySelector('iframe');
          if (panel.closest('section') === deck.getCurrentSlide() && !frame.hasAttribute('src') && !frame.dataset.bundleLoading) {
            window.__reportBundle.mount(frame, frame.dataset.showcaseSrc);
          }
        });
        showcases.forEach(panel => {
          const frame = panel.querySelector('iframe');
          const expand = panel.querySelector('.result-browser-expand');
          panel.querySelector('.result-browser-home').addEventListener('click', () => {
            window.__reportBundle.mount(frame, frame.dataset.showcaseSrc);
          });
          expand.addEventListener('click', async () => {
            try {
              if (document.fullscreenElement === panel) await document.exitFullscreen();
              else await panel.requestFullscreen();
            } catch { expand.textContent = '请点新窗口浏览'; }
          });
          document.addEventListener('fullscreenchange', () => {
            expand.textContent = document.fullscreenElement === panel ? '退出放大' : '放大浏览';
            if (!document.fullscreenElement) deck.layout();
          });
        });
        deck.on('slidechanged', loadShowcases);
        loadShowcases();
        document.querySelectorAll('.ppt-example').forEach(panel => {
          const pages = Array.from(panel.querySelectorAll('.ppt-example-viewport img'));
          const counter = panel.querySelector('.ppt-example-count');
          const buttons = Array.from(panel.querySelectorAll('[data-ppt-step]'));
          let index = 0;
          const render = () => {
            pages.forEach((page, i) => { page.hidden = i !== index; });
            if (counter) counter.textContent = `${index + 1} / ${pages.length}`;
            buttons.forEach(button => { button.disabled = Number(button.dataset.pptStep) < 0 ? index === 0 : index === pages.length - 1; });
          };
          buttons.forEach(button => button.addEventListener('click', event => {
            event.stopPropagation();
            index = Math.max(0, Math.min(pages.length - 1, index + Number(button.dataset.pptStep)));
            render();
          }));
          const expand = panel.querySelector('.ppt-example-expand');
          expand.addEventListener('click', async () => {
            try {
              if (document.fullscreenElement === panel) await document.exitFullscreen();
              else await panel.requestFullscreen();
            } catch { expand.textContent = '全屏不可用'; }
          });
          document.addEventListener('fullscreenchange', () => {
            expand.textContent = document.fullscreenElement === panel ? '退出放大' : '放大';
            if (!document.fullscreenElement) deck.layout();
          });
          render();
        });
        document.querySelectorAll('.wave-example').forEach(panel => {
          const frame = panel.querySelector('iframe');
          const viewport = panel.querySelector('.wave-example-viewport');
          const fit = () => {
            const scale = Math.min(viewport.clientWidth / 1280, viewport.clientHeight / 720);
            frame.style.transform = `translate(${(viewport.clientWidth - 1280 * scale) / 2}px, ${(viewport.clientHeight - 720 * scale) / 2}px) scale(${scale})`;
          };
          new ResizeObserver(fit).observe(viewport);
          deck.on('slidechanged', fit);
          panel.querySelectorAll('[data-wave-key]').forEach(button => button.addEventListener('click', event => {
            event.stopPropagation();
            frame.contentWindow.postMessage({type:'wave-example-key',key:button.dataset.waveKey}, '*');
          }));
          panel.querySelector('.wave-example-expand').addEventListener('click', async () => {
            if (document.fullscreenElement === panel) await document.exitFullscreen();
            else try { await panel.requestFullscreen(); } catch { panel.querySelector('.wave-example-expand').textContent='全屏不可用'; }
          });
          document.addEventListener('fullscreenchange', () => {
            panel.querySelector('.wave-example-expand').textContent = document.fullscreenElement === panel ? '退出放大' : '放大';
            fit();
          });
          window.addEventListener('message', event => {
            if (event.source !== frame.contentWindow || event.data?.type !== 'wave-example-state') return;
            const {current,total} = event.data;
            if (!Number.isInteger(current) || !Number.isInteger(total) || current<1 || current>total) return;
            if (!panel.querySelector('.wave-example-count')) return;
            panel.querySelector('.wave-example-count').textContent = `${current} / ${total}`;
            panel.querySelector('[data-wave-key="ArrowLeft"]').disabled = current === 1;
            panel.querySelector('[data-wave-key="ArrowRight"]').disabled = current === total;
          });
          fit();
        });
        const logo = deck.getRevealElement().querySelector(':scope > .slide-logo');
        if (logo) logo.alt = '中南大学';
      }
      function ready() {
        if (window.Reveal?.isReady()) install();
        else window.Reveal?.on('ready', install);
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once: true});
      else ready();
    })();
    