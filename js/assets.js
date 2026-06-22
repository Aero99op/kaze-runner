// Environment Assets: Time-of-Day engine, parallax sky cycles, sweeping spotlights,
// skyscraper windows, shimmering wet reflections, concrete guard rails, streetlights, and catenary lines.

let currentCamHeight = CAM_HEIGHT;
let camWX = 0;
let camVelX = 0;
let camHeightVel = 0;
let timeCycle = 0; // global cycle frame (Dawn -> Noon -> Sunset -> Night -> Dawn)

// Interpolate between two color arrays [r,g,b,a]
function interpolateColor(c1, c2, factor) {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);
    const a = c1[3] !== undefined && c2[3] !== undefined ? (c1[3] + (c2[3] - c1[3]) * factor) : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Get the current Time-of-Day phase parameters
function getCurrentTimeState() {
    const phaseLen = 600; // 600 frames per phase (10s at 60fps)
    const tc = timeCycle % 2400;
    const phase = Math.floor(tc / phaseLen);
    const factor = (tc % phaseLen) / phaseLen;
    return {
        current: phase,     // 0: Dawn, 1: Noon, 2: Sunset, 3: Night
        next: (phase + 1) % 4,
        factor: factor
    };
}

// Project 3D world space coordinate into 2D screen coordinate
function project(wx, wy, wz) {
    const clampedWz = Math.max(wz, 12);
    
    // Dynamic FOV Zoom out at high speeds (simulates arcade speed warping)
    let speedFactor = 0;
    if (typeof speed !== 'undefined') {
        speedFactor = Math.min((speed - 7) / 15, 1);
    }
    const dynamicFocal = FOCAL * (1.0 - speedFactor * 0.15);

    const scale = dynamicFocal / clampedWz;
    const sx = VP_X + (wx - camWX) * scale;
    const groundScreenY = HORIZON_Y + currentCamHeight * scale;
    const sy = groundScreenY - wy * scale;
    return { x: sx, y: sy, s: scale };
}

// ── COLOR GRADIENT TABLES FOR PHASES ──
const ENV_COLORS = {
    // Sky gradient top
    skyTop: [
        [185, 55, 8],    // Dawn (Deep Orange)
        [3, 105, 161],   // Noon (Ocean Blue)
        [59, 7, 100],    // Sunset (Deep Purple)
        [3, 1, 14]       // Night (Pitch Black)
    ],
    // Sky gradient mid
    skyMid: [
        [220, 120, 40],  // Dawn (Amber)
        [14, 165, 233],  // Noon (Sky)
        [157, 23, 77],   // Sunset (Magenta)
        [9, 5, 35]       // Night (Deep Navy)
    ],
    // Sky gradient bottom
    skyBottom: [
        [254, 215, 170], // Dawn (Peach)
        [186, 230, 253], // Noon (Light Blue)
        [249, 115, 22],  // Sunset (Neon Orange)
        [15, 20, 50]     // Night (Slate Navy)
    ],
    // Mountain backdrop shading
    mountain: [
        [120, 53, 4],    // Dawn
        [55, 72, 95],    // Noon
        [76, 29, 90],    // Sunset
        [7, 4, 18]       // Night
    ],
    // Mountain ridge 2 shading
    mountainNear: [
        [55, 25, 5],     // Dawn
        [35, 52, 72],    // Noon
        [40, 8, 60],     // Sunset
        [4, 2, 12]       // Night
    ],
    // Skyscraper wall panels
    building: [
        [28, 25, 23],    // Dawn
        [40, 58, 80],    // Noon
        [22, 14, 44],    // Sunset
        [8, 4, 18]       // Night
    ],
    // Asphalt road surface
    road: [
        [32, 20, 18],    // Dawn
        [48, 58, 78],    // Noon
        [19, 12, 35],    // Sunset
        [10, 7, 20]      // Night
    ],
    // Ambient brightness (glowing neon strength)
    ambient: [0.55, 0.09, 0.85, 1.0],
    // Window lit density ratio
    winLit: [0.28, 0.06, 0.55, 0.90]
};

// ── SCENERY ASSETS CONFIG ──
const STARS = [];
for (let i = 0; i < 60; i++) {
    STARS.push({
        x: Math.random() * W,
        y: Math.random() * (HORIZON_Y * 0.75),
        size: Math.random() * 1.8 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.04 + 0.015
    });
}

const NEON_SIGNS = [
    { bIdx: 1, xOff: 18, yOff: 25, w: 20, h: 55, text: 'カゼ', col: '#00f0ff', textCol: '#fff' },
    { bIdx: 3, xOff: 28, yOff: 35, w: 22, h: 65, text: '走れ', col: '#ff007f', textCol: '#fff' },
    { bIdx: 6, xOff: 15, yOff: 20, w: 20, h: 50, text: 'WEB3', col: '#34d399', textCol: '#fff' },
    { bIdx: 8, xOff: 22, yOff: 30, w: 24, h: 60, text: '東京', col: '#a78bfa', textCol: '#fff' }
];

const BLDGS = [
    { x: 15, w: 55, h: 90, win: [[8, 10, 14, 12], [8, 30, 14, 12], [8, 50, 14, 12], [28, 10, 14, 12], [28, 30, 14, 12], [28, 50, 14, 12]] },
    { x: 80, w: 70, h: 125, win: [[8, 10, 14, 12], [8, 32, 14, 12], [8, 54, 14, 12], [8, 76, 14, 12], [28, 10, 14, 12], [28, 32, 14, 12], [28, 54, 14, 12], [28, 76, 14, 12], [48, 10, 14, 12], [48, 32, 14, 12], [48, 54, 14, 12]] },
    { x: 165, w: 48, h: 72, win: [[8, 10, 12, 10], [8, 28, 12, 10], [8, 46, 12, 10], [24, 10, 12, 10], [24, 28, 12, 10], [24, 46, 12, 10]] },
    { x: 228, w: 85, h: 145, win: [[8, 10, 14, 12], [8, 32, 14, 12], [8, 54, 14, 12], [8, 76, 14, 12], [8, 98, 14, 12], [28, 10, 14, 12], [28, 32, 14, 12], [28, 54, 14, 12], [28, 76, 14, 12], [28, 98, 14, 12], [50, 10, 14, 12], [50, 32, 14, 12], [50, 54, 14, 12], [50, 76, 14, 12], [50, 98, 14, 12]] },
    { x: 328, w: 52, h: 80, win: [[8, 10, 12, 10], [8, 30, 12, 10], [8, 50, 12, 10], [26, 10, 12, 10], [26, 30, 12, 10], [26, 50, 12, 10]] },
    { x: 396, w: 95, h: 155, win: [[8, 10, 14, 12], [8, 32, 14, 12], [8, 54, 14, 12], [8, 76, 14, 12], [8, 100, 14, 12], [30, 10, 14, 12], [30, 32, 14, 12], [30, 54, 14, 12], [30, 76, 14, 12], [30, 100, 14, 12], [54, 10, 14, 12], [54, 32, 14, 12], [54, 54, 14, 12], [54, 76, 14, 12], [54, 100, 14, 12]] },
    { x: 510, w: 62, h: 95, win: [[8, 10, 14, 12], [8, 32, 14, 12], [8, 54, 14, 12], [28, 10, 14, 12], [28, 32, 14, 12], [28, 54, 14, 12]] },
    { x: 588, w: 50, h: 68, win: [[8, 10, 12, 10], [8, 28, 12, 10], [8, 46, 12, 10], [24, 10, 12, 10], [24, 28, 12, 10], [24, 46, 12, 10]] },
    { x: 654, w: 80, h: 130, win: [[8, 10, 14, 12], [8, 32, 14, 12], [8, 54, 14, 12], [8, 76, 14, 12], [8, 98, 14, 12], [28, 10, 14, 12], [28, 32, 14, 12], [28, 54, 14, 12], [28, 76, 14, 12], [28, 98, 14, 12], [50, 10, 14, 12], [50, 32, 14, 12], [50, 54, 14, 12], [50, 76, 14, 12]] },
    { x: 750, w: 60, h: 88, win: [[8, 10, 14, 12], [8, 32, 14, 12], [8, 54, 14, 12], [28, 10, 14, 12], [28, 32, 14, 12], [28, 54, 14, 12]] },
    { x: 826, w: 70, h: 110, win: [[8, 10, 14, 12], [8, 32, 14, 12], [8, 54, 14, 12], [8, 76, 14, 12], [28, 10, 14, 12], [28, 32, 14, 12], [28, 54, 14, 12], [28, 76, 14, 12], [48, 10, 14, 12], [48, 32, 14, 12], [48, 54, 14, 12], [48, 76, 14, 12]] },
];

