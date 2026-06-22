// Main game coordinator, state machines, game loop, rendering pipelines, and input handlers
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');

let gameState = 'start';
let frame = 0;
let speed = 7;
let dist = 0;
let totalCoins = 0;
let runCoins = 0;
let score = 0;
let spawnTimer = 0;
let camShake = 0;
let speedBoost = 0; // speed boost value from Tapli slap

let roadOff = 0;
let poleOff = 0;
let treeOff = 0;

let loopRafId = null;
let idleRafId = null;

// Keyboard handlers
const keys = {};

window.addEventListener('keydown', e => {
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (gameState !== 'running') return;
    ensureAudio();

    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && P.lane > 0) {
        P.prevLane = P.lane;
        P.lane--;
        sfx('jump');
        burst(true);
    }
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && P.lane < 2) {
        P.prevLane = P.lane;
        P.lane++;
        sfx('jump');
        burst(true);
    }
    if ((e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') && !P.jumping && P.flyT <= 0) {
        if (P.sliding) {
            P.sliding = false;
            P.slideT = 0;
        }
        P.jumping = true;
        P.velY = 15;
        sfx('jump');
        burst(true);
    }
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !P.sliding && P.flyT <= 0) {
        if (P.jumping) {
            P.jumping = false;
            P.velY = 0;
            
            // Instantly snap to the correct ground height (road or train roof)
            let targetGroundY = 0;
            if (typeof obstacles !== 'undefined') {
                const underTrain = obstacles.find(o => 
                    o.type === 'train' && 
                    o.lane === P.lane && 
                    o.wz <= P.wz + 10 && 
                    (o.wz + o.len) >= P.wz - 10
                );
                if (underTrain) {
                    if (underTrain.climbable) {
                        const rampDist = P.wz - underTrain.wz;
                        const rampFraction = Math.min(Math.max(rampDist / 65, 0), 1);
                        targetGroundY = 85 * rampFraction;
                    } else if (P.wasOnTrain) {
                        targetGroundY = 85;
                    }
                }
            }
            P.wy = targetGroundY;
        }
        P.sliding = true;
        P.slideT = 38;
        sfx('slide');
    }
    // Invincibility Shield Trigger (Costs 75 Coins, 10 seconds / 600 frames)
    if (e.code === 'KeyE') {
        if (runCoins >= 75) {
            runCoins -= 75;
            P.invincT = 600;
            sfx('coin');
            burst(false);
            updateHUD();
        } else {
            // Error buzz
            beep(150, 'sawtooth', 0.15, 0.25);
        }
    }
    // Fly Jetpack Trigger (Costs 20 Coins, 20 seconds / 1200 frames)
    if (e.code === 'KeyR') {
        if (runCoins >= 20) {
            runCoins -= 20;
            P.flyT = 1200;
            P.jumping = false;
            P.sliding = false;
            P.velY = 0;
            sfx('jump');
            spawnFlyingCoins();
            burst(true);
            updateHUD();
        } else {
            // Error buzz
            beep(150, 'sawtooth', 0.15, 0.25);
        }
    }
    // Tapli / Slap Trigger (Costs 100 Coins, requires Catcher to be active)
    if (e.code === 'KeyF') {
        if (runCoins >= 100 && C.active && C.status === 'chasing') {
            runCoins -= 100;
            C.status = 'tripping';
            C.statusT = 60; // 1 second fall animation
            speedBoost = 5; // give immediate speed boost!
            sfx('slap');
            camShake = 6;
            burst(false);
            updateHUD();
        } else {
            // Error buzz
            beep(150, 'sawtooth', 0.15, 0.25);
        }
    }
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

// Bind UI actions
window.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('btnPlay');
    if (playBtn) playBtn.onclick = startGame;
    
    const retryBtn = document.getElementById('btnRetry');
    if (retryBtn) retryBtn.onclick = startGame;
});

