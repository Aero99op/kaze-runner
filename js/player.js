// Player physics, skeleton-joint animation, scarf physics, and power-up rendering
const P = {
    lane: 1,
    wx: 0,           // world X (lerps to lane target)
    wy: 0,           // height above road
    wz: NEAR_Z + 24, // depth (fixed, world moves toward us; increased to distance the camera)
    velX: 0,         // horizontal lane switching velocity
    velY: 0,         // vertical jump velocity
    jumping: false,
    sliding: false,
    slideT: 0,
    legPhase: 0,
    invincT: 0,      // invincibility timer (frames)
    flyT: 0,         // fly timer (frames)
    squishT: 0,      // landing squish animation timer
    stumbleT: 0,     // stumble recovery timer
    wasOnTrain: false, // tracks if player is currently climbing/running on a train roof
};

// Catcher state representation (Cyber Police Inspector chasing the player)
const C = {
    wx: 0,
    wy: 0,
    wz: 30,          // depth behind camera
    active: false,
    legPhase: 0,
    status: 'idle',  // 'chasing', 'tripping', 'retreating', 'idle'
    statusT: 0,
    stumbleCount: 0,
    lane: 1,
};

// Trailing physics scarf nodes
const scarfNodes = [];
for (let i = 0; i < 12; i++) {
    scarfNodes.push({ wx: 0, wy: 0, wz: P.wz });
}

