// Audio System using Web Audio API
let AC = null;

function ensureAudio() {
    if (!AC) {
        AC = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function beep(freq, type, dur, vol = 0.15) {
    if (!AC || AC.state === 'closed') return;
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.connect(g);
    g.connect(AC.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, AC.currentTime);
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.linearRampToValueAtTime(0, AC.currentTime + dur);
    o.start();
    o.stop(AC.currentTime + dur);
}

function sfx(t) {
    ensureAudio();
    if (t === 'coin') {
        beep(1047, 'sine', .07, .12);
        setTimeout(() => beep(1319, 'sine', .09, .1), 55);
    } else if (t === 'jump') {
        beep(400, 'triangle', .05, .1);
        setTimeout(() => beep(540, 'triangle', .1, .08), 35);
    } else if (t === 'slide') {
        beep(200, 'sawtooth', .2, .1);
    } else if (t === 'crash') {
        [120, 90, 65].forEach((f, i) => setTimeout(() => {
            if (!AC) return;
            const b = AC.createOscillator();
            const g = AC.createGain();
            b.connect(g);
            g.connect(AC.destination);
            b.type = 'sawtooth';
            b.frequency.value = f;
            g.gain.setValueAtTime(.25, AC.currentTime);
            g.gain.linearRampToValueAtTime(0, AC.currentTime + .22);
            b.start();
            b.stop(AC.currentTime + .22);
        }, i * 100));
    } else if (t === 'over') {
        [390, 370, 350, 330].forEach((f, i) => setTimeout(() => beep(f, 'triangle', .22, .12), i * 160));
    } else if (t === 'whistle') {
        beep(780, 'sine', 0.12, 0.2);
        setTimeout(() => beep(980, 'sine', 0.12, 0.2), 60);
        setTimeout(() => beep(880, 'sine', 0.18, 0.2), 120);
    } else if (t === 'stumble') {
        beep(180, 'sawtooth', 0.1, 0.25);
        setTimeout(() => beep(130, 'sawtooth', 0.15, 0.2), 50);
    } else if (t === 'slap') {
        beep(280, 'sawtooth', 0.12, 0.35);
        setTimeout(() => beep(650, 'sawtooth', 0.08, 0.25), 20);
    }
}
