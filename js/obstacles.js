// Obstacles: Heavy Shinkansen/Subway trains, Concrete barricades, and Plasma gates
let obstacles = [];

function drawSingleObstacle(ctx, o) {
    if (typeof project === 'undefined') return;
    const lx = LANE_X[o.lane];
    const fp = project(lx, 0, o.wz);
    const bp = project(lx, 0, o.wz + o.len);
    if (fp.y < HORIZON_Y) return;

    ctx.save();
    if (o.type === 'barrier') {
        drawBarrier(ctx, lx, o, fp, bp);
    } else if (o.type === 'highbar') {
        drawHighBar(ctx, lx, o, fp, bp);
    } else if (o.type === 'train') {
        drawTrain(ctx, lx, o, fp, bp);
    } else if (o.type === 'tunnel_gate') {
        drawTunnelGate(ctx, lx, o, fp, bp);
    }
    ctx.restore();
}

function drawBarrier(ctx, lx, o, fp, bp) {
    const hw = o.w * fp.s * 0.5;
    const bh = o.h * fp.s;
    const bx = fp.x - hw;
    const by = fp.y - bh;
    const bw = hw * 2;

    // 1. Shadow under barricade
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(fp.x, fp.y, hw, 5.5 * fp.s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Concrete anchor block bases
    ctx.fillStyle = '#4b5563'; // Concrete grey
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = Math.max(1, 1.8 * fp.s);
    ctx.fillRect(bx + bw * 0.08, fp.y - 8 * fp.s, 10 * fp.s, 8 * fp.s);
    ctx.strokeRect(bx + bw * 0.08, fp.y - 8 * fp.s, 10 * fp.s, 8 * fp.s);
    ctx.fillRect(bx + bw * 0.82, fp.y - 8 * fp.s, 10 * fp.s, 8 * fp.s);
    ctx.strokeRect(bx + bw * 0.82, fp.y - 8 * fp.s, 10 * fp.s, 8 * fp.s);

    // 3. Steel support legs
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = Math.max(2.0, 3.8 * fp.s);
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.13, fp.y - 8 * fp.s); ctx.lineTo(bx + bw * 0.13, by + bh * 0.5);
    ctx.moveTo(bx + bw * 0.87, fp.y - 8 * fp.s); ctx.lineTo(bx + bw * 0.87, by + bh * 0.5);
    ctx.stroke();

    // 4. Main striped hazard sign board
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(bx, by, bw, bh * 0.62);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh * 0.62);
    ctx.clip();
    
    // Diagonal warning stripes
    ctx.fillStyle = '#ea580c'; // Neon orange
    const stripeW = bw / 4.8;
    for (let s = -1; s < 6; s++) {
        ctx.beginPath();
        ctx.moveTo(bx + s * stripeW, by);
        ctx.lineTo(bx + s * stripeW + stripeW * 0.45, by);
        ctx.lineTo(bx + (s - 1) * stripeW + stripeW * 0.45, by + bh * 0.62);
        ctx.lineTo(bx + (s - 1) * stripeW, by + bh * 0.62);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    // Dark border outline
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, 2.0 * fp.s);
    ctx.strokeRect(bx, by, bw, bh * 0.62);

    // 5. Blinking hazard lanterns with glow halos
    const tick = typeof frame !== 'undefined' ? frame : 0;
    const blinkAlpha = 0.45 + Math.abs(Math.sin(tick * 0.12)) * 0.55;
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    const leftX = bx + 6 * fp.s;
    const rightX = bx + bw - 6 * fp.s;
    const lightY = by - 4 * fp.s;
    const flareSize = Math.max(5, 12 * fp.s);

    // Left flare
    const leftG = ctx.createRadialGradient(leftX, lightY, 0, leftX, lightY, flareSize);
    leftG.addColorStop(0, `rgba(239, 68, 68, ${blinkAlpha * 0.85})`);
    leftG.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = leftG;
    ctx.beginPath(); ctx.arc(leftX, lightY, flareSize, 0, Math.PI * 2); ctx.fill();

    // Right flare
    const rightG = ctx.createRadialGradient(rightX, lightY, 0, rightX, lightY, flareSize);
    rightG.addColorStop(0, `rgba(239, 68, 68, ${blinkAlpha * 0.85})`);
    rightG.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = rightG;
    ctx.beginPath(); ctx.arc(rightX, lightY, flareSize, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Bulb cores
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(leftX, lightY, Math.max(1.6, 3.8 * fp.s), 0, Math.PI * 2);
    ctx.arc(rightX, lightY, Math.max(1.6, 3.8 * fp.s), 0, Math.PI * 2);
    ctx.fill();
}

