// Particle System for sparks, dust, and visual impacts
let particles = [];

function burst(isJump) {
    if (typeof P === 'undefined' || typeof project === 'undefined') return;
    const p = project(P.wx, P.wy, P.wz);
    
    // Aesthetic upgrade: glowing violet/blue sparks for jump, rose/sakura energy for slides/crashes
    const col = isJump ? 'rgba(167, 139, 250, 0.95)' : 'rgba(251, 113, 133, 0.95)';
    const numParticles = isJump ? 12 : 35;
    
    for (let i = 0; i < numParticles; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * (isJump ? 6 : 12) + 2;
        particles.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - (isJump ? 3 : 0),
            life: isJump ? 22 : 45,
            maxL: isJump ? 22 : 45,
            col: col,
            size: Math.random() * 4.5 + 1.5
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity drop
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles(ctx) {
    ctx.save();
    // Simulate additive blend bloom for realistic sparks
    ctx.globalCompositeOperation = 'screen';
    particles.forEach(p => {
        const t = p.life / p.maxL;
        ctx.globalAlpha = t * 0.9;
        
        // Spark core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.size * t) * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Spark colored halo glow
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}