const WIN_COLORS = [
    'rgba(254, 240, 138, 0.88)',
    'rgba(147, 197, 253, 0.85)',
    'rgba(244, 63, 94, 0.8)',
    'rgba(167, 139, 250, 0.75)'
];

function winColor(bIdx, r, c) {
    const v = (bIdx * 7 + r * 3 + c * 11) % 4;
    return WIN_COLORS[v];
}

const sakura = [];
for (let i = 0; i < 55; i++) {
    sakura.push(makeSakura(true));
}

function makeSakura(init = false) {
    return {
        x: Math.random() * W,
        y: init ? Math.random() * H : -20,
        vx: (Math.random() - 0.35) * 1.2,
        vy: Math.random() * 0.75 + 0.35,
        angle: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 0.045,
        size: Math.random() * 5.8 + 3.2,
        alpha: Math.random() * 0.62 + 0.25,
    };
}

let shootingStar = null;

const CLOUDS = [
    { x: 120, y: 65, size: 85, alpha: 0.25, speed: 0.05 },
    { x: 350, y: 42, size: 110, alpha: 0.20, speed: 0.035 },
    { x: 580, y: 56, size: 95, alpha: 0.18, speed: 0.06 },
    { x: 810, y: 46, size: 78, alpha: 0.22, speed: 0.045 }
];

// Curbside guard rail step configuration
const RAIL_STEP = 30;

// ── ENVIRONMENT DRAW PIPELINES ──