function updatePlayer() {
    let targetPlayerWY = 0;
    let targetCamHeight = CAM_HEIGHT + P.wy; // Dynamically follow the player's elevation (fixes train roof POV)

    if (P.flyT > 0) {
        targetPlayerWY = 180;
        targetCamHeight = CAM_HEIGHT + 125; // keep it high during flight
        P.flyT--;
        P.wasOnTrain = true; // Flying counts as train roof altitude/climbing status
    }

    if (P.invincT > 0) {
        P.invincT--;
    }

    if (P.stumbleT > 0) {
        P.stumbleT--;
    }

    // 1. Physics - Advanced Spring-Damper Lane Switching (S-curve Easing)
    const targetX = LANE_X[P.lane];
    const displacementX = targetX - P.wx;
    const lateralSpring = 0.22;
    const lateralDamping = 0.55;
    const lateralAcc = lateralSpring * displacementX - lateralDamping * P.velX;
    P.velX += lateralAcc;
    P.wx += P.velX;
    
    // Smooth camera horizontal tracking
    if (typeof camWX !== 'undefined') {
        camWX += (P.wx - camWX) * 0.085;
    }

    // Decrement landing squish timer
    if (P.squishT > 0) {
        P.squishT--;
    }

    // 2. Physics - Advanced Apex-Floated Jump Arc (Variable Gravity)
    // Find if there is a train underneath the player to stand/run on its roof
    let targetGroundY = 0;
    let underTrain = null;
    if (typeof obstacles !== 'undefined') {
        underTrain = obstacles.find(o => 
            o.type === 'train' && 
            o.lane === P.lane && 
            o.wz <= P.wz + 10 && 
            (o.wz + o.len) >= P.wz - 10
        );
        if (underTrain) {
            if (underTrain.climbable) {
                // If it's a climbable train, player slides smoothly up/down the front ramp (extends 65 units)
                const rampDist = P.wz - underTrain.wz;
                const rampFraction = Math.min(Math.max(rampDist / 65, 0), 1);
                targetGroundY = 85 * rampFraction;
            } else {
                // Non-climbable train: only land on roof if player is already high and jumped from another train (or was flying)
                if (P.wy >= 80 && (P.wasOnTrain || P.flyT > 0)) {
                    targetGroundY = 85; // Train roof height
                }
            }
        }
    }
    P.groundY = targetGroundY; // Store ground height globally for shadow rendering

    if (P.jumping) {
        let gravity = 0.85;
        // Float at the apex (high point) of the jump
        if (Math.abs(P.velY) < 3.0) {
            gravity = 0.38; // 55% gravity reduction
        }
        
        P.wy += P.velY;
        P.velY -= gravity;
        
        if (P.wy <= targetGroundY) {
            P.wy = targetGroundY;
            P.velY = 0;
            P.jumping = false;
            P.squishT = 10; // Trigger landing squish compression (10 frames)
            if (typeof camHeightVel !== 'undefined') {
                camHeightVel = -14; // screen landing dip!
            }
        }
    } else {
        // Flight transition or ground snapping
        // Fall check: if we walk off the train roof or flight ends
        const shouldFall = P.flyT <= 0 && (underTrain ? P.wy > 120 : P.wy > targetGroundY);
        if (shouldFall) {
            P.jumping = true;
            P.velY = 0; // start falling
        } else {
            if (P.flyT > 0) {
                P.wy += (targetPlayerWY - P.wy) * 0.08;
            } else {
                P.wy = targetGroundY; // stick to roof/ramp/ground directly
            }
        }
    }

    // Spring tracking on vertical camera height
    if (typeof currentCamHeight !== 'undefined' && typeof camHeightVel !== 'undefined') {
        const displacementY = currentCamHeight - targetCamHeight;
        const springConstantY = 0.18;
        const dampingConstantY = 0.50;
        const camAccY = -springConstantY * displacementY - dampingConstantY * camHeightVel;
        camHeightVel += camAccY;
        currentCamHeight += camHeightVel;
    }

    // Slide state timer
    if (P.sliding) {
        P.slideT--;
        if (P.slideT <= 0) {
            P.sliding = false;
        }
    }

    // Animation cycle speed calculations
    if (!P.sliding) {
        const cycleSpeed = typeof speed !== 'undefined' ? speed / 6.5 : 1;
        P.legPhase += 0.19 * cycleSpeed;
    }

    // Scarf physics follow trail simulation (Z-axis trailing and drag)
    let leadWX = P.wx;
    let leadWY = P.wy - 44; // Scarf neck height
    if (P.sliding) leadWY = P.wy - 20;
    let leadWZ = P.wz;

    scarfNodes[0].wx = leadWX;
    scarfNodes[0].wy = leadWY;
    scarfNodes[0].wz = leadWZ;

    const windBack = typeof speed !== 'undefined' ? speed * 1.5 : 10;
    const waveAmp = P.sliding ? 4 : 8;
    const waveFreq = P.legPhase * 1.4;

    for (let i = 1; i < scarfNodes.length; i++) {
        const node = scarfNodes[i];
        const prev = scarfNodes[i - 1];
        
        // Trail behind along the Z-axis (towards the camera)
        const targetZ = prev.wz - 3.2;
        // Flap symmetrically with added aerodynamic drag opposite to steering velocity (P.velX)
        const targetX = prev.wx + Math.sin(waveFreq - i * 0.4) * (waveAmp * 0.15) - P.velX * 1.5;
        // Droop down under gravity
        const targetY = prev.wy + Math.cos(waveFreq - i * 0.4) * (waveAmp * 0.08) + 0.8;

        node.wx += (targetX - node.wx) * 0.35;
        node.wy += (targetY - node.wy) * 0.35;
        node.wz += (targetZ - node.wz) * 0.35;
    }

    // Update P.wasOnTrain state dynamically
    if (!P.jumping && P.wy >= 80) {
        P.wasOnTrain = true;
    } else if (P.wy < 10) {
        P.wasOnTrain = false;
    }
}

