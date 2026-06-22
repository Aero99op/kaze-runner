// Powers and Special Ability systems: Invincibility, Flight mechanics, and Air coin runs
function spawnFlyingCoins() {
    if (typeof P === 'undefined' || typeof coins === 'undefined') return;
    coins.length = 0; // Clear existing coins
    const startZ = P.wz + 180;
    const numRows = 100;
    const spacingZ = 12; // tight spacing to fit within flight duration

    let spawned = 0;
    for (let r = 0; r < numRows; r++) {
        const z = startZ + r * spacingZ;
        const wave = Math.sin(r * 0.12);
        let lanes = [1]; // default center lane

        if (wave < -0.4) {
            lanes = [0, 1]; // Left and Center
        } else if (wave > 0.4) {
            lanes = [1, 2]; // Center and Right
        } else {
            lanes = [0, 2]; // Left and Right split
        }

        const wy = 175 + Math.sin(r * 0.2) * 10;

        lanes.forEach(lane => {
            if (spawned < 250) {
                coins.push({
                    lane: lane,
                    wz: z,
                    wy: wy,
                    spin: Math.random() * Math.PI * 2,
                    collected: false,
                    isAir: true
                });
                spawned++;
            }
        });
    }

    // Fill remaining to get exactly 250 coins
    while (spawned < 250) {
        coins.push({
            lane: Math.floor(Math.random() * 3),
            wz: startZ + numRows * spacingZ + spawned * 10,
            wy: 175,
            spin: Math.random() * Math.PI * 2,
            collected: false,
            isAir: true
        });
        spawned++;
    }
}