function startGame() {
    ensureAudio();
    if (loopRafId) cancelAnimationFrame(loopRafId);
    if (idleRafId) cancelAnimationFrame(idleRafId);

    gameState = 'running';
    frame = 0;
    speed = 7;
    dist = 0;
    runCoins = 0;
    score = 0;
    spawnTimer = 0;
    obstacles.length = 0;
    coins.length = 0;
    particles.length = 0;

    camWX = 0;
    currentCamHeight = CAM_HEIGHT;

    P.lane = 1;
    P.prevLane = 1;
    P.wx = 0;
    P.wy = 0;
    P.velY = 0;
    P.jumping = false;
    P.sliding = false;
    P.slideT = 0;
    P.legPhase = 0;
    P.invincT = 0;
    P.flyT = 0;
    P.stumbleT = 0;
    P.wasOnTrain = false;
 
    // Reset Catcher state
    C.active = false;
    C.wz = 30;
    C.wx = 0;
    C.wy = 0;
    C.status = 'idle';
    C.statusT = 0;
    C.stumbleCount = 0;
    C.lane = 1;

    speedBoost = 0;

    document.getElementById('scrStart').classList.add('hidden');
    document.getElementById('scrOver').classList.add('hidden');
    document.getElementById('txStatus').textContent = '';
    
    loop();
}

function gameOver() {
    gameState = 'over';
    sfx('crash');
    setTimeout(() => sfx('over'), 220);
    camShake = 22; // High impact shake
    burst(false);

    // Set Game Over screen metrics
    document.getElementById('ovScore').textContent = score + 'm';
    document.getElementById('ovCoins').textContent = runCoins;
    document.getElementById('ovEth').textContent = (runCoins * 0.0001).toFixed(4) + ' ETH';

    // Save coins to general balance
    totalCoins += runCoins;
    runCoins = 0;

    updateHUD();

    const cb = document.getElementById('btnClaim');
    if (cb) {
        cb.disabled = (!walletConnected || totalCoins === 0);
        cb.textContent = 'Claim ETH';
    }
    
    document.getElementById('scrOver').classList.remove('hidden');

    if (loopRafId) {
        cancelAnimationFrame(loopRafId);
        loopRafId = null;
    }
    idleRender();
}

function updateHUD() {
    const hScore = document.getElementById('hScore');
    const hCoins = document.getElementById('hCoins');
    const hEth = document.getElementById('hEth');

    if (hScore) hScore.textContent = score + 'm';
    if (hCoins) hCoins.textContent = totalCoins + runCoins;
    if (hEth) hEth.textContent = ((totalCoins + runCoins) * 0.0001).toFixed(4);
}

function spawnWave() {
    const roll = Math.random();
    if (roll < 0.5) {
        // Spawns obstacles
        const lane = Math.floor(Math.random() * 3);
        const types = ['barrier', 'highbar', 'train'];
        const type = types[Math.floor(Math.random() * 3)];
        
        const climbable = type === 'train' ? Math.random() > 0.38 : false;
        obstacles.push({
            lane: lane,
            type: type,
            wz: FAR_Z,
            w: type === 'train' ? 90 : 75,
            h: type === 'barrier' ? 32 : type === 'highbar' ? 82 : 85,
            len: type === 'train' ? 320 : 22,
            passed: false,
            climbable: climbable
        });

        // Spawn structured coins on top of Shinkansen trains or as an arc over barriers
        if (type === 'train') {
            // Spawn 4 coins spaced along the roof of the train (roof height is 85 + 20 hover = 105)
            for (let k = 0; k < 4; k++) {
                coins.push({
                    lane: lane,
                    wz: FAR_Z + 50 + k * 70,
                    wy: 105,
                    spin: Math.random() * Math.PI * 2,
                    collected: false,
                    onTrain: true
                });
            }
        } else if (type === 'barrier') {
            // Spawn a 3-coin parabolic jump arc over the barrier
            coins.push({ lane: lane, wz: FAR_Z - 45, wy: 25, spin: Math.random() * Math.PI * 2, collected: false });
            coins.push({ lane: lane, wz: FAR_Z, wy: 65, spin: Math.random() * Math.PI * 2, collected: false });
            coins.push({ lane: lane, wz: FAR_Z + 45, wy: 25, spin: Math.random() * Math.PI * 2, collected: false });
        }
    } else {
        // Spawns ground coins row (standard road coins hover above the ground)
        const lane = Math.floor(Math.random() * 3);
        const n = Math.floor(Math.random() * 5) + 3;
        const wy = 18; // hover height above road
        
        for (let j = 0; j < n; j++) {
            coins.push({
                lane: lane,
                wz: FAR_Z + j * 80,
                wy: wy,
                spin: Math.random() * Math.PI * 2,
                collected: false
            });
        }
    }
}

