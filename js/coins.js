// Coins: 3D rotating Ethereum diamonds with real-time vector shading
let coins = [];

function drawSingleCoin(ctx, c) {
    if (typeof project === 'undefined') return;
    const p = project(LANE_X[c.lane], c.wy, c.wz);
    if (p.y < HORIZON_Y || p.s < 0.04) return;
    
    const r = Math.max(2.5, 14.5 * p.s);
    ctx.save();
    ctx.translate(p.x, p.y);

    // 1. Celestial Bloom Halo (Additive screen composite)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glowR = r * 2.6;
    const glowG = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glowG.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
    glowG.addColorStop(0.35, 'rgba(253, 224, 71, 0.16)');
    glowG.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glowG;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── 3D ETHEREUM OCTAHEDRON DRAWING PIPELINE ──
    // Points rotated around the Y-axis by angle `c.spin`
    const theta = c.spin;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // Octahedron heights and radii
    const h1 = r * 0.95;  // Top pyramid peak
    const h2 = r * 0.12;  // Mid belt drop
    const h3 = r * 0.85;  // Bottom peak
    const rad = r * 0.65; // Belt width

    // Vertices (Projected 3D coordinates onto local 2D space)
    const top = { x: 0, y: -h1 };
    const bottom = { x: 0, y: h3 };
    
    // 4 Mid Belt vertices (Belt X coordinates sway as Y-rotation angles change)
    const v0 = { x: rad * cosT, y: -h2 };              // Front-Right
    const v1 = { x: rad * -sinT, y: -h2 + r * 0.08 };   // Back-Right (slight slant)
    const v2 = { x: -rad * cosT, y: -h2 };             // Back-Left
    const v3 = { x: rad * sinT, y: -h2 - r * 0.08 };    // Front-Left

    // Shading presets for gold metallic facets (dependent on light direction)
    const gold0 = '#fffbeb'; // Specular highlight
    const gold1 = '#fde047'; // Bright gold
    const gold2 = '#eab308'; // Mid gold shade
    const gold3 = '#ca8a04'; // Dark shadow gold
    const gold4 = '#854d0e'; // Deep bronze outline

    // Draw the 4 upper facets
    drawFacet(ctx, top, v0, v3, sinT > 0 ? gold1 : gold2, gold4); // Front-Right
    drawFacet(ctx, top, v3, v2, sinT > 0 ? gold0 : gold1, gold4); // Front-Left
    drawFacet(ctx, top, v2, v1, sinT > 0 ? gold3 : gold2, gold4); // Back-Left
    drawFacet(ctx, top, v1, v0, sinT > 0 ? gold2 : gold3, gold4); // Back-Right

    // Draw the 4 lower facets
    drawFacet(ctx, bottom, v0, v3, sinT > 0 ? gold2 : gold3, gold4);
    drawFacet(ctx, bottom, v3, v2, sinT > 0 ? gold1 : gold2, gold4);
    drawFacet(ctx, bottom, v2, v1, sinT > 0 ? gold3 : gold4, gold4);
    drawFacet(ctx, bottom, v1, v0, sinT > 0 ? gold2 : gold1, gold4);

    ctx.restore();
}

// Helper to draw a single shaded facet with borders
function drawFacet(ctx, p1, p2, p3, fillCol, strokeCol) {
    ctx.fillStyle = fillCol;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}