function drawHighBar(ctx, lx, o, fp, bp) {
    const hw = o.w * fp.s * 0.5;
    const bh = o.h * fp.s;
    const barY = fp.y - bh;
    const barH = Math.max(5.0, 10.0 * fp.s);
    const tick = typeof frame !== 'undefined' ? frame : 0;

    // Ground shadows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(fp.x - hw, fp.y, 8 * fp.s, 3.2 * fp.s, 0, 0, Math.PI * 2);
    ctx.ellipse(fp.x + hw, fp.y, 8 * fp.s, 3.2 * fp.s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pillars with diagonal structural steel
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, 2.0 * fp.s);
    
    // Left post
    ctx.fillRect(fp.x - hw, barY, Math.max(3.5, 6.2 * fp.s), bh);
    ctx.strokeRect(fp.x - hw, barY, Math.max(3.5, 6.2 * fp.s), bh);
    // Right post
    ctx.fillRect(fp.x + hw - Math.max(3.5, 6.2 * fp.s), barY, Math.max(3.5, 6.2 * fp.s), bh);
    ctx.strokeRect(fp.x + hw - Math.max(3.5, 6.2 * fp.s), barY, Math.max(3.5, 6.2 * fp.s), bh);

    // Danger sign logo block on top of posts
    const signH = 14 * fp.s;
    const signW = 18 * fp.s;
    if (fp.s > 0.15) {
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(fp.x - hw - signW * 0.3, barY - signH, signW, signH);
        ctx.strokeRect(fp.x - hw - signW * 0.3, barY - signH, signW, signH);
        ctx.fillRect(fp.x + hw - signW * 0.7, barY - signH, signW, signH);
        ctx.strokeRect(fp.x + hw - signW * 0.7, barY - signH, signW, signH);
    }

    // ── PULSING HIGH-DENSITY COLD-LASER BEAM ──
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    // Bloom
    const pulseScale = 0.85 + Math.abs(Math.sin(tick * 0.16)) * 0.3;
    const glowH = barH * 2.8 * pulseScale;
    ctx.fillStyle = 'rgba(168, 85, 247, 0.32)'; // glowing violet
    ctx.fillRect(fp.x - hw, barY - glowH * 0.5, hw * 2, glowH);

    // Laser core gradient
    const beamG = ctx.createLinearGradient(fp.x - hw, barY, fp.x + hw, barY);
    beamG.addColorStop(0, '#c084fc');
    beamG.addColorStop(0.5, '#ffffff'); // super-hot white core focus
    beamG.addColorStop(1, '#c084fc');
    ctx.fillStyle = beamG;
    ctx.fillRect(fp.x - hw, barY - barH * 0.5 * pulseScale, hw * 2, barH * pulseScale);
    ctx.restore();

    // Laser outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(1, 1.8 * fp.s);
    ctx.beginPath();
    ctx.moveTo(fp.x - hw, barY);
    ctx.lineTo(fp.x + hw, barY);
    ctx.stroke();

    // Laser contact point sparks
    if (Math.random() < 0.35 && typeof particles !== 'undefined') {
        [-hw, hw].forEach(xOff => {
            particles.push({
                x: fp.x + xOff,
                y: barY,
                vx: (xOff < 0 ? 1 : -1) * (Math.random() * 4 + 1),
                vy: Math.random() * 4 - 2,
                life: 14,
                maxL: 14,
                col: '#c084fc',
                size: Math.random() * 2.2 + 1
            });
        });
    }
}