function drawSky(ctx) {
    const tick = typeof frame !== 'undefined' ? frame : 0;
    const timeState = getCurrentTimeState();

    // 1. Interpolate Sky Gradient stops (3-stop volumetric gradient)
    const skyColorTop = interpolateColor(
        ENV_COLORS.skyTop[timeState.current],
        ENV_COLORS.skyTop[timeState.next],
        timeState.factor
    );
    const skyColorMid = interpolateColor(
        ENV_COLORS.skyMid[timeState.current],
        ENV_COLORS.skyMid[timeState.next],
        timeState.factor
    );
    const skyColorBottom = interpolateColor(
        ENV_COLORS.skyBottom[timeState.current],
        ENV_COLORS.skyBottom[timeState.next],
        timeState.factor
    );

    const skyG = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyG.addColorStop(0, skyColorTop);
    skyG.addColorStop(0.45, skyColorMid);
    skyG.addColorStop(1, skyColorBottom);
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, HORIZON_Y + 2);

    // 1b. Volumetric atmospheric haze band near horizon
    const hazeG = ctx.createLinearGradient(0, HORIZON_Y - 55, 0, HORIZON_Y + 2);
    hazeG.addColorStop(0, 'rgba(255, 255, 255, 0)');
    hazeG.addColorStop(0.55, 'rgba(255, 220, 180, 0.08)');
    hazeG.addColorStop(1, 'rgba(255, 200, 160, 0.22)');
    ctx.fillStyle = hazeG;
    ctx.fillRect(0, HORIZON_Y - 55, W, 57);

    // 1c. Night-time aurora shimmer band
    let auroraOpacity = 0;
    if (timeState.current === 3) auroraOpacity = 0.55;
    else if (timeState.current === 2) auroraOpacity = timeState.factor * 0.4;
    else if (timeState.current === 0) auroraOpacity = (1.0 - timeState.factor) * 0.3;
    if (auroraOpacity > 0.01) {
        const auroraShift = Math.sin(tick * 0.008) * 55;
        const auroraY = HORIZON_Y * 0.32 + Math.sin(tick * 0.005) * 18;
        for (let band = 0; band < 3; band++) {
            const bandColors = ['rgba(0,240,255,', 'rgba(120,80,255,', 'rgba(0,255,160,'];
            const bandShift = auroraShift + band * 95;
            const bandG = ctx.createLinearGradient(0, auroraY - 22 + band * 12, 0, auroraY + 22 + band * 12);
            bandG.addColorStop(0, bandColors[band] + '0)');
            bandG.addColorStop(0.5, bandColors[band] + (auroraOpacity * 0.38).toFixed(2) + ')');
            bandG.addColorStop(1, bandColors[band] + '0)');
            ctx.fillStyle = bandG;
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(0, auroraY - 22 + band * 12);
            for (let xi = 0; xi <= W; xi += 55) {
                const wave = Math.sin((xi + bandShift) * 0.018 + tick * 0.012) * 14;
                ctx.lineTo(xi, auroraY + wave + band * 12);
            }
            for (let xi = W; xi >= 0; xi -= 55) {
                const wave = Math.sin((xi + bandShift) * 0.018 + tick * 0.012) * 14;
                ctx.lineTo(xi, auroraY + 44 + wave + band * 12);
            }
            ctx.closePath();
            ctx.fillStyle = bandG;
            ctx.fill();
            ctx.restore();
        }
    }

    // 2. Stars (twinkling 4-point cross sparkles at night/sunset/dawn)
    let starsOpacity = 0;
    if (timeState.current === 3) starsOpacity = 1.0; // Night
    else if (timeState.current === 2) starsOpacity = timeState.factor * 0.75; // Sunset -> Night
    else if (timeState.current === 0) starsOpacity = (1.0 - timeState.factor) * 0.75; // Night -> Dawn
    
    if (starsOpacity > 0.01) {
        ctx.save();
        ctx.globalAlpha = starsOpacity;
        STARS.forEach(s => {
            s.phase += s.speed;
            const alpha = 0.2 + Math.abs(Math.sin(s.phase)) * 0.8;
            
            // Core star dot
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();

            // Twinkling cross sparkle flares for larger stars
            if (s.size > 1.25 && (tick + s.x) % 70 < 30) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.72})`;
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(s.x - 4, s.y);
                ctx.lineTo(s.x + 4, s.y);
                ctx.moveTo(s.x, s.y - 4);
                ctx.lineTo(s.x, s.y + 4);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    // 3. Shooting stars
    if (starsOpacity > 0.4) {
        if (!shootingStar && Math.random() < 0.004) {
            shootingStar = {
                x: Math.random() * W * 0.6,
                y: Math.random() * HORIZON_Y * 0.35,
                len: Math.random() * 50 + 35,
                angle: Math.PI * 0.16 + Math.random() * 0.07,
                speed: Math.random() * 11 + 9,
                alpha: 1.0
            };
        }
        if (shootingStar) {
            ctx.save();
            ctx.strokeStyle = `rgba(254, 240, 138, ${shootingStar.alpha * starsOpacity})`;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(shootingStar.x, shootingStar.y);
            ctx.lineTo(
                shootingStar.x + Math.cos(shootingStar.angle) * shootingStar.len,
                shootingStar.y + Math.sin(shootingStar.angle) * shootingStar.len
            );
            ctx.stroke();
            ctx.restore();

            shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
            shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
            shootingStar.alpha -= 0.038;
            if (shootingStar.alpha <= 0) shootingStar = null;
        }
    }

    // 4. Sun & Moon path positions
    let sx = W * 0.72;
    let sy = HORIZON_Y - 26;
    
    if (timeState.current === 0) { // Dawn -> Noon (rising from left)
        sx = W * 0.2 + (W * 0.3) * timeState.factor;
        sy = (HORIZON_Y - 10) + ((HORIZON_Y - 80) - (HORIZON_Y - 10)) * timeState.factor;
    } else if (timeState.current === 1) { // Noon -> Sunset (setting to right)
        sx = W * 0.5 + (W * 0.22) * timeState.factor;
        sy = (HORIZON_Y - 80) + ((HORIZON_Y - 26) - (HORIZON_Y - 80)) * timeState.factor;
    } else if (timeState.current === 2) { // Sunset -> Night (sinking below)
        sx = W * 0.72 + (W * 0.1) * timeState.factor;
        sy = (HORIZON_Y - 26) + 40 * timeState.factor;
    } else if (timeState.current === 3) { // Night -> Dawn (Moon path)
        sx = W * 0.75 - (W * 0.45) * timeState.factor;
        sy = (HORIZON_Y - 60) + Math.sin(timeState.factor * Math.PI) * -30;
    }

    // Draw Sun or Moon
    if (timeState.current < 2 || (timeState.current === 2 && timeState.factor < 0.6) || (timeState.current === 3 && timeState.factor > 0.8)) {
        // Draw Sun
        let sunAlpha = 1.0;
        if (timeState.current === 2) sunAlpha = 1.0 - timeState.factor * 1.5; // setting fade
        if (timeState.current === 3) sunAlpha = (timeState.factor - 0.8) * 5; // rising fade
        
        if (sunAlpha > 0.01) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(sunAlpha, 1));
            
            // Glowing sunbeams
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const numRays = 10;
            for (let i = 0; i < numRays; i++) {
                const angle = Math.PI * 0.15 + (i / numRays) * Math.PI * 0.7;
                const width = 0.075 + Math.sin(tick * 0.012 + i) * 0.018;
                const length = 310;

                const rayG = ctx.createLinearGradient(sx, sy, sx + Math.cos(angle) * length, sy + Math.sin(angle) * length);
                rayG.addColorStop(0, 'rgba(251, 146, 60, 0.35)');
                rayG.addColorStop(0.5, 'rgba(244, 63, 94, 0.08)');
                rayG.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.fillStyle = rayG;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + Math.cos(angle - width) * length, sy + Math.sin(angle - width) * length);
                ctx.lineTo(sx + Math.cos(angle + width) * length, sy + Math.sin(angle + width) * length);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            // Sun radial halo
            const sunHalo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 95);
            sunHalo.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
            sunHalo.addColorStop(0.2, 'rgba(251, 146, 60, 0.65)');
            sunHalo.addColorStop(0.55, 'rgba(244, 63, 94, 0.32)');
            sunHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = sunHalo;
            ctx.beginPath();
            ctx.arc(sx, sy, 95, 0, Math.PI * 2);
            ctx.fill();

            // Solid sun core
            ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
            ctx.beginPath();
            ctx.arc(sx, sy, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    } else {
        // Draw Giant Cyberpunk Crescent Moon
        let moonAlpha = 1.0;
        if (timeState.current === 2) moonAlpha = (timeState.factor - 0.4) * 1.6; // appearing fade
        if (timeState.current === 3 && timeState.factor > 0.8) moonAlpha = (1.0 - timeState.factor) * 5; // setting fade

        if (moonAlpha > 0.01) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(moonAlpha, 1));
            
            // Soft moon radial cyan-blue halo
            const moonHalo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 75);
            moonHalo.addColorStop(0, 'rgba(0, 240, 255, 0.4)'); // cyan neon glow
            moonHalo.addColorStop(0.4, 'rgba(147, 197, 253, 0.15)');
            moonHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = moonHalo;
            ctx.beginPath();
            ctx.arc(sx, sy, 75, 0, Math.PI * 2);
            ctx.fill();

            // Stylized Saturn-style ring around cyber-moon
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 42, 6, -Math.PI / 6, 0, Math.PI * 2);
            ctx.stroke();

            // Moon core shape
            ctx.fillStyle = 'rgba(255, 253, 245, 0.96)';
            ctx.beginPath();
            ctx.arc(sx, sy, 18, 0, Math.PI * 2);
            ctx.fill();

            // Overlay dark arc to cut out crescent
            ctx.fillStyle = skyColorTop;
            ctx.beginPath();
            ctx.arc(sx - 6, sy - 3, 17, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }

    // 5. Draw clouds
    CLOUDS.forEach(c => {
        c.x -= c.speed;
        if (c.x < -c.size) c.x = W + c.size;
        drawCloud(ctx, c.x, c.y, c.size, c.alpha);
    });
}

function drawCloud(ctx, cx, cy, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#1e0524';
    const shadowOffset = size * 0.09;
    const blobs = [
        { dx: 0, dy: shadowOffset, r: size * 0.38 },
        { dx: size * 0.3, dy: size * 0.06 + shadowOffset, r: size * 0.28 },
        { dx: -size * 0.28, dy: size * 0.08 + shadowOffset, r: size * 0.24 },
        { dx: size * 0.1, dy: -size * 0.18 + shadowOffset, r: size * 0.2 },
        { dx: -size * 0.1, dy: -size * 0.1 + shadowOffset, r: size * 0.18 },
    ];
    blobs.forEach(b => {
        ctx.beginPath();
        ctx.arc(cx + b.dx, cy + b.dy, b.r, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff6fb';
    const blobsMain = [
        { dx: 0, dy: 0, r: size * 0.38 },
        { dx: size * 0.3, dy: size * 0.06, r: size * 0.28 },
        { dx: -size * 0.28, dy: size * 0.08, r: size * 0.24 },
        { dx: size * 0.1, dy: -size * 0.18, r: size * 0.2 },
        { dx: -size * 0.1, dy: -size * 0.1, r: size * 0.18 },
    ];
    blobsMain.forEach(b => {
        ctx.beginPath();
        ctx.arc(cx + b.dx, cy + b.dy, b.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawMountains(ctx) {
    const mxShift = -camWX * 0.06;
    const timeState = getCurrentTimeState();

    // Tokyo Tower (far background)
    drawTokyoTower(ctx, mxShift);

    // Dynamic mountain colors
    const mountainCol = interpolateColor(
        ENV_COLORS.mountain[timeState.current],
        ENV_COLORS.mountain[timeState.next],
        timeState.factor
    );
    const mountainNearCol = interpolateColor(
        ENV_COLORS.mountainNear[timeState.current],
        ENV_COLORS.mountainNear[timeState.next],
        timeState.factor
    );

    // Layer 0: Very far snowcapped mountains (slowest parallax)
    const mx0 = -camWX * 0.03;
    ctx.fillStyle = mountainCol;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    const mPoints0 = [0, 60, 130, 210, 310, 400, 490, 580, 670, 760, 850, 900];
    const mHeights0 = [0, 60, 95, 65, 118, 82, 122, 72, 105, 60, 95, 68];
    mPoints0.forEach((x, i) => {
        ctx.lineTo(x + mx0, HORIZON_Y - mHeights0[i]);
    });
    ctx.lineTo(900, HORIZON_Y);
    ctx.closePath();
    ctx.fill();

    // Snow caps on tallest peaks
    ctx.fillStyle = 'rgba(255, 235, 248, 0.72)';
    [[210, 65, 18], [490, 122, 22], [310, 118, 20], [670, 105, 16]].forEach(([mx, mh, r]) => {
        const smx = mx + mx0;
        const my = HORIZON_Y - mh;
        ctx.beginPath();
        ctx.moveTo(smx, my);
        ctx.lineTo(smx - r, my + r * 1.45);
        ctx.lineTo(smx + r, my + r * 1.45);
        ctx.closePath();
        ctx.fill();
        // Snow ridge line
        ctx.strokeStyle = 'rgba(255, 160, 190, 0.42)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(smx - r * 0.45, my + r * 0.9);
        ctx.lineTo(smx + r * 0.55, my + r * 0.95);
        ctx.stroke();
    });

    // Layer 1: Mid far hills (slightly faster parallax)
    const mx1 = -camWX * 0.10;
    const ambientFactor = ENV_COLORS.ambient[timeState.current] +
        (ENV_COLORS.ambient[timeState.next] - ENV_COLORS.ambient[timeState.current]) * timeState.factor;
    const mCol1R = Math.floor(29 * (1 - ambientFactor) + 20 * ambientFactor);
    const mCol1G = Math.floor(8 * (1 - ambientFactor) + 5 * ambientFactor);
    const mCol1B = Math.floor(48 * (1 - ambientFactor) + 40 * ambientFactor);
    ctx.fillStyle = `rgba(${mCol1R},${mCol1G},${mCol1B},0.88)`;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    [0, 90, 185, 285, 390, 500, 610, 710, 800, 900].forEach((x, i) => {
        const h = [0, 38, 22, 46, 28, 52, 24, 40, 18, 0][i];
        ctx.lineTo(x + mx1, HORIZON_Y - h);
    });
    ctx.lineTo(900, HORIZON_Y);
    ctx.closePath();
    ctx.fill();

    // Atmospheric mist/glow band at horizon
    const mistG = ctx.createLinearGradient(0, HORIZON_Y - 52, 0, HORIZON_Y + 2);
    if (timeState.current === 3 || timeState.current === 2) {
        mistG.addColorStop(0, 'rgba(15, 5, 40, 0)');
        mistG.addColorStop(0.6, 'rgba(80, 20, 120, 0.22)');
        mistG.addColorStop(1, 'rgba(30, 10, 60, 0.70)');
    } else if (timeState.current === 0) {
        mistG.addColorStop(0, 'rgba(234, 88, 12, 0)');
        mistG.addColorStop(0.55, 'rgba(234, 88, 12, 0.22)');
        mistG.addColorStop(1, 'rgba(200, 60, 10, 0.78)');
    } else {
        mistG.addColorStop(0, 'rgba(186, 230, 253, 0)');
        mistG.addColorStop(0.65, 'rgba(186, 230, 253, 0.18)');
        mistG.addColorStop(1, 'rgba(14, 165, 233, 0.55)');
    }
    ctx.fillStyle = mistG;
    ctx.fillRect(0, HORIZON_Y - 52, W, 54);

    // Layer 2: Near hills/ridgeline (faster parallax, darkest)
    const hxShift = -camWX * 0.20;
    ctx.fillStyle = mountainNearCol;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    const hHeights = [0, 34, 20, 44, 28, 42, 22, 34, 8, 0];
    [0, 100, 200, 300, 450, 570, 680, 790, 860, 900].forEach((x, i) => {
        ctx.lineTo(x + hxShift, HORIZON_Y - hHeights[i]);
    });
    ctx.lineTo(900, HORIZON_Y);
    ctx.closePath();
    ctx.fill();
}

function drawTokyoTower(ctx, mxShift) {
    const tx = W * 0.32 + mxShift;
    const ty = HORIZON_Y;
    const tick = typeof frame !== 'undefined' ? frame : 0;
    
    ctx.save();
    
    // Sweeping Searchlight (Only at Night/Sunset/Dawn)
    const timeState = getCurrentTimeState();
    let showLight = (timeState.current === 3) || (timeState.current === 2 && timeState.factor > 0.4) || (timeState.current === 0 && timeState.factor < 0.6);
    
    if (showLight) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const sweepAngle = Math.sin(tick * 0.015) * 0.45;
        const lightShaftG = ctx.createLinearGradient(tx, ty - 105, tx + Math.sin(sweepAngle) * 280, ty - 105 - Math.cos(sweepAngle) * 280);
        lightShaftG.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
        lightShaftG.addColorStop(0.5, 'rgba(0, 240, 255, 0.07)');
        lightShaftG.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = lightShaftG;
        ctx.beginPath();
        ctx.moveTo(tx, ty - 105);
        ctx.lineTo(tx + Math.sin(sweepAngle - 0.08) * 280, ty - 105 - Math.cos(sweepAngle - 0.08) * 280);
        ctx.lineTo(tx + Math.sin(sweepAngle + 0.08) * 280, ty - 105 - Math.cos(sweepAngle + 0.08) * 280);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    const beaconAlpha = 0.35 + Math.abs(Math.sin(tick * 0.08)) * 0.65;
    const towerGlow = ctx.createRadialGradient(tx, ty - 105, 0, tx, ty - 105, 14);
    towerGlow.addColorStop(0, `rgba(239, 68, 68, ${beaconAlpha * 0.85})`);
    towerGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = towerGlow;
    ctx.beginPath();
    ctx.arc(tx, ty - 105, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.66)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(tx - 14, ty);
    ctx.quadraticCurveTo(tx - 3, ty - 40, tx - 2, ty - 70);
    ctx.moveTo(tx + 14, ty);
    ctx.quadraticCurveTo(tx + 3, ty - 40, tx + 2, ty - 70);
    ctx.lineTo(tx, ty - 105);
    ctx.lineTo(tx - 2, ty - 70);
    
    for (let h = 0; h < 70; h += 10) {
        const yCoord = ty - h;
        const xOff = 14 * (1 - h / 70);
        ctx.moveTo(tx - xOff, yCoord);
        ctx.lineTo(tx + xOff, yCoord - 10);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.72)';
    ctx.fillRect(tx - 7.5, ty - 22, 15, 2.5);
    ctx.fillRect(tx - 5.5, ty - 46, 11, 2.5);
    ctx.fillRect(tx - 3.5, ty - 68, 7, 3.8);
    ctx.fillRect(tx - 1.5, ty - 82, 3, 2.5);

    ctx.fillStyle = `rgba(255, 235, 235, ${beaconAlpha})`;
    ctx.beginPath();
    ctx.arc(tx, ty - 105, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBuildings(ctx) {
    const bShift = -camWX * 0.22;
    const timeState = getCurrentTimeState();
    const tick = typeof frame !== 'undefined' ? frame : 0;
    
    const bldgCol = interpolateColor(
        ENV_COLORS.building[timeState.current],
        ENV_COLORS.building[timeState.next],
        timeState.factor
    );

    const litDensity = ENV_COLORS.winLit[timeState.current] + 
        (ENV_COLORS.winLit[timeState.next] - ENV_COLORS.winLit[timeState.current]) * timeState.factor;
    const neonVisibility = ENV_COLORS.ambient[timeState.current] +
        (ENV_COLORS.ambient[timeState.next] - ENV_COLORS.ambient[timeState.current]) * timeState.factor;

    BLDGS.forEach((b, bi) => {
        const bx = b.x + bShift;
        const by = HORIZON_Y - b.h;

        // ── GLASS FACADE: multi-stop gradient with subtle reflections ──
        const facadeG = ctx.createLinearGradient(bx, by, bx + b.w, by + b.h);
        facadeG.addColorStop(0, bldgCol);
        facadeG.addColorStop(0.3 + Math.sin(bi * 1.3) * 0.12, 'rgba(255,255,255,0.045)');
        facadeG.addColorStop(0.65, bldgCol);
        facadeG.addColorStop(1.0, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = facadeG;
        ctx.fillRect(bx, by, b.w, b.h);

        // Glass reflection diagonal sheen (like a tall glass tower catching sky)
        if (neonVisibility > 0.05) {
            ctx.save();
            const sheenG = ctx.createLinearGradient(bx, by, bx + b.w * 0.9, by + b.h * 0.6);
            sheenG.addColorStop(0, 'rgba(255,255,255,0)');
            sheenG.addColorStop(0.35, `rgba(255,255,255,${0.04 + neonVisibility * 0.04})`);
            sheenG.addColorStop(0.6, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheenG;
            ctx.fillRect(bx, by, b.w, b.h);
            ctx.restore();
        }

        // Structural horizontal floor lines (every ~10px of height)
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.045)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let fy = by + 10; fy < by + b.h; fy += 10) {
            ctx.moveTo(bx, fy);
            ctx.lineTo(bx + b.w, fy);
        }
        ctx.stroke();
        // Vertical structural columns
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let fx = bx + Math.round(b.w * 0.33); fx < bx + b.w - 2; fx += Math.round(b.w * 0.33)) {
            ctx.moveTo(fx, by);
            ctx.lineTo(fx, by + b.h);
        }
        ctx.stroke();
        ctx.restore();

        // Neon Vertical Edge Trim Lines
        if (neonVisibility > 0.12) {
            const neonColors = ['#ff007f', '#00f0ff', '#a78bfa', '#ffd95a', '#34d399', '#f97316'];
            const nc = neonColors[bi % neonColors.length];
            ctx.save();
            // Outer glow
            ctx.globalAlpha = neonVisibility * 0.38;
            ctx.strokeStyle = nc;
            ctx.lineWidth = 4.5;
            ctx.shadowColor = nc;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(bx + 1, by); ctx.lineTo(bx + 1, by + b.h);
            ctx.moveTo(bx + b.w - 1, by); ctx.lineTo(bx + b.w - 1, by + b.h);
            ctx.stroke();
            // Bright inner line
            ctx.globalAlpha = neonVisibility * 0.85;
            ctx.strokeStyle = nc;
            ctx.lineWidth = 1.4;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(bx + 1, by); ctx.lineTo(bx + 1, by + b.h);
            ctx.moveTo(bx + b.w - 1, by); ctx.lineTo(bx + b.w - 1, by + b.h);
            ctx.stroke();
            ctx.restore();
        }

        // Roof structure
        if (bi % 2 === 0) {
            // Antenna with blinking halo
            ctx.strokeStyle = 'rgba(167, 139, 250, 0.38)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(bx + b.w * 0.5, by);
            ctx.lineTo(bx + b.w * 0.5, by - 20);
            ctx.stroke();
            // Cross bar
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(bx + b.w * 0.5 - 4, by - 14);
            ctx.lineTo(bx + b.w * 0.5 + 4, by - 14);
            ctx.stroke();

            const antAlpha = 0.35 + Math.abs(Math.sin(timeCycle * 0.055 + bi * 0.8)) * 0.65;
            ctx.save();
            ctx.globalAlpha = antAlpha * Math.min(neonVisibility + 0.3, 1);
            const glow = ctx.createRadialGradient(bx + b.w * 0.5, by - 20, 0, bx + b.w * 0.5, by - 20, 9);
            glow.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
            glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(bx + b.w * 0.5, by - 20, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255, 100, 100, ${antAlpha})`;
            ctx.beginPath(); ctx.arc(bx + b.w * 0.5, by - 20, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            // HVAC/Water tower block on roof
            ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
            ctx.fillRect(bx + b.w * 0.18, by - 8, b.w * 0.38, 8);
            ctx.fillStyle = 'rgba(80, 80, 100, 0.5)';
            ctx.fillRect(bx + b.w * 0.20, by - 7, b.w * 0.34, 6);
        }

        // Office window grids (with enhanced glow bloom)
        b.win.forEach((w, wi) => {
            const isLit = ((bi * 17 + wi * 11) % 10) < litDensity * 10;
            if (isLit) {
                const wColor = winColor(bi, wi, 0);
                // Wide outer bloom
                if (neonVisibility > 0.08) {
                    ctx.save();
                    ctx.globalAlpha = neonVisibility * 0.28;
                    ctx.fillStyle = wColor;
                    ctx.fillRect(bx + w[0] - 2.5, by + w[1] - 2.5, w[2] + 5, w[3] + 5);
                    ctx.restore();
                }
                // Main pane
                ctx.fillStyle = wColor;
                ctx.fillRect(bx + w[0], by + w[1], w[2], w[3]);
                // Interior shadow half (depth illusion)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
                ctx.fillRect(bx + w[0] + w[2] * 0.52, by + w[1], w[2] * 0.46, w[3]);
                // Tiny white specular glint top-left
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.fillRect(bx + w[0] + 1, by + w[1] + 1, Math.max(2, w[2] * 0.22), 1.4);
            } else {
                // Dark unlit window (slightly reflective)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
                ctx.fillRect(bx + w[0], by + w[1], w[2], w[3]);
            }
        });

        // Glowing vertical Japanese neon signs
        NEON_SIGNS.forEach(sign => {
            if (sign.bIdx === bi) {
                const sx = bx + sign.xOff;
                const sy = by + sign.yOff;
                
                ctx.fillStyle = 'rgba(5, 2, 12, 0.96)';
                ctx.strokeStyle = sign.col;
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.roundRect(sx, sy, sign.w, sign.h, 4);
                ctx.fill();
                
                ctx.save();
                ctx.globalAlpha = neonVisibility;
                // Outer glow border
                ctx.shadowColor = sign.col;
                ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;
                // Ambient area glow
                ctx.fillStyle = sign.col + '18';
                ctx.fillRect(sx - 4, sy - 4, sign.w + 8, sign.h + 8);

                const chars = sign.text.split('');
                const stepY = sign.h / (chars.length + 1);
                chars.forEach((ch, ci) => {
                    const flicker = Math.random() > 0.004 ? 1.0 : 0.42;
                    ctx.save();
                    ctx.globalAlpha = flicker * neonVisibility;
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 9px "Noto Sans JP", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = sign.col;
                    ctx.shadowBlur = 6;
                    ctx.fillText(ch, sx + sign.w / 2, sy + stepY * (ci + 1));
                    ctx.restore();
                });
                ctx.restore();
            }
        });

        // Thin outer frame
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.08)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx, by, b.w, b.h);
    });
}

