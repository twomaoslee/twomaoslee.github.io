
    let globalScale = 1;
    function updateRootFontSize() {
        const container = document.querySelector(".slide-container");
        globalScale = container.clientWidth / 1280;
        document.documentElement.style.fontSize = (16 * globalScale) + "px";
    }

    const TAU = Math.PI * 2;
    const DISPLAY_TIME_WINDOW = 8.0;
    const state = {
        isPlaying: false,
        t: 0,
        A1: 1.0,
        A2: 0.5,
        w: 1.8,
        phi1: 0,
        phi2: 0,
        speed: 1.0
    };

    const limits = {
        A: { max: 1.2 },
        w: { max: 3.0 }
    };

    const colors = {
        axis: "#4d5966",
        grid: "rgba(255,255,255,0.06)",
        guide: "rgba(255,255,255,0.18)",
        text: "#9aa9bb",
        textMain: "#f3f7fb",
        green: "#36d77f",
        orange: "#ffad21",
        blue: "#1c98ff",
        cyan: "#72d6ff",
        ring: "rgba(114,214,255,0.22)",
        point: "#ff685b"
    };

    let vectorSyncPoint = null;
    let curveSyncPoint = null;

    const vectorCanvas = document.getElementById("vector-canvas");
    const vectorCtx = vectorCanvas.getContext("2d");
    const sumCanvas = document.getElementById("sum-canvas");
    const sumCtx = sumCanvas.getContext("2d");

    const ui = {
        btnPlay: document.getElementById("btn-play"),
        btnReset: document.getElementById("btn-reset"),
        sliderA1: document.getElementById("slider-a1"),
        sliderA2: document.getElementById("slider-a2"),
        sliderW: document.getElementById("slider-w"),
        sliderPhi1: document.getElementById("slider-phi1"),
        sliderPhi2: document.getElementById("slider-phi2"),
        sliderSpeed: document.getElementById("slider-speed"),
        valA1: document.getElementById("val-a1"),
        valA2: document.getElementById("val-a2"),
        valW: document.getElementById("val-w"),
        valPhi1: document.getElementById("val-phi1"),
        valPhi2: document.getElementById("val-phi2"),
        valSpeed: document.getElementById("val-speed"),
        readX1: document.getElementById("read-x1"),
        readX2: document.getElementById("read-x2"),
        readXsum: document.getElementById("read-xsum"),
        readDPhi: document.getElementById("read-dphi"),
        readAmp: document.getElementById("read-amp"),
        readPhi: document.getElementById("read-phi"),
        readPeriod: document.getElementById("read-period"),
        readT: document.getElementById("read-t"),
        btnDPhi: document.querySelectorAll(".btn-dphi"),
        btnRatio: document.querySelectorAll(".btn-ratio"),
        syncOverlay: document.getElementById("sync-overlay"),
        syncLine: document.getElementById("sync-line")
    };

    function resizeCanvas(canvas, ctx) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }

    function resizeAll() {
        updateRootFontSize();
        resizeCanvas(vectorCanvas, vectorCtx);
        resizeCanvas(sumCanvas, sumCtx);
    }

    function fmt(value, digits = 2) { return value.toFixed(digits); }
    function wrap(value, max) { return ((value % max) + max) % max; }
    function wrapSigned(angle) {
        let a = wrap(angle + Math.PI, TAU) - Math.PI;
        if (Math.abs(a + Math.PI) < 1e-9) a = Math.PI;
        return a;
    }
    function period() { return TAU / state.w; }
    function timeWindow() { return DISPLAY_TIME_WINDOW; }

    function resultPhasor() {
        const C = state.A1 * Math.cos(state.phi1) + state.A2 * Math.cos(state.phi2);
        const S = state.A1 * Math.sin(state.phi1) + state.A2 * Math.sin(state.phi2);
        return { C, S, A: Math.hypot(C, S), phi: Math.atan2(S, C) };
    }

    function x1At(t) { return state.A1 * Math.cos(state.w * t + state.phi1); }
    function x2At(t) { return state.A2 * Math.cos(state.w * t + state.phi2); }
    function xSumAt(t) { return x1At(t) + x2At(t); }
    function deltaPhi() { return wrapSigned(state.phi2 - state.phi1); }
    function referenceSumAmp() { return limits.A.max * 2 * 1.05; }
    function referenceSingleAmp() { return limits.A.max * 1.08; }

    function getCurveGeometry() {
        const curveRect = sumCanvas.parentElement.getBoundingClientRect();
        const margin = {
            left: 56 * globalScale,
            right: 26 * globalScale,
            top: 22 * globalScale,
            bottom: 36 * globalScale
        };
        const plotW = curveRect.width - margin.left - margin.right;
        const plotH = curveRect.height - margin.top - margin.bottom;
        const yRef = referenceSumAmp();
        const tMax = timeWindow();
        return { curveRect, margin, plotW, plotH, yRef, tMax };
    }

    function getCurrentCurvePoint() {
        const { curveRect, margin, plotW, plotH, yRef, tMax } = getCurveGeometry();
        return {
            x: curveRect.left + margin.left + (state.t / tMax) * plotW,
            y: curveRect.top + margin.top + plotH * 0.5 - (xSumAt(state.t) / yRef) * plotH * 0.42
        };
    }

    function getVectorProjectionPoint() {
        const rect = vectorCanvas.parentElement.getBoundingClientRect();
        const { plotH, yRef } = getCurveGeometry();
        const midZeroScreenY = getCurrentCurvePoint().y + (xSumAt(state.t) / yRef) * plotH * 0.42;
        const cx = rect.left + rect.width * 0.5;
        const projScale = (plotH * 0.42) / yRef;
        return {
            x: cx,
            y: midZeroScreenY - xSumAt(state.t) * projScale
        };
    }

    function drawLine(ctx, x1, y1, x2, y2, color, width = 1, dash = [], shadow = 0) {
        ctx.beginPath();
        ctx.setLineDash(dash);
        ctx.strokeStyle = color;
        ctx.lineWidth = width * globalScale;
        ctx.lineCap = "round";
        ctx.shadowBlur = shadow ? shadow * globalScale : 0;
        ctx.shadowColor = color;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    function drawDot(ctx, x, y, color, radius = 5.2, shadow = 0) {
        const r = radius * globalScale;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowBlur = shadow ? shadow * globalScale : 0;
        ctx.shadowColor = color;
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(x, y, r * 0.38, 0, TAU);
        ctx.fill();
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, width = 3, shadow = 0) {
        drawLine(ctx, x1, y1, x2, y2, color, width, [], shadow);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = 10 * globalScale;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowBlur = shadow ? shadow * globalScale : 0;
        ctx.shadowColor = color;
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawVectorPanel() {
        const rect = vectorCanvas.parentElement.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        vectorCtx.clearRect(0, 0, w, h);

        const { plotH, yRef } = getCurveGeometry();
        const curvePoint = getCurrentCurvePoint();
        const midZeroScreenY = curvePoint.y + (xSumAt(state.t) / yRef) * plotH * 0.42;
        const projScale = (plotH * 0.42) / yRef;

        const cx = w * 0.5;
        const cy = midZeroScreenY - rect.top;
        const ringR = Math.min(referenceSumAmp() * projScale, w * 0.43, h * 0.37);
        const scaleR = projScale;

        const theta1 = state.w * state.t + state.phi1;
        const theta2 = state.w * state.t + state.phi2;
        const phasor = resultPhasor();
        const theta = state.w * state.t + phasor.phi;
        const displayPhase = wrap(theta, TAU);

        drawLine(vectorCtx, cx - ringR - 30 * globalScale, cy, cx + ringR + 30 * globalScale, cy, colors.axis, 1.8);
        drawLine(vectorCtx, cx, cy - ringR - 30 * globalScale, cx, cy + ringR + 30 * globalScale, colors.cyan, 2.1);

        const ringR1 = state.A1 * scaleR;
        const ringR2 = state.A2 * scaleR;
        const ringRSum = phasor.A * scaleR;

        const drawRing = (radius, stroke, width, dash, alpha = 1, blur = 0) => {
            if (radius < 6 * globalScale) return;
            vectorCtx.beginPath();
            vectorCtx.setLineDash(dash);
            vectorCtx.strokeStyle = stroke;
            vectorCtx.globalAlpha = alpha;
            vectorCtx.lineWidth = width * globalScale;
            vectorCtx.shadowBlur = blur ? blur * globalScale : 0;
            vectorCtx.shadowColor = stroke;
            vectorCtx.arc(cx, cy, radius, 0, TAU);
            vectorCtx.stroke();
            vectorCtx.setLineDash([]);
            vectorCtx.globalAlpha = 1;
            vectorCtx.shadowBlur = 0;
        };

        drawRing(ringR1, "rgba(54,215,127,0.24)", 1.4, [4 * globalScale, 4 * globalScale], 1, 0);
        drawRing(ringR2, "rgba(255,173,33,0.24)", 1.4, [4 * globalScale, 4 * globalScale], 1, 0);
        drawRing(ringRSum, "rgba(28,152,255,0.85)", 2.2, [], 0.95, 10);

        const p1 = {
            x: cx - state.A1 * scaleR * Math.sin(theta1),
            y: cy - state.A1 * scaleR * Math.cos(theta1)
        };
        const p2 = {
            x: cx - state.A2 * scaleR * Math.sin(theta2),
            y: cy - state.A2 * scaleR * Math.cos(theta2)
        };
        const ps = {
            x: cx - phasor.A * scaleR * Math.sin(theta),
            y: cy - phasor.A * scaleR * Math.cos(theta)
        };

        const translatedP2 = {
            x: p1.x - state.A2 * scaleR * Math.sin(theta2),
            y: p1.y - state.A2 * scaleR * Math.cos(theta2)
        };

        vectorCtx.beginPath();
        vectorCtx.strokeStyle = colors.orange;
        vectorCtx.lineWidth = 2.4 * globalScale;
        vectorCtx.shadowBlur = 8 * globalScale;
        vectorCtx.shadowColor = colors.orange;
        vectorCtx.arc(cx, cy, Math.max(ringRSum * 0.24, 18 * globalScale), -Math.PI / 2, -Math.PI / 2 - displayPhase, true);
        vectorCtx.stroke();
        vectorCtx.shadowBlur = 0;

        drawLine(vectorCtx, p1.x, p1.y, translatedP2.x, translatedP2.y, "rgba(255,173,33,0.28)", 2, [4 * globalScale, 4 * globalScale]);
        drawLine(vectorCtx, p2.x, p2.y, translatedP2.x, translatedP2.y, "rgba(54,215,127,0.24)", 2, [4 * globalScale, 4 * globalScale]);

        drawArrow(vectorCtx, cx, cy, p1.x, p1.y, colors.green, 3.1, 10);
        drawArrow(vectorCtx, cx, cy, p2.x, p2.y, colors.orange, 3.1, 10);
        drawArrow(vectorCtx, cx, cy, ps.x, ps.y, colors.blue, 4.2, 12);

        drawDot(vectorCtx, p1.x, p1.y, colors.green, 4.8, 8);
        drawDot(vectorCtx, p2.x, p2.y, colors.orange, 4.8, 8);
        drawDot(vectorCtx, ps.x, ps.y, colors.blue, 5.4, 10);
        drawDot(vectorCtx, cx, cy, colors.point, 4.8, 8);
        drawLine(vectorCtx, ps.x, ps.y, cx, ps.y, colors.blue, 2, [4 * globalScale, 4 * globalScale], 8);
        drawLine(vectorCtx, cx, cy, cx, ps.y, colors.blue, 4.2, [], 10);
        drawDot(vectorCtx, cx, ps.y, colors.blue, 5.5, 10);
        const vectorCanvasRect = vectorCanvas.getBoundingClientRect();
        vectorSyncPoint = { x: vectorCanvasRect.left + cx, y: vectorCanvasRect.top + ps.y };

        vectorCtx.fillStyle = colors.green;
        vectorCtx.font = `700 ${16 * globalScale}px -apple-system, sans-serif`;
        vectorCtx.textAlign = "center";
        vectorCtx.fillText("A1", p1.x - 17 * globalScale * Math.sin(theta1), p1.y - 17 * globalScale * Math.cos(theta1));
        vectorCtx.fillStyle = colors.orange;
        vectorCtx.fillText("A2", p2.x - 17 * globalScale * Math.sin(theta2), p2.y - 17 * globalScale * Math.cos(theta2));
        vectorCtx.fillStyle = colors.blue;
        vectorCtx.fillText("A", ps.x - 18 * globalScale * Math.sin(theta), ps.y - 18 * globalScale * Math.cos(theta));

        vectorCtx.fillStyle = colors.cyan;
        vectorCtx.font = `700 ${17 * globalScale}px -apple-system, sans-serif`;
        vectorCtx.fillText("x", cx + 10 * globalScale, cy - ringR - 10 * globalScale);

        vectorCtx.fillStyle = colors.blue;
        vectorCtx.font = `700 ${15 * globalScale}px -apple-system, sans-serif`;
        vectorCtx.textAlign = "left";
        vectorCtx.fillText("x", cx + 18 * globalScale, ps.y + 4 * globalScale);
    }

    function updateSyncLine() {
        const slideRect = document.querySelector(".slide-container").getBoundingClientRect();
        const leftPoint = vectorSyncPoint || getVectorProjectionPoint();
        const rightPoint = curveSyncPoint || getCurrentCurvePoint();

        ui.syncOverlay.setAttribute("viewBox", `0 0 ${slideRect.width} ${slideRect.height}`);
        ui.syncOverlay.setAttribute("width", `${slideRect.width}`);
        ui.syncOverlay.setAttribute("height", `${slideRect.height}`);
        ui.syncLine.setAttribute("x1", `${leftPoint.x - slideRect.left}`);
        ui.syncLine.setAttribute("y1", `${leftPoint.y - slideRect.top}`);
        ui.syncLine.setAttribute("x2", `${rightPoint.x - slideRect.left}`);
        ui.syncLine.setAttribute("y2", `${rightPoint.y - slideRect.top}`);
        ui.syncLine.setAttribute("stroke-width", `${1.5 * globalScale}`);
        ui.syncLine.setAttribute("stroke-dasharray", `${6 * globalScale} ${6 * globalScale}`);
    }

    function drawCurvePanel(ctx, canvas, options) {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        ctx.clearRect(0, 0, w, h);

        const margin = {
            left: 56 * globalScale,
            right: 26 * globalScale,
            top: 22 * globalScale,
            bottom: 36 * globalScale
        };
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;
        const yRef = options.referenceAmplitude;
        const tMax = timeWindow();
        const T = period();
        const currentT = state.t;

        const mapX = (t) => margin.left + (t / tMax) * plotW;
        const mapY = (x) => margin.top + plotH * 0.5 - (x / yRef) * plotH * 0.42;
        const zeroY = margin.top + plotH * 0.5;

        for (let i = 0; i <= 6; i += 1) {
            const gx = margin.left + (plotW / 6) * i;
            drawLine(ctx, gx, margin.top, gx, margin.top + plotH, colors.grid, 1, [4 * globalScale, 5 * globalScale]);
        }
        for (let i = 0; i <= 4; i += 1) {
            const gy = margin.top + (plotH / 4) * i;
            drawLine(ctx, margin.left, gy, margin.left + plotW, gy, colors.grid, 1, [4 * globalScale, 5 * globalScale]);
        }

        drawLine(ctx, margin.left, zeroY, margin.left + plotW + 6 * globalScale, zeroY, colors.axis, 2);
        drawLine(ctx, margin.left, margin.top + plotH, margin.left, margin.top, colors.axis, 2);

        options.series.forEach((series) => {
            ctx.beginPath();
            ctx.strokeStyle = series.color;
            ctx.lineWidth = series.width * globalScale;
            ctx.lineJoin = "round";
            ctx.shadowBlur = 10 * globalScale;
            ctx.shadowColor = series.color;
            const steps = 320;
            for (let i = 0; i <= steps; i += 1) {
                const t = (i / steps) * tMax;
                const x = mapX(t);
                const y = mapY(series.fn(t));
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        });

        const currentX = mapX(currentT);
        drawLine(ctx, currentX, margin.top, currentX, margin.top + plotH, colors.guide, 1.5, [5 * globalScale, 5 * globalScale]);

        options.series.forEach((series, index) => {
            const dotY = mapY(series.fn(currentT));
            drawDot(ctx, currentX, dotY, series.color, series.pointRadius || 5.1, 8);
            if (index === options.series.length - 1) {
                const sumCanvasRect = sumCanvas.getBoundingClientRect();
                curveSyncPoint = { x: sumCanvasRect.left + currentX, y: sumCanvasRect.top + dotY };
            }
        });

        ctx.fillStyle = colors.text;
        ctx.font = `600 ${13.5 * globalScale}px -apple-system, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText("0", margin.left - 8 * globalScale, zeroY + 4 * globalScale);
        ctx.fillText(options.peakTop, margin.left - 8 * globalScale, mapY(options.topValue) + 4 * globalScale);
        ctx.fillText(options.peakBottom, margin.left - 8 * globalScale, mapY(options.bottomValue) + 4 * globalScale);
        ctx.fillStyle = colors.cyan;
        ctx.fillText("当前时刻", currentX - 8 * globalScale, margin.top - 5 * globalScale);
        ctx.fillStyle = colors.text;
        ctx.textAlign = "center";
        if (T <= tMax) {
            ctx.fillText("T", mapX(T), zeroY + 18 * globalScale);
        }
        if (2 * T <= tMax) {
            ctx.fillText("2T", mapX(2 * T) - 4 * globalScale, zeroY + 18 * globalScale);
        }
    }

    function updateReadouts() {
        const phasor = resultPhasor();
        const x1 = x1At(state.t);
        const x2 = x2At(state.t);
        const xs = xSumAt(state.t);
        const dphi = deltaPhi();

        ui.readX1.innerText = fmt(x1, 2);
        ui.readX2.innerText = fmt(x2, 2);
        ui.readXsum.innerText = fmt(xs, 2);
        ui.readDPhi.innerText = `${fmt(dphi, 2)} rad`;
        ui.readAmp.innerText = fmt(phasor.A, 2);
        ui.readPhi.innerText = `${fmt(wrap(phasor.phi, TAU), 2)} rad`;
        ui.readPeriod.innerText = `${fmt(period(), 2)} s`;
        ui.readT.innerText = `${fmt(state.t, 2)} s`;

        ui.valA1.innerText = fmt(state.A1, 2);
        ui.valA2.innerText = fmt(state.A2, 2);
        ui.valW.innerText = fmt(state.w, 2);
        ui.valPhi1.innerText = Math.abs(state.phi1) < 1e-6 ? "0" : fmt(state.phi1, 2);
        ui.valPhi2.innerText = Math.abs(state.phi2) < 1e-6 ? "0" : fmt(state.phi2, 2);
        ui.valSpeed.innerText = `${fmt(state.speed, 1)}x`;
        ui.btnPlay.innerText = state.isPlaying ? "暂停" : "播放";
        ui.btnPlay.className = state.isPlaying ? "btn-primary" : "btn-secondary";
    }

    function render() {
        state.t = wrap(state.t, timeWindow());
        drawVectorPanel();
        drawCurvePanel(sumCtx, sumCanvas, {
            referenceAmplitude: referenceSumAmp(),
            series: [
                { fn: x1At, color: "rgba(54,215,127,0.9)", width: 2.5, pointRadius: 4.4 },
                { fn: x2At, color: "rgba(255,173,33,0.9)", width: 2.5, pointRadius: 4.4 },
                { fn: xSumAt, color: colors.blue, width: 3.7, pointRadius: 5.8 }
            ],
            peakTop: "+A",
            peakBottom: "-A",
            topValue: Math.max(resultPhasor().A, state.A1, state.A2),
            bottomValue: -Math.max(resultPhasor().A, state.A1, state.A2)
        });
        updateSyncLine();
        updateReadouts();
    }

    let lastTs = 0;
    function tick(ts) {
        if (!lastTs) lastTs = ts;
        const dt = (ts - lastTs) / 1000;
        lastTs = ts;
        if (state.isPlaying) state.t += dt * state.speed;
        render();
        requestAnimationFrame(tick);
    }

    function bindSlider(el, key) {
        el.addEventListener("input", (e) => {
            state[key] = parseFloat(e.target.value);
            render();
        });
    }

    bindSlider(ui.sliderA1, "A1");
    bindSlider(ui.sliderA2, "A2");
    bindSlider(ui.sliderW, "w");
    bindSlider(ui.sliderPhi1, "phi1");
    bindSlider(ui.sliderPhi2, "phi2");
    bindSlider(ui.sliderSpeed, "speed");

    ui.btnPlay.addEventListener("click", () => {
        state.isPlaying = !state.isPlaying;
        render();
    });

    ui.btnReset.addEventListener("click", () => {
        state.t = 0;
        state.isPlaying = false;
        render();
    });

    ui.btnDPhi.forEach((btn) => {
        btn.addEventListener("click", () => {
            const diff = parseFloat(btn.dataset.val);
            state.phi2 = wrap(state.phi1 + diff, TAU);
            ui.sliderPhi2.value = String(state.phi2);
            render();
        });
    });

    ui.btnRatio.forEach((btn) => {
        btn.addEventListener("click", () => {
            const ratio = parseFloat(btn.dataset.ratio);
            if (Math.abs(ratio - 0.5) < 1e-9) {
                state.A1 = 0.5;
                state.A2 = 1.0;
            } else if (Math.abs(ratio - 1) < 1e-9) {
                state.A1 = 1.0;
                state.A2 = 1.0;
            } else {
                state.A1 = 1.0;
                state.A2 = 0.5;
            }
            ui.sliderA1.value = state.A1.toFixed(2);
            ui.sliderA2.value = state.A2.toFixed(2);
            render();
        });
    });

    function queueTypeset() {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise();
        }
    }

    window.addEventListener("resize", () => {
        resizeAll();
        render();
    });

    resizeAll();
    render();
    queueTypeset();
    window.addEventListener("load", queueTypeset);
    requestAnimationFrame(tick);
