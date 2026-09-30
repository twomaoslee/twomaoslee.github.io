
        // ===================== 1. Three.js 初始化 =====================
        const canvas = document.getElementById('webgl-canvas');
        const container = document.getElementById('canvas-container');
        
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        
        const scene = new THREE.Scene();
        
        // 摄像机：平视偏俯视，完美展示陀螺触地点和进动圆锥
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(0, 4, 9);
        
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, 1.5, 0); // 焦点中心对准陀螺腰部

        // 自适应 16:9 画布尺寸
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width === 0 || height === 0) continue;
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height, false);
            }
        });
        resizeObserver.observe(container);

        // ===================== 2. 场景环境与灯光 =====================
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(5, 10, 5);
        scene.add(dirLight);
        const backLight = new THREE.DirectionalLight(0x38bdf8, 0.5); 
        backLight.position.set(-5, -2, -5);
        scene.add(backLight);

        // 地面网格，突出空间感
        const gridHelper = new THREE.GridHelper(15, 15, 0x334155, 0x1e293b);
        scene.add(gridHelper);

        // 地面中心触点垫片
        const padGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.05, 32);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.8 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.025;
        scene.add(pad);

        const centerDot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        centerDot.position.y = 0.05;
        scene.add(centerDot);

        // ===================== 3. 极具质感的陀螺模型 =====================
        // 整体进动系统 (绕 Y 轴)
        const precessionGroup = new THREE.Group(); 
        scene.add(precessionGroup);
        
        // 倾斜系统 (绕 Z 轴)
        const tiltGroup = new THREE.Group(); 
        precessionGroup.add(tiltGroup);

        // 陀螺主轴 (固定从原点向上延伸)
        const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 5, 16);
        shaftGeo.translate(0, 2.5, 0); // 长度5，一半在2.5，使得底部恰好在原点 0
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.1 });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        tiltGroup.add(shaft);

        // 陀螺锥形尖端
        const tipGeo = new THREE.ConeGeometry(0.06, 0.4, 16);
        tipGeo.rotateX(Math.PI);
        tipGeo.translate(0, 0.2, 0); 
        const tipMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 1.0, roughness: 0.1 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tiltGroup.add(tip);

        // 飞轮转子组 (可以在主轴上滑动)
        const rotorGroup = new THREE.Group(); 
        tiltGroup.add(rotorGroup);

        const diskRadius = 1.6;
        // 飞轮主体：科技蓝
        const diskGeo = new THREE.CylinderGeometry(diskRadius, diskRadius, 0.2, 32);
        const diskMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.6, roughness: 0.2 });
        const disk = new THREE.Mesh(diskGeo, diskMat);
        rotorGroup.add(disk);

        // 配重金环：展示旋转动态
        const ringGeo = new THREE.TorusGeometry(diskRadius, 0.12, 16, 64);
        ringGeo.rotateX(Math.PI/2);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        rotorGroup.add(ring);

        // 旋转观测十字标
        const spokeGeo = new THREE.BoxGeometry(diskRadius * 2.1, 0.22, 0.05);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const spoke1 = new THREE.Mesh(spokeGeo, spokeMat);
        const spoke2 = new THREE.Mesh(spokeGeo, spokeMat);
        spoke2.rotation.y = Math.PI / 2;
        rotorGroup.add(spoke1);
        rotorGroup.add(spoke2);

        // ===================== 4. 空间力学矢量箭头 =====================
        const arrowL = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 1, 0x3b82f6, 0.3, 0.15);
        const arrowG = new THREE.ArrowHelper(new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,0), 1, 0xfacc15, 0.3, 0.15);
        const arrowTau = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,0), 1, 0xef4444, 0.3, 0.15);
        const arrowOmega = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 1, 0xa855f7, 0.3, 0.15);
        
        scene.add(arrowL); 
        scene.add(arrowG); 
        scene.add(arrowTau); 
        scene.add(arrowOmega); 

        // 华丽的紫色进动轨迹线
        const trailMax = 200;
        let trailLength = 0;
        const trailPositions = new Float32Array(trailMax * 3);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trailMat = new THREE.LineBasicMaterial({ color: 0xd946ef, linewidth: 4, transparent: true, opacity: 0.9 });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);

        // ===================== 5. 物理引擎核心逻辑 =====================
        const g = 9.8;
        // 初始状态：竖直向上 (theta = 0)
        let state = {
            m: 2.0, r: 2.0, w_current: 80,
            phi: 0, theta: 0.0, spinAngle: 0, fallVelocity: 0,
            isCrashed: false
        };

        const ui = {
            sldSpin: document.getElementById('spin-slider'),
            sldRad: document.getElementById('radius-slider'),
            sldMass: document.getElementById('mass-slider'),
            btnReset: document.getElementById('btn-reset'),
            btnStopSpin: document.getElementById('btn-stop-spin'),
            btnPoke: document.getElementById('btn-poke'),
            
            valSpin: document.getElementById('spin-val'),
            valRad: document.getElementById('radius-val'),
            valMass: document.getElementById('mass-val'),
            dispOmega: document.getElementById('omega-disp')
        };

        ui.btnReset.onclick = () => {
            state.theta = 0.0; // 恢复竖直平衡状态
            state.phi = 0;
            state.fallVelocity = 0;
            state.isCrashed = false;
            ui.sldSpin.value = 80;
            state.w_current = 80;
            trailLength = 0; // 清空旧轨迹
        };

        ui.btnPoke.onclick = () => {
            if (state.theta < 0.05) {
                state.theta = Math.PI / 8; // 偏置约 22.5 度，引发重力矩
                state.fallVelocity = 0;
                state.isCrashed = false;
            } else if (!state.isCrashed) {
                state.theta += Math.PI / 12; // 已经倾斜则进一步加大倾角
            }
        };

        ui.btnStopSpin.onclick = () => {
            ui.sldSpin.value = 0;
        };

        let lastTimestamp = performance.now();
        let lastO = 0;

        function update() {
            const now = performance.now();
            let dt = Math.min(0.1, (now - lastTimestamp) / 1000);
            lastTimestamp = now;

            // 读取操作面板参数
            const r = parseFloat(ui.sldRad.value);
            const m = parseFloat(ui.sldMass.value);
            const targetW = parseFloat(ui.sldSpin.value);
            
            ui.valRad.innerText = r.toFixed(1);
            ui.valMass.innerText = m.toFixed(1);

            // 自转平滑过渡
            if(!state.isCrashed) {
                state.w_current += (targetW - state.w_current) * 5 * dt;
            }
            ui.valSpin.innerText = state.w_current.toFixed(0);

            // 物理量计算
            const J = 0.5 * m * (diskRadius * diskRadius);
            const L_mag = J * state.w_current;
            const torque = m * g * r * Math.sin(state.theta);
            
            let Omega = 0;
            const crashAngle = Math.PI / 2 - 0.05; // 触地倾角

            if (!state.isCrashed && state.w_current > 10) { 
                // 真实进动计算
                Omega = torque / L_mag;
                
                // 【核心演示优化】：放大进动速率供肉眼观察
                const visualOmegaMultiplier = 15.0; 
                state.phi += (Omega * visualOmegaMultiplier) * dt;
                
                // 极其微小的自然下垂
                state.theta += 0.005 * dt; 
                state.fallVelocity = 0;
            } else if (!state.isCrashed) {
                // 角速度太小，失去陀螺定力，自由落体
                state.fallVelocity += (g / r) * Math.sin(state.theta) * dt;
                state.theta += state.fallVelocity * dt;
            }

            // 碰撞地面
            if (state.theta >= crashAngle) {
                state.theta = crashAngle;
                if(!state.isCrashed) {
                    state.fallVelocity *= -0.3; // 弹一下
                    state.w_current *= 0.5; // 地面摩擦急剧减速
                    ui.sldSpin.value = state.w_current;
                }
                state.isCrashed = true;
                Omega = 0;
            }

            state.spinAngle += state.w_current * dt;

            // UI 渲染与高亮特效
            ui.dispOmega.innerText = Omega.toFixed(3);
            if (Math.abs(Omega - lastO) > 0.005 && !state.isCrashed) {
                ui.dispOmega.classList.add('glow-o');
            } else {
                ui.dispOmega.classList.remove('glow-o');
            }
            lastO = Omega;

            // ================= 3D 模型空间姿态更新 =================
            
            // 调整重心滑块，转子在主轴上真实滑动！
            rotorGroup.position.y = r; 
            rotorGroup.rotation.y = state.spinAngle; 
            
            // 全局进动与倾斜
            precessionGroup.rotation.y = state.phi;
            tiltGroup.rotation.z = state.theta; 

            // 获取转子在绝对空间中的坐标，用于绑定力学矢量
            const rotorPos = new THREE.Vector3();
            rotorGroup.getWorldPosition(rotorPos);
            
            // 获取陀螺主轴的空间指向 (即角动量 L 的方向)
            const shaftDir = new THREE.Vector3(0, 1, 0);
            shaftDir.applyQuaternion(tiltGroup.getWorldQuaternion(new THREE.Quaternion()));

            // 矢量 L (蓝色：沿主轴向上)
            arrowL.position.copy(rotorPos);
            arrowL.setDirection(shaftDir);
            arrowL.setLength(1 + state.w_current * 0.03);
            arrowL.visible = state.w_current > 5;

            // 矢量 G (黄色：沿转子重心绝对向下)
            const downDir = new THREE.Vector3(0, -1, 0);
            arrowG.position.copy(rotorPos);
            arrowG.setDirection(downDir);
            arrowG.setLength(1 + m * 0.3);

            // 矢量 M (红色力矩：r × G)
            const crossProd = new THREE.Vector3().crossVectors(rotorPos, downDir);
            // 修复竖直状态下叉积为零导致的报错问题
            if (crossProd.lengthSq() > 0.0001 && !state.isCrashed) {
                arrowTau.position.copy(rotorPos);
                arrowTau.setDirection(crossProd.normalize());
                arrowTau.setLength(1 + torque * 0.05);
                arrowTau.visible = true;
            } else {
                arrowTau.visible = false;
            }

            // 矢量 Ω (紫色：进动轴绝对向上，立在原点)
            arrowOmega.position.set(0, 0, 0);
            arrowOmega.setDirection(new THREE.Vector3(0, 1, 0));
            arrowOmega.setLength(1 + Math.abs(Omega) * 10);
            arrowOmega.visible = Math.abs(Omega) > 0.01 && !state.isCrashed;

            // 绘制空间圆锥轨迹
            if (!state.isCrashed && Math.abs(Omega) > 0) {
                if (trailLength < trailMax) {
                    trailPositions[trailLength*3] = rotorPos.x;
                    trailPositions[trailLength*3+1] = rotorPos.y;
                    trailPositions[trailLength*3+2] = rotorPos.z;
                    trailLength++;
                } else {
                    for(let i=0; i<trailMax-1; i++) {
                        trailPositions[i*3] = trailPositions[(i+1)*3];
                        trailPositions[i*3+1] = trailPositions[(i+1)*3+1];
                        trailPositions[i*3+2] = trailPositions[(i+1)*3+2];
                    }
                    trailPositions[(trailMax-1)*3] = rotorPos.x;
                    trailPositions[(trailMax-1)*3+1] = rotorPos.y;
                    trailPositions[(trailMax-1)*3+2] = rotorPos.z;
                }
                trailGeo.setDrawRange(0, trailLength);
                trailGeo.attributes.position.needsUpdate = true;
            }

            controls.update();
            renderer.render(scene, camera);
            
            requestAnimationFrame(update);
        }

        // 启动仿真
        requestAnimationFrame(update);
    