// Main active loop running during runs
function loop() {
    if (gameState !== 'running') {
        loopRafId = null;
        return;
    }
    if (loopRafId) cancelAnimationFrame(loopRafId);
    loopRafId = requestAnimationFrame(loop);
    
    frame++;
    
    // Decay speed boost
    if (speedBoost > 0) {
        speedBoost -= 0.08;
        if (speedBoost < 0) speedBoost = 0;
    }
    
    const currentSpeed = speed + speedBoost;
    dist += currentSpeed / 10;
    score = Math.floor(dist);
    
    // Smoothly scale speed difficulty
    if (frame % 300 === 0 && speed < 22) {
        speed += 0.6;
    }

    spawnTimer -= currentSpeed;
    if (spawnTimer <= 0) {
        spawnWave();
        spawnTimer = 220 + Math.random() * 130;
    }

    update();
    render();
    updateHUD();
}

function update() {
    const currentSpeed = speed + speedBoost;
    // Camera shake decay
    if (camShake > 0) camShake *= 0.83;

    // Shift scrolling offsets (roadOff accumulates to allow custom modulos dynamically)
    roadOff += currentSpeed;
    poleOff = (poleOff + currentSpeed) % POLE_STEP;
    treeOff = (treeOff + currentSpeed) % TREE_STEP;

    // Increment environment Time-of-Day cycle
    if (typeof timeCycle !== 'undefined') {
        timeCycle++;
    }

    // Update character physics
    updatePlayer();

    // Update Catcher physics
    if (typeof updateCatcher !== 'undefined') {
        updateCatcher();
    }

    // Update Obstacles position & check collisions
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.wz -= currentSpeed;
        
        // Collsion check range: near the character
        if (!o.passed && o.wz <= P.wz + 50 && o.wz + o.len >= P.wz - 15) {
            // Only check collisions if not invincible
            if (P.invincT <= 0 && P.wy <= 85) {
                const lx = LANE_X[o.lane];
                if (Math.abs(P.wx - lx) < 55) {
                    let hit = false;
                    if (o.type === 'barrier') hit = P.wy < o.h;
                    else if (o.type === 'highbar') hit = !P.sliding;
                    else if (o.type === 'train') {
                        if (o.climbable) {
                            hit = false; // climbable train acts as ramp
                        } else {
                            hit = P.wy < o.h; // standard bullet train is wall
                        }
                    }
                    
                    if (hit) {
                        // Check if it's a side collision (grazing the side of an object already passing you)
                        if (o.wz < P.wz - 5) {
                            // Side collision/stumble!
                            P.lane = (typeof P.prevLane !== 'undefined') ? P.prevLane : P.lane;
                            P.stumbleT = 45;
                            sfx('stumble');
                            camShake = 5;
                            o.passed = true; // prevent duplicate trigger
                            
                            // Activate Catcher warning whistling
                            if (typeof C !== 'undefined') {
                                if (!C.active) {
                                    C.active = true;
                                    C.status = 'chasing';
                                    C.wz = 40; 
                                    C.wx = P.wx;
                                    C.lane = P.lane;
                                    C.statusT = 360; 
                                    sfx('whistle');
                                } else {
                                    // Stumbled again while catcher is active! Captured!
                                    gameOver();
                                    return;
                                }
                            }
                        } else {
                            // Head-on crash! Game Over
                            gameOver();
                            return;
                        }
                    }
                }
            }
        }
        // Remove trailing objects
        if (o.wz < NEAR_Z - o.len - 25) {
            obstacles.splice(i, 1);
        }
    }

    // Update Coins position & check collections
    for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.wz -= currentSpeed;
        c.spin += 0.07; // rotate coin

        if (!c.collected && Math.abs(c.wz - P.wz) < 30) {
            const lx = LANE_X[c.lane];
            if (Math.abs(P.wx - lx) < 45 && Math.abs(P.wy - c.wy) < 45) {
                c.collected = true;
                runCoins++;
                sfx('coin');
                
                // Explode spark particles on claim
                const sp = project(lx, c.wy, c.wz);
                for (let k = 0; k < 8; k++) {
                    const a = Math.random() * Math.PI * 2;
                    const v = Math.random() * 5 + 2;
                    particles.push({
                        x: sp.x,
                        y: sp.y,
                        vx: Math.cos(a) * v,
                        vy: Math.sin(a) * v,
                        life: 18,
                        maxL: 18,
                        col: 'rgba(253, 224, 71, 0.95)',
                        size: Math.random() * 3 + 1.5
                    });
                }
            }
        }
        if (c.wz < NEAR_Z - 25) {
            coins.splice(i, 1);
        }
    }

    // Particles physics
    updateParticles();

    // Floating sakura petals
    updateSakura();
}

