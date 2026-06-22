// Constants and Config for Kaze Runner
const W = 900;
const H = 520;
const HORIZON_Y = 165;           // pixels from top
const VP_X = W / 2;              // vanishing point x (center)
const NEAR_Z = 65;               // closest depth (near clip, world units)
const FAR_Z = 1600;              // farthest depth
const FOCAL = 240;               // perspective focal length
const CAM_HEIGHT = 125;          // camera height above road in world units
const ROAD_HALF_W = 155;         // half road width in world units

// Lane world X offsets (3 lanes: left, center, right)
const LANE_X = [-110, 0, 110];

const POLE_WX = 220;             // world X (outside road edge)
const POLE_H = 200;              // world height of pole
const POLE_STEP = 360;           // world Z spacing between poles (less cluttered)

const TREE_WX = 205;             // world X (sidewalk edge)
const TREE_STEP = 360;           // spacing for Sakura trees (prevent canopy overlapping)

// Dynamic backend selection: Use localhost for local play, and live URL on production (Vercel)
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://kaze-runner-backend.onrender.com';
