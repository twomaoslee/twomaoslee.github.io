
    const canvas = document.getElementById('waveCanvas');
    const ctx = canvas.getContext('2d');
    
    const inputF1 = document.getElementById('inputF1'), inputA1 = document.getElementById('inputA1');
    const inputF2 = document.getElementById('inputF2'), inputA2 = document.getElementById('inputA2');
    const valF1 = document.getElementById('valF1'), valA1 = document.getElementById('valA1');
    const valF2 = document.getElementById('valF2'), valA2 = document.getElementById('valA2');
    
    const btnRight = document.getElementById('btnRight'), btnLeft = document.getElementById('btnLeft');
    const btnSum = document.getElementById('btnSum'), btnEnv = document.getElementById('btnEnv');
    const btnSync = document.getElementById('btnSync'), btnEnergy = document.getElementById('btnEnergy');
    const btnPause = document.getElementById('btnPause'), btnSlow = document.getElementById('btnSlow');
    
    const statusBar = document.getElementById('statusBar');
    const formulaCard = document.getElementById('formulaCard');

    let f1 = 0.5, a1 = 100;
    let f2 = 0.5, a2 = 100;
    const waveSpeed = 200; 
    let baseAmplitude = 50;
    
    let showRight = true, showLeft = true;
    let showSum = true, showEnv = true;
    let showEnergy = false;
    let isStandingWave = true;
    
    let isPaused = false, isSlow = false;
    let time = 0, lastTimestamp = 0;

    let logicalWidth = 0, logicalHeight = 0;
    let pixelRatio = 1;

    function renderFormula() {
        if (!window.MathJax || !window.MathJax.typesetPromise) {
            formulaCard.innerHTML = '<span style="color:#94a3b8; font-size: 0.95rem;">⏳ 正在加载公式渲染引擎(MathJax)...</span>';
            setTimeout(renderFormula, 200); 
            return; 
        }
        
        const mathStr = isStandingWave 
            ? "$$y = y_1 + y_2 = \\color{#dc2626}{\\left[ 2A \\cos\\left(\\frac{2\\pi x}{\\lambda}\\right) \\right]} \\cos(2\\pi \\nu t)$$"
            : "$$y = A_1 \\cos(2\\pi f_1 t - k_1 x) + A_2 \\cos(2\\pi f_2 t + k_2 x) \\quad \\small\\color{#991b1b}{\\text{(无法提取出独立的空间振幅项)}}$$";
        
        formulaCard.innerHTML = mathStr;
        MathJax.typesetClear([formulaCard]);
        MathJax.typesetPromise([formulaCard]).catch(function (err) {
            console.error('MathJax 渲染出错: ', err.message);
        });
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(rect.width * pixelRatio);
        canvas.height = Math.round(rect.height * pixelRatio);
        logicalWidth = rect.width;
        logicalHeight = rect.height;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        // 降低基础振幅，防止与底部的能量面板重叠
        baseAmplitude = Math.min(logicalHeight * 0.18, 90); 
    }

    function updateParams() {
        f1 = parseFloat(inputF1.value); a1 = parseFloat(inputA1.value);
        f2 = parseFloat(inputF2.value); a2 = parseFloat(inputA2.value);
        
        valF1.innerText = f1.toFixed(2) + " Hz"; valA1.innerText = a1 + "%";
        valF2.innerText = f2.toFixed(2) + " Hz"; valA2.innerText = a2 + "%";

        isStandingWave = (Math.abs(f1 - f2) < 0.01) && (Math.abs(a1 - a2) < 1);
        
        if (isStandingWave) {
            statusBar.className = "status-bar success";
            statusBar.innerText = "✅ 驻波已形成 (满足条件：同频、同幅、反向传播)";
        } else {
            statusBar.className = "status-bar fail";
            if (Math.abs(f1 - f2) >= 0.01) {
                statusBar.innerText = "❌ 驻波被破坏：频率不同 (产生拍频，波节与波腹随波逐流)";
            } else {
                statusBar.innerText = "⚠️ 不完美驻波：振幅不同 (波节处无法完全相互抵消)";
            }
        }
        renderFormula();
    }

    // Toggle logic
    btnSum.addEventListener('click', () => { showSum = !showSum; btnSum.classList.toggle('active', showSum); btnSum.innerText = showSum ? "合成波 开" : "合成波 隐"; });
    btnRight.addEventListener('click', () => { showRight = !showRight; btnRight.classList.toggle('active', showRight); btnRight.innerText = showRight ? "右行波 开" : "右行波 隐"; });
    btnLeft.addEventListener('click', () => { showLeft = !showLeft; btnLeft.classList.toggle('active', showLeft); btnLeft.innerText = showLeft ? "左行波 开" : "左行波 隐"; });
    btnEnv.addEventListener('click', () => { showEnv = !showEnv; btnEnv.classList.toggle('active', showEnv); btnEnv.innerText = showEnv ? "包络线 开" : "包络线 隐"; });
    
    btnSync.addEventListener('click', () => { inputF2.value = inputF1.value; inputA2.value = inputA1.value; updateParams(); });
    
    btnEnergy.addEventListener('click', () => { 
        showEnergy = !showEnergy; 
        btnEnergy.classList.toggle('active', showEnergy); 
        btnEnergy.innerText = showEnergy ? "⚡ 能量转换 开" : "⚡ 能量转换 关"; 
    });

    btnPause.addEventListener('click', () => {
        isPaused = !isPaused;
        btnPause.innerText = isPaused ? "▶️ 播放" : "⏸️ 暂停";
        btnPause.style.background = isPaused ? "#10b981" : "var(--primary)";
    });
    btnSlow.addEventListener('click', () => {
        isSlow = !isSlow;
        btnSlow.style.background = isSlow ? "var(--primary)" : "#64748b";
        btnSlow.innerText = isSlow ? "▶ 恢复常速" : "🐌 慢动作";
    });

    [inputF1, inputA1, inputF2, inputA2].forEach(el => el.addEventListener('input', updateParams));
    window.addEventListener('resize', resize);

    function draw(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        let dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        if (isSlow) dt *= 0.15; 
        if (!isPaused) time += dt;

        ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // 如果开启了能量面板，将中心线稍微上移以留出空间
        const bottomPanelHeight = showEnergy ? 60 : 0;
        const centerY = (logicalHeight - bottomPanelHeight) / 2;
        
        const omega1 = 2 * Math.PI * f1;
        const k1 = 2 * Math.PI * f1 / waveSpeed;
        const amp1 = baseAmplitude * (a1 / 100);
        
        const omega2 = 2 * Math.PI * f2;
        const k2 = 2 * Math.PI * f2 / waveSpeed;
        const amp2 = baseAmplitude * (a2 / 100);

        // 1. 画水平参考线
        ctx.beginPath();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.moveTo(0, centerY); ctx.lineTo(logicalWidth, centerY);
        ctx.stroke(); ctx.setLineDash([]);

        // 2. 画包络线 (仅驻波完美且开启时显示)
        if (showEnv && isStandingWave) {
            ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
            ctx.beginPath();
            for(let x=0; x<=logicalWidth; x++) ctx.lineTo(x, centerY - 2 * amp1 * Math.abs(Math.cos(k1 * x)));
            for(let x=logicalWidth; x>=0; x--) ctx.lineTo(x, centerY + 2 * amp1 * Math.abs(Math.cos(k1 * x)));
            ctx.fill();
        }

        // 3. 画右行波和左行波
        if (showRight) {
            ctx.beginPath(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
            for (let x = 0; x <= logicalWidth; x++) {
                let y = amp1 * Math.cos(omega1 * time - k1 * x);
                if(x===0) ctx.moveTo(x, centerY - y); else ctx.lineTo(x, centerY - y);
            }
            ctx.stroke();
        }

        if (showLeft) {
            ctx.beginPath(); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
            for (let x = 0; x <= logicalWidth; x++) {
                let y = amp2 * Math.cos(omega2 * time + k2 * x);
                if(x===0) ctx.moveTo(x, centerY - y); else ctx.lineTo(x, centerY - y);
            }
            ctx.stroke();
        }

        // 4. 画合成波并追踪动态极值/零点
        if (showSum) {
            const ys = new Float32Array(Math.ceil(logicalWidth) + 1);
            
            ctx.beginPath();
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 3.5;
            ctx.setLineDash([]);
            
            for (let x = 0; x <= logicalWidth; x++) {
                ys[x] = amp1 * Math.cos(omega1 * time - k1 * x) + amp2 * Math.cos(omega2 * time + k2 * x);
                if(x===0) ctx.moveTo(x, centerY - ys[x]); 
                else ctx.lineTo(x, centerY - ys[x]);
            }
            ctx.stroke();

            // a) 寻找动态波腹 (极值点)
            ctx.fillStyle = '#dc2626';
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            for (let x = 1; x < logicalWidth; x++) {
                if ( (ys[x] > ys[x-1] && ys[x] > ys[x+1]) || (ys[x] < ys[x-1] && ys[x] < ys[x+1]) ) {
                    if (Math.abs(ys[x]) > 1) {
                        ctx.beginPath();
                        ctx.arc(x, centerY - ys[x], 6, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                }
            }

            // b) 寻找动态波节 (零交叉点)
            ctx.fillStyle = '#475569';
            for (let x = 1; x <= logicalWidth; x++) {
                if (ys[x-1] * ys[x] < 0) {
                    let exactX = x - 1 + Math.abs(ys[x-1]) / (Math.abs(ys[x] - ys[x-1]));
                    ctx.beginPath();
                    ctx.arc(exactX, centerY, 5, 0, Math.PI * 2);
                    ctx.fill();
                } else if (ys[x] === 0) {
                    ctx.beginPath();
                    ctx.arc(x, centerY, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 5. 能量转换可视化面板
        if (showEnergy) {
            const energyBarY = logicalHeight - 35;
            
            // 绘制面板背景底色
            ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
            ctx.fillRect(0, energyBarY - 25, logicalWidth, 60);
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
            ctx.moveTo(0, energyBarY - 25);
            ctx.lineTo(logicalWidth, energyBarY - 25);
            ctx.stroke();

            if (isStandingWave) {
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const lambda = waveSpeed / f1;
                const phaseTime = omega1 * time;
                
                // 物理学计算：动能和势能的周期变化
                // 波腹处：位移为0时速度最大，动能最大
                // 波节处：弦的斜率最大，势能最大
                const ekRatio = Math.pow(Math.sin(phaseTime), 2); // 动能比例 0~1
                const epRatio = Math.pow(Math.cos(phaseTime), 2); // 势能比例 0~1
                
                // 能量流动方向：功率 P ∝ sin(2kx)sin(2ωt)
                const flowFlow = Math.sin(2 * phaseTime); 
                const flowAlpha = Math.abs(flowFlow);

                for (let i = 0; i * (lambda / 4) <= logicalWidth + 10; i++) {
                    let x = i * (lambda / 4);
                    let isAntinode = (i % 2 === 0); // 偶数点是波腹，奇数点是波节

                    // 绘制文字状态
                    if (isAntinode) {
                        ctx.font = `bold ${11 + ekRatio * 4}px sans-serif`; // 字体动态呼吸放大
                        ctx.fillStyle = `rgba(234, 88, 12, ${0.3 + ekRatio * 0.7})`; // 橙色
                        ctx.fillText("动能 Ek", x, energyBarY);
                    } else {
                        ctx.font = `bold ${11 + epRatio * 4}px sans-serif`;
                        ctx.fillStyle = `rgba(14, 165, 233, ${0.3 + epRatio * 0.7})`; // 蓝色
                        ctx.fillText("势能 Ep", x, energyBarY);
                    }

                    // 绘制能量流向箭头
                    if (i > 0) {
                        let prevX = (i - 1) * (lambda / 4);
                        let fromX, toX;
                        let isNodeToAntinode = (flowFlow > 0); // 势能转为动能

                        let padding = 38; // 避开文字的间距

                        // 判断箭头方向
                        if (isNodeToAntinode) {
                            if (isAntinode) { fromX = prevX + padding; toX = x - padding; } // 波节 -> 波腹
                            else            { fromX = x - padding; toX = prevX + padding; } // 波节 -> 波腹
                        } else {
                            if (isAntinode) { fromX = x - padding; toX = prevX + padding; } // 波腹 -> 波节
                            else            { fromX = prevX + padding; toX = x - padding; } // 波腹 -> 波节
                        }

                        if (flowAlpha > 0.05 && toX !== undefined) {
                            ctx.beginPath();
                            ctx.strokeStyle = `rgba(139, 92, 246, ${flowAlpha * 0.8})`; // 紫色箭头表示能量转移
                            ctx.lineWidth = 1.5 + flowAlpha * 2.5;
                            
                            // 画线
                            ctx.moveTo(fromX, energyBarY);
                            ctx.lineTo(toX, energyBarY);
                            ctx.stroke();

                            // 画箭头头部
                            ctx.beginPath();
                            ctx.fillStyle = `rgba(139, 92, 246, ${flowAlpha * 0.8})`;
                            const dir = toX > fromX ? 1 : -1;
                            ctx.moveTo(toX, energyBarY);
                            ctx.lineTo(toX - dir * 8, energyBarY - 5);
                            ctx.lineTo(toX - dir * 8, energyBarY + 5);
                            ctx.fill();
                        }
                    }
                }
            } else {
                // 如果破坏了驻波条件，则无法显示规律的能量场
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = "bold 14px sans-serif";
                ctx.fillStyle = "#94a3b8";
                ctx.fillText("⚠️ 能量转换可视化规律 仅在完美驻波状态下(同频同幅)可用", logicalWidth / 2, energyBarY);
            }
        }

        requestAnimationFrame(draw);
    }

    resize();
    updateParams();
    requestAnimationFrame(draw);