function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    
    // 1. Apply camera shakes
    if (camShake > 0.4) {
        const dx = (Math.random() - 0.5) * camShake;
        const dy = (Math.random() - 0.5) * camShake;
        ctx.translate(dx, dy);
    }

    // Dynamic Camera roll (Screen rolls in the direction of lane shift for high-fidelity POV tracking)
    if (typeof camVelX !== 'undefined') {
        const targetRoll = camVelX * -0.0032; // Elastic roll sway
        ctx.translate(W / 2, H / 2);
        ctx.rotate(targetRoll);
        ctx.translate(-W / 2, -H / 2);
    }

    // 2. Draw static backgrounds
    drawSky(ctx);
    drawMountains(ctx);
    drawBuildings(ctx);
    drawRoad(ctx);
    drawRoadLines(ctx);

    // 3. Unified Depth Sorting Render Queue
    const queue = [];

    // Telephone poles (scroll towards camera with continuous sequence index)
    let poleIdx = 0;
    for (let z = NEAR_Z + POLE_STEP - poleOff; z < FAR_Z; z += POLE_STEP) {
        const currentIdx = poleIdx;
        queue.push({ z: z, draw: () => drawSinglePole(ctx, z, currentIdx) });
        poleIdx++;
    }

    // Sakura trees (scroll towards camera)
    for (let z = NEAR_Z + TREE_STEP - treeOff; z < FAR_Z; z += TREE_STEP) {
        queue.push({ z: z, draw: () => drawSingleTree(ctx, z) });
    }

    // Sidewalk Guard Rails (scroll towards camera)
    const railStepZ = 90;
    const railOff = typeof roadOff !== 'undefined' ? (roadOff % railStepZ) : 0;
    [-ROAD_HALF_W - 8, ROAD_HALF_W + 8].forEach(wx => {
        for (let z = NEAR_Z + railStepZ - railOff; z < FAR_Z; z += railStepZ) {
            queue.push({ z: z, draw: () => drawSingleGuardRail(ctx, wx, z, railStepZ) });
        }
    });

    // Active coins
    coins.forEach(c => {
        if (c.collected) return;
        let coinSortZ = c.wz;
        if (c.onTrain && typeof obstacles !== 'undefined') {
            const underTrain = obstacles.find(o => 
                o.type === 'train' && 
                o.lane === c.lane && 
                o.wz <= c.wz + 10 && 
                (o.wz + o.len) >= c.wz - 10
            );
            if (underTrain) {
                coinSortZ = Math.min(coinSortZ, underTrain.wz - 1);
            }
        }
        queue.push({ z: coinSortZ, draw: () => drawSingleCoin(ctx, c) });
    });

    // Active obstacles
    obstacles.forEach(o => {
        queue.push({ z: o.wz, draw: () => drawSingleObstacle(ctx, o) });
    });

    // Character model
    let playerSortZ = P.wz;
    if (typeof obstacles !== 'undefined') {
        const underTrain = obstacles.find(o => 
            o.type === 'train' && 
            o.lane === P.lane && 
            o.wz <= P.wz + 10 && 
            (o.wz + o.len) >= P.wz - 10
        );
        if (underTrain) {
            playerSortZ = Math.min(playerSortZ, underTrain.wz - 1);
        }
    }
    queue.push({ z: playerSortZ, draw: () => drawPlayer(ctx) });

    // Catcher model (chasing behind player)
    if (typeof C !== 'undefined' && C.active) {
        let catcherSortZ = C.wz;
        if (typeof obstacles !== 'undefined') {
            const underTrainC = obstacles.find(o => 
                o.type === 'train' && 
                o.lane === C.lane && 
                o.wz <= C.wz + 10 && 
                (o.wz + o.len) >= C.wz - 10
            );
            if (underTrainC) {
                catcherSortZ = Math.min(catcherSortZ, underTrainC.wz - 1);
            }
        }
        queue.push({ z: catcherSortZ, draw: () => drawCatcher(ctx) });
    }

    // Render depth-sorted queue from farthest depth to front
    queue.sort((a, b) => b.z - a.z);
    queue.forEach(item => item.draw());

    // 4. Overlays & overlays particles
    drawParticles(ctx);
    drawSakura(ctx);
    drawSpeedLines(ctx, speed);
    drawHUD(ctx);

    ctx.restore();
}