function drawTrain(ctx, lx, o, fp, bp) {
    const hw = fp.s * o.w * 0.5;
    const bphw = bp.s * o.w * 0.5;
    const fh = o.h * fp.s;
    const bh = o.h * bp.s;
    const tick = typeof frame !== 'undefined' ? frame : 0;

    // Ink outline styling config (Anime/Manga cell border look)
    const strokeStyle = '#0a0918';
    const strokeWidth = Math.max(1.0, 1.8 * fp.s);

    if (o.climbable) {
        // ── CLIMBABLE TRAIN (Heavy-Duty Industrial Safety Hazard Wagon) ──
        // 1. Projection points for the 3D ramp and body layout
        const rampTopZ = o.wz + 65;
        const fbl = project(lx - o.w * 0.5, 0, o.wz);
        const fbr = project(lx + o.w * 0.5, 0, o.wz);
        const rtl = project(lx - o.w * 0.5, o.h, rampTopZ);
        const rtr = project(lx + o.w * 0.5, o.h, rampTopZ);
        const rbl = project(lx - o.w * 0.5, 0, rampTopZ);
        const rbr = project(lx + o.w * 0.5, 0, rampTopZ);

        const btl = project(lx - o.w * 0.5, o.h, o.wz + o.len);
        const btr = project(lx + o.w * 0.5, o.h, o.wz + o.len);
        const bbl = project(lx - o.w * 0.5, 0, o.wz + o.len);
        const bbr = project(lx + o.w * 0.5, 0, o.wz + o.len);

        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 2. Main Train Body Side Panels (Industrial Charcoal with Rivets)
        const leftSideG = ctx.createLinearGradient(rtl.x, rtl.y, rbl.x, rbl.y);
        leftSideG.addColorStop(0, '#2d3748'); // steel gray
        leftSideG.addColorStop(0.5, '#1a202c'); // dark iron
        leftSideG.addColorStop(1, '#0f172a'); // shadowed base
        ctx.fillStyle = leftSideG;
        ctx.beginPath();
        ctx.moveTo(rtl.x, rtl.y);
        ctx.lineTo(btl.x, btl.y);
        ctx.lineTo(bbl.x, bbl.y);
        ctx.lineTo(rbl.x, rbl.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const rightSideG = ctx.createLinearGradient(rtr.x, rtr.y, rbr.x, rbr.y);
        rightSideG.addColorStop(0, '#2d3748');
        rightSideG.addColorStop(0.5, '#1a202c');
        rightSideG.addColorStop(1, '#0f172a');
        ctx.fillStyle = rightSideG;
        ctx.beginPath();
        ctx.moveTo(rtr.x, rtr.y);
        ctx.lineTo(btr.x, btr.y);
        ctx.lineTo(bbr.x, bbr.y);
        ctx.lineTo(rbr.x, rbr.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw side panel rivets/bolts for mechanical realism
        if (fp.s > 0.14) {
            ctx.fillStyle = '#0f172a';
            const rivetsCount = 8;
            for (let k = 0; k <= rivetsCount; k++) {
                const ratio = k / rivetsCount;
                // Left Panel Rivets (Top and Bottom edges)
                const lTopX = rtl.x + (btl.x - rtl.x) * ratio;
                const lTopY = rtl.y + (btl.y - rtl.y) * ratio;
                const lBotX = rbl.x + (bbl.x - rbl.x) * ratio;
                const lBotY = rbl.y + (bbl.y - rbl.y) * ratio;

                const scaleS = rtl.s + (btl.s - rtl.s) * ratio;
                const rRadius = 1.6 * scaleS;

                ctx.beginPath(); ctx.arc(lTopX, lTopY + 2 * scaleS, rRadius, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(lBotX, lBotY - 2 * scaleS, rRadius, 0, Math.PI * 2); ctx.fill();

                // Highlight dot on rivet
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath(); ctx.arc(lTopX - 0.5 * scaleS, lTopY + 1.5 * scaleS, 0.5 * scaleS, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(lBotX - 0.5 * scaleS, lBotY - 2.5 * scaleS, 0.5 * scaleS, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#0f172a'; // restore rivet base fill

                // Right Panel Rivets
                const rTopX = rtr.x + (btr.x - rtr.x) * ratio;
                const rTopY = rtr.y + (btr.y - rtr.y) * ratio;
                const rBotX = rbr.x + (bbr.x - rbr.x) * ratio;
                const rBotY = rbr.y + (bbr.y - rbr.y) * ratio;

                ctx.beginPath(); ctx.arc(rTopX, rTopY + 2 * scaleS, rRadius, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(rBotX, rBotY - 2 * scaleS, rRadius, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath(); ctx.arc(rTopX - 0.5 * scaleS, rTopY + 1.5 * scaleS, 0.5 * scaleS, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(rBotX - 0.5 * scaleS, rBotY - 2.5 * scaleS, 0.5 * scaleS, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#0f172a';
            }
        }

        // 3. Draw Main Train Body Roof (charcoal grey with silver highlights)
        const roofG = ctx.createLinearGradient(rtl.x, rtl.y, rtr.x, rtr.y);
        roofG.addColorStop(0, '#1e293b');
        roofG.addColorStop(0.3, '#334155');
        roofG.addColorStop(0.5, '#475569'); // bright gloss sheen line
        roofG.addColorStop(0.7, '#1e293b');
        roofG.addColorStop(1, '#0f172a');
        ctx.fillStyle = roofG;
        ctx.beginPath();
        ctx.moveTo(rtl.x, rtl.y);
        ctx.lineTo(btl.x, btl.y);
        ctx.lineTo(btr.x, btr.y);
        ctx.lineTo(rtr.x, rtr.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw metal plates tread lines along the roof
        if (fp.s > 0.12) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1.0;
            const roofStepZ = 25;
            for (let rz = rampTopZ + 15; rz < o.wz + o.len; rz += roofStepZ) {
                const rl = project(lx - o.w * 0.44, o.h, rz);
                const rr = project(lx + o.w * 0.44, o.h, rz);
                if (rl.y >= HORIZON_Y && rr.y >= HORIZON_Y) {
                    ctx.beginPath();
                    ctx.moveTo(rl.x, rl.y);
                    ctx.lineTo(rr.x, rr.y);
                    ctx.stroke();
                }
            }
        }

        // 4. Draw Ramp Sides
        ctx.fillStyle = leftSideG;
        ctx.beginPath();
        ctx.moveTo(fbl.x, fbl.y);
        ctx.lineTo(rtl.x, rtl.y);
        ctx.lineTo(rbl.x, rbl.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = rightSideG;
        ctx.beginPath();
        ctx.moveTo(fbr.x, fbr.y);
        ctx.lineTo(rtr.x, rtr.y);
        ctx.lineTo(rbr.x, rbr.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw side panels details and Japanese danger stencil
        if (fp.s > 0.16) {
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo((fbl.x + rbl.x) * 0.5, (fbl.y + rbl.y) * 0.5);
            ctx.lineTo((rtl.x + rbl.x) * 0.5, (rtl.y + rbl.y) * 0.5);
            ctx.stroke();

            // Stenciled "SAFETY FIRST / 立入禁止" text
            if (fp.s > 0.22) {
                ctx.save();
                ctx.fillStyle = '#eab308';
                ctx.font = `bold ${Math.floor(7 * fp.s)}px monospace`;
                ctx.fillText('立入禁止 [DANGER]', (fbl.x + rtl.x) * 0.5 - 24 * fp.s, (fbl.y + rtl.y) * 0.5);
                ctx.restore();
            }
        }

        // 5. Draw Sloped Ramp Deck (caution amber base with metal sheen)
        const deckG = ctx.createLinearGradient(fbl.x, fbl.y, rtl.x, rtl.y);
        deckG.addColorStop(0, '#b45309'); // dark amber shadow
        deckG.addColorStop(0.5, '#f59e0b'); // vibrant core amber
        deckG.addColorStop(1, '#d97706');
        ctx.fillStyle = deckG;
        ctx.beginPath();
        ctx.moveTo(fbl.x, fbl.y);
        ctx.lineTo(fbr.x, fbr.y);
        ctx.lineTo(rtr.x, rtr.y);
        ctx.lineTo(rtl.x, rtl.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 6. Clip and Draw diagonal warning stripes & steel plating lines on Ramp Deck
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(fbl.x, fbl.y);
        ctx.lineTo(fbr.x, fbr.y);
        ctx.lineTo(rtr.x, rtr.y);
        ctx.lineTo(rtl.x, rtl.y);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = '#090514'; // high contrast black
        const stripeStep = 10;
        for (let sz = o.wz - 20; sz < o.wz + 85; sz += stripeStep) {
            const pctL = Math.max(0, Math.min(1, (sz - 8 - o.wz) / 65));
            const pctR = Math.max(0, Math.min(1, (sz + 8 - o.wz) / 65));
            
            const sL = project(lx - o.w * 0.55, o.h * pctL, o.wz + 65 * pctL);
            const sR = project(lx + o.w * 0.55, o.h * pctR, o.wz + 65 * pctR);
            
            const pctLNext = Math.max(0, Math.min(1, (sz - 8 + 5 - o.wz) / 65));
            const pctRNext = Math.max(0, Math.min(1, (sz + 8 + 5 - o.wz) / 65));
            const sLNext = project(lx - o.w * 0.55, o.h * pctLNext, o.wz + 65 * pctLNext);
            const sRNext = project(lx + o.w * 0.55, o.h * pctRNext, o.wz + 65 * pctRNext);

            ctx.beginPath();
            ctx.moveTo(sL.x, sL.y);
            ctx.lineTo(sR.x, sR.y);
            ctx.lineTo(sRNext.x, sRNext.y);
            ctx.lineTo(sLNext.x, sLNext.y);
            ctx.closePath();
            ctx.fill();
        }

        // Draw steel plate grid lines on top of the ramp for realistic friction texture
        if (fp.s > 0.16) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 1.0;
            for (let sz = o.wz; sz < o.wz + 65; sz += 12) {
                const ratio = (sz - o.wz) / 65;
                const plL = project(lx - o.w * 0.5, o.h * ratio, sz);
                const plR = project(lx + o.w * 0.5, o.h * ratio, sz);
                ctx.beginPath();
                ctx.moveTo(plL.x, plL.y);
                ctx.lineTo(plR.x, plR.y);
                ctx.stroke();
            }
        }
        ctx.restore();

        // 7. Rotating Siren beacons that cast dynamic light sweeps
        const blinkAlpha = 0.45 + Math.abs(Math.sin(tick * 0.15)) * 0.55;
        const leftLight = { x: rtl.x, y: rtl.y };
        const rightLight = { x: rtr.x, y: rtr.y };

        // Siren bases
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(leftLight.x - 5 * fp.s, leftLight.y, 10 * fp.s, 4 * fp.s);
        ctx.fillRect(rightLight.x - 5 * fp.s, rightLight.y, 10 * fp.s, 4 * fp.s);

        // Siren glass domes (Vibrant Warning Orange)
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(leftLight.x, leftLight.y - 2 * fp.s, 3.8 * fp.s, 5.5 * fp.s, 0, Math.PI, 0);
        ctx.ellipse(rightLight.x, rightLight.y - 2 * fp.s, 3.8 * fp.s, 5.5 * fp.s, 0, Math.PI, 0);
        ctx.fill();
        ctx.stroke();

        // Volumetric Rotating Light Beams!
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // Left Siren Light Beam (Sweeps left-right)
        const leftSweep = Math.sin(tick * 0.08) * 45 * fp.s;
        const beamH = 140 * fp.s;
        const beamW = 35 * fp.s;

        const leftBeamG = ctx.createLinearGradient(leftLight.x, leftLight.y - 2.5 * fp.s, leftLight.x + leftSweep, leftLight.y + beamH);
        leftBeamG.addColorStop(0, `rgba(249, 115, 22, ${blinkAlpha * 0.55})`);
        leftBeamG.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = leftBeamG;
        ctx.beginPath();
        ctx.moveTo(leftLight.x, leftLight.y - 2.5 * fp.s);
        ctx.lineTo(leftLight.x + leftSweep - beamW, leftLight.y + beamH);
        ctx.lineTo(leftLight.x + leftSweep + beamW, leftLight.y + beamH);
        ctx.closePath();
        ctx.fill();

        // Right Siren Light Beam (Sweeps opposite phase)
        const rightSweep = Math.sin(tick * 0.08 + Math.PI) * 45 * fp.s;
        const rightBeamG = ctx.createLinearGradient(rightLight.x, rightLight.y - 2.5 * fp.s, rightLight.x + rightSweep, rightLight.y + beamH);
        rightBeamG.addColorStop(0, `rgba(249, 115, 22, ${blinkAlpha * 0.55})`);
        rightBeamG.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = rightBeamG;
        ctx.beginPath();
        ctx.moveTo(rightLight.x, rightLight.y - 2.5 * fp.s);
        ctx.lineTo(rightLight.x + rightSweep - beamW, rightLight.y + beamH);
        ctx.lineTo(rightLight.x + rightSweep + beamW, rightLight.y + beamH);
        ctx.closePath();
        ctx.fill();

        // Glowing halos around sirens
        const flareSize = Math.max(8, 16 * fp.s);
        const glowL = ctx.createRadialGradient(leftLight.x, leftLight.y - 2.5 * fp.s, 0, leftLight.x, leftLight.y - 2.5 * fp.s, flareSize);
        glowL.addColorStop(0, `rgba(249, 115, 22, ${blinkAlpha})`);
        glowL.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = glowL;
        ctx.beginPath(); ctx.arc(leftLight.x, leftLight.y - 2.5 * fp.s, flareSize, 0, Math.PI * 2); ctx.fill();

        const glowR = ctx.createRadialGradient(rightLight.x, rightLight.y - 2.5 * fp.s, 0, rightLight.x, rightLight.y - 2.5 * fp.s, flareSize);
        glowR.addColorStop(0, `rgba(249, 115, 22, ${blinkAlpha})`);
        glowR.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = glowR;
        ctx.beginPath(); ctx.arc(rightLight.x, rightLight.y - 2.5 * fp.s, flareSize, 0, Math.PI * 2); ctx.fill();
        
        ctx.restore();

        // Siren inner light core bulb (White-Hot)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(leftLight.x, leftLight.y - 2.5 * fp.s, Math.max(1.8, 3.2 * fp.s), 0, Math.PI * 2);
        ctx.arc(rightLight.x, rightLight.y - 2.5 * fp.s, Math.max(1.8, 3.2 * fp.s), 0, Math.PI * 2);
        ctx.fill();

        // Heavy Cowcatcher fender mesh at bottom
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.5, 2.5 * fp.s);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(fbl.x, fbl.y);
        ctx.lineTo(fbl.x + 4 * fp.s, fbl.y + 11 * fp.s);
        ctx.lineTo(fbr.x - 4 * fp.s, fbr.y + 11 * fp.s);
        ctx.lineTo(fbr.x, fbr.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Heavy steel grill slats on fender
        if (fp.s > 0.16) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let fx = fbl.x + 8 * fp.s; fx < fbr.x - 8 * fp.s; fx += 6 * fp.s) {
                ctx.moveTo(fx, fbl.y);
                ctx.lineTo(fx + 2 * fp.s, fbl.y + 11 * fp.s);
            }
            ctx.stroke();
        }
    } else {
        // ── STANDARD NON-CLIMBABLE BULLET TRAIN (Cyber-Shinkansen) ──
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Glossy White/Silver Roof Panel (Volumetric shading)
        const roofG = ctx.createLinearGradient(fp.x - hw, fp.y - fh, fp.x + hw, fp.y - fh);
        roofG.addColorStop(0, '#e2e8f0'); // silver left shadow
        roofG.addColorStop(0.35, '#f8fafc'); // bright white sheen
        roofG.addColorStop(0.5, '#ffffff'); // pure glare
        roofG.addColorStop(0.75, '#f1f5f9');
        roofG.addColorStop(1, '#cbd5e1'); // silver right shadow
        
        ctx.fillStyle = roofG;
        ctx.beginPath();
        ctx.moveTo(fp.x - hw, fp.y - fh);
        ctx.lineTo(bp.x - bphw, bp.y - bh);
        ctx.lineTo(bp.x + bphw, bp.y - bh);
        ctx.lineTo(fp.x + hw, fp.y - fh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 2. White/Silver Side Panels with Cyber-Cyan Racing Stripes
        const sideLeftG = ctx.createLinearGradient(fp.x - hw, fp.y - fh, fp.x - hw, fp.y);
        sideLeftG.addColorStop(0, '#cbd5e1');
        sideLeftG.addColorStop(1, '#94a3b8');
        ctx.fillStyle = sideLeftG;
        ctx.beginPath();
        ctx.moveTo(fp.x - hw, fp.y - fh);
        ctx.lineTo(bp.x - bphw, bp.y - bh);
        ctx.lineTo(bp.x - bphw, bp.y);
        ctx.lineTo(fp.x - hw, fp.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const sideRightG = ctx.createLinearGradient(fp.x + hw, fp.y - fh, fp.x + hw, fp.y);
        sideRightG.addColorStop(0, '#cbd5e1');
        sideRightG.addColorStop(1, '#94a3b8');
        ctx.fillStyle = sideRightG;
        ctx.beginPath();
        ctx.moveTo(fp.x + hw, fp.y - fh);
        ctx.lineTo(bp.x + bphw, bp.y - bh);
        ctx.lineTo(bp.x + bphw, bp.y);
        ctx.lineTo(fp.x + hw, fp.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw glowing neon-cyan stripe along sides
        const drawNeonSideStripe = (sideLeft) => {
            const sideHOffset = o.h * 0.28;
            const leftOffset = sideLeft ? -o.w * 0.5 : o.w * 0.5;

            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            const fS = project(lx + leftOffset, sideHOffset, o.wz);
            const bS = project(lx + leftOffset, sideHOffset, o.wz + o.len);
            const fST = project(lx + leftOffset, sideHOffset + 8, o.wz);
            const bST = project(lx + leftOffset, sideHOffset + 8, o.wz + o.len);
            
            ctx.moveTo(fS.x, fS.y);
            ctx.lineTo(bS.x, bS.y);
            ctx.lineTo(bST.x, bST.y);
            ctx.lineTo(fST.x, fST.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };
        drawNeonSideStripe(true);
        drawNeonSideStripe(false);

        // 3. Warm backlit windows showing detailed Tokyo commuter silhouettes
        const numWindows = 6;
        for (let i = 0; i < numWindows; i++) {
            const fZ = o.wz + (i / numWindows) * o.len;
            const bZ = o.wz + ((i + 0.65) / numWindows) * o.len;

            const drawWindowSide = (isLeft) => {
                const sideOffset = isLeft ? -o.w * 0.5 : o.w * 0.5;
                const pStart = project(lx + sideOffset, o.h * 0.42, fZ);
                const pEnd = project(lx + sideOffset, o.h * 0.42, bZ);
                const pTopStart = project(lx + sideOffset, o.h * 0.66, fZ);
                const pTopEnd = project(lx + sideOffset, o.h * 0.66, bZ);

                if (pStart.y >= HORIZON_Y && pEnd.y >= HORIZON_Y) {
                    const winG = ctx.createLinearGradient(pStart.x, pStart.y, pTopStart.x, pTopStart.y);
                    winG.addColorStop(0, '#fef08a'); // Warm golden amber base
                    winG.addColorStop(1, '#f97316'); // Shaded orange top
                    ctx.fillStyle = winG;

                    ctx.beginPath();
                    ctx.moveTo(pStart.x, pStart.y);
                    ctx.lineTo(pEnd.x, pEnd.y);
                    ctx.lineTo(pTopEnd.x, pTopEnd.y);
                    ctx.lineTo(pTopStart.x, pTopStart.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Render stylized passenger silhouettes inside window frame
                    if (pStart.s > 0.12) {
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Dark silhouette
                        const midX = (pStart.x + pEnd.x) * 0.5;
                        const midY = (pStart.y + pTopStart.y) * 0.5 + 2 * pStart.s;

                        // Draw passenger head
                        ctx.beginPath();
                        ctx.arc(midX, midY, 2.8 * pStart.s, 0, Math.PI * 2);
                        ctx.fill();

                        // Draw shoulders
                        ctx.beginPath();
                        ctx.ellipse(midX, midY + 4 * pStart.s, 4.2 * pStart.s, 2.5 * pStart.s, 0, 0, Math.PI, true);
                        ctx.fill();

                        // Anime phone-glow details (tiny glowing cyan screen dots)
                        if (i % 2 === 0) {
                            ctx.fillStyle = '#00f0ff';
                            const phoneX = midX + (isLeft ? 2.5 : -2.5) * pStart.s;
                            const phoneY = midY + 2.0 * pStart.s;
                            ctx.beginPath();
                            ctx.arc(phoneX, phoneY, 0.8 * pStart.s, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.save();
                            ctx.globalCompositeOperation = 'screen';
                            const glow = ctx.createRadialGradient(phoneX, phoneY, 0, phoneX, phoneY, 4 * pStart.s);
                            glow.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
                            glow.addColorStop(1, 'rgba(0, 240, 255, 0)');
                            ctx.fillStyle = glow;
                            ctx.beginPath(); ctx.arc(phoneX, phoneY, 4 * pStart.s, 0, Math.PI * 2); ctx.fill();
                            ctx.restore();
                        }
                    }
                }
            };
            drawWindowSide(true);
            drawWindowSide(false);
        }

        // 4. Overhead Catenary Power Pantograph with Electric Sparks
        if (fp.s > 0.15) {
            const pantographY = o.h + 2;
            const pBase = project(lx, pantographY, o.wz + 30);
            const pMid = project(lx, pantographY + 22, o.wz + 45);
            const pTop = project(lx, pantographY + 28, o.wz + 50);

            ctx.strokeStyle = '#475569';
            ctx.lineWidth = Math.max(1, 1.8 * fp.s);
            ctx.beginPath();
            ctx.moveTo(pBase.x - 12 * fp.s, pBase.y);
            ctx.lineTo(pMid.x, pMid.y);
            ctx.lineTo(pTop.x - 9 * fp.s, pTop.y);
            ctx.lineTo(pTop.x + 9 * fp.s, pTop.y);
            ctx.moveTo(pBase.x + 12 * fp.s, pBase.y);
            ctx.lineTo(pMid.x, pMid.y);
            ctx.stroke();

            // Contact plate lineart
            ctx.strokeStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(pTop.x - 12 * fp.s, pTop.y);
            ctx.lineTo(pTop.x + 12 * fp.s, pTop.y);
            ctx.stroke();

            // Cyan electrical friction sparking particles!
            if (tick % 6 < 3) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 1.2 * fp.s;
                ctx.beginPath();
                // Star shape sparks
                const sparkSize = 4 * fp.s;
                ctx.moveTo(pTop.x - sparkSize, pTop.y);
                ctx.lineTo(pTop.x + sparkSize, pTop.y);
                ctx.moveTo(pTop.x, pTop.y - sparkSize);
                ctx.lineTo(pTop.x, pTop.y + sparkSize);
                ctx.stroke();
                
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(pTop.x, pTop.y, 1.5 * fp.s, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // 5. Stylized Aerodynamic Contoured Shinkansen Front Nose Plate
        const topL = { x: fp.x - hw * 0.84, y: fp.y - fh };
        const topR = { x: fp.x + hw * 0.84, y: fp.y - fh };
        const midR = { x: fp.x + hw * 0.98, y: fp.y - fh * 0.32 };
        const botR = { x: fp.x + hw * 0.78, y: fp.y };
        const botL = { x: fp.x - hw * 0.78, y: fp.y };
        const midL = { x: fp.x - hw * 0.98, y: fp.y - fh * 0.32 };

        // Volumetric Shinkansen Nose Gradient (Glossy lacquered paint)
        const noseG = ctx.createLinearGradient(midL.x, fp.y, midR.x, fp.y);
        noseG.addColorStop(0, '#cbd5e1'); // soft left shadow
        noseG.addColorStop(0.35, '#f8fafc'); // bright white center-left
        noseG.addColorStop(0.5, '#ffffff'); // glare line
        noseG.addColorStop(0.75, '#f1f5f9');
        noseG.addColorStop(1, '#94a3b8'); // right shade

        ctx.fillStyle = noseG;
        ctx.beginPath();
        ctx.moveTo(topL.x, topL.y);
        ctx.lineTo(topR.x, topR.y);
        ctx.bezierCurveTo(topR.x + 6 * fp.s, topR.y + 15 * fp.s, midR.x, midR.y - 10 * fp.s, midR.x, midR.y);
        ctx.bezierCurveTo(midR.x, midR.y + 15 * fp.s, botR.x + 4 * fp.s, botR.y, botR.x, botR.y);
        ctx.lineTo(botL.x, botL.y);
        ctx.bezierCurveTo(botL.x - 4 * fp.s, botL.y, midL.x, midL.y + 15 * fp.s, midL.x, midL.y);
        ctx.bezierCurveTo(midL.x, midL.y - 10 * fp.s, topL.x - 6 * fp.s, topL.y + 15 * fp.s, topL.x, topL.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cyber-Cyan curved accent wrap-around stripe on the nose
        if (fp.s > 0.16) {
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.moveTo(fp.x - hw * 0.88, fp.y - fh * 0.28);
            ctx.lineTo(fp.x + hw * 0.88, fp.y - fh * 0.28);
            ctx.lineTo(fp.x + hw * 0.82, fp.y - fh * 0.20);
            ctx.lineTo(fp.x - hw * 0.82, fp.y - fh * 0.20);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Circular Nose Coupler Hatch cover detail (classic anime robot detail)
            ctx.strokeStyle = '#475569';
            ctx.fillStyle = '#cbd5e1';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(fp.x, fp.y - fh * 0.12, 6 * fp.s, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Hatch core panel line
            ctx.beginPath();
            ctx.moveTo(fp.x - 6 * fp.s, fp.y - fh * 0.12);
            ctx.lineTo(fp.x + 6 * fp.s, fp.y - fh * 0.12);
            ctx.stroke();
        }

        // Aerodynamic Glass Windshield (Cockpit window)
        const winTL = { x: fp.x - hw * 0.65, y: fp.y - fh * 0.76 };
        const winTR = { x: fp.x + hw * 0.65, y: fp.y - fh * 0.76 };
        const winBR = { x: fp.x + hw * 0.75, y: fp.y - fh * 0.44 };
        const winBL = { x: fp.x - hw * 0.75, y: fp.y - fh * 0.44 };

        const winG = ctx.createLinearGradient(0, winTL.y, 0, winBR.y);
        winG.addColorStop(0, '#0c4a6e'); // deep sky-blue glass
        winG.addColorStop(1, '#020617'); // dark space core
        ctx.fillStyle = winG;

        ctx.beginPath();
        ctx.moveTo(winTL.x, winTL.y);
        ctx.lineTo(winTR.x, winTR.y);
        ctx.lineTo(winBR.x, winBR.y);
        ctx.lineTo(winBL.x, winBL.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inside Cockpit dashboard silhouette details
        if (fp.s > 0.14) {
            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.moveTo(winBL.x + 3 * fp.s, winBL.y);
            ctx.lineTo(winBR.x - 3 * fp.s, winBR.y);
            ctx.lineTo(winBR.x - 6 * fp.s, winBR.y - 5 * fp.s);
            ctx.lineTo(winBL.x + 6 * fp.s, winBL.y - 5 * fp.s);
            ctx.closePath();
            ctx.fill();

            // Cockpit console lights (glowing green/red dots)
            ctx.fillStyle = '#22c55e'; // Green console light
            ctx.beginPath(); ctx.arc(fp.x - 5 * fp.s, winBL.y - 2.5 * fp.s, 1 * fp.s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ef4444'; // Red alarm bulb
            ctx.beginPath(); ctx.arc(fp.x + 5 * fp.s, winBL.y - 2.5 * fp.s, 1 * fp.s, 0, Math.PI * 2); ctx.fill();
        }

        // Windshield specular glare lines (Glossy reflection sheets)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(winTL.x + 8 * fp.s, winTL.y + 2 * fp.s);
        ctx.lineTo(winTL.x + 18 * fp.s, winTL.y + 2 * fp.s);
        ctx.lineTo(winBL.x + 30 * fp.s, winBL.y - 2 * fp.s);
        ctx.lineTo(winBL.x + 20 * fp.s, winBL.y - 2 * fp.s);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(winTL.x + 24 * fp.s, winTL.y + 2 * fp.s);
        ctx.lineTo(winTL.x + 30 * fp.s, winTL.y + 2 * fp.s);
        ctx.lineTo(winBL.x + 42 * fp.s, winBL.y - 2 * fp.s);
        ctx.lineTo(winBL.x + 36 * fp.s, winBL.y - 2 * fp.s);
        ctx.closePath();
        ctx.fill();

        // Destination Display LED sign: "新宿 / SHINJUKU"
        if (fp.s > 0.16) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(fp.x - hw * 0.32, fp.y - fh * 0.94, hw * 0.64, fh * 0.08);
            ctx.strokeStyle = '#334155';
            ctx.strokeRect(fp.x - hw * 0.32, fp.y - fh * 0.94, hw * 0.64, fh * 0.08);
            
            ctx.fillStyle = '#00f0ff';
            ctx.font = `bold ${Math.max(6, Math.floor(9 * fp.s))}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('新宿 [SHINJUKU]', fp.x, fp.y - fh * 0.90);
        }

        // 6. Futuristic Angled Slit LED Headlights & volumetric shafts
        const hlY = fp.y - fh * 0.24;
        const hlH = 6.5 * fp.s;
        const hlW = hw * 0.44;

        // Perfectly symmetric left/right headlights
        const leftHlX = fp.x - hw * 0.8;
        const rightHlX = fp.x + hw * 0.8 - hlW;

        // Angled housing slots
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#090514';
        
        ctx.beginPath();
        ctx.moveTo(leftHlX, hlY);
        ctx.lineTo(leftHlX + hlW, hlY - 2.5 * fp.s);
        ctx.lineTo(leftHlX + hlW, hlY - 2.5 * fp.s + hlH);
        ctx.lineTo(leftHlX, hlY + hlH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightHlX, hlY - 2.5 * fp.s);
        ctx.lineTo(rightHlX + hlW, hlY);
        ctx.lineTo(rightHlX + hlW, hlY + hlH);
        ctx.lineTo(rightHlX, hlY - 2.5 * fp.s + hlH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // White glowing light slit inserts
        ctx.fillStyle = '#fef08a'; // Neon glow base yellow
        ctx.beginPath();
        ctx.moveTo(leftHlX + 2 * fp.s, hlY + 1 * fp.s);
        ctx.lineTo(leftHlX + hlW - 2 * fp.s, hlY - 2 * fp.s + 1 * fp.s);
        ctx.lineTo(leftHlX + hlW - 2 * fp.s, hlY - 2 * fp.s + hlH - 1 * fp.s);
        ctx.lineTo(leftHlX + 2 * fp.s, hlY + hlH - 1 * fp.s);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(rightHlX + 2 * fp.s, hlY - 2 * fp.s + 1 * fp.s);
        ctx.lineTo(rightHlX + hlW - 2 * fp.s, hlY + 1 * fp.s);
        ctx.lineTo(rightHlX + hlW - 2 * fp.s, hlY + hlH - 1 * fp.s);
        ctx.lineTo(rightHlX + 2 * fp.s, hlY - 2 * fp.s + hlH - 1 * fp.s);
        ctx.closePath();
        ctx.fill();

        // Draw projected headlight spotlights (shafts)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const leftHeadX = leftHlX + hlW * 0.5;
        const rightHeadX = rightHlX + hlW * 0.5;
        const headlightY = hlY + hlH * 0.5;
        const flareR = Math.max(10, 26 * fp.s);

        // Radial glow overlays
        const lG = ctx.createRadialGradient(leftHeadX, headlightY, 0, leftHeadX, headlightY, flareR);
        lG.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
        lG.addColorStop(0.3, 'rgba(254, 240, 138, 0.25)');
        lG.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lG;
        ctx.beginPath(); ctx.arc(leftHeadX, headlightY, flareR, 0, Math.PI * 2); ctx.fill();

        const rG = ctx.createRadialGradient(rightHeadX, headlightY, 0, rightHeadX, headlightY, flareR);
        rG.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
        rG.addColorStop(0.3, 'rgba(254, 240, 138, 0.25)');
        rG.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rG;
        ctx.beginPath(); ctx.arc(rightHeadX, headlightY, flareR, 0, Math.PI * 2); ctx.fill();

        // Project atmospheric light cone onto standard railway track (fades with distance Z)
        const shaftL = 150 * fp.s;
        const shaftW = 24 * fp.s;
        const distanceFade = Math.max(0, Math.min(1.0, 1.0 - o.wz / 1200));

        if (distanceFade > 0.05) {
            const lShaftG = ctx.createLinearGradient(leftHeadX, headlightY, leftHeadX - shaftW, headlightY + shaftL);
            lShaftG.addColorStop(0, `rgba(254, 240, 138, ${0.45 * distanceFade})`);
            lShaftG.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = lShaftG;
            ctx.beginPath();
            ctx.moveTo(leftHeadX - 2 * fp.s, headlightY);
            ctx.lineTo(leftHeadX - shaftW - 12 * fp.s, headlightY + shaftL);
            ctx.lineTo(leftHeadX + shaftW + 12 * fp.s, headlightY + shaftL);
            ctx.lineTo(leftHeadX + 2 * fp.s, headlightY);
            ctx.closePath();
            ctx.fill();

            const rShaftG = ctx.createLinearGradient(rightHeadX, headlightY, rightHeadX + shaftW, headlightY + shaftL);
            rShaftG.addColorStop(0, `rgba(254, 240, 138, ${0.45 * distanceFade})`);
            rShaftG.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = rShaftG;
            ctx.beginPath();
            ctx.moveTo(rightHeadX - 2 * fp.s, headlightY);
            ctx.lineTo(rightHeadX - shaftW - 12 * fp.s, headlightY + shaftL);
            ctx.lineTo(rightHeadX + shaftW + 12 * fp.s, headlightY + shaftL);
            ctx.lineTo(rightHeadX + 2 * fp.s, headlightY);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // Bottom Cowcatcher / Track Sweeper bumper (metallic grill structure)
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(1, 1.8 * fp.s);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(botL.x, botL.y);
        ctx.lineTo(botL.x + 5 * fp.s, botL.y + 10 * fp.s);
        ctx.lineTo(botR.x - 5 * fp.s, botR.y + 10 * fp.s);
        ctx.lineTo(botR.x, botR.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Safety lines/grills on standard cowcatcher
        if (fp.s > 0.18) {
            ctx.beginPath();
            for (let fx = botL.x + 8 * fp.s; fx < botR.x - 8 * fp.s; fx += 8 * fp.s) {
                ctx.moveTo(fx, botR.y);
                ctx.lineTo(fx + 2 * fp.s, botR.y + 10 * fp.s);
            }
            ctx.stroke();
        }
    }
}

function drawTunnelGate(ctx, lx, o, fp, bp) {
    const hw = o.w * fp.s * 0.5;
    const bh = o.h * fp.s;
    const bx = fp.x - hw;
    const by = fp.y - bh;
    const bw = hw * 2;
    const tick = typeof frame !== 'undefined' ? frame : 0;

    ctx.save();
    
    // 1. Drawing the solid outer frame of the tunnel portal (arched concrete structure)
    ctx.fillStyle = '#1e1b4b'; // dark blue/indigo concrete
    ctx.strokeStyle = '#020617'; // dark outline
    ctx.lineWidth = Math.max(2.0, 4.0 * fp.s);

    ctx.beginPath();
    ctx.moveTo(bx, fp.y);
    ctx.lineTo(bx, by + bh * 0.4);
    ctx.bezierCurveTo(bx, by, bx + bw, by, bx + bw, by + bh * 0.4);
    ctx.lineTo(bx + bw, fp.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Draw the black inner portal mouth (tunnel entrance void)
    ctx.fillStyle = '#020617'; // pure dark void
    ctx.beginPath();
    ctx.moveTo(bx + 18 * fp.s, fp.y);
    ctx.lineTo(bx + 18 * fp.s, by + bh * 0.45);
    ctx.bezierCurveTo(bx + 18 * fp.s, by + 12 * fp.s, bx + bw - 18 * fp.s, by + 12 * fp.s, bx + bw - 18 * fp.s, by + bh * 0.45);
    ctx.lineTo(bx + bw - 18 * fp.s, fp.y);
    ctx.closePath();
    ctx.fill();

    // 3. Glowing neon borders along the arch mouth
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)'; // cyan neon glow
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = Math.max(2, 10 * fp.s);
    ctx.lineWidth = Math.max(1.5, 3.5 * fp.s);

    ctx.beginPath();
    ctx.moveTo(bx + 16 * fp.s, fp.y);
    ctx.lineTo(bx + 16 * fp.s, by + bh * 0.45);
    ctx.bezierCurveTo(bx + 16 * fp.s, by + 10 * fp.s, bx + bw - 16 * fp.s, by + 10 * fp.s, bx + bw - 16 * fp.s, by + bh * 0.45);
    ctx.lineTo(bx + bw - 16 * fp.s, fp.y);
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset shadow

    // 4. Glowing portal caution lights (Blinking warning halos)
    const bulbColor = (Math.floor(tick / 15) % 2 === 0) ? '#ff0055' : '#330011';
    ctx.fillStyle = bulbColor;
    if (fp.s > 0.15) {
        ctx.beginPath();
        ctx.arc(bx + 30 * fp.s, by + bh * 0.5, 4 * fp.s, 0, Math.PI * 2);
        ctx.arc(bx + bw - 30 * fp.s, by + bh * 0.5, 4 * fp.s, 0, Math.PI * 2);
        ctx.fill();
        
        if (bulbColor === '#ff0055') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = 'rgba(255, 0, 85, 0.28)';
            ctx.beginPath();
            ctx.arc(bx + 30 * fp.s, by + bh * 0.5, 12 * fp.s, 0, Math.PI * 2);
            ctx.arc(bx + bw - 30 * fp.s, by + bh * 0.5, 12 * fp.s, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // 5. Label overlay text above the arch (Cyberpunk portal sign)
    if (fp.s > 0.22) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(9, Math.floor(13 * fp.s))}px "Noto Sans JP", "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 5;
        
        let label = 'JUNGLE TUNNEL';
        if (typeof gameTheme !== 'undefined' && gameTheme === 'jungle') {
            label = 'TOKYO TUNNEL';
        }
        ctx.fillText(label, fp.x, by + 16 * fp.s);
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}