function drawPlayer(ctx) {
    if (typeof project === 'undefined') return;
    
    const p = project(P.wx, P.wy, P.wz);
    if (p.y < HORIZON_Y) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Dynamic Camera roll/tilt based on actual lateral velocity (leans naturally into turns)
    const rollAngle = P.velX * 0.015; // counter-clockwise tilt when moving left, clockwise when right
    ctx.rotate(rollAngle);

    // 1. Vector Drop Shadow (Grounded on asphalt or train roof below runner)
    const shadowY = (typeof P.groundY !== 'undefined') ? P.groundY : 0;
    const sh = project(P.wx, shadowY, P.wz);
    ctx.save();
    ctx.translate(sh.x - p.x, sh.y - p.y);
    const shadowG = ctx.createRadialGradient(0, 0, 0, 0, 0, 24 * sh.s);
    shadowG.addColorStop(0, 'rgba(3, 2, 10, 0.48)');
    shadowG.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowG;
    ctx.beginPath();
    ctx.ellipse(0, 3, 24 * sh.s, 6.5 * sh.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Character Render scale & squash/stretch parameters
    const s = p.s;
    const slide = P.sliding;
    const bodyW = 20;
    const bodyH = slide ? 15 : 28;
    
    // Default dimensions
    let headRad = 9;
    const lp = P.legPhase;

    // Apply squash and stretch values procedurally
    let stretchX = 1.0;
    let stretchY = 1.0;
    
    if (P.jumping) {
        // Stretch vertically as vertical speed increases
        const factor = Math.min(Math.abs(P.velY) * 0.012, 0.15);
        stretchX = 1.0 - factor;
        stretchY = 1.0 + factor;
    } else if (P.squishT > 0) {
        // Compress vertically on landing impact
        const phase = P.squishT / 10; // scales from 1.0 down to 0
        const factor = Math.sin(phase * Math.PI) * 0.18; // peak squish amplitude
        stretchX = 1.0 + factor;
        stretchY = 1.0 - factor;
    }

    ctx.scale(s * stretchX, s * stretchY);

    // 3. Torso bobbing & shoulder sways (Run cycle weights)
    let bobY = 0;
    let bobAngle = 0;
    if (!slide && !P.jumping) {
        bobY = Math.sin(lp * 2) * 1.5; // torso bobbing up/down twice per gait cycle
        bobAngle = Math.cos(lp) * 0.038; // slight shoulder sway
    }

    if (P.stumbleT > 0) {
        bobAngle += Math.sin(P.stumbleT * 0.5) * 0.15; // heavy stagger wobble
        bobY += Math.cos(P.stumbleT * 0.5) * 2.5;
    }

    const bodyY = (slide ? -14 : -40) + bobY;
    const headY = (slide ? -26 : -53) + bobY;

    ctx.strokeStyle = '#0a0918'; // High contrast manga ink borders
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ── LEGS (Hierarchical Joints Skeletal Rig to fix crab legs) ──
    if (!slide) {
        for (let legIdx = 0; legIdx < 2; legIdx++) {
            const phase = lp + (legIdx * Math.PI);
            const hipX = legIdx === 0 ? -5 : 5;
            const hipY = -15 + bobY * 0.5;

            // Save context for hierarchical transforms
            ctx.save();
            ctx.translate(hipX, hipY);

            // Thigh swings back/forward slightly (hip joint rotation)
            const thighAngle = Math.sin(phase) * 0.28; // limited to prevent crab outward kicks
            ctx.rotate(thighAngle);

            // Draw Thigh (shaded pants)
            ctx.fillStyle = legIdx === 0 ? '#1d4ed8' : '#1e3a8a';
            ctx.beginPath();
            ctx.roundRect(-2.8, 0, 5.6, 12, 1.8);
            ctx.fill();
            ctx.stroke();

            // Move to knee joint
            ctx.translate(0, 11);

            // Calf bends backward at the knee (Symmetrical outward swing)
            const calfAngle = (legIdx === 0 ? -1 : 1) * Math.abs(Math.sin(phase)) * 0.38;
            ctx.rotate(calfAngle);

            // Draw Calf (socks/pants continuation)
            ctx.fillStyle = legIdx === 0 ? '#3b82f6' : '#2563eb';
            ctx.beginPath();
            ctx.roundRect(-2.2, 0, 4.4, 11, 1.5);
            ctx.fill();
            ctx.stroke();

            // Move to ankle joint
            ctx.translate(0, 10);

            // Draw Crimson Sneakers (Details: white soles, glowing lines)
            ctx.fillStyle = '#f3f4f6'; // Sole base
            ctx.beginPath();
            ctx.roundRect(-4.5, 0, 9, 4.5, 1.5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ef4444'; // Red paneling
            ctx.beginPath();
            ctx.roundRect(-4.0, 0, 8, 3.2, 1.0);
            ctx.fill();

            // Glowing laces
            ctx.fillStyle = '#fde047';
            ctx.fillRect(-2.0, 0.5, 4.0, 1.0);

            ctx.restore();
        }
    } else {
        // Slide tucked legs
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.roundRect(-15, bodyY + bodyH, 29, 6.8, 2.5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(9, bodyY + bodyH + 1, 9, 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(13, bodyY + bodyH + 1, 5, 5);

        // Slide sparks under shoes
        if (Math.random() < 0.45 && typeof particles !== 'undefined') {
            particles.push({
                x: p.x + 12 * s,
                y: p.y + (bodyY + bodyH + 4) * s,
                vx: Math.random() * 5 + 3,
                vy: -Math.random() * 3 - 1,
                life: 15,
                maxL: 15,
                col: '#ffd95a',
                size: Math.random() * 2 + 1
            });
        }
    }

    // ── WIND-SWEPT JACKET BODY WITH SHOULDER SWAYS ──
    ctx.save();
    ctx.rotate(bobAngle); // Shoulder sway rotation
    
    const windG = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
    windG.addColorStop(0, '#1e40af'); // deep shade
    windG.addColorStop(0.3, '#2563eb'); // mid blue
    windG.addColorStop(1, '#3b82f6'); // bright highlight
    ctx.fillStyle = windG;
    ctx.beginPath();
    ctx.roundRect(-bodyW / 2, bodyY, bodyW, bodyH, 4.5);
    ctx.fill();
    ctx.stroke();

    // Glowing electric yellow sports jacket panels
    ctx.strokeStyle = '#ffd95a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2 + 3, bodyY + 4);
    ctx.lineTo(-bodyW / 2 + 3, bodyY + bodyH - 3);
    ctx.moveTo(bodyW / 2 - 3, bodyY + 4);
    ctx.lineTo(bodyW / 2 - 3, bodyY + bodyH - 3);
    ctx.stroke();

    // ── GLOWING CHAMELEON LOGO CREST ON JACKET BACK ──
    ctx.strokeStyle = '#00f0ff'; // glowing cyan neon
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    // Spiral body tail
    ctx.arc(0, bodyY + bodyH * 0.45, 3.2, 0, Math.PI * 1.7);
    // Head tip
    ctx.moveTo(0, bodyY + bodyH * 0.45 - 3.2);
    ctx.lineTo(2, bodyY + bodyH * 0.45 - 4.5);
    ctx.stroke();

    ctx.strokeStyle = '#0a0918'; // restore outline
    ctx.lineWidth = 2.0;

    // ── HIGH-GRADE LEATHER RANDOSERU (Cyber-Thruster backpack) ──
    const packW = bodyW * 0.78;
    const packH = bodyH * 0.68;
    const packX = -packW / 2;
    const packY = bodyY + bodyH * 0.16;

    // Leather body
    ctx.fillStyle = '#451a03'; // deep leather brown
    ctx.beginPath();
    ctx.roundRect(packX, packY, packW, packH, 3);
    ctx.fill();
    ctx.stroke();

    // Flap details
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(packX + 1.5, packY + 1, packW - 3, packH * 0.62, 1.8);
    ctx.fill();
    ctx.stroke();

    // Golden lock buckle
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-2, packY + packH - 4.5, 4, 3);

    // Jetpack fire thruster flares
    if (P.flyT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        const plumeH = 18 + Math.sin(lp * 2) * 7;
        const exhaustY = packY + packH;
        
        // Expanisve thruster gradients
        const fireG = ctx.createLinearGradient(0, exhaustY, 0, exhaustY + plumeH);
        fireG.addColorStop(0, '#ffffff'); // super-hot white core
        fireG.addColorStop(0.2, '#00f0ff'); // cyan neon halo
        fireG.addColorStop(0.65, '#0055ff'); // blue discharge
        fireG.addColorStop(1, 'rgba(0, 85, 255, 0)');

        ctx.fillStyle = fireG;
        
        // Dual nozzles
        [-4, 4].forEach(xOff => {
            ctx.beginPath();
            ctx.moveTo(packX + packW / 2 + xOff - 3.5, exhaustY);
            ctx.lineTo(packX + packW / 2 + xOff - 7, exhaustY + plumeH);
            ctx.lineTo(packX + packW / 2 + xOff + 7, exhaustY + plumeH);
            ctx.lineTo(packX + packW / 2 + xOff + 3.5, exhaustY);
            ctx.closePath();
            ctx.fill();
        });
        ctx.restore();

        // Spark emitter
        if (Math.random() < 0.45 && typeof particles !== 'undefined') {
            particles.push({
                x: p.x + (packX + packW * Math.random()) * s * stretchX,
                y: p.y + exhaustY * s * stretchY,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * 4 + 3,
                life: 18,
                maxL: 18,
                col: '#00f0ff',
                size: Math.random() * 2.5 + 1.2
            });
        }
    }

    // ── ARMS (Fluid running swing) ──
    ctx.fillStyle = '#2563eb';
    if (!slide) {
        for (let armIdx = 0; armIdx < 2; armIdx++) {
            const phase = lp + (armIdx === 0 ? Math.PI : 0);
            const sideSign = armIdx === 0 ? -1 : 1;
            
            ctx.save();
            ctx.translate(sideSign * (bodyW / 2 - 2.2), bodyY + 4.5);
            ctx.rotate(phase * 0.45 * sideSign + 0.1);
            
            // Sleeve
            ctx.fillRect(sideSign * 2.5 - 2.5, 0, 5.0, 16);
            ctx.strokeRect(sideSign * 2.5 - 2.5, 0, 5.0, 16);
            
            // Skin Hand
            ctx.fillStyle = '#fcd5b0';
            ctx.beginPath();
            ctx.arc(0, 17.5, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            ctx.fillStyle = '#2563eb';
        }
    } else {
        // Slide tuck arms
        ctx.fillRect(-bodyW / 2 - 4.5, bodyY + 6.5, 6, 12);
        ctx.strokeRect(-bodyW / 2 - 4.5, bodyY + 6.5, 6, 12);
        ctx.fillRect(bodyW / 2 - 1.5, bodyY + 6.5, 6, 12);
        ctx.strokeRect(bodyW / 2 - 1.5, bodyY + 6.5, 6, 12);
    }
    
    ctx.restore(); // Restore shoulder sways

    // ── NECK & HEAD (Dynamic turning profile based on lateral lane speed) ──
    // Skin Neck
    ctx.fillStyle = '#fcd5b0';
    ctx.fillRect(-3.8, headY + 5, 7.6, bodyY - (headY + 5) + 1);
    ctx.strokeRect(-3.8, headY + 5, 7.6, bodyY - (headY + 5) + 1);

    // Determine horizontal face turning profile offset based on lateral velocity
    let turnOffset = 0;
    if (P.velX < -0.8) {
        turnOffset = -2.2; // looks left
    } else if (P.velX > 0.8) {
        turnOffset = 2.2;  // looks right
    }

    // Spiky Hair drawing (Offset base slightly to follow turn)
    ctx.fillStyle = '#060216';
    ctx.beginPath();
    ctx.arc(turnOffset * 0.45, headY, headRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spiky strands on sides
    ctx.beginPath();
    ctx.moveTo(-headRad + turnOffset * 0.4, headY - 1);
    ctx.quadraticCurveTo(-14.5 + turnOffset * 0.2, headY - 8, -12 + turnOffset * 0.2, headY - 14);
    ctx.quadraticCurveTo(-8.5, headY - 10.5, -8 + turnOffset * 0.4, headY - 4.5);
    
    ctx.moveTo(headRad + turnOffset * 0.4, headY - 1);
    ctx.quadraticCurveTo(14.5 + turnOffset * 0.2, headY - 8, 12 + turnOffset * 0.2, headY - 14);
    ctx.quadraticCurveTo(8.5, headY - 10.5, 8 + turnOffset * 0.4, headY - 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hair crowns
    ctx.beginPath();
    ctx.moveTo(-6 + turnOffset * 0.3, headY - headRad + 1.2);
    ctx.quadraticCurveTo(turnOffset * 0.3, headY - 22, 2 + turnOffset * 0.3, headY - 25);
    ctx.quadraticCurveTo(4 + turnOffset * 0.3, headY - 16, 7.5 + turnOffset * 0.3, headY - headRad + 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Specular hair highlights
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(turnOffset * 0.4, headY - 2, headRad - 3.8, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    
    ctx.strokeStyle = '#0a0918'; // restore outline
    ctx.lineWidth = 2.0;

    // Cyber Goggles
    if (turnOffset === 0) {
        // Draw the goggles strap around the back of the head since we are viewing from behind
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-8, headY - 5.5, 16, 2.5);
    } else {
        // Draw the goggles peaking out to the side of the head profile
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-6.5 + turnOffset * 1.5, headY - 6.5, 13, 4.5, 1.2);
        ctx.fill();
        ctx.stroke();

        // Lens shine highlights (Face Profile Visor view)
        ctx.fillStyle = '#00f0ff';
        if (turnOffset < 0) {
            // Exposes left lens more, wraps right lens out of view
            ctx.fillRect(-6.5 + turnOffset * 1.5, headY - 5.5, 5.5, 2.5);
            ctx.fillStyle = '#0066aa'; // dark side right lens
            ctx.fillRect(0.5 + turnOffset * 1.5, headY - 5.5, 2.0, 2.5);
        } else {
            // Exposes right lens more, wraps left lens
            ctx.fillStyle = '#0066aa'; // dark side left lens
            ctx.fillRect(-2.5 + turnOffset * 1.5, headY - 5.5, 2.0, 2.5);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(1.0 + turnOffset * 1.5, headY - 5.5, 5.5, 2.5);
        }
    }

    // ── SCARF ──
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(-6.5, headY + 7.5, 13, 5, 1.8);
    ctx.fill();
    ctx.stroke();

    ctx.restore(); // Exit local translations to draw scarf in relative scale coordinates
    
    // Draw the scarf ribbons using projected node points
    ctx.save();
    ctx.fillStyle = '#dc2626'; // Darker red body shadow
    ctx.strokeStyle = '#0a0918';
    ctx.lineWidth = 2.0 * s;

    ctx.beginPath();
    // Top boundary
    const leadNodeProj = project(scarfNodes[0].wx, scarfNodes[0].wy, scarfNodes[0].wz);
    ctx.moveTo(leadNodeProj.x, leadNodeProj.y);
    for (let i = 1; i < scarfNodes.length; i++) {
        const np = project(scarfNodes[i].wx, scarfNodes[i].wy, scarfNodes[i].wz);
        const thickness = (1 - (i / scarfNodes.length)) * 5.8 * s * stretchX;
        ctx.lineTo(np.x, np.y - thickness);
    }
    // Tip
    const tipProj = project(scarfNodes[scarfNodes.length - 1].wx, scarfNodes[scarfNodes.length - 1].wy, scarfNodes[scarfNodes.length - 1].wz);
    ctx.lineTo(tipProj.x, tipProj.y);
    // Bottom boundary
    for (let i = scarfNodes.length - 2; i >= 0; i--) {
        const np = project(scarfNodes[i].wx, scarfNodes[i].wy, scarfNodes[i].wz);
        const thickness = (1 - (i / scarfNodes.length)) * 5.8 * s * stretchX;
        ctx.lineTo(np.x, np.y + thickness);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ── CELESTIAL INVINCIBILITY SHIELD EFFECT ──
    if (P.invincT > 0) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s * stretchX, s * stretchY);
        ctx.globalCompositeOperation = 'screen';
        
        const tickVal = lp * 1.5;
        const shieldPulse = Math.abs(Math.sin(tickVal * 0.4));
        
        // Inner glowing core
        const glowG = ctx.createRadialGradient(0, headY + 5, 0, 0, headY + 5, headRad + 14 + shieldPulse * 8);
        glowG.addColorStop(0, 'rgba(251, 191, 36, 0.38)');
        glowG.addColorStop(0.7, 'rgba(251, 191, 36, 0.08)');
        glowG.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glowG;
        ctx.beginPath();
        ctx.arc(0, headY + 5, headRad + 14 + shieldPulse * 8, 0, Math.PI * 2);
        ctx.fill();

        // Concentric Orbital Ring 1
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.4 + shieldPulse * 0.55})`;
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.arc(0, headY + 5, headRad + 12 + shieldPulse * 6, 0, Math.PI * 2);
        ctx.stroke();

        // Concentric Orbital Ring 2
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.2 + (1 - shieldPulse) * 0.45})`;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 14]);
        ctx.beginPath();
        ctx.arc(0, bodyY + bodyH * 0.5, 27 + (1 - shieldPulse) * 11, tickVal, tickVal + Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

// Update Catcher state and physics
function updateCatcher() {
    if (!C.active) return;

    if (C.status === 'chasing') {
        // Catcher follows player's lane and coordinate offsets
        C.wx += (P.wx - C.wx) * 0.12;
        C.wy += (P.wy - C.wy) * 0.12;
        
        // Target Z is right behind the player
        const targetZ = P.wz - 22;
        C.wz += (targetZ - C.wz) * 0.04;
        
        // Swing legs running animation
        C.legPhase += 0.22;
        
        // Retreat when status timer expires
        C.statusT--;
        if (C.statusT <= 0) {
            C.status = 'retreating';
        }
    } else if (C.status === 'retreating') {
        C.wx += (0 - C.wx) * 0.05;
        C.wz += (20 - C.wz) * 0.04;
        if (C.wz < 25) {
            C.active = false;
            C.status = 'idle';
        }
    } else if (C.status === 'tripping') {
        // Slapped/Tripped! Falls down flat and slides backward past camera
        C.wz -= 4.5;
        C.statusT--;
        if (C.statusT <= 0 || C.wz < 25) {
            C.active = false;
            C.status = 'idle';
        }
    }
}

// Render the Catcher model in vector graphic form
function drawCatcher(ctx) {
    if (typeof project === 'undefined' || !C.active) return;

    const cp = project(C.wx, C.wy, C.wz);
    if (cp.y < HORIZON_Y) return;

    ctx.save();
    ctx.translate(cp.x, cp.y);

    const s = cp.s;
    
    // Slap splash graphic
    if (C.status === 'tripping' && C.statusT > 30) {
        ctx.save();
        ctx.fillStyle = '#fde047'; // yellow comic burst
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        const cx = 0;
        const cy = -85 * s;
        const radius = 40 * s;
        const numPoints = 12;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const r = (i % 2 === 0 ? radius : radius * 0.55);
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Splash text
        ctx.fillStyle = '#ef4444'; // red text
        ctx.font = `bold ${Math.floor(14 * s)}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAPLI!', cx, cy);
        ctx.restore();
    }

    // Apply rotation if tripping/falling
    if (C.status === 'tripping') {
        const fallProgress = (60 - C.statusT) / 60;
        ctx.rotate(fallProgress * Math.PI * 0.42); // falls forward
        ctx.translate(0, fallProgress * 15 * s);
    }

    ctx.scale(s, s);

    // Default sizing
    const bodyW = 24; 
    const bodyH = 32;
    const headRad = 11;
    const clp = C.legPhase;

    ctx.strokeStyle = '#05020c';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ── LEGS (Combat Police Boots) ──
    for (let legIdx = 0; legIdx < 2; legIdx++) {
        const phase = clp + (legIdx * Math.PI);
        const hipX = legIdx === 0 ? -6 : 6;
        const hipY = -15;

        ctx.save();
        ctx.translate(hipX, hipY);

        const thighAngle = Math.sin(phase) * 0.28;
        ctx.rotate(thighAngle);

        // Draw Thigh (Dark police trousers)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-3.2, 0, 6.4, 13, 2);
        ctx.fill();
        ctx.stroke();

        // Knee joint
        ctx.translate(0, 12);
        const calfAngle = (legIdx === 0 ? -1 : 1) * Math.abs(Math.sin(phase)) * 0.35;
        ctx.rotate(calfAngle);

        // Draw Calf/Boots (Heavy combat boots)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-2.8, 0, 5.6, 12, 1.8);
        ctx.fill();
        ctx.stroke();

        // Ankle joint
        ctx.translate(0, 11);
        ctx.fillStyle = '#000000'; // black soles
        ctx.beginPath();
        ctx.roundRect(-5.2, 0, 10.4, 5, 1.5);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    // ── BODY (Heavy Cyber Inspector Coat) ──
    ctx.fillStyle = '#0f172a'; // Police dark navy
    ctx.beginPath();
    ctx.roundRect(-bodyW / 2, -43, bodyW, bodyH, 5);
    ctx.fill();
    ctx.stroke();

    // Gold Police Badge and neon markings
    ctx.fillStyle = '#eab308'; // Glowing gold badge
    ctx.beginPath();
    ctx.moveTo(3, -37);
    ctx.lineTo(6, -35);
    ctx.lineTo(4, -31);
    ctx.lineTo(2, -31);
    ctx.lineTo(0, -35);
    ctx.closePath();
    ctx.fill();

    // Glowing Neon Yellow/Orange high-visibility vest bars
    ctx.strokeStyle = '#ea580c'; // neon safety orange
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2 + 3, -38);
    ctx.lineTo(bodyW / 2 - 3, -38);
    ctx.moveTo(-bodyW / 2 + 3, -24);
    ctx.lineTo(bodyW / 2 - 3, -24);
    ctx.stroke();

    // ── ARMS (Waving neon stun nightstick) ──
    // Left arm running swing
    ctx.save();
    ctx.translate(-bodyW / 2 + 2, -39);
    ctx.rotate(clp * 0.35 - 0.2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4, 0, 4.5, 15);
    ctx.strokeRect(-4, 0, 4.5, 15);
    ctx.restore();

    // Right arm holding glowing stun nightstick
    ctx.save();
    ctx.translate(bodyW / 2 - 2, -39);
    const batonWiggle = Math.sin(clp * 2.2) * 0.35;
    ctx.rotate(-Math.PI * 0.3 + batonWiggle);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-0.5, 0, 4.5, 15);
    ctx.strokeRect(-0.5, 0, 4.5, 15);

    // Stun Baton (neon blue glowing nightstick)
    ctx.translate(2, 14);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.stroke();
    ctx.restore();
    
    ctx.strokeStyle = '#00f0ff'; // cyan neon core
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.stroke();
    ctx.restore();

    // ── HEAD & HELMET (Glowing Red Police Visor) ──
    const headY = -53;
    // Skin Neck
    ctx.fillStyle = '#fcd5b0';
    ctx.fillRect(-3, headY + 5, 6, 7);
    ctx.strokeRect(-3, headY + 5, 6, 7);

    // Helmet
    ctx.fillStyle = '#1e293b'; // slate police helmet
    ctx.beginPath();
    ctx.arc(0, headY, headRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing police helmet beacon dome light
    const beaconAlpha = 0.4 + Math.abs(Math.sin(frame * 0.15)) * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const lightG = ctx.createRadialGradient(0, headY - headRad - 1, 0, 0, headY - headRad - 1, 10);
    lightG.addColorStop(0, `rgba(239, 68, 68, ${beaconAlpha * 0.85})`);
    lightG.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = lightG;
    ctx.beginPath();
    ctx.arc(0, headY - headRad - 1, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Beacon cap
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-2.5, headY - headRad - 3, 5, 3);
    ctx.strokeRect(-2.5, headY - headRad - 3, 5, 3);

    // Glowing red visor bar (face guard) on police helmet
    ctx.fillStyle = '#ef4444'; // Glowing red visor
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(-6.5, headY - 4.5, 13, 3.2, 1);
    ctx.fill();
    ctx.restore();

    ctx.restore();
}