// Render the active meters and activation triggers in the HUD
function drawHUDPowerups(ctx, startY) {
    if (typeof P === 'undefined' || typeof runCoins === 'undefined' || typeof frame === 'undefined') return startY;
    let activeY = startY;

    // 🛡️ SHIELD / INVINCIBILITY METER CARD
    {
        let pct = 0;
        let label = '';
        let textColor = '#fbbf24';
        let barColor1 = '#f59e0b';
        let barColor2 = '#fbbf24';

        if (P.invincT > 0) {
            pct = P.invincT / 600;
            label = `${(P.invincT / 60).toFixed(1)}s`;
            textColor = '#fbbf24';
        } else {
            pct = Math.min(runCoins / 75, 1);
            label = `${runCoins}/75 ¥`;
            if (runCoins >= 75) {
                textColor = '#fbbf24';
                label = 'Press [E]';
            } else {
                textColor = 'rgba(251, 191, 36, 0.45)';
            }
        }

        // Draw Card Background
        ctx.fillStyle = 'rgba(6, 4, 16, 0.72)';
        ctx.beginPath();
        ctx.roundRect(12, activeY, 200, 34, 8);
        ctx.fill();

        // Border Glow
        ctx.strokeStyle = P.invincT > 0 ? '#fbbf24' : (runCoins >= 75 ? 'rgba(245, 158, 11, 0.75)' : 'rgba(255, 183, 197, 0.15)');
        ctx.lineWidth = 1;
        ctx.strokeRect(12, activeY, 200, 34);

        // Icon
        ctx.font = '13px "Outfit"';
        ctx.fillText('🛡️', 20, activeY + 22);

        // Track bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(46, activeY + 13, 100, 8, 4);
        ctx.fill();

        // Active progress bar
        if (pct > 0) {
            const fillG = ctx.createLinearGradient(46, 0, 46 + 100 * pct, 0);
            fillG.addColorStop(0, barColor1);
            fillG.addColorStop(1, barColor2);
            ctx.fillStyle = fillG;
            ctx.beginPath();
            ctx.roundRect(46, activeY + 13, 100 * pct, 8, 4);
            ctx.fill();
        }

        // Label details
        ctx.fillStyle = textColor;
        ctx.font = 'bold 9px "Outfit", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(label, 200, activeY + 20);
        ctx.textAlign = 'left'; // Reset

        activeY += 40;
    }

    // 🚀 THRUSTERS / FLY METER CARD
    {
        let pct = 0;
        let label = '';
        let textColor = '#22d3ee';
        let barColor1 = '#06b6d4';
        let barColor2 = '#22d3ee';

        if (P.flyT > 0) {
            pct = P.flyT / 1200;
            label = `${(P.flyT / 60).toFixed(1)}s`;
            textColor = '#22d3ee';
        } else {
            pct = Math.min(runCoins / 20, 1);
            label = `${runCoins}/20 ¥`;
            if (runCoins >= 20) {
                textColor = '#22d3ee';
                label = 'Press [R]';
            } else {
                textColor = 'rgba(34, 211, 238, 0.45)';
            }
        }

        // Draw Card Background
        ctx.fillStyle = 'rgba(6, 4, 16, 0.72)';
        ctx.beginPath();
        ctx.roundRect(12, activeY, 200, 34, 8);
        ctx.fill();

        // Border Glow
        ctx.strokeStyle = P.flyT > 0 ? '#22d3ee' : (runCoins >= 20 ? 'rgba(6, 182, 212, 0.75)' : 'rgba(255, 183, 197, 0.15)');
        ctx.lineWidth = 1;
        ctx.strokeRect(12, activeY, 200, 34);

        // Icon
        ctx.font = '13px "Outfit"';
        ctx.fillText('🚀', 20, activeY + 22);

        // Track bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(46, activeY + 13, 100, 8, 4);
        ctx.fill();

        // Active progress bar
        if (pct > 0) {
            const fillG = ctx.createLinearGradient(46, 0, 46 + 100 * pct, 0);
            fillG.addColorStop(0, barColor1);
            fillG.addColorStop(1, barColor2);
            ctx.fillStyle = fillG;
            ctx.beginPath();
            ctx.roundRect(46, activeY + 13, 100 * pct, 8, 4);
            ctx.fill();
        }

        // Label details
        ctx.fillStyle = textColor;
        ctx.font = 'bold 9px "Outfit", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(label, 200, activeY + 20);
        ctx.textAlign = 'left'; // Reset

        activeY += 40;
    }

    // 👋 TAPLI / SLAP METER CARD
    if (typeof C !== 'undefined') {
        let pct = Math.min(runCoins / 100, 1);
        let label = `${runCoins}/100 ¥`;
        let textColor = 'rgba(239, 68, 68, 0.45)';
        let barColor1 = '#dc2626';
        let barColor2 = '#ef4444';
        let strokeColor = 'rgba(255, 183, 197, 0.15)';

        if (C.active && C.status === 'chasing') {
            if (runCoins >= 100) {
                textColor = '#ef4444';
                label = 'Press [F]!';
                strokeColor = '#ef4444';
            } else {
                textColor = '#f87171';
            }
        } else if (runCoins >= 100) {
            textColor = '#f87171';
            label = 'Ready';
        }

        // Draw Card Background
        ctx.fillStyle = 'rgba(6, 4, 16, 0.72)';
        ctx.beginPath();
        ctx.roundRect(12, activeY, 200, 34, 8);
        ctx.fill();

        // Border Glow
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(12, activeY, 200, 34);

        // Icon
        ctx.font = '13px "Outfit"';
        ctx.fillText('👋', 20, activeY + 22);

        // Track bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(46, activeY + 13, 100, 8, 4);
        ctx.fill();

        // Active progress bar
        if (pct > 0) {
            const fillG = ctx.createLinearGradient(46, 0, 46 + 100 * pct, 0);
            fillG.addColorStop(0, barColor1);
            fillG.addColorStop(1, barColor2);
            ctx.fillStyle = fillG;
            ctx.beginPath();
            ctx.roundRect(46, activeY + 13, 100 * pct, 8, 4);
            ctx.fill();
        }

        // Label details
        ctx.fillStyle = textColor;
        ctx.font = 'bold 9px "Outfit", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(label, 200, activeY + 20);
        ctx.textAlign = 'left'; // Reset

        activeY += 40;
    }

    return activeY;
}
