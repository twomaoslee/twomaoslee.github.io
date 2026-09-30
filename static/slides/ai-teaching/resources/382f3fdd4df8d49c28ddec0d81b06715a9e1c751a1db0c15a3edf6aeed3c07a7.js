
    (() => {
      function install() {
        const deck = window.Reveal, video = document.getElementById('history-drawing-video');
        // Keep old links to the exercise example pointing to the merged gallery.
        if (location.hash === '#/handmade-exercise') {
          const merged = deck.getIndices(document.getElementById('handmade-phasor'));
          deck.slide(merged.h, merged.v);
        }
        document.querySelectorAll('.quarto-source-scroll, .beamer-source-scroll').forEach(pane => {
          pane.addEventListener('keydown', event => {
            if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) event.stopPropagation();
          });
        });
        const button = document.querySelector('#handmade-animation .history-video-play');
        const status = document.querySelector('.history-video-status');
        let started = false, full = false;
        const inVideo = () => deck.getCurrentSlide()?.id === 'handmade-animation';
        const geoVideos = [...document.querySelectorAll('#handmade-geogebra video')];
        const geoStarted = new Set();
        const geoStatus = document.querySelector('.geogebra-video-status');
        const inGeo = () => deck.getCurrentSlide()?.id === 'handmade-geogebra';
        let geoFullscreen = null;
        function exitGeoFullscreen(v) {
          if (document.fullscreenElement === v) document.exitFullscreen().catch(() => {});
          else if (v.webkitDisplayingFullscreen) v.webkitExitFullscreen?.();
        }
        function stopGeo() { geoVideos.forEach(v => { v.pause(); exitGeoFullscreen(v); }); }
        function playGeo(v, restart = false) {
          geoVideos.filter(other => other !== v).forEach(other => other.pause());
          if (restart || v.ended) v.currentTime = 0;
          geoStarted.add(v); geoStatus.textContent = '';
          v.play()?.catch(() => { geoStarted.delete(v); geoStatus.textContent = '请点击视频中的播放键。'; });
        }
        document.querySelectorAll('.geogebra-play').forEach(b => {
          b.addEventListener('click', () => playGeo(document.getElementById(b.dataset.video), true));
        });
        geoVideos.forEach(v => {
          v.addEventListener('play', () => {
            geoStarted.add(v); geoVideos.filter(other => other !== v).forEach(other => other.pause());
            document.querySelector('[data-video="'+v.id+'"]').textContent = '重新播放';
          });
          v.addEventListener('ended', () => exitGeoFullscreen(v));
          v.addEventListener('webkitendfullscreen', () => v.pause());
          v.addEventListener('error', () => { geoStarted.delete(v); geoStatus.textContent = '视频未能加载，请重新加载页面后重试。'; });
        });
        document.addEventListener('fullscreenchange', () => {
          if (geoFullscreen && document.fullscreenElement !== geoFullscreen) geoFullscreen.pause();
          geoFullscreen = geoVideos.includes(document.fullscreenElement) ? document.fullscreenElement : null;
        });

        const hasNextVertical = () => {
          const current = deck.getCurrentSlide();
          return current?.nextElementSibling?.tagName === 'SECTION';
        };
        const inBranch = () => deck.getCurrentSlide()?.matches('.history-detail, .scenario-detail') && !deck.isOverview();
        function leaveFullscreen() {
          if (document.fullscreenElement === video) document.exitFullscreen().catch(() => {});
          else if (video.webkitDisplayingFullscreen) video.webkitExitFullscreen?.();
        }
        function stop() { video.pause(); leaveFullscreen(); }
        function play(restart = false) {
          if (restart || video.ended) video.currentTime = 0;
          started = true; status.textContent = '';
          // Playback starts inline from the user's key/click activation.
          video.play()?.catch(() => { started = false; status.textContent = '请点击视频中的播放键。'; });
        }
        button.addEventListener('click', () => play(true));
        video.addEventListener('play', () => { started = true; button.textContent = '重新播放'; });
        video.addEventListener('ended', leaveFullscreen);
        video.addEventListener('error', () => {
          started = false; status.textContent = '视频解码失败，请重新加载页面后重试。';
        });
        document.addEventListener('fullscreenchange', () => {
          const now = document.fullscreenElement === video;
          if (full && !now) video.pause();
          full = now;
        });
        video.addEventListener('webkitendfullscreen', () => video.pause());
        function next() {
          if (inGeo()) { const pending = geoVideos.find(v => !geoStarted.has(v)); if (pending) { playGeo(pending); return; } }
          if (inVideo() && !started) { play(); return; }
          const {h, v} = deck.getIndices();
          if (hasNextVertical()) deck.slide(h, v + 1);
        }
        window.addEventListener('keydown', event => {
          if (event.key === 'Escape' && inGeo()) { stopGeo(); return; }
          if (event.key === 'Escape' && inVideo()) { video.pause(); return; }
          if (!inBranch() || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, button, video, .quarto-source-scroll, .beamer-source-scroll')) return;
          const forward = ['ArrowDown','PageDown',' '].includes(event.key) && !event.shiftKey;
          if (forward) {
            event.preventDefault(); event.stopImmediatePropagation(); next();
          }
        }, true);
        window.addEventListener('click', event => {
          if (!inBranch()) return;
          if (event.target.closest?.('.navigate-down')) {
            event.preventDefault(); event.stopImmediatePropagation(); next();
          }
        }, true);
        function update() {
          if (!inGeo()) stopGeo();
          if (!inVideo()) { stop(); }
          queueMicrotask(() => {
            if (!inBranch()) return;
            const down = document.querySelector('.reveal > .controls .navigate-down');
            if (down) { const enabled = hasNextVertical(); down.classList.toggle('enabled', enabled); down.disabled = !enabled; }
          });
        }
        deck.on('slidechanged', update);
        deck.on('overviewshown', () => { stop(); stopGeo(); });
        deck.on('overviewhidden', update);
        update();
      }
      function ready() { if (window.Reveal?.isReady()) install(); else window.Reveal?.on('ready', install); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true}); else ready();
    })();
    