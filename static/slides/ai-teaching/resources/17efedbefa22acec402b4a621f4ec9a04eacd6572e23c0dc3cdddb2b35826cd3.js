
        // 【核心新增】根字号动态缩放引擎：以 1280px 为基准
        function updateRootFontSize() {
            const container = document.getElementById('app-container');
            const baseWidth = 1280;
            const currentWidth = container.clientWidth;
            // 限制字号范围，防止极端尺寸下布局崩溃
            const newFontSize = Math.max(12, Math.min(32, (currentWidth / baseWidth) * 16));
            document.documentElement.style.fontSize = newFontSize + 'px';
        }

        const canvas = document.getElementById('sim-canvas');
        const ctx = canvas.getContext('2d');
        let logicalWidth, logicalHeight;
        
        function resize() {
            const container = canvas.parentElement;
            logicalWidth = container.clientWidth;
            logicalHeight = container.clientHeight;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = logicalWidth * dpr;
            canvas.height = logicalHeight * dpr;
            canvas.style.width = logicalWidth + 'px';
            canvas.style.height = logicalHeight + 'px';
            ctx.setTransform(1, 0, 0, 1, 0, 0); 
            ctx.scale(dpr, dpr);
            updateRootFontSize(); // 同步更新字号
        }
        window.addEventListener('resize', resize);
        setTimeout(resize, 0);

        // 物理逻辑保持严谨
        let L = 0, theta = 0, J_base = 5, isDriving = false, drivingTorque = 40; 
        let lastTime = performance.now(), last_J = 0, last_omega = 0;
        let lastJChangeTime = 0, lastWChangeTime = 0;

        const rSlider = document.getElementById('radius-slider');
        const mSlider = document.getElementById('mass-slider');
        const btnSpin = document.getElementById('btn-spin');
        const btnStop = document.getElementById('btn-stop');
        const condConserved = document.getElementById('header-cond-conserved'), condBroken = document.getElementById('header-cond-broken');
        const statusIndicator = document.getElementById('status-indicator');
        const jValEl = document.getElementById('j-val'), wValEl = document.getElementById('omega-val'), lValEl = document.getElementById('l-val'), lDescEl = document.getElementById('l-desc'), wDispEl = document.getElementById('omega-disp');

        function calcInertia(m, r) { return J_base + m * (r * r); }
        btnSpin.onmousedown = () => isDriving = true;
        window.onmouseup = () => isDriving = false;
        btnSpin.ontouchstart = (e) => { e.preventDefault(); isDriving = true; };
        window.ontouchend = () => isDriving = false;
        btnStop.onclick = () => { L = 0; };

        function update(currentTime) {
            let dt = Math.min(0.1, (currentTime - lastTime) / 1000);
            lastTime = currentTime;
            const r = parseFloat(rSlider.value), m = parseFloat(mSlider.value);
            const J_current = calcInertia(m, r);

            if (isDriving) {
                L += drivingTorque * dt; 
                condConserved.classList.add('hidden'); condBroken.classList.remove('hidden');
                statusIndicator.innerHTML = "⚠️ 外加推力矩加速中 (M<sub>ext</sub> > 0)";
                statusIndicator.className = "w-max px-3 py-1.5 rounded-full text-[0.625rem] md:text-xs font-bold bg-red-900/90 backdrop-blur text-red-200 border border-red-500 shadow-lg transition-colors whitespace-nowrap";
                lDescEl.innerText = "(受力矩改变)"; lDescEl.className = "text-[0.5rem] md:text-[0.5625rem] text-red-400 font-bold tracking-widest mt-1.5 leading-none transition-colors duration-150";
                lValEl.className = "font-mono text-base md:text-lg leading-none origin-right transition-all duration-150 val-highlight val-l-glow";
            } else {
                condConserved.classList.remove('hidden'); condBroken.classList.add('hidden');
                statusIndicator.innerText = "当前状态：理想无摩擦 (锁定)";
                statusIndicator.className = "w-max px-3 py-1.5 rounded-full text-[0.625rem] md:text-xs font-bold bg-slate-800/80 backdrop-blur text-slate-300 border border-slate-600 shadow-lg transition-colors whitespace-nowrap";
                lDescEl.innerText = "(绝对守恒)"; lDescEl.className = "text-[0.5rem] md:text-[0.5625rem] text-slate-400 font-bold tracking-widest mt-1.5 leading-none transition-colors duration-300";
                lValEl.className = "font-mono text-white text-base md:text-lg drop-shadow-md leading-none origin-right transition-all duration-300";
            }

            const omega = L / J_current;
            theta += omega * dt;

            if (Math.abs(J_current - last_J) > 0.001) lastJChangeTime = currentTime;
            jValEl.className = (currentTime - lastJChangeTime < 150) ? "font-mono text-base md:text-lg leading-none origin-right transition-all duration-75 val-highlight val-j-glow" : "font-mono text-white text-base md:text-lg drop-shadow-md leading-none origin-right transition-all duration-300";
            last_J = J_current;

            if (Math.abs(omega - last_omega) > 0.001) lastWChangeTime = currentTime;
            if (currentTime - lastWChangeTime < 150) {
                wValEl.className = "font-mono text-base md:text-lg leading-none origin-right transition-all duration-75 val-highlight val-w-glow";
                wDispEl.className = "text-3xl md:text-5xl font-mono font-bold transition-all duration-75 val-highlight val-w-glow relative z-10";
            } else {
                wValEl.className = "font-mono text-white text-base md:text-lg drop-shadow-md leading-none origin-right transition-all duration-300";
                wDispEl.className = "text-3xl md:text-5xl font-mono font-bold text-cyan-400 drop-shadow-[0_0_0.9375rem_rgba(34,211,238,0.5)] relative z-10 transition-all duration-300";
            }
            last_omega = omega;

            document.getElementById('radius-val').innerText = r.toFixed(2);
            document.getElementById('mass-val').innerText = m;
            document.getElementById('j-val').innerText = J_current.toFixed(1);
            document.getElementById('omega-val').innerText = omega.toFixed(1);
            document.getElementById('l-val').innerText = L.toFixed(1);
            wDispEl.innerText = omega.toFixed(1);

            document.getElementById('j-bar').style.width = Math.min(100, (J_current / 205) * 100) + '%';
            document.getElementById('w-bar').style.width = Math.min(100, (Math.abs(omega) / 50) * 100) + '%';
            document.getElementById('l-bar').style.width = Math.min(100, (Math.abs(L) / 1000) * 100) + '%';

            render(r, m, omega);
            requestAnimationFrame(update);
        }

        function render(r, m, omega) {
            ctx.clearRect(0, 0, logicalWidth, logicalHeight);
            if(logicalWidth === 0) return;
            // 同样使用基于 rem 计算的偏移量，保持旋转中心在剩余空间居中
            const fontSize = parseFloat(document.documentElement.style.fontSize);
            const leftHudSpace = 10 * fontSize; // 对应 w-40 (10rem)
            const cx = leftHudSpace + (logicalWidth - leftHudSpace) / 2;
            const cy = logicalHeight * 0.5; 
            const baseSize = Math.min(logicalWidth - leftHudSpace - 40, logicalHeight);
            const scale = baseSize / 4.5; const px_r = r * scale;
            ctx.save(); ctx.translate(cx, cy);
            if(Math.abs(omega) > 0.5) {
                ctx.beginPath(); ctx.arc(0, 0, px_r, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(16, 185, 129, ${Math.min(0.6, Math.abs(omega)*0.03)})`;
                ctx.lineWidth = baseSize * 0.04; ctx.stroke();
            }
            ctx.rotate(theta);
            ctx.beginPath(); ctx.arc(0, 0, baseSize * 0.03, 0, Math.PI*2); ctx.fillStyle = '#94a3b8'; ctx.fill();
            ctx.beginPath(); ctx.moveTo(-px_r, 0); ctx.lineTo(px_r, 0); ctx.strokeStyle = '#475569'; ctx.lineWidth = baseSize * 0.015; ctx.lineCap = 'round'; ctx.stroke();
            const massRadius = Math.sqrt(m) * (baseSize * 0.008);
            ctx.beginPath(); ctx.arc(px_r, 0, massRadius, 0, Math.PI*2); ctx.fillStyle = '#10b981'; ctx.shadowBlur = baseSize * 0.04; ctx.shadowColor = '#10b981'; ctx.fill();
            ctx.beginPath(); ctx.arc(-px_r, 0, massRadius, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        requestAnimationFrame(update);
    