function drawRoad(ctx) {
    const fl = project(-ROAD_HALF_W, 0, FAR_Z);
    const fr = project(ROAD_HALF_W, 0, FAR_Z);
    const nl = project(-ROAD_HALF_W, 0, NEAR_Z);
    const nr = project(ROAD_HALF_W, 0, NEAR_Z);
    const timeState = getCurrentTimeState();
    const tick = typeof frame !== 'undefined' ? frame : 0;

    const roadColor = interpolateColor(
        ENV_COLORS.road[timeState.current],
        ENV_COLORS.road[timeState.next],
        timeState.factor
    );

    // ── GROUND BACKGROUND FILL ──
    // Scale down road color components by 55% to make a matching, dark natural ground base
    const matches = roadColor.match(/\d+/g);
    let groundColor = '#060410';
    if (matches && matches.length >= 3) {
        const gr = Math.max(0, Math.floor(parseInt(matches[0]) * 0.45));
        const gg = Math.max(0, Math.floor(parseInt(matches[1]) * 0.45));
        const gb = Math.max(0, Math.floor(parseInt(matches[2]) * 0.45));
        groundColor = `rgb(${gr},${gg},${gb})`;
    }
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    // ── ROAD BASE: perspective-correct trapezoid ──
    ctx.fillStyle = roadColor;
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.lineTo(nr.x, nr.y);
    ctx.lineTo(nl.x, nl.y);
    ctx.closePath();
    ctx.fill();

    // ── Subtle cross-grain asphalt texture (horizontal scan lines fade with distance) ──
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.lineTo(nr.x, nr.y);
    ctx.lineTo(nl.x, nl.y);
    ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = 'overlay';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)';
    ctx.lineWidth = 0.7;
    for (let lineY = HORIZON_Y + 4; lineY < H; lineY += 3) {
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(W, lineY);
        ctx.stroke();
    }
    ctx.restore();

    // ── Perspective darkening gradient on road surface ──
    const roadDepthG = ctx.createLinearGradient(0, fl.y, 0, nr.y);
    roadDepthG.addColorStop(0, 'rgba(0,0,0,0.35)');
    roadDepthG.addColorStop(0.55, 'rgba(0,0,0,0.08)');
    roadDepthG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = roadDepthG;
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.lineTo(nr.x, nr.y);
    ctx.lineTo(nl.x, nl.y);
    ctx.closePath();
    ctx.fill();

    // ── GORGEOUS WET ROAD NEON REFLECTIONS WITH SIMULATED SHIMMER RIPPLES ──
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bShift = -camWX * 0.22;
    // Get ambient neon visibility
    const neonVisibility = ENV_COLORS.ambient[timeState.current] +
        (ENV_COLORS.ambient[timeState.next] - ENV_COLORS.ambient[timeState.current]) * timeState.factor;

    if (neonVisibility > 0.05) {
        ctx.globalAlpha = neonVisibility;
        BLDGS.forEach((b, bi) => {
            NEON_SIGNS.forEach(sign => {
                if (sign.bIdx === bi) {
                    const signWX = b.x + bShift + sign.xOff + sign.w * 0.5;
                    const rStart = project(signWX - 60, 0, FAR_Z);
                    const rEnd = project(signWX - 60, 0, NEAR_Z);
                    const rStart2 = project(signWX + 60, 0, FAR_Z);
                    const rEnd2 = project(signWX + 60, 0, NEAR_Z);

                    let rx = (rStart.x + rStart2.x) * 0.5;
                    let rxBottom = (rEnd.x + rEnd2.x) * 0.5;

                    // Warp coordinates using sine ripples
                    const reflectionWarp = Math.sin(tick * 0.08 + bi * 1.5) * 4;
                    rx += reflectionWarp * rStart.s;
                    rxBottom += reflectionWarp * rEnd.s;

                    const refG = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
                    refG.addColorStop(0, sign.col + '35');
                    refG.addColorStop(0.4, sign.col + '18');
                    refG.addColorStop(1, 'rgba(0, 0, 0, 0)');

                    ctx.fillStyle = refG;
                    ctx.beginPath();
                    ctx.moveTo(rx - 25, HORIZON_Y);
                    ctx.lineTo(rx + 25, HORIZON_Y);
                    ctx.lineTo(rxBottom + 115, H);
                    ctx.lineTo(rxBottom - 115, H);
                    ctx.closePath();
                    ctx.fill();
                }
            });
        });
    }

    // Streetlight light reflections on road (projected under streetlights)
    if (neonVisibility > 0.15) {
        ctx.globalAlpha = neonVisibility * 0.24;
        const stepP = POLE_STEP;
        const offsetP = typeof poleOff !== 'undefined' ? poleOff : 0;
        for (let z = NEAR_Z + stepP - offsetP; z < FAR_Z; z += stepP) {
            // Streetlights overhang at ROAD_HALF_W + 25 (right) and -ROAD_HALF_W - 25 (left)
            // with curved overhang bracket of 38 units towards center.
            const lampL_WX = -ROAD_HALF_W - 25 + 38;
            const lampR_WX = ROAD_HALF_W + 25 - 38;

            const lRefL = project(lampL_WX, 0, z);
            const lRefR = project(lampR_WX, 0, z);
            const radiusRef = 55 * lRefL.s;
            
            if (lRefL.y >= HORIZON_Y) {
                const gradL = ctx.createRadialGradient(lRefL.x, lRefL.y, 0, lRefL.x, lRefL.y, radiusRef * 1.6);
                gradL.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
                gradL.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradL;
                ctx.beginPath();
                ctx.ellipse(lRefL.x, lRefL.y, radiusRef * 1.8, radiusRef * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            if (lRefR.y >= HORIZON_Y) {
                const gradR = ctx.createRadialGradient(lRefR.x, lRefR.y, 0, lRefR.x, lRefR.y, radiusRef * 1.6);
                gradR.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
                gradR.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradR;
                ctx.beginPath();
                ctx.ellipse(lRefR.x, lRefR.y, radiusRef * 1.8, radiusRef * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    ctx.restore();

    // Sidewalk slabs
    const sl = project(-ROAD_HALF_W - 60, 0, FAR_Z);
    const sr = project(ROAD_HALF_W + 60, 0, FAR_Z);
    const snl = project(-ROAD_HALF_W - 60, 0, NEAR_Z);
    const snr = project(ROAD_HALF_W + 60, 0, NEAR_Z);

    ctx.fillStyle = 'rgba(20, 15, 30, 0.95)';
    ctx.beginPath();
    ctx.moveTo(sl.x, sl.y); ctx.lineTo(fl.x, fl.y);
    ctx.lineTo(nl.x, nl.y); ctx.lineTo(snl.x, snl.y);
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(fr.x, fr.y); ctx.lineTo(sr.x, sr.y);
    ctx.lineTo(snr.x, snr.y); ctx.lineTo(nr.x, nr.y);
    ctx.closePath(); ctx.fill();

    // Yellow curb warning lines
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = Math.max(1, 2.5 * fl.s);
    ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.lineTo(nl.x, nl.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fr.x, fr.y); ctx.lineTo(nr.x, nr.y); ctx.stroke();
    ctx.restore();

    // Glowing boundary pink neon curb bars
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.25)';
    ctx.lineWidth = Math.max(3.5, 6.5 * fl.s);
    ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.lineTo(nl.x, nl.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fr.x, fr.y); ctx.lineTo(nr.x, nr.y); ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 230, 245, 0.88)';
    ctx.lineWidth = Math.max(1, 1.8 * fl.s);
    ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.lineTo(nl.x, nl.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fr.x, fr.y); ctx.lineTo(nr.x, nr.y); ctx.stroke();
    ctx.restore();
}

function drawSingleGuardRail(ctx, wx, z, stepZ) {
    const base1 = project(wx, 0, z);
    const top1 = project(wx, 14, z);
    const base2 = project(wx, 0, z + stepZ);
    const top2 = project(wx, 14, z + stepZ);

    if (base1.y < HORIZON_Y || base2.y < HORIZON_Y) return;

    ctx.save();
    ctx.fillStyle = '#64748b'; // metallic steel rails
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;

    const t = Math.max(1, 2.5 * base1.s);

    // Draw vertical post
    ctx.fillRect(top1.x - t * 0.5, top1.y, t, base1.y - top1.y);
    ctx.strokeRect(top1.x - t * 0.5, top1.y, t, base1.y - top1.y);

    // Draw horizontal rail beams
    ctx.beginPath();
    ctx.lineWidth = Math.max(1.5, 3.2 * base1.s);
    ctx.moveTo(top1.x, top1.y);
    ctx.lineTo(top2.x, top2.y);
    ctx.stroke();

    // Lower horizontal support bar
    const midY1 = top1.y + (base1.y - top1.y) * 0.45;
    const midY2 = top2.y + (base2.y - top2.y) * 0.45;
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.8, 2.0 * base1.s);
    ctx.moveTo(top1.x, midY1);
    ctx.lineTo(top2.x, midY2);
    ctx.stroke();

    ctx.restore();
}

function drawRoadLines(ctx) {
    const stepZ = 95;
    const currentOff = typeof roadOff !== 'undefined' ? (roadOff % stepZ) : 0;
    
    // ── Glowing dual-layer cyan laser lane dashes ──
    [-55, 55].forEach(lx => {
        for (let z = NEAR_Z + stepZ - currentOff; z < FAR_Z; z += stepZ) {
            const a = project(lx, 0, z);
            const b = project(lx, 0, z + 50);
            if (a.y < HORIZON_Y || b.y < HORIZON_Y) continue;

            // Ultra-wide outer bloom halo
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
            ctx.lineWidth = Math.max(6.0, 14.0 * a.s);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Mid cyan glow
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
            ctx.lineWidth = Math.max(3.0, 6.5 * a.s);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Bright white laser core
            ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
            ctx.lineWidth = Math.max(0.8, 1.8 * a.s);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    });

    // ── Center dashed white line ──
    const cStep = 80;
    const cOff = typeof roadOff !== 'undefined' ? (roadOff % cStep) : 0;
    for (let z = NEAR_Z + cStep - cOff; z < FAR_Z; z += cStep) {
        const a = project(0, 0, z);
        const b = project(0, 0, z + 42);
        if (a.y < HORIZON_Y || b.y < HORIZON_Y) continue;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = Math.max(0.7, 1.4 * a.s);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }

    // ── Curb hazard warning stripes ──
    const blockZ = 60;
    const blockOff = typeof roadOff !== 'undefined' ? (roadOff % blockZ) : 0;
    [-ROAD_HALF_W, ROAD_HALF_W].forEach(lx => {
        for (let z = NEAR_Z + blockZ - blockOff; z < FAR_Z; z += blockZ) {
            const a = project(lx, 0, z);
            const b = project(lx, 0, z + 30);
            if (a.y < HORIZON_Y) continue;

            const isEven = Math.floor((z - NEAR_Z) / blockZ) % 2 === 0;
            // Outer glow
            ctx.strokeStyle = isEven ? 'rgba(245, 158, 11, 0.28)' : 'rgba(239, 68, 68, 0.28)';
            ctx.lineWidth = Math.max(3.5, 7.5 * a.s);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
            // Core line
            ctx.strokeStyle = isEven ? 'rgba(245, 158, 11, 0.82)' : 'rgba(239, 68, 68, 0.82)';
            ctx.lineWidth = Math.max(1.5, 3.5 * a.s);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    });
}

function drawSinglePole(ctx, z, index = 0) {
    const timeState = getCurrentTimeState();
    
    // Light visibility factors (bright at night/sunset/dawn)
    const lightFactor = ENV_COLORS.ambient[timeState.current] +
        (ENV_COLORS.ambient[timeState.next] - ENV_COLORS.ambient[timeState.current]) * timeState.factor;

    [-POLE_WX, POLE_WX].forEach(wx => {
        const base = project(wx, 0, z);
        const top = project(wx, POLE_H, z);
        if (base.y < HORIZON_Y) return;
        const thick = Math.max(1.5, 2.8 * base.s);

        // Main concrete column
        ctx.strokeStyle = 'rgba(36, 28, 52, 0.94)';
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();

        // Grey distribution transformer cylinder details
        const cbY = POLE_H - 18;
        if (index % 2 === 0) {
            const tfH = 32 * base.s;
            const tfW = 14 * base.s;
            const tfP = project(wx - 10, cbY - 10, z);
            
            ctx.fillStyle = '#475569';
            ctx.fillRect(tfP.x - tfW * 0.5, tfP.y - tfH * 0.5, tfW, tfH);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = Math.max(0.5, 1.2 * base.s);
            ctx.strokeRect(tfP.x - tfW * 0.5, tfP.y - tfH * 0.5, tfW, tfH);
        }

        // Crossbar
        const cbL = project(wx - 55, cbY, z);
        const cbR = project(wx + 55, cbY, z);
        ctx.lineWidth = Math.max(1, 2 * base.s);
        ctx.strokeStyle = 'rgba(36, 28, 52, 0.94)';
        ctx.beginPath();
        ctx.moveTo(cbL.x, cbL.y);
        ctx.lineTo(cbR.x, cbR.y);
        ctx.stroke();

        // Hanging power cable lines
        const nextZ = Math.min(z + POLE_STEP, FAR_Z);
        const nextBase = project(wx, cbY, nextZ);
        
        [-30, 0, 30].forEach(ox => {
            const p1 = project(wx + ox, cbY, z);
            const p2 = project(wx + ox, cbY - 8, nextZ);
            const mid = project(wx + ox, cbY - 18, (z + nextZ) / 2);
            
            ctx.strokeStyle = 'rgba(28, 18, 40, 0.45)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.quadraticCurveTo(mid.x, mid.y + 6.5, p2.x, p2.y);
            ctx.stroke();
        });
    });

    // ── HIGH-GRADE STREETLIGHTS CASTING TRANSLUCENT LIGHT CONES ──
    const streetLightStep = POLE_STEP; // aligned with poles
    [-ROAD_HALF_W - 25, ROAD_HALF_W + 25].forEach(wx => {
        const base = project(wx, 0, z);
        const poleH = 92;
        const top = project(wx, poleH, z);
        
        if (base.y < HORIZON_Y) return;

        const thick = Math.max(1.2, 2.2 * base.s);
        ctx.save();
        
        // Render pole (Slate grey)
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();

        // Curved overhang bracket arm pointing towards road center
        const signSign = wx < 0 ? 1 : -1;
        const bracketW = 38;
        const lampWX = wx + bracketW * signSign;
        const lampWY = poleH - 4;
        
        const lampBase = project(lampWX, lampWY, z);
        
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo(top.x + (bracketW * 0.4) * signSign, top.y - 12 * base.s, lampBase.x, lampBase.y);
        ctx.stroke();

        // Lamp fixture housing box
        const fixW = 10 * base.s;
        const fixH = 4 * base.s;
        ctx.fillStyle = '#334155';
        ctx.fillRect(lampBase.x - fixW * 0.5, lampBase.y, fixW, fixH);
        ctx.strokeRect(lampBase.x - fixW * 0.5, lampBase.y, fixW, fixH);

        // Light cone cone projection (Only draw at night, sunset, or dawn)
        if (lightFactor > 0.15) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = lightFactor * 0.28; // max opacity at night

            const groundY = base.y;
            const coneHalfW = 45 * base.s;

            // Gradient yellow streetlight beam
            const coneG = ctx.createLinearGradient(lampBase.x, lampBase.y, lampBase.x, groundY);
            coneG.addColorStop(0, 'rgba(254, 240, 138, 0.98)'); // Intense yellow bulb
            coneG.addColorStop(0.3, 'rgba(254, 240, 138, 0.58)');
            coneG.addColorStop(0.7, 'rgba(254, 240, 138, 0.18)');
            coneG.addColorStop(1, 'rgba(254, 240, 138, 0)'); // fade on ground

            ctx.fillStyle = coneG;
            ctx.beginPath();
            ctx.moveTo(lampBase.x, lampBase.y);
            ctx.lineTo(lampBase.x - coneHalfW - 35 * base.s, groundY);
            ctx.lineTo(lampBase.x + coneHalfW + 35 * base.s, groundY);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            
            // Glowing lens flare bulb core
            ctx.fillStyle = '#ffffee';
            ctx.beginPath();
            ctx.arc(lampBase.x, lampBase.y + 1, Math.max(1.2, 2.5 * base.s), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
}

function drawSingleTree(ctx, z) {
    [-TREE_WX, TREE_WX].forEach(wx => {
        const base = project(wx, 0, z);
        if (base.y < HORIZON_Y || base.s < 0.04) return;

        const s = base.s;
        ctx.save();
        ctx.translate(base.x, base.y);
        ctx.scale(s, s);

        // ── 1. Gnarled Trunk with bark detail ──
        ctx.fillStyle = '#2c150a';
        ctx.strokeStyle = '#120804';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.bezierCurveTo(-12, -8, -9, -28, -10, -50);
        ctx.lineTo(-20, -70); ctx.lineTo(-14, -74); ctx.lineTo(-7, -58);
        ctx.lineTo(-3, -78); ctx.lineTo(3, -78); ctx.lineTo(7, -58);
        ctx.lineTo(14, -74); ctx.lineTo(20, -70);
        ctx.bezierCurveTo(9, -28, 12, -8, 18, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bark texture lines
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.38)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-7, -3); ctx.bezierCurveTo(-4, -22, -5, -38, -7, -50);
        ctx.moveTo(0, -5); ctx.bezierCurveTo(2, -28, 1, -44, -2, -54);
        ctx.moveTo(7, -3); ctx.bezierCurveTo(4, -18, 6, -36, 8, -48);
        ctx.stroke();
        // Subtle root flares
        ctx.fillStyle = 'rgba(30,10,5,0.55)';
        ctx.beginPath();
        ctx.ellipse(-18, -1, 8, 4, -0.35, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(18, -1, 8, 4, 0.35, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // ── 2. Deep shadow foliage (back layer) ──
        const backFoliage = [
            { x: -25, y: -74, r: 27, c1: '#9d174d', c2: '#7d1040' },
            { x: 25, y: -72, r: 25, c1: '#9d174d', c2: '#7d1040' },
            { x: 0, y: -92, r: 36, c1: '#be185d', c2: '#9d174d' },
            { x: -10, y: -62, r: 20, c1: '#be185d', c2: '#9d174d' },
            { x: 10, y: -60, r: 18, c1: '#be185d', c2: '#9d174d' },
        ];
        backFoliage.forEach(f => {
            const rg = ctx.createRadialGradient(f.x - f.r*0.22, f.y - f.r*0.22, 0, f.x, f.y, f.r);
            rg.addColorStop(0, f.c1);
            rg.addColorStop(1, f.c2);
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
        });

        // ── 3. Mid branches showing through ──
        ctx.strokeStyle = '#2c150a';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, -55); ctx.lineTo(-20, -78);
        ctx.moveTo(8, -55); ctx.lineTo(20, -78);
        ctx.moveTo(0, -54); ctx.lineTo(0, -86);
        ctx.moveTo(-5, -68); ctx.lineTo(-12, -80);
        ctx.moveTo(5, -68); ctx.lineTo(12, -80);
        ctx.stroke();
        // Fine branch tips
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-20, -78); ctx.lineTo(-26, -88);
        ctx.moveTo(-20, -78); ctx.lineTo(-15, -88);
        ctx.moveTo(20, -78); ctx.lineTo(26, -88);
        ctx.moveTo(20, -78); ctx.lineTo(15, -88);
        ctx.moveTo(0, -86); ctx.lineTo(-6, -95);
        ctx.moveTo(0, -86); ctx.lineTo(6, -95);
        ctx.stroke();

        // ── 4. Main cherry blossom foliage (mid layer) ──
        const midFoliage = [
            { x: -18, y: -80, r: 24, c1: '#ffb7c5', c2: '#ff80a0' },
            { x: 18, y: -78, r: 22, c1: '#ffb7c5', c2: '#ff80a0' },
            { x: -28, y: -66, r: 18, c1: '#ffb7c5', c2: '#ff8da9' },
            { x: 28, y: -64, r: 17, c1: '#ffb7c5', c2: '#ff8da9' },
            { x: 0, y: -75, r: 30, c1: '#ffccd8', c2: '#ff9ebb' },
            { x: -8, y: -92, r: 20, c1: '#ffdde8', c2: '#ffb7c5' },
            { x: 8, y: -90, r: 18, c1: '#ffdde8', c2: '#ffb7c5' },
        ];
        midFoliage.forEach(f => {
            const rg = ctx.createRadialGradient(f.x - f.r*0.28, f.y - f.r*0.28, 0, f.x, f.y, f.r);
            rg.addColorStop(0, f.c1);
            rg.addColorStop(1, f.c2);
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
        });

        // ── 5. Bright highlight foliage (front / lit by sun) ──
        const foreFoliage = [
            { x: -12, y: -90, r: 17, c1: '#ffffff', c2: '#ffe0ea' },
            { x: 12, y: -88, r: 16, c1: '#ffffff', c2: '#ffe0ea' },
            { x: 0, y: -100, r: 22, c1: '#ffffff', c2: '#ffd0e0' },
            { x: -6, y: -68, r: 13, c1: '#ffe8ee', c2: '#ffb7c5' },
            { x: 6, y: -68, r: 13, c1: '#ffe8ee', c2: '#ffb7c5' },
            { x: -22, y: -82, r: 10, c1: '#fff0f5', c2: '#ffccd8' },
            { x: 22, y: -80, r: 10, c1: '#fff0f5', c2: '#ffccd8' },
        ];
        foreFoliage.forEach(f => {
            const rg = ctx.createRadialGradient(f.x - f.r*0.35, f.y - f.r*0.35, 0, f.x, f.y, f.r);
            rg.addColorStop(0, f.c1);
            rg.addColorStop(1, f.c2);
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
        });

        // ── 6. Individual blossom detail clusters (5-petal flowers) ──
        const blossomCenters = [
            { x: -34, y: -64, r: 2.8 }, { x: -36, y: -68, r: 2.2 },
            { x: 33, y: -62, r: 3.0 }, { x: 35, y: -58, r: 2.0 },
            { x: -14, y: -97, r: 3.2 }, { x: 13, y: -95, r: 2.8 },
            { x: 0, y: -108, r: 3.5 }, { x: -4, y: -103, r: 2.4 },
            { x: 5, y: -100, r: 2.6 }, { x: -28, y: -88, r: 2.2 }, { x: 28, y: -86, r: 2.2 }
        ];
        ctx.fillStyle = '#fff5f8';
        ctx.strokeStyle = '#ffb7c5';
        ctx.lineWidth = 0.6;
        blossomCenters.forEach(d => {
            // Draw simple 5-petal shape
            for (let pi = 0; pi < 5; pi++) {
                const angle = (pi / 5) * Math.PI * 2 - Math.PI / 2;
                ctx.beginPath();
                ctx.ellipse(
                    d.x + Math.cos(angle) * d.r * 0.85,
                    d.y + Math.sin(angle) * d.r * 0.85,
                    d.r * 0.62, d.r * 0.48,
                    angle, 0, Math.PI * 2
                );
                ctx.fill();
                ctx.stroke();
            }
            // Yellow stamen center dot
            ctx.fillStyle = '#fde68a';
            ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.35, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff5f8';
        });

        ctx.restore();
    });
}

function updateSakura() {
    for (let i = 0; i < sakura.length; i++) {
        const s = sakura[i];
        s.x += s.vx;
        s.y += s.vy;
        s.angle += s.va;
        if (s.y > H + 20) {
            sakura[i] = makeSakura(false);
        }
    }
}

function drawSakura(ctx) {
    sakura.forEach(s => {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        
        // Single organic sakura petal shape (curved leaf)
        ctx.fillStyle = '#ffb7c5';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-s.size * 0.5, -s.size * 0.4, -s.size * 0.5, -s.size * 1.2, 0, -s.size);
        ctx.bezierCurveTo(s.size * 0.5, -s.size * 1.2, s.size * 0.5, -s.size * 0.4, 0, 0);
        ctx.closePath();
        ctx.fill();

        // Shaded dark pink center crease/vein
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = Math.max(0.4, 0.7 * s.size * 0.15);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -s.size * 0.85);
        ctx.stroke();

        ctx.restore();
    });
    ctx.globalAlpha = 1.0;
}

function drawSpeedLines(ctx, speed) {
    if (speed < 10) return;

    const intensity = Math.min((speed - 10) / 12, 1.0);
    const count = Math.floor(intensity * 38 + 6);
    const vpX = VP_X;
    const vpY = HORIZON_Y;

    ctx.save();

    // ── Radial perspective speed streaks converging at vanishing point ──
    for (let i = 0; i < count; i++) {
        // Spawn a random angle band (wide left-right, slightly up-down)
        const angle = (Math.random() - 0.5) * Math.PI * 0.92 + (Math.random() - 0.5) * 0.22;
        const startDist = Math.random() * 65 + 28; // gap near VP
        const lineLen = Math.random() * 200 + 60;
        const alpha = (Math.random() * 0.15 + 0.05) * intensity;
        const lw = Math.random() * 1.4 + 0.4;

        const sx = vpX + Math.cos(angle) * startDist;
        const sy = vpY + Math.sin(angle) * startDist;
        const ex = vpX + Math.cos(angle) * (startDist + lineLen);
        const ey = vpY + Math.sin(angle) * (startDist + lineLen);

        const lineG = ctx.createLinearGradient(sx, sy, ex, ey);
        lineG.addColorStop(0, `rgba(255, 255, 255, 0)`);
        lineG.addColorStop(0.35, `rgba(255, 255, 255, ${alpha})`);
        lineG.addColorStop(1, `rgba(200, 230, 255, 0)`);
        ctx.strokeStyle = lineG;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }

    // ── Edge vignette that deepens at high speed ──
    if (intensity > 0.25) {
        const vigG = ctx.createRadialGradient(vpX, vpY + 60, H * 0.18, vpX, vpY + 60, H * 0.75);
        vigG.addColorStop(0, 'rgba(0,0,0,0)');
        vigG.addColorStop(1, `rgba(0,0,0,${intensity * 0.38})`);
        ctx.fillStyle = vigG;
        ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
}