// Canvas UI details
function drawHUD(ctx) {
    ctx.save();

    // Score board window card
    ctx.fillStyle = 'rgba(6, 4, 16, 0.65)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 200, 74, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 183, 197, 0.18)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 200, 74, 12);
    ctx.fill();

    ctx.fillStyle = 'rgba(167, 139, 250, 0.8)';
    ctx.font = 'bold 10px "Outfit"';
    ctx.letterSpacing = '2px';
    ctx.fillText('DISTANCE', 22, 32);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Noto Sans JP", sans-serif';
    ctx.fillText(score + 'm', 22, 56);

    ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.font = 'bold 10px "Outfit"';
    ctx.letterSpacing = '2px';
    ctx.fillText('COINS', 140, 32);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = '#ffd95a';
    ctx.font = 'bold 22px "Noto Sans JP", sans-serif';
    ctx.fillText(runCoins, 140, 56);

    // Speed bar (Bottom left)
    const spFrac = Math.min((speed - 7) / 15, 1);
    ctx.fillStyle = 'rgba(6, 4, 16, 0.6)';
    ctx.beginPath();
    ctx.roundRect(12, H - 40, 170, 28, 8);
    ctx.fill();

    if (spFrac > 0) {
        ctx.fillStyle = 'rgba(110, 231, 183, 0.22)';
        ctx.beginPath();
        ctx.roundRect(12, H - 40, 170 * spFrac, 28, 8);
        ctx.fill();
    }
    ctx.fillStyle = 'rgba(110, 231, 183, 0.9)';
    ctx.font = 'bold 10px "Outfit"';
    ctx.letterSpacing = '1px';
    ctx.fillText(`SPEED  ${speed.toFixed(1)}x`, 20, H - 22);

    // active powers overlay cards
    drawHUDPowerups(ctx, 96);

    ctx.restore();
}

// Background idle render loops (runs on start and game-over overlays)
function idleRender() {
    if (gameState === 'running') {
        idleRafId = null;
        return;
    }

    // Gentle scroll of background environment scenery (roadOff accumulates for custom modulos)
    roadOff += 1.6;
    poleOff = (poleOff + 1.6) % POLE_STEP;
    treeOff = (treeOff + 1.6) % TREE_STEP;

    // Increment environment Time-of-Day cycle during idle screens
    if (typeof timeCycle !== 'undefined') {
        timeCycle += 0.5;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    drawSky(ctx);
    drawMountains(ctx);
    drawBuildings(ctx);
    drawRoad(ctx);
    drawRoadLines(ctx);

    // Render scenery
    const queue = [];
    let poleIdx = 0;
    for (let z = NEAR_Z + POLE_STEP - poleOff; z < FAR_Z; z += POLE_STEP) {
        const currentIdx = poleIdx;
        queue.push({ z, draw: () => drawSinglePole(ctx, z, currentIdx) });
        poleIdx++;
    }
    for (let z = NEAR_Z + TREE_STEP - treeOff; z < FAR_Z; z += TREE_STEP) {
        queue.push({ z, draw: () => drawSingleTree(ctx, z) });
    }

    // Sidewalk Guard Rails
    const railStepZ = 90;
    const railOff = typeof roadOff !== 'undefined' ? (roadOff % railStepZ) : 0;
    [-ROAD_HALF_W - 8, ROAD_HALF_W + 8].forEach(wx => {
        for (let z = NEAR_Z + railStepZ - railOff; z < FAR_Z; z += railStepZ) {
            queue.push({ z: z, draw: () => drawSingleGuardRail(ctx, wx, z, railStepZ) });
        }
    });
    queue.sort((a, b) => b.z - a.z);
    queue.forEach(item => item.draw());

    // Falling cherry blossom leaves
    updateSakura();
    drawSakura(ctx);
    ctx.restore();

    if (idleRafId) cancelAnimationFrame(idleRafId);
    idleRafId = requestAnimationFrame(idleRender);
}

// Trigger idle rendering when initialized
idleRender();
