// ============================================================
//  GENESIS LAB - Cloning Facility Escape
//  Full game engine in vanilla JS + Canvas
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ── Global State ─────────────────────────────────────────────
const TOTAL_LEVELS = 15;
const BOSS_EVERY = 5; // boss fight every Nth level
let score = 0, lives = 5, bones = 0, currentLevel = 1;
let gameRunning = false, gameOver = false;
let keys = {};
let particles = [];
let clouds = [];
let bgStars = [];
let camera = {x: 0, y: 0};
let boss = null;           // active boss instance on boss levels
let bossProjectiles = [];  // fire / spike / vine projectiles

// ── Skin / Shop System ───────────────────────────────────────
// Each skin is a palette swap of the dino. "rainbow" is special: cycles hue over time.
const SKINS = [
    { id: 'classic', name: 'Classic Rex',  emoji: '🦖', cost: 0,
      mid: '#3aaa3a', dark: '#2d8a2d', darker: '#1a6b1a', belly: '#90ee90' },
    { id: 'azure',   name: 'Azure Raptor', emoji: '🔷', cost: 25,
      mid: '#3a8aee', dark: '#2d6fc9', darker: '#1a4a8a', belly: '#aac4f0' },
    { id: 'crimson', name: 'Crimson Fang', emoji: '🔥', cost: 50,
      mid: '#ee3a3a', dark: '#c92d2d', darker: '#8a1a1a', belly: '#f0aaaa' },
    { id: 'golden',  name: 'Golden Tyrant',emoji: '⭐', cost: 100,
      mid: '#ffd700', dark: '#cfa800', darker: '#8a6f00', belly: '#fff0aa' },
    { id: 'shadow',  name: 'Shadow Stalker',emoji: '🌑', cost: 150,
      mid: '#4a4a55', dark: '#2a2a33', darker: '#111',    belly: '#8a8a99' },
    { id: 'rainbow', name: 'Prismarex',    emoji: '🌈', cost: 300,
      mid: '#ff00ff', dark: '#cc00cc', darker: '#880088', belly: '#ffccff', rainbow: true },
];

const SAVE_KEY = 'dinoland_save_v1';
function defaultSave() {
    return { bones: 0, owned: ['classic'], equipped: 'classic' };
}
let save = defaultSave();

function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) { save = defaultSave(); return; }
        const data = JSON.parse(raw);
        save = {
            bones: Math.max(0, parseInt(data.bones, 10) || 0),
            owned: Array.isArray(data.owned) && data.owned.length ? data.owned : ['classic'],
            equipped: typeof data.equipped === 'string' ? data.equipped : 'classic',
        };
        if (!save.owned.includes('classic')) save.owned.push('classic');
        if (!save.owned.includes(save.equipped)) save.equipped = 'classic';
    } catch (_) { save = defaultSave(); }
}
function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {}
}
function getSkin(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
function currentSkin() { return getSkin(save.equipped); }
loadSave();
bones = save.bones; // wallet persists across runs

// ── Input ─────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Utility ───────────────────────────────────────────────────
function rand(a, b) { return Math.random() * (b - a) + a; }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Particle System ───────────────────────────────────────────
function spawnParticles(x, y, color, count = 8, speed = 3) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: rand(-speed, speed),
            vy: rand(-speed * 1.5, -speed * 0.3),
            life: 1, decay: rand(0.03, 0.07),
            size: rand(3, 7),
            color
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.15;
        p.life -= p.decay;
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

// ── Level Themes (Cloning Facility) ───────────────────────────
const THEMES = {
    lab: {
        name: "Sterile Lab",
        style: 'lab',
        bgColors: ['#04111a', '#082030', '#02060a'],
        groundColor: '#36404a',
        platformColor: '#4a5560',
        cloudColor: 'rgba(180,255,230,',
        enemyMix: ['raptor','raptor','pterodactyl','triceratops'],
        bossName: 'Lab Prototype',
        bossKind: 'triceratops',
        bossColor: '#bcdce6',
    },
    dome: {
        name: "Bio-Dome",
        style: 'dome',
        bgColors: ['#001a14', '#003322', '#001911'],
        groundColor: '#1e3d2a',
        platformColor: '#2f5a3a',
        cloudColor: 'rgba(140,255,180,',
        enemyMix: ['raptor','pterodactyl','raptor','triceratops','pterodactyl'],
        bossName: 'Mutant Hybrid',
        bossKind: 'raptor',
        bossColor: '#5fff7f',
    },
    hazard: {
        name: "Hazard Zone",
        style: 'hazard',
        bgColors: ['#1a0008', '#3d0011', '#1a0500'],
        groundColor: '#4a1a1a',
        platformColor: '#6b2222',
        cloudColor: 'rgba(255,140,140,',
        enemyMix: ['raptor','pterodactyl','pterodactyl','triceratops'],
        bossKind: 'pterodactyl',
        bossName: 'Evil Clone',
        bossColor: '#5b0033',
        bossDarkMirror: true,
    },
};

const THEME_ORDER = ['lab','dome','hazard'];

// ── Story / Cutscenes ─────────────────────────────────────────
// Each page: { bg: gradient key, emoji, text }
const CUTSCENES = {
    intro: [
        { bg: 'lab',    emoji: '🧪⚡',   text: 'Cloning Sector 7. 03:41 AM.\nRoutine genome sequencing run, scheduled for tonight.' },
        { bg: 'flash',  emoji: '💥',     text: 'A power surge tears through the chamber.\nThe synthesizer locks open. Something climbs out.' },
        { bg: 'lab',    emoji: '😈🧬',   text: 'It looks exactly like you.\nBut it grins. Then it tears the lab apart.' },
        { bg: 'lab',    emoji: '🔧',     text: 'Before fleeing into the facility,\nit scatters the clone-machine parts across every sector.' },
        { bg: 'dome',   emoji: '🦖',     text: '...and unseals every mutant specimen still in containment.' },
        { bg: 'hazard', emoji: '🌍',     text: 'If you don\'t recover the parts and stop the mutants,\nyour evil twin walks out and takes the world.' },
        { bg: 'hero',   emoji: '🏃',     text: 'Time to clean up your own mess.' },
    ],
    sector5: [
        { bg: 'lab',    emoji: '⚙️',     text: 'Part 1 of 3 recovered.\nThe mutants are pushing harder. Your clone is watching.' },
    ],
    sector10: [
        { bg: 'dome',   emoji: '⚙️⚙️',   text: 'Part 2 of 3 recovered.\nYour clone left these for the strongest mutants. He wants you to fail.' },
    ],
    finalApproach: [
        { bg: 'hazard', emoji: '🩸',     text: 'The final part is in the wrecked containment vault.\nHe\'s waiting for you there.' },
    ],
    win: [
        { bg: 'hazard', emoji: '⚙️⚙️⚙️', text: 'All three parts recovered.\nThe clone machine boots up. Your evil twin... unmade.' },
        { bg: 'hero',   emoji: '😌',     text: 'Mutants neutralized. Facility quiet.\nYou make a note in the lab log: NEVER AGAIN.' },
        { bg: 'lab',    emoji: '🤔🧪',   text: '...maybe just one more experiment couldn\'t hurt?' },
    ],
};

let cutsceneActive = false;
let cutscenePages = null;
let cutsceneIdx = 0;
let cutsceneCharIdx = 0;
let cutsceneTickN = 0;
let cutsceneCallback = null;
let _cutsceneRaf = null;
const CUTSCENES_SEEN_KEY = 'genesislab_cutscenes_seen_v1';
function cutsceneSeen(key) {
    try {
        const seen = JSON.parse(localStorage.getItem(CUTSCENES_SEEN_KEY) || '{}');
        return !!seen[key];
    } catch (e) { return false; }
}
function markCutsceneSeen(key) {
    try {
        const seen = JSON.parse(localStorage.getItem(CUTSCENES_SEEN_KEY) || '{}');
        seen[key] = true;
        localStorage.setItem(CUTSCENES_SEEN_KEY, JSON.stringify(seen));
    } catch (e) {}
}

function playCutscene(pages, onDone, options) {
    options = options || {};
    cutscenePages = pages;
    cutsceneIdx = 0;
    cutsceneCharIdx = 0;
    cutsceneTickN = 0;
    cutsceneActive = true;
    cutsceneCallback = onDone || null;
    renderCutsceneFrame();
    const el = document.getElementById('cutscene-overlay');
    if (el) el.style.display = 'flex';
    if (_cutsceneRaf) cancelAnimationFrame(_cutsceneRaf);
    _cutsceneRaf = requestAnimationFrame(cutsceneLoop);
}

function cutsceneLoop() {
    if (!cutsceneActive) return;
    cutsceneTickN++;
    const page = cutscenePages[cutsceneIdx];
    if (page && cutsceneCharIdx < page.text.length && cutsceneTickN % 2 === 0) {
        cutsceneCharIdx++;
        const t = document.getElementById('cs-text');
        if (t) t.textContent = page.text.slice(0, cutsceneCharIdx);
    }
    _cutsceneRaf = requestAnimationFrame(cutsceneLoop);
}

function renderCutsceneFrame() {
    const el = document.getElementById('cutscene-overlay');
    if (!el) return;
    const page = cutscenePages[cutsceneIdx];
    const last = cutsceneIdx === cutscenePages.length - 1;
    el.innerHTML = `
        <div class="cs-bg cs-bg-${page.bg}"></div>
        <div class="cs-panel">
            <div class="cs-emoji">${page.emoji}</div>
            <pre class="cs-text" id="cs-text"></pre>
            <div class="cs-controls">
                <button id="cs-skip" class="cs-btn-skip">SKIP STORY ▶▶</button>
                <button id="cs-next" class="cs-btn-next">${last ? 'BEGIN ▶' : 'NEXT ▶'}</button>
            </div>
            <div class="cs-progress">${cutsceneIdx + 1} / ${cutscenePages.length}</div>
        </div>`;
    document.getElementById('cs-skip').onclick = endCutscene;
    document.getElementById('cs-next').onclick = nextCutscenePage;
    cutsceneCharIdx = 0;
}

function nextCutscenePage() {
    const page = cutscenePages[cutsceneIdx];
    if (cutsceneCharIdx < page.text.length) {
        // Reveal full text immediately on the first click
        cutsceneCharIdx = page.text.length;
        const t = document.getElementById('cs-text');
        if (t) t.textContent = page.text;
        return;
    }
    cutsceneIdx++;
    if (cutsceneIdx >= cutscenePages.length) {
        endCutscene();
    } else {
        renderCutsceneFrame();
    }
}

function endCutscene() {
    cutsceneActive = false;
    if (_cutsceneRaf) cancelAnimationFrame(_cutsceneRaf);
    _cutsceneRaf = null;
    const el = document.getElementById('cutscene-overlay');
    if (el) el.style.display = 'none';
    const cb = cutsceneCallback;
    cutsceneCallback = null;
    if (cb) cb();
}
function isBossLevelIdx(i) { return i % BOSS_EVERY === 0; }
function nonBossPosition(idx) {
    // 1-based position of `idx` in the sequence of non-boss levels
    return idx - Math.floor(idx / BOSS_EVERY);
}
function themeKeyForLevel(idx) {
    // Boss levels inherit the theme of the non-boss level immediately before them,
    // so a run through lab -> dome -> hazard -> lab -> BOSS gives a lab boss, etc.
    const refIdx = isBossLevelIdx(idx) ? idx - 1 : idx;
    const pos = nonBossPosition(refIdx); // 1..N
    return THEME_ORDER[(pos - 1) % THEME_ORDER.length];
}
function isBossLevel(idx) { return idx % BOSS_EVERY === 0; }

// ── Procedural Level Generator ────────────────────────────────
function generateLevel(idx) {
    if (isBossLevel(idx)) return generateBossLevel(idx);

    const theme = THEMES[themeKeyForLevel(idx)];
    // Each level longer than the last (capped).
    const width = Math.min(2400 + idx * 140, 4800);

    // ── Ground: mostly continuous, with occasional gaps to jump over ──
    const platforms = [];
    {
        let x = 0;
        while (x < width) {
            // First/last ground sections are always solid (safe start + safe portal area)
            const canGap = x > 320 && x < width - 400 && Math.random() < 0.28;
            if (canGap) {
                const gap = randInt(70, 130);
                x += gap;
                if (x >= width) break;
            }
            const len = randInt(220, 520);
            const segW = Math.min(len, width - x);
            platforms.push({x: x, y: 440, w: segW, h: 60});
            x += segW;
        }
    }

    // ── Floating platforms (2 rough altitude bands) ──
    const bandLow = {min: 300, max: 380};
    const bandHigh = {min: 150, max: 250};
    const floatCount = Math.floor(width / 180);
    const floatPlats = [];
    for (let i = 0; i < floatCount; i++) {
        const band = Math.random() < 0.55 ? bandLow : bandHigh;
        const pw = randInt(90, 160);
        const px = clamp(80 + (i * (width - 200) / floatCount) + rand(-40, 40), 40, width - pw - 40);
        const py = Math.round(rand(band.min, band.max));
        // Avoid stacking directly over another float platform
        if (floatPlats.some(q => Math.abs(q.x - px) < 40 && Math.abs(q.y - py) < 40)) continue;
        floatPlats.push({x: px, y: py, w: pw, h: 18});
    }
    platforms.push(...floatPlats);

    // ── Enemies (more as levels progress) ──
    const enemies = [];
    const enemyCount = Math.floor(width / 340) + Math.floor(idx / 3);
    for (let i = 0; i < enemyCount; i++) {
        const type = theme.enemyMix[randInt(0, theme.enemyMix.length - 1)];
        if (type === 'pterodactyl') {
            const ex = rand(300, width - 200);
            enemies.push({type, x: ex, y: rand(90, 220), range: randInt(110, 220)});
        } else {
            // Ground patrollers - place on a random ground segment
            const grounds = platforms.filter(p => p.y === 440 && p.w > 140);
            const g = grounds[randInt(0, grounds.length - 1)];
            const ex = rand(g.x + 40, g.x + g.w - 80);
            enemies.push({type, x: ex, y: 400});
        }
    }

    // ── Collectibles: one above most floating platforms, plus ground trail ──
    const collectibles = [];
    floatPlats.forEach(p => {
        if (Math.random() < 0.8) {
            collectibles.push({
                type: Math.random() < 0.75 ? 'bone' : 'egg',
                x: p.x + p.w / 2 - 10,
                y: p.y - 26,
            });
        }
    });
    // Ground-level bones scattered as a breadcrumb trail
    const groundBones = Math.floor(width / 220);
    for (let i = 0; i < groundBones; i++) {
        collectibles.push({
            type: 'bone',
            x: 120 + i * (width - 240) / groundBones + rand(-30, 30),
            y: 408,
        });
    }

    // ── Random portal: pick a random floating platform in the last 30% ──
    const portalCandidates = floatPlats.filter(p => p.x + p.w > width * 0.65);
    let portalPos;
    if (portalCandidates.length > 0) {
        const p = portalCandidates[randInt(0, portalCandidates.length - 1)];
        portalPos = {x: p.x + p.w / 2 - 22, y: p.y - 62};
    } else {
        // Fallback: on ground near the end
        portalPos = {x: width - 100, y: 380};
    }

    return {
        name: `${theme.name} ${idx}`,
        theme: theme,
        bgColors: theme.bgColors,
        groundColor: theme.groundColor,
        platformColor: theme.platformColor,
        width,
        platforms,
        enemies,
        collectibles,
        portal: portalPos,
        playerStart: {x: 50, y: 380},
        isBoss: false,
        idx,
    };
}

function generateBossLevel(idx) {
    const theme = THEMES[themeKeyForLevel(idx)];
    const width = 1400;
    // Arena: solid ground + symmetric platforms for dodging
    const platforms = [
        {x: 0,    y: 440, w: width, h: 60},
        {x: 120,  y: 340, w: 140,   h: 18},
        {x: width - 260, y: 340, w: 140, h: 18},
        {x: width / 2 - 80, y: 250, w: 160, h: 18},
        {x: 330,  y: 180, w: 120, h: 18},
        {x: width - 450, y: 180, w: 120, h: 18},
    ];
    const bossDef = {
        kind: theme.bossKind,
        name: theme.bossName,
        color: theme.bossColor,
        hp: 4 + Math.floor(idx / BOSS_EVERY) * 2, // bosses get tougher
        themeKey: themeKeyForLevel(idx),
        x: width / 2 - 55,
        y: 290,
    };
    return {
        name: `BOSS: ${theme.bossName}`,
        theme: theme,
        bgColors: theme.bgColors,
        groundColor: theme.groundColor,
        platformColor: theme.platformColor,
        width,
        platforms,
        enemies: [],
        collectibles: [
            {type: 'bone', x: 200, y: 408},
            {type: 'bone', x: width - 220, y: 408},
        ],
        boss: bossDef,
        // portal spawned dynamically after boss defeated (center of arena)
        portal: null,
        playerStart: {x: 50, y: 380},
        isBoss: true,
        idx,
    };
}

// ── Player ────────────────────────────────────────────────────
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 38; this.h = 48;
        this.vx = 0; this.vy = 0;
        this.onGround = false;
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.speed = 4.5;
        this.jumpPower = -13;
        this.facing = 1; // 1=right, -1=left
        this.frame = 0;
        this.frameTimer = 0;
        this.state = 'idle'; // idle, run, jump, fall, stomp
        this.invincible = 0;
        this.stompCooldown = 0;
        this.tailWag = 0;
        // Palette swap via equipped shop skin
        this.skin = currentSkin();
        this.skinTime = 0; // used by rainbow skin
    }

    update(platforms) {
        // Horizontal movement
        let moving = false;
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.vx = -this.speed;
            this.facing = -1;
            moving = true;
        } else if (keys['ArrowRight'] || keys['KeyD']) {
            this.vx = this.speed;
            this.facing = 1;
            moving = true;
        } else {
            this.vx *= 0.8;
        }

        // Jump
        if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && !this._jumpHeld) {
            if (this.jumpCount < this.maxJumps) {
                this.vy = this.jumpPower;
                this.jumpCount++;
                this._jumpHeld = true;
                spawnParticles(this.x + this.w/2, this.y + this.h, '#aaddff', 6, 2);
            }
        }
        if (!keys['Space'] && !keys['ArrowUp'] && !keys['KeyW']) {
            this._jumpHeld = false;
        }

        // Variable jump height
        if (this._jumpHeld && this.vy < -4 && !(keys['Space'] || keys['ArrowUp'] || keys['KeyW'])) {
            this.vy *= 0.9;
        }

        // Gravity
        this.vy += 0.6;
        if (this.vy > 16) this.vy = 16;

        // Move X
        this.x += this.vx;
        this.x = clamp(this.x, 0, (levelDef ? levelDef.width : W) - this.w);

        // Platform collision X (basic)
        // Move Y
        this.y += this.vy;

        // Platform collisions
        this.onGround = false;
        for (let p of platforms) {
            if (rectOverlap({x:this.x, y:this.y, w:this.w, h:this.h}, p)) {
                // From above
                if (this.vy >= 0 && this.y + this.h - this.vy <= p.y + 5) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                    this.onGround = true;
                    this.jumpCount = 0;
                }
                // From below
                else if (this.vy < 0 && this.y - this.vy >= p.y + p.h - 5) {
                    this.y = p.y + p.h;
                    this.vy = 0;
                }
                // From sides
                else {
                    if (this.vx > 0) this.x = p.x - this.w;
                    else if (this.vx < 0) this.x = p.x + p.w;
                    this.vx = 0;
                }
            }
        }

        // Fall off screen
        if (this.y > H + 50) {
            this.die();
        }

        // Cooldowns
        if (this.invincible > 0) this.invincible--;
        if (this.stompCooldown > 0) this.stompCooldown--;

        // State
        if (!this.onGround) {
            this.state = this.vy < 0 ? 'jump' : 'fall';
        } else if (moving) {
            this.state = 'run';
        } else {
            this.state = 'idle';
        }

        // Animation
        this.frameTimer++;
        if (this.state === 'run' && this.frameTimer > 8) {
            this.frame = (this.frame + 1) % 4;
            this.frameTimer = 0;
        } else if (this.state === 'idle' && this.frameTimer > 20) {
            this.frame = (this.frame + 1) % 2;
            this.frameTimer = 0;
        }

        this.tailWag += 0.12;
    }

    die() {
        spawnParticles(this.x + this.w/2, this.y + this.h/2, '#ff4444', 15, 5);
        lives--;
        updateHUD();
        // Respawn at the nearest ground-platform checkpoint so we don't chain-die in gaps
        const candidates = (platforms || []).filter(p => p.y === 440 && p.x + p.w > this.x - 60);
        const cp = candidates.length ? candidates[0] : {x: 50, y: 380};
        this.x = clamp(cp.x + 40, 20, levelDef.width - this.w - 20);
        this.y = (cp.y || 440) - this.h - 10;
        this.vx = 0; this.vy = 0;
        this.invincible = 90;
        if (lives <= 0) {
            triggerGameOver();
        } else {
            showMessage('⚠️ SPECIMEN HIT!', 'Vitals dropping — keep moving!', false);
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        if (this.facing === -1) ctx.scale(-1, 1);

        // Blink when invincible
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        const bob = this.state === 'run' ? Math.sin(this.frame * 1.5) * 2 : 0;
        const idleBob = this.state === 'idle' ? Math.sin(this.tailWag * 0.5) * 1.5 : 0;
        ctx.translate(0, bob + idleBob);

        // ── Resolve skin palette (rainbow cycles hue over time) ──
        this.skinTime += 0.05;
        let PAL_MID, PAL_DARK, PAL_DARKER, PAL_BELLY;
        if (this.skin && this.skin.rainbow) {
            const h = (this.skinTime * 30) % 360;
            PAL_MID    = `hsl(${h},80%,55%)`;
            PAL_DARK   = `hsl(${(h+20)%360},80%,42%)`;
            PAL_DARKER = `hsl(${(h+40)%360},75%,28%)`;
            PAL_BELLY  = `hsl(${(h+180)%360},80%,78%)`;
        } else {
            const s = this.skin || SKINS[0];
            PAL_MID    = s.mid;    PAL_DARK   = s.dark;
            PAL_DARKER = s.darker; PAL_BELLY  = s.belly;
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, this.h/2 + 3, 16, 5, 0, 0, Math.PI*2);
        ctx.fill();

        // Tail
        const tailWag = Math.sin(this.tailWag) * 0.3;
        ctx.save();
        ctx.translate(-this.w/2 + 2, 2);
        ctx.rotate(tailWag);
        ctx.fillStyle = PAL_DARK;
        ctx.beginPath();
        ctx.ellipse(-8, 4, 14, 7, -0.4, 0, Math.PI*2);
        ctx.fill();
        // Tail tip
        ctx.fillStyle = PAL_DARKER;
        ctx.beginPath();
        ctx.ellipse(-18, 8, 7, 4, -0.6, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // Body
        ctx.fillStyle = PAL_MID;
        ctx.beginPath();
        ctx.ellipse(0, 4, 16, 20, 0, 0, Math.PI*2);
        ctx.fill();

        // Belly
        ctx.fillStyle = PAL_BELLY;
        ctx.beginPath();
        ctx.ellipse(4, 8, 9, 14, 0.2, 0, Math.PI*2);
        ctx.fill();

        // Neck + Head
        ctx.fillStyle = PAL_MID;
        ctx.beginPath();
        ctx.ellipse(8, -14, 10, 14, 0.3, 0, Math.PI*2);
        ctx.fill();

        // Head
        ctx.fillStyle = PAL_MID;
        ctx.beginPath();
        ctx.ellipse(16, -22, 13, 10, 0.15, 0, Math.PI*2);
        ctx.fill();

        // Snout
        ctx.fillStyle = PAL_DARK;
        ctx.beginPath();
        ctx.ellipse(26, -20, 9, 6, 0.1, 0, Math.PI*2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(20, -26, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(21, -26, 2, 0, Math.PI*2);
        ctx.fill();
        // Pupil shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(22, -27, 0.8, 0, Math.PI*2);
        ctx.fill();

        // Nostril
        ctx.fillStyle = PAL_DARKER;
        ctx.beginPath();
        ctx.arc(30, -22, 1.5, 0, Math.PI*2);
        ctx.fill();

        // Teeth (when running)
        if (this.state === 'run') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(26, -17, 3, 3);
            ctx.fillRect(30, -17, 3, 3);
        }

        // Arms (tiny T-Rex arms!)
        ctx.fillStyle = PAL_DARK;
        // Upper arm
        ctx.beginPath();
        ctx.ellipse(14, -2, 5, 3, 0.5, 0, Math.PI*2);
        ctx.fill();
        // Forearm
        const armAngle = this.state === 'run' ? Math.sin(this.frame * 1.5) * 0.3 : 0;
        ctx.save();
        ctx.translate(18, 0);
        ctx.rotate(armAngle);
        ctx.beginPath();
        ctx.ellipse(4, 3, 4, 2.5, 0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // Legs
        const legSwing = this.state === 'run' ? Math.sin(this.frame * 1.5) * 0.4 : 0;
        ctx.fillStyle = PAL_DARK;
        // Left leg
        ctx.save();
        ctx.translate(-4, 14);
        ctx.rotate(-legSwing);
        ctx.beginPath();
        ctx.ellipse(0, 5, 5, 9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = PAL_DARKER;
        ctx.beginPath();
        ctx.ellipse(-2, 14, 6, 4, -0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        // Right leg
        ctx.save();
        ctx.translate(4, 14);
        ctx.rotate(legSwing);
        ctx.beginPath();
        ctx.fillStyle = PAL_DARK;
        ctx.ellipse(0, 5, 5, 9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = PAL_DARKER;
        ctx.beginPath();
        ctx.ellipse(2, 14, 6, 4, 0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // Jump effect
        if (this.state === 'jump') {
            ctx.strokeStyle = '#aaddff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.ellipse(0, this.h/2 + 2, 20, 6, 0, 0, Math.PI*2);
            ctx.stroke();
        }

        ctx.restore();
    }

    get hitbox() { return {x: this.x+4, y: this.y+4, w: this.w-8, h: this.h-4}; }
    isStomping() { return this.vy > 2 && keys['ArrowDown'] && this.stompCooldown === 0; }
}

// ── Enemy Base ────────────────────────────────────────────────
class Enemy {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.alive = true;
        this.frame = 0;
        this.frameTimer = 0;
        this.stunTimer = 0;
        this.facing = 1;
        // Per-instance jitter for mutation effects so they don't all pulse in sync.
        this._mutSeed = Math.random() * Math.PI * 2;
    }
    get hitbox() { return {x:this.x+4, y:this.y+4, w:this.w-8, h:this.h-8}; }
    // Pulsing green bioluminescent aura behind the body. Call after ctx.translate
    // to enemy center, before drawing the body.
    drawMutationAura() {
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const pulse = (Math.sin(t / 280 + this._mutSeed) + 1) / 2;
        const r = Math.max(this.w, this.h) * (0.62 + pulse * 0.10);
        const aura = ctx.createRadialGradient(0, 4, 4, 0, 4, r);
        aura.addColorStop(0,   `rgba(140,255,180,${0.40 + pulse * 0.20})`);
        aura.addColorStop(0.6, 'rgba(120,220,160,0.10)');
        aura.addColorStop(1,   'rgba(120,220,160,0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 4, r, 0, Math.PI*2);
        ctx.fill();
    }
    // Glowing mutation pustules at body offsets. spots: [[x,y,r], ...]
    drawMutationSpots(spots) {
        ctx.save();
        ctx.shadowColor = '#aaff88';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#cfff8a';
        spots.forEach(([sx, sy, sr]) => {
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.restore();
    }
}

class Raptor extends Enemy {
    constructor(x, y) {
        super(x, y, 'raptor');
        this.w = 40; this.h = 44;
        this.vx = 1.5;
        this.vy = 0;
        this.onGround = false;
        this.startX = x;
        this.patrolRange = 120;
        this.speed = 1.5 + Math.random() * 0.8;
    }

    update(platforms) {
        if (!this.alive) return;

        // Gravity
        this.vy += 0.6;
        if (this.vy > 14) this.vy = 14;
        this.x += this.vx;
        this.y += this.vy;
        this.onGround = false;

        for (let p of platforms) {
            if (rectOverlap({x:this.x,y:this.y,w:this.w,h:this.h}, p)) {
                if (this.vy >= 0 && this.y + this.h - this.vy <= p.y + 5) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy < 0) {
                    this.y = p.y + p.h; this.vy = 0;
                } else {
                    this.vx = -this.vx;
                    this.facing = this.vx > 0 ? 1 : -1;
                }
            }
        }

        // Patrol
        if (this.x < this.startX - this.patrolRange || this.x > this.startX + this.patrolRange) {
            this.vx = -this.vx;
        }
        if (this.x < 0 || this.x + this.w > levelDef.width) { this.vx = -this.vx; }
        this.facing = this.vx > 0 ? 1 : -1;

        // Animation
        this.frameTimer++;
        if (this.frameTimer > 8) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
        // Mutated bioluminescent aura behind the body
        this.drawMutationAura();
        if (this.facing === -1) ctx.scale(-1, 1);

        const bob = Math.sin(this.frame * 1.5) * 1.5;
        ctx.translate(0, bob);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, this.h/2 + 2, 14, 4, 0, 0, Math.PI*2);
        ctx.fill();

        // Tail
        ctx.fillStyle = '#cc5500';
        ctx.beginPath();
        ctx.ellipse(-15, 5, 13, 5, -0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-25, 9, 7, 3, -0.5, 0, Math.PI*2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#e06620';
        ctx.beginPath();
        ctx.ellipse(0, 4, 13, 16, 0, 0, Math.PI*2);
        ctx.fill();

        // Belly
        ctx.fillStyle = '#f5a060';
        ctx.beginPath();
        ctx.ellipse(4, 8, 7, 11, 0.2, 0, Math.PI*2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#e06620';
        ctx.beginPath();
        ctx.ellipse(16, -14, 11, 9, 0.1, 0, Math.PI*2);
        ctx.fill();
        // Snout
        ctx.fillStyle = '#cc5500';
        ctx.beginPath();
        ctx.ellipse(24, -13, 8, 5, 0, 0, Math.PI*2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ffee00';
        ctx.beginPath();
        ctx.arc(19, -17, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(20, -17, 1.5, 0, Math.PI*2);
        ctx.fill();

        // Teeth
        ctx.fillStyle = '#fff';
        ctx.fillRect(24, -15, 2.5, 3);
        ctx.fillRect(27.5, -15, 2.5, 3);

        // Legs
        const legSwing = Math.sin(this.frame * 1.5) * 0.4;
        ctx.fillStyle = '#cc5500';
        ctx.save(); ctx.translate(-3, 12); ctx.rotate(-legSwing);
        ctx.beginPath(); ctx.ellipse(0, 5, 4, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#b34400';
        ctx.beginPath(); ctx.ellipse(-1, 12, 5, 3, -0.2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#cc5500';
        ctx.save(); ctx.translate(3, 12); ctx.rotate(legSwing);
        ctx.beginPath(); ctx.ellipse(0, 5, 4, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#b34400';
        ctx.beginPath(); ctx.ellipse(1, 12, 5, 3, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // Arms
        ctx.fillStyle = '#cc5500';
        ctx.beginPath();
        ctx.ellipse(12, 0, 4, 2.5, 0.5, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}

class Pterodactyl extends Enemy {
    constructor(x, y, range) {
        super(x, y, 'pterodactyl');
        this.w = 50; this.h = 32;
        this.startX = x;
        this.range = range || 130;
        this.speed = 1.8 + Math.random() * 0.8;
        this.vx = this.speed;
        this.vyOsc = 0;
        this.oscTimer = Math.random() * Math.PI * 2;
        this.wingAngle = 0;
    }

    update() {
        if (!this.alive) return;
        this.x += this.vx;
        this.oscTimer += 0.05;
        this.y += Math.sin(this.oscTimer) * 0.8;
        if (this.x < this.startX - this.range || this.x + this.w > this.startX + this.range) {
            this.vx = -this.vx;
            this.facing = this.vx > 0 ? 1 : -1;
        }
        if (this.x < 0) { this.vx = Math.abs(this.vx); this.facing = 1; }
        if (this.x + this.w > levelDef.width) { this.vx = -Math.abs(this.vx); this.facing = -1; }
        this.facing = this.vx > 0 ? 1 : -1;
        this.wingAngle += 0.18;
        this.frameTimer++;
        if (this.frameTimer > 6) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
        // Mutated bioluminescent aura behind the body
        this.drawMutationAura();
        if (this.facing === -1) ctx.scale(-1, 1);

        const wf = Math.sin(this.wingAngle);

        // Shadow on ground (optional)
        // Wings
        ctx.fillStyle = '#6600aa';
        // Upper wing left
        ctx.save();
        ctx.translate(-5, -4);
        ctx.rotate(-0.3 + wf * 0.5);
        ctx.beginPath();
        ctx.ellipse(-12, -6, 18, 7, -0.4, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        // Upper wing right
        ctx.save();
        ctx.translate(5, -4);
        ctx.rotate(0.3 - wf * 0.5);
        ctx.beginPath();
        ctx.ellipse(12, -6, 18, 7, 0.4, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // Wing membrane
        ctx.fillStyle = '#8822cc';
        ctx.save();
        ctx.translate(-5, 0);
        ctx.rotate(wf * 0.4);
        ctx.beginPath();
        ctx.ellipse(-8, 4, 14, 5, -0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(5, 0);
        ctx.rotate(-wf * 0.4);
        ctx.beginPath();
        ctx.ellipse(8, 4, 14, 5, 0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // Body
        ctx.fillStyle = '#7711bb';
        ctx.beginPath();
        ctx.ellipse(0, 2, 9, 13, 0, 0, Math.PI*2);
        ctx.fill();

        // Head + beak
        ctx.fillStyle = '#7711bb';
        ctx.beginPath();
        ctx.ellipse(9, -10, 10, 7, 0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#5500aa';
        // Beak top
        ctx.beginPath();
        ctx.moveTo(14, -13); ctx.lineTo(26, -10); ctx.lineTo(14, -8);
        ctx.closePath(); ctx.fill();
        // Beak bottom
        ctx.beginPath();
        ctx.moveTo(14, -8); ctx.lineTo(22, -7); ctx.lineTo(14, -6);
        ctx.closePath(); ctx.fill();
        // Head crest
        ctx.fillStyle = '#cc44ff';
        ctx.beginPath();
        ctx.moveTo(6, -14); ctx.lineTo(10, -22); ctx.lineTo(14, -14);
        ctx.closePath(); ctx.fill();

        // Eye
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.arc(12, -12, 2.5, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(12.5, -12, 1, 0, Math.PI*2);
        ctx.fill();

        // Tail
        ctx.fillStyle = '#5500aa';
        ctx.beginPath();
        ctx.ellipse(-10, 10, 8, 3, 0.3, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}

class Triceratops extends Enemy {
    constructor(x, y) {
        super(x, y, 'triceratops');
        this.w = 56; this.h = 44;
        this.vx = 1.0;
        this.vy = 0;
        this.onGround = false;
        this.startX = x;
        this.patrolRange = 80;
        this.speed = 0.9 + Math.random() * 0.5;
    }

    update(platforms) {
        if (!this.alive) return;
        this.vy += 0.6;
        if (this.vy > 14) this.vy = 14;
        this.x += this.vx;
        this.y += this.vy;
        this.onGround = false;

        for (let p of platforms) {
            if (rectOverlap({x:this.x,y:this.y,w:this.w,h:this.h}, p)) {
                if (this.vy >= 0 && this.y + this.h - this.vy <= p.y + 5) {
                    this.y = p.y - this.h; this.vy = 0; this.onGround = true;
                } else if (this.vy < 0) {
                    this.y = p.y + p.h; this.vy = 0;
                } else {
                    this.vx = -this.vx;
                }
            }
        }
        if (this.x < this.startX - this.patrolRange || this.x > this.startX + this.patrolRange) {
            this.vx = -this.vx;
        }
        if (this.x < 0 || this.x + this.w > levelDef.width) this.vx = -this.vx;
        this.facing = this.vx > 0 ? 1 : -1;

        this.frameTimer++;
        if (this.frameTimer > 10) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
        // Mutated bioluminescent aura behind the body
        this.drawMutationAura();
        if (this.facing === -1) ctx.scale(-1, 1);

        const bob = Math.sin(this.frame * 1.3) * 1;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, this.h/2 + 2, 22, 5, 0, 0, Math.PI*2);
        ctx.fill();

        // Tail
        ctx.fillStyle = '#1155aa';
        ctx.beginPath();
        ctx.ellipse(-22, 4 + bob, 15, 6, -0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-33, 7 + bob, 7, 3.5, -0.3, 0, Math.PI*2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#2266cc';
        ctx.beginPath();
        ctx.ellipse(0, 4, 19, 17, 0, 0, Math.PI*2);
        ctx.fill();
        // Armour plates on back
        ctx.fillStyle = '#1144aa';
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.ellipse(i * 7, -12 + bob, 5, 4, 0, 0, Math.PI*2);
            ctx.fill();
        }

        // Neck
        ctx.fillStyle = '#2266cc';
        ctx.beginPath();
        ctx.ellipse(16, -6, 9, 12, 0.3, 0, Math.PI*2);
        ctx.fill();

        // Frill (neck shield)
        ctx.fillStyle = '#3388ff';
        ctx.beginPath();
        ctx.ellipse(22, -14, 14, 10, 0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#1144aa';
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#1144aa';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(22, -14);
            const ang = -0.6 + i * 0.4;
            ctx.lineTo(22 + Math.cos(ang) * 14, -14 + Math.sin(ang) * 10);
            ctx.stroke();
        }

        // Head
        ctx.fillStyle = '#2266cc';
        ctx.beginPath();
        ctx.ellipse(22, -6, 12, 10, 0.1, 0, Math.PI*2);
        ctx.fill();

        // Horns
        ctx.fillStyle = '#f0d060';
        // Main horn
        ctx.beginPath();
        ctx.moveTo(30, -12); ctx.lineTo(38, -22); ctx.lineTo(33, -11);
        ctx.closePath(); ctx.fill();
        // Side horns
        ctx.beginPath();
        ctx.moveTo(26, -14); ctx.lineTo(30, -20); ctx.lineTo(28, -13);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(18, -14); ctx.lineTo(20, -20); ctx.lineTo(20, -13);
        ctx.closePath(); ctx.fill();

        // Eye
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(27, -7, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(28, -7, 1.5, 0, Math.PI*2);
        ctx.fill();

        // Legs
        const legSwing = Math.sin(this.frame * 1.3) * 0.3;
        for (let s = -1; s <= 1; s += 2) {
            ctx.fillStyle = '#1155aa';
            ctx.save();
            ctx.translate(s * 8, 14);
            ctx.rotate(s * legSwing * 0.4);
            ctx.beginPath();
            ctx.ellipse(0, 5, 5, 9, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#1144aa';
            ctx.beginPath();
            ctx.ellipse(0, 13, 6, 3.5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }
}

// ── Boss ──────────────────────────────────────────────────────
// A much larger themed creature with HP, attack phases, contact damage,
// and ranged attacks on the hazard theme. Stomp to damage (brief i-frames after hit).
class Boss {
    constructor(def) {
        this.kind = def.kind;         // 'raptor' | 'triceratops' | 'pterodactyl'
        this.themeKey = def.themeKey; // 'lab' | 'dome' | 'hazard'
        this.name = def.name;
        this.color = def.color;
        this.x = def.x; this.y = def.y;
        // Bosses are ~2.4x scale of their base creatures
        if (this.kind === 'raptor')       { this.w = 96;  this.h = 106; }
        else if (this.kind === 'triceratops') { this.w = 134; this.h = 106; }
        else                              { this.w = 120; this.h = 76;  } // pterodactyl
        this.vx = 0; this.vy = 0;
        this.onGround = false;
        this.facing = -1;
        this.hpMax = def.hp;
        this.hp = def.hp;
        this.alive = true;
        this.invuln = 0;          // i-frames after being stomped
        this.phase = 'idle';      // idle -> charge -> jump -> attack
        this.phaseTimer = 60;
        this.frameTimer = 0;
        this.frame = 0;
        this.wingAngle = 0;
    }

    nextPhase(player) {
        const opts = this.kind === 'pterodactyl'
            ? ['swoop','hover','attack','idle']
            : ['charge','jump','attack','idle'];
        this.phase = opts[randInt(0, opts.length - 1)];
        // Shorten pauses as HP drops -> faster, angrier
        const rage = 1 - (this.hp / this.hpMax) * 0.5;
        this.phaseTimer = Math.floor((this.phase === 'idle' ? 50 : 110) / rage);
    }

    update(platforms, player) {
        if (!this.alive) return;
        if (this.invuln > 0) this.invuln--;
        this.phaseTimer--;
        if (this.phaseTimer <= 0) this.nextPhase(player);

        this.frameTimer++;
        if (this.frameTimer > 6) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
        this.wingAngle += 0.2;

        const dirToPlayer = (player.x + player.w/2) > (this.x + this.w/2) ? 1 : -1;
        this.facing = dirToPlayer;

        if (this.kind === 'pterodactyl') {
            // Flying boss: no gravity; swoops + hovers + shoots
            const targetY = this.phase === 'swoop' ? player.y - 20 : 160;
            this.vy += ((targetY - this.y) * 0.004) - this.vy * 0.05;
            this.vx += dirToPlayer * (this.phase === 'swoop' ? 0.25 : 0.08) - this.vx * 0.08;
            this.vx = clamp(this.vx, -5, 5);
            this.vy = clamp(this.vy, -4, 6);
            this.x += this.vx;
            this.y += this.vy;
            this.x = clamp(this.x, 0, levelDef.width - this.w);
            this.y = clamp(this.y, 40, 320);
            // Fire projectiles during 'attack' phase
            if (this.phase === 'attack' && this.phaseTimer % 22 === 0) {
                this.shoot(player);
            }
        } else {
            // Grounded boss: gravity + platform collision
            this.vy += 0.7;
            if (this.vy > 16) this.vy = 16;

            if (this.phase === 'charge') {
                this.vx += dirToPlayer * 0.35;
                this.vx = clamp(this.vx, -5, 5);
            } else if (this.phase === 'jump' && this.onGround) {
                this.vy = -15;
                this.vx = dirToPlayer * 4.2;
            } else if (this.phase === 'attack') {
                this.vx *= 0.85;
                // Bosses of lava/jungle also spit projectiles during attack phase
                if (this.phaseTimer % 28 === 0) this.shoot(player);
            } else {
                this.vx *= 0.9;
            }

            this.x += this.vx;
            this.y += this.vy;
            this.onGround = false;
            for (const p of platforms) {
                if (rectOverlap({x:this.x,y:this.y,w:this.w,h:this.h}, p)) {
                    if (this.vy >= 0 && this.y + this.h - this.vy <= p.y + 8) {
                        this.y = p.y - this.h; this.vy = 0; this.onGround = true;
                    } else if (this.vy < 0) {
                        this.y = p.y + p.h; this.vy = 0;
                    } else {
                        this.vx = -this.vx;
                    }
                }
            }
            if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
            if (this.x + this.w > levelDef.width) { this.x = levelDef.width - this.w; this.vx = -Math.abs(this.vx); }
        }
    }

    shoot(player) {
        const cx = this.x + this.w/2;
        const cy = this.y + this.h/2;
        const tx = player.x + player.w/2;
        const ty = player.y + player.h/2;
        const dx = tx - cx, dy = ty - cy;
        const len = Math.max(1, Math.hypot(dx, dy));
        const speed = 5.5;
        const kind = this.themeKey; // 'lab'|'dome'|'hazard'
        bossProjectiles.push({
            x: cx, y: cy,
            vx: (dx / len) * speed,
            vy: (dy / len) * speed,
            kind,
            life: 180,
            r: 8,
        });
    }

    hit() {
        if (this.invuln > 0 || !this.alive) return false;
        this.hp--;
        this.invuln = 50;
        spawnParticles(this.x + this.w/2, this.y + this.h/2, this.color, 22, 5);
        if (this.hp <= 0) {
            this.alive = false;
            spawnParticles(this.x + this.w/2, this.y + this.h/2, '#ffd700', 50, 7);
        }
        return true;
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
        if (this.facing === -1) ctx.scale(-1, 1);

        // Damage blink
        if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) {
            ctx.globalAlpha = 0.45;
        }
        // Menacing aura
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, this.h/2 + 6, this.w/2, 8, 0, 0, Math.PI*2);
        ctx.fill();

        const scale = this.w / 40;
        ctx.scale(scale, scale);
        // Reuse a styled silhouette per kind
        if (this.kind === 'raptor') this._drawRaptor();
        else if (this.kind === 'triceratops') this._drawTriceratops();
        else this._drawPterodactyl();

        ctx.restore();
    }

    _drawRaptor() {
        const bob = Math.sin(this.frame * 1.5) * 1.5;
        ctx.translate(0, bob);
        // Tail
        ctx.fillStyle = darken(this.color, 20);
        ctx.beginPath(); ctx.ellipse(-15, 5, 15, 6, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-26, 9, 8, 4, -0.5, 0, Math.PI*2); ctx.fill();
        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.ellipse(0, 4, 14, 17, 0, 0, Math.PI*2); ctx.fill();
        // Belly
        ctx.fillStyle = lighten(this.color, 40);
        ctx.beginPath(); ctx.ellipse(4, 8, 7, 12, 0.2, 0, Math.PI*2); ctx.fill();
        // Head
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.ellipse(16, -15, 12, 10, 0.1, 0, Math.PI*2); ctx.fill();
        // Snout
        ctx.fillStyle = darken(this.color, 20);
        ctx.beginPath(); ctx.ellipse(25, -14, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        // Eye (red/angry)
        ctx.fillStyle = '#ffee00';
        ctx.beginPath(); ctx.arc(19, -18, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#d00';
        ctx.beginPath(); ctx.arc(20, -18, 2, 0, Math.PI*2); ctx.fill();
        // Fangs
        ctx.fillStyle = '#fff';
        ctx.fillRect(24, -15, 3, 4);
        ctx.fillRect(28, -15, 3, 4);
        // Horn-crest (boss exclusive)
        ctx.fillStyle = darken(this.color, 30);
        ctx.beginPath();
        ctx.moveTo(10, -25); ctx.lineTo(18, -34); ctx.lineTo(22, -25); ctx.closePath(); ctx.fill();
        // Legs
        const legSwing = Math.sin(this.frame * 1.5) * 0.4;
        ctx.fillStyle = darken(this.color, 20);
        ctx.save(); ctx.translate(-3, 12); ctx.rotate(-legSwing);
        ctx.beginPath(); ctx.ellipse(0, 6, 5, 10, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(3, 12); ctx.rotate(legSwing);
        ctx.beginPath(); ctx.ellipse(0, 6, 5, 10, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    _drawTriceratops() {
        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.ellipse(0, 2, 20, 15, 0, 0, Math.PI*2); ctx.fill();
        // Belly
        ctx.fillStyle = lighten(this.color, 35);
        ctx.beginPath(); ctx.ellipse(0, 7, 12, 8, 0, 0, Math.PI*2); ctx.fill();
        // Head
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.ellipse(18, -4, 14, 11, 0, 0, Math.PI*2); ctx.fill();
        // Frill
        ctx.fillStyle = darken(this.color, 15);
        ctx.beginPath(); ctx.ellipse(10, -10, 14, 14, 0, 0, Math.PI*2); ctx.fill();
        // Spikes around frill
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI/2 + (i - 2) * 0.4;
            const sx = 10 + Math.cos(a) * 14;
            const sy = -10 + Math.sin(a) * 14;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(a) * 6, sy + Math.sin(a) * 6);
            ctx.lineTo(sx + Math.cos(a + 0.3) * 3, sy + Math.sin(a + 0.3) * 3);
            ctx.closePath(); ctx.fill();
        }
        // Horns
        ctx.fillStyle = '#f5f0e0';
        ctx.beginPath(); ctx.moveTo(20, -9); ctx.lineTo(32, -18); ctx.lineTo(22, -6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(24, -2); ctx.lineTo(36, -10); ctx.lineTo(26, 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(26, 5); ctx.lineTo(34, 8); ctx.lineTo(24, 7); ctx.closePath(); ctx.fill();
        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(21, -6, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(22, -6, 1.6, 0, Math.PI*2); ctx.fill();
        // Legs
        ctx.fillStyle = darken(this.color, 20);
        ctx.beginPath(); ctx.ellipse(-10, 14, 5, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( 10, 14, 5, 8, 0, 0, Math.PI*2); ctx.fill();
    }

    _drawPterodactyl() {
        const wf = Math.sin(this.wingAngle);
        // Wings (huge)
        ctx.fillStyle = darken(this.color, 10);
        ctx.save(); ctx.translate(-6, -4); ctx.rotate(-0.3 + wf * 0.6);
        ctx.beginPath(); ctx.ellipse(-16, -8, 24, 9, -0.4, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(6, -4); ctx.rotate(0.3 - wf * 0.6);
        ctx.beginPath(); ctx.ellipse(16, -8, 24, 9, 0.4, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        // Wing membrane
        ctx.fillStyle = lighten(this.color, 30);
        ctx.save(); ctx.translate(-5, 0); ctx.rotate(wf * 0.5);
        ctx.beginPath(); ctx.ellipse(-10, 4, 18, 6, -0.2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(5, 0); ctx.rotate(-wf * 0.5);
        ctx.beginPath(); ctx.ellipse(10, 4, 18, 6, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.ellipse(0, 2, 10, 14, 0, 0, Math.PI*2); ctx.fill();
        // Head + beak
        ctx.beginPath(); ctx.ellipse(10, -10, 11, 8, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = darken(this.color, 25);
        ctx.beginPath(); ctx.moveTo(15, -13); ctx.lineTo(30, -9); ctx.lineTo(15, -7); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(15, -7); ctx.lineTo(24, -5); ctx.lineTo(15, -4); ctx.closePath(); ctx.fill();
        // Crest
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.moveTo(6, -15); ctx.lineTo(12, -26); ctx.lineTo(16, -15); ctx.closePath(); ctx.fill();
        // Eye
        ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.arc(13, -12, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(13.5, -12, 1.3, 0, Math.PI*2); ctx.fill();
    }

    get hitbox() { return {x:this.x+8, y:this.y+8, w:this.w-16, h:this.h-12}; }
}

// ── Collectible ───────────────────────────────────────────────
class Collectible {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.w = 20; this.h = 20;
        this.collected = false;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.glowTimer = 0;
    }
    update() {
        this.bobTimer += 0.06;
        this.glowTimer += 0.08;
    }
    draw() {
        if (this.collected) return;
        const bob = Math.sin(this.bobTimer) * 3;
        const glow = (Math.sin(this.glowTimer) + 1) / 2;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2 + bob);

        if (this.type === 'bone') {
            // Clone-machine part — drawn as a proper mechanical cog:
            // dark outline + steel-gold disk + 6 crisp rectangular teeth + bolt hole.
            ctx.rotate(this.bobTimer * 0.6);

            // Outer halo glow (kept subtle so the silhouette stays sharp).
            ctx.shadowColor = '#ffd24a';
            ctx.shadowBlur = 4 + glow * 4;

            const teethCount = 6;
            const rDisk = 6.2;
            const toothLen = 4.2;
            const toothW = 3.6;

            // Dark outline pass — slightly larger teeth + slightly larger disk.
            ctx.fillStyle = '#1a1100';
            for (let i = 0; i < teethCount; i++) {
                ctx.save();
                ctx.rotate((i / teethCount) * Math.PI * 2);
                ctx.fillRect(-(toothW + 1.4) / 2, -(rDisk + toothLen + 0.7), toothW + 1.4, toothLen + 1.4);
                ctx.restore();
            }
            ctx.beginPath();
            ctx.arc(0, 0, rDisk + 0.8, 0, Math.PI * 2);
            ctx.fill();

            // Drop the halo before drawing the bright fill so edges stay sharp.
            ctx.shadowBlur = 0;

            // Brass fill teeth
            ctx.fillStyle = '#f5c130';
            for (let i = 0; i < teethCount; i++) {
                ctx.save();
                ctx.rotate((i / teethCount) * Math.PI * 2);
                ctx.fillRect(-toothW / 2, -(rDisk + toothLen), toothW, toothLen + 0.6);
                ctx.restore();
            }
            // Central disk
            ctx.beginPath();
            ctx.arc(0, 0, rDisk, 0, Math.PI * 2);
            ctx.fill();

            // Stepped inner rings for a machined look
            ctx.fillStyle = '#c08a14';
            ctx.beginPath();
            ctx.arc(0, 0, rDisk - 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#8c6210';
            ctx.beginPath();
            ctx.arc(0, 0, rDisk - 2.8, 0, Math.PI * 2);
            ctx.fill();

            // Centre bolt hole
            ctx.fillStyle = '#100600';
            ctx.beginPath();
            ctx.arc(0, 0, 1.7, 0, Math.PI * 2);
            ctx.fill();

            // Rim highlight on one tooth (sells the metal)
            ctx.fillStyle = 'rgba(255,245,176,0.9)';
            ctx.fillRect(-toothW / 2 + 0.2, -(rDisk + toothLen) + 0.2, 1.0, toothLen);
        } else if (this.type === 'egg') {
            // Glow
            ctx.shadowColor = '#aaffaa';
            ctx.shadowBlur = 10 + glow * 8;
            // Egg
            ctx.fillStyle = '#7be07b';
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI*2);
            ctx.fill();
            // Spots
            ctx.fillStyle = '#5bb55b';
            ctx.beginPath(); ctx.arc(-3, -3, 2.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(3, 2, 2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(-2, 4, 1.5, 0, Math.PI*2); ctx.fill();
            // Shine
            ctx.fillStyle = '#ccffcc';
            ctx.beginPath(); ctx.arc(-2, -5, 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
    get hitbox() { return {x:this.x+2, y:this.y+2, w:this.w-4, h:this.h-4}; }
}

// ── Exit Portal ───────────────────────────────────────────────
class Portal {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 44; this.h = 60;
        this.timer = 0;
    }
    update() { this.timer += 0.05; }
    draw() {
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);

        const pulse = Math.sin(this.timer) * 0.15 + 1;
        ctx.scale(pulse, pulse);

        // Outer ring glow
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;

        // Outer ring
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 28, 0, 0, Math.PI*2);
        ctx.stroke();

        // Inner swirl
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        grad.addColorStop(0, `hsla(${this.timer * 100 % 360}, 100%, 70%, 0.9)`);
        grad.addColorStop(0.5, `hsla(${(this.timer * 100 + 120) % 360}, 100%, 50%, 0.6)`);
        grad.addColorStop(1, 'rgba(0,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 26, 0, 0, Math.PI*2);
        ctx.fill();

        // Stars around portal
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + this.timer;
            const r = 24;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r * 0.7, 2, 0, Math.PI*2);
            ctx.fill();
        }

        // Arrow pointing up
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(0, -34); ctx.lineTo(-6, -26); ctx.lineTo(-2, -26);
        ctx.lineTo(-2, -20); ctx.lineTo(2, -20); ctx.lineTo(2, -26);
        ctx.lineTo(6, -26); ctx.closePath(); ctx.fill();

        ctx.restore();
    }
    get hitbox() { return {x:this.x+6, y:this.y+4, w:this.w-12, h:this.h-8}; }
}

// ── Background Drawing ────────────────────────────────────────
function generateClouds() {
    clouds = [];
    for (let i = 0; i < 8; i++) {
        clouds.push({
            x: rand(0, W), y: rand(20, 160),
            w: rand(60, 140), h: rand(20, 50),
            speed: rand(0.1, 0.4),
            opacity: rand(0.1, 0.3)
        });
    }
}

function generateStars() {
    bgStars = [];
    for (let i = 0; i < 80; i++) {
        bgStars.push({x: rand(0, W), y: rand(0, H*0.6), size: rand(0.5, 2.5), blink: rand(0, Math.PI*2)});
    }
}

function drawBackground(levelDef) {
    const [c1, c2, c3] = levelDef.bgColors;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.5, c2);
    grad.addColorStop(1, c3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars (very slow parallax)
    const starShift = camera.x * 0.15;
    bgStars.forEach(s => {
        s.blink += 0.03;
        const alpha = (Math.sin(s.blink) + 1) / 2 * 0.8 + 0.2;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        const sx = ((s.x - starShift) % W + W) % W;
        ctx.arc(sx, s.y, s.size, 0, Math.PI*2);
        ctx.fill();
    });

    // Distant mountains/volcano silhouettes (mid parallax)
    drawMountains(levelDef);

    // Clouds/mist (fast parallax + drift) - tinted per theme
    const cloudColorBase =
        (levelDef.theme && levelDef.theme.cloudColor) ||
        levelDef.cloudColor ||
        'rgba(180,255,230,';
    const cloudShift = camera.x * 0.5;
    clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.w < 0) c.x = W;
        ctx.fillStyle = `${cloudColorBase}${c.opacity})`;
        ctx.beginPath();
        const cx = ((c.x - cloudShift) % (W + c.w) + (W + c.w)) % (W + c.w) - c.w/2;
        ctx.ellipse(cx + c.w/2, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2);
        ctx.fill();
    });
}

function drawMountains(levelDef) {
    const style =
        (levelDef.theme && levelDef.theme.style) ||
        levelDef.style ||
        'lab';
    const parallax = camera.x * 0.3;
    const t = Date.now();

    if (style === 'lab') {
        // Sterile-lab: rows of containment cylinders / cloning tanks
        const tile = 220;
        const start = Math.floor(parallax / tile) - 1;
        for (let i = start; i < start + Math.ceil(W / tile) + 3; i++) {
            const bx = 90 + i * tile - parallax;
            const bh = 150 + ((i % 3) + 3) % 3 * 30;
            // Tank chassis (dark steel)
            ctx.fillStyle = '#1a2630';
            ctx.fillRect(bx - 22, H - bh, 44, bh);
            // Top + bottom caps
            ctx.fillStyle = '#2a3a48';
            ctx.fillRect(bx - 26, H - bh - 8, 52, 12);
            ctx.fillRect(bx - 26, H - 14, 52, 8);
            // Glow tube (cyan growth fluid)
            const tube = ctx.createLinearGradient(bx, H - bh + 12, bx, H - 18);
            tube.addColorStop(0,   'rgba(0,255,210,0.55)');
            tube.addColorStop(0.5, 'rgba(0,180,160,0.55)');
            tube.addColorStop(1,   'rgba(0,60,90,0.85)');
            ctx.fillStyle = tube;
            ctx.fillRect(bx - 12, H - bh + 12, 24, bh - 30);
            // Bubbles rising inside
            ctx.fillStyle = 'rgba(200,255,235,0.85)';
            for (let b = 0; b < 4; b++) {
                const phase = (t / 30 + i * 53 + b * 41) % (bh - 40);
                const by = H - 24 - phase;
                ctx.beginPath();
                ctx.arc(bx + Math.sin(b + i + t/400) * 5, by, 2, 0, Math.PI*2);
                ctx.fill();
            }
        }
    } else if (style === 'dome') {
        // Bio-dome silhouettes with vines spilling out
        const tile = 320;
        const start = Math.floor(parallax / tile) - 1;
        for (let i = start; i < start + Math.ceil(W / tile) + 3; i++) {
            const bx = 160 + i * tile - parallax;
            const bh = 130 + ((i % 3) + 3) % 3 * 25;
            // Dome
            ctx.fillStyle = '#0c2818';
            ctx.beginPath();
            ctx.arc(bx, H - 8, bh, Math.PI, 0);
            ctx.closePath(); ctx.fill();
            // Lattice grid (dome ribs)
            ctx.strokeStyle = 'rgba(80,200,140,0.35)';
            ctx.lineWidth = 1;
            for (let r = 0.25; r < 1; r += 0.2) {
                ctx.beginPath();
                ctx.arc(bx, H - 8, bh * r, Math.PI, 0);
                ctx.stroke();
            }
            // Vines hanging from the dome
            ctx.strokeStyle = '#3e7a30';
            ctx.lineWidth = 2;
            for (let v = -2; v <= 2; v++) {
                ctx.beginPath();
                ctx.moveTo(bx + v * 22, H - bh + 4);
                ctx.bezierCurveTo(
                    bx + v * 24 + 6, H - bh * 0.5,
                    bx + v * 22 - 6, H - bh * 0.2,
                    bx + v * 22,     H
                );
                ctx.stroke();
            }
        }
    } else if (style === 'hazard') {
        // Wrecked containment + flashing red beacons
        const tile = 290;
        const start = Math.floor(parallax / tile) - 1;
        for (let i = start; i < start + Math.ceil(W / tile) + 3; i++) {
            const bx = 120 + i * tile - parallax;
            const bh = 130 + ((i % 3) + 3) % 3 * 30;
            // Ragged silhouette of a broken tank
            ctx.fillStyle = '#1c0808';
            ctx.beginPath();
            ctx.moveTo(bx - 90, H);
            ctx.lineTo(bx - 60, H - bh * 0.6);
            ctx.lineTo(bx - 30, H - bh * 0.85);
            ctx.lineTo(bx + 10, H - bh);
            ctx.lineTo(bx + 50, H - bh * 0.7);
            ctx.lineTo(bx + 90, H);
            ctx.closePath(); ctx.fill();
            // Pulsing red alert beacon at the top
            const flick = (Math.sin(t / 120 + i * 2) + 1) / 2;
            const beaconY = H - bh - 6;
            const r = 12 + flick * 10;
            const beacon = ctx.createRadialGradient(bx, beaconY, 2, bx, beaconY, r + 18);
            beacon.addColorStop(0,   'rgba(255,90,90,0.95)');
            beacon.addColorStop(0.5, 'rgba(220,30,30,0.45)');
            beacon.addColorStop(1,   'rgba(255,0,0,0)');
            ctx.fillStyle = beacon;
            ctx.beginPath();
            ctx.arc(bx, beaconY, r + 14, 0, Math.PI*2);
            ctx.fill();
        }
    }
}

function drawPlatforms(levelDef, platforms) {
    platforms.forEach((p, i) => {
        const isGround = p.y > 400;
        if (isGround) {
            // Ground
            const gGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
            gGrad.addColorStop(0, levelDef.groundColor);
            gGrad.addColorStop(1, '#1a0a00');
            ctx.fillStyle = gGrad;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            // Ground top edge
            ctx.fillStyle = lighten(levelDef.groundColor, 30);
            ctx.fillRect(p.x, p.y, p.w, 6);
            // Ground details (rocks/plants)
            for (let gx = 30; gx < p.w - 20; gx += 55) {
                ctx.fillStyle = lighten(levelDef.groundColor, 20);
                ctx.beginPath();
                ctx.arc(p.x + gx, p.y + 3, 4, 0, Math.PI*2);
                ctx.fill();
            }
        } else {
            // Elevated platform
            ctx.fillStyle = levelDef.platformColor;
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.w, p.h, 4);
            ctx.fill();
            // Top highlight
            ctx.fillStyle = lighten(levelDef.platformColor, 25);
            ctx.beginPath();
            ctx.roundRect(p.x + 2, p.y, p.w - 4, 5, 3);
            ctx.fill();
            // Bottom shadow
            ctx.fillStyle = darken(levelDef.platformColor, 20);
            ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
            // Platform decoration (mossy/rocky spots)
            for (let px = 15; px < p.w - 10; px += 22) {
                ctx.fillStyle = darken(levelDef.platformColor, 10);
                ctx.beginPath();
                ctx.arc(p.x + px, p.y + 9, 3, 0, Math.PI*2);
                ctx.fill();
            }
        }
    });
}

function lighten(hex, amount) {
    return adjustColor(hex, amount);
}
function darken(hex, amount) {
    return adjustColor(hex, -amount);
}
function adjustColor(hex, amount) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgb(${clamp(r+amount,0,255)},${clamp(g+amount,0,255)},${clamp(b+amount,0,255)})`;
}

// ── Game Instance ─────────────────────────────────────────────
let player, platforms, enemies, collectibles, portal, levelDef;
let messageActive = false, messageCallback = null;
let levelTransitioning = false;

function loadLevel(levelIdx) {
    levelDef = generateLevel(levelIdx);
    platforms = levelDef.platforms;
    player = new Player(levelDef.playerStart.x, levelDef.playerStart.y);
    enemies = levelDef.enemies.map(e => {
        if (e.type === 'raptor') return new Raptor(e.x, e.y);
        if (e.type === 'pterodactyl') return new Pterodactyl(e.x, e.y, e.range);
        if (e.type === 'triceratops') return new Triceratops(e.x, e.y);
    }).filter(Boolean);
    collectibles = levelDef.collectibles.map(c => new Collectible(c.x, c.y, c.type));
    // Boss level: spawn boss, no portal yet (appears after boss dies)
    if (levelDef.isBoss && levelDef.boss) {
        boss = new Boss(levelDef.boss);
        portal = null;
    } else {
        boss = null;
        portal = new Portal(levelDef.portal.x, levelDef.portal.y);
    }
    bossProjectiles = [];
    particles = [];
    generateClouds();
    generateStars();
    camera.x = 0;
    levelTransitioning = false;
    document.getElementById('level-display').textContent =
        levelDef.isBoss ? `PROTOTYPE ${levelIdx}` : `Sector ${levelIdx}`;
}

// Camera follows the player, clamped to level bounds
function updateCamera() {
    const target = player.x + player.w / 2 - W / 2;
    camera.x = clamp(target, 0, Math.max(0, levelDef.width - W));
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
    document.getElementById('score-display').textContent = `Score: ${score}`;
    document.getElementById('lives-display').textContent = `x${lives}`;
    document.getElementById('bones-display').textContent = `Parts: ${bones}`;
    // Persist wallet whenever HUD changes (every pickup / damage event)
    save.bones = bones;
    writeSave();
}

// ── Messages ──────────────────────────────────────────────────
function showMessage(title, body, waitForSpace = false, cb = null) {
    const box = document.getElementById('message-box');
    document.getElementById('msg-title').textContent = title;
    document.getElementById('msg-body').textContent = body;
    box.style.display = 'block';
    messageActive = waitForSpace;
    messageCallback = cb;
    if (!waitForSpace) {
        setTimeout(() => { box.style.display = 'none'; if (cb) cb(); }, 2000);
    }
}

function hideMessage() {
    document.getElementById('message-box').style.display = 'none';
    messageActive = false;
    if (messageCallback) { messageCallback(); messageCallback = null; }
}

// ── Game Over / Win ───────────────────────────────────────────
const BTN_STYLE = 'padding:12px 28px;font-size:18px;font-family:Courier New,monospace;font-weight:bold;background:linear-gradient(135deg,#00d4aa,#006e58);color:white;border:3px solid #ffd700;border-radius:8px;cursor:pointer;margin:6px;';
const SHOP_BTN_STYLE = 'padding:12px 28px;font-size:18px;font-family:Courier New,monospace;font-weight:bold;background:linear-gradient(135deg,#6b3aff,#3a1a88);color:white;border:3px solid #ffd700;border-radius:8px;cursor:pointer;margin:6px;';

function triggerGameOver() {
    gameRunning = false;
    gameOver = true;
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
        <div class="deco">☠️🧬</div>
        <h1 style="color:#ff4477">SPECIMEN TERMINATED</h1>
        <div class="subtitle" style="color:#aaffee">The mutants caught up with you. Score: ${score}</div>
        <div class="controls-info">You have <span>${bones} ⚙️ clone parts</span> banked — spend them on new clones in the shop!</div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;">
            <button id="retry-btn" style="${BTN_STYLE}">🔄 TRY AGAIN</button>
            <button id="shop-btn-over" style="${SHOP_BTN_STYLE}">🛒 GO TO SHOP</button>
        </div>
    `;
    ov.style.display = 'flex';
    // Wire the buttons on the NEXT tick so the DOM has updated
    requestAnimationFrame(() => {
        const r = document.getElementById('retry-btn');
        if (r) r.addEventListener('click', restartGame);
        const s = document.getElementById('shop-btn-over');
        if (s) s.addEventListener('click', openShop);
    });
}

function triggerWin() {
    // Play the outro cutscene first, then show the win overlay.
    gameRunning = false;
    playCutscene(CUTSCENES.win, _showWinOverlay);
}

function _showWinOverlay() {
    // Treat a completed run like a finished run for the Shop → PLAY path so that
    // returning to a fresh game resets score/lives via restartGame() instead of
    // leaking them via startGame().
    gameOver = true;
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
        <div class="deco">🏆🧬⚗️</div>
        <h1 style="color:#ffd700">EVIL CLONE DEFEATED!</h1>
        <div class="subtitle" style="color:#aaffd6">All three clone parts recovered. World saved. Final Score: ${score}</div>
        <div class="controls-info">Parts banked: <span>${bones} ⚙️</span> — spend them on new clone skins!</div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;">
            <button id="retry-btn" style="${BTN_STYLE}">🔄 PLAY AGAIN</button>
            <button id="shop-btn-win" style="${SHOP_BTN_STYLE}">🛒 GO TO SHOP</button>
        </div>
    `;
    ov.style.display = 'flex';
    requestAnimationFrame(() => {
        const r = document.getElementById('retry-btn');
        if (r) r.addEventListener('click', restartGame);
        const s = document.getElementById('shop-btn-win');
        if (s) s.addEventListener('click', openShop);
    });
}

function restartGame() {
    // Keep the bones wallet persistent across runs — only reset per-run state
    score = 0; lives = 5; currentLevel = 1;
    updateHUD();
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('message-box').style.display = 'none';
    const shopEl = document.getElementById('shop-overlay');
    if (shopEl) shopEl.style.display = 'none';
    loadLevel(1);
    gameOver = false;
    messageActive = false;
    // Critical: the loop exits when gameRunning becomes false, so we must restart it.
    if (!gameRunning) {
        gameRunning = true;
        loop();
    } else {
        gameRunning = true;
    }
}

function startGame() {
    document.getElementById('overlay').style.display = 'none';
    const shopEl = document.getElementById('shop-overlay');
    if (shopEl) shopEl.style.display = 'none';
    // Optional ?level=N URL param for jumping to a specific level (handy for boss testing)
    const urlLvl = parseInt(new URLSearchParams(location.search).get('level'), 10);
    const startLvl = (Number.isFinite(urlLvl) && urlLvl >= 1 && urlLvl <= TOTAL_LEVELS) ? urlLvl : 1;
    currentLevel = startLvl;
    loadLevel(startLvl);
    if (!gameRunning) {
        gameRunning = true;
        loop();
    } else {
        gameRunning = true;
    }
}

// Title-screen entry point: BEGIN ESCAPE.
// The intro auto-plays on page load (see bottom of file), so once the player
// has watched it we go straight into the game on click. If somehow the intro
// hasn't been seen yet (e.g. they hit the button while the boot cutscene is
// still up), we replay it before starting.
function beginNewGameWithIntro() {
    const urlLvl = parseInt(new URLSearchParams(location.search).get('level'), 10);
    const skippingViaUrl = Number.isFinite(urlLvl) && urlLvl >= 1 && urlLvl <= TOTAL_LEVELS && urlLvl !== 1;
    document.getElementById('overlay').style.display = 'none';
    const shopEl = document.getElementById('shop-overlay');
    if (shopEl) shopEl.style.display = 'none';
    if (skippingViaUrl || cutsceneSeen('intro')) {
        startGame();
        return;
    }
    playCutscene(CUTSCENES.intro, () => {
        markCutsceneSeen('intro');
        startGame();
    });
}

// Auto-play the opening cutscene on first page load, before the title screen
// is shown. Subsequent loads (cutsceneSeen('intro') === true) skip straight to
// the title. Honours the ?level=N shortcut to bypass the cutscene entirely.
function maybeAutoPlayBootCutscene() {
    const urlLvl = parseInt(new URLSearchParams(location.search).get('level'), 10);
    const skippingViaUrl = Number.isFinite(urlLvl) && urlLvl >= 1 && urlLvl <= TOTAL_LEVELS;
    if (skippingViaUrl) return;
    if (cutsceneSeen('intro')) return;
    const titleOverlay = document.getElementById('overlay');
    if (titleOverlay) titleOverlay.style.display = 'none';
    // Defer to next frame so the DOM has fully settled before we render.
    requestAnimationFrame(() => {
        playCutscene(CUTSCENES.intro, () => {
            markCutsceneSeen('intro');
            if (titleOverlay) titleOverlay.style.display = 'flex';
        });
    });
}

// ── Shop ─────────────────────────────────────────────────────
function renderShop() {
    const el = document.getElementById('shop-overlay');
    if (!el) return;
    const cards = SKINS.map(s => {
        const owned = save.owned.includes(s.id);
        const equipped = save.equipped === s.id;
        const affordable = bones >= s.cost;
        let btnLabel, btnClass, btnDisabled;
        if (equipped)       { btnLabel = 'EQUIPPED';           btnClass = 'shop-btn equipped'; btnDisabled = true; }
        else if (owned)     { btnLabel = 'EQUIP';              btnClass = 'shop-btn equip';    btnDisabled = false; }
        else if (affordable){ btnLabel = `BUY · ${s.cost} ⚙️`; btnClass = 'shop-btn buy';      btnDisabled = false; }
        else                { btnLabel = `${s.cost} ⚙️`;      btnClass = 'shop-btn locked';   btnDisabled = true; }
        // Preview swatch: three color circles
        return `
            <div class="skin-card ${equipped ? 'active' : ''}">
                <div class="skin-emoji">${s.emoji}${s.rainbow ? '✨' : ''}</div>
                <div class="skin-name">${s.name}</div>
                <div class="skin-swatch">
                    <span style="background:${s.mid}"></span>
                    <span style="background:${s.dark}"></span>
                    <span style="background:${s.belly}"></span>
                </div>
                <button class="${btnClass}" data-skin="${s.id}" ${btnDisabled ? 'disabled' : ''}>${btnLabel}</button>
            </div>`;
    }).join('');

    el.innerHTML = `
        <div class="shop-inner">
            <h2 class="shop-title">🧬 CLONE LAB SHOP ⚙️</h2>
            <div class="shop-wallet">Wallet: <b>${bones} ⚙️</b></div>
            <div class="skin-grid">${cards}</div>
            <div class="shop-actions">
                <button id="shop-play" style="${BTN_STYLE}">${gameOver ? '🔄 TRY AGAIN' : '▶ PLAY'}</button>
                <button id="shop-back" style="${SHOP_BTN_STYLE.replace('#6b3aff','#555').replace('#3a1a88','#222')}">✖ CLOSE</button>
            </div>
        </div>`;

    el.querySelectorAll('.shop-btn').forEach(b => {
        b.addEventListener('click', () => {
            const id = b.getAttribute('data-skin');
            if (b.classList.contains('buy')) buySkin(id);
            else if (b.classList.contains('equip')) equipSkin(id);
        });
    });
    document.getElementById('shop-play').addEventListener('click', () => {
        el.style.display = 'none';
        if (gameOver) restartGame(); else startGame();
    });
    document.getElementById('shop-back').addEventListener('click', closeShop);
}

function openShop() {
    const el = document.getElementById('shop-overlay');
    if (!el) return;
    el.style.display = 'flex';
    renderShop();
}
function closeShop() {
    const el = document.getElementById('shop-overlay');
    if (el) el.style.display = 'none';
    // If we got here from the title or game-over screens, those overlays are still shown.
    // If the game was running, do nothing — return to gameplay.
}

function buySkin(id) {
    const skin = getSkin(id);
    if (!skin || save.owned.includes(id)) return;
    if (bones < skin.cost) return;
    bones -= skin.cost;
    save.bones = bones;
    save.owned.push(id);
    writeSave();
    updateHUD();
    renderShop();
}

function equipSkin(id) {
    if (!save.owned.includes(id)) return;
    save.equipped = id;
    writeSave();
    // Live-swap if a player already exists (e.g. opened shop from game-over)
    if (typeof player !== 'undefined' && player) player.skin = currentSkin();
    renderShop();
}

// ── Collision Logic ───────────────────────────────────────────
function checkCollisions() {
    if (player.invincible > 0) return;

    // Collectibles
    collectibles.forEach(c => {
        if (!c.collected && rectOverlap(player.hitbox, c.hitbox)) {
            c.collected = true;
            if (c.type === 'bone') {
                bones++;
                score += 50;
                spawnParticles(c.x + 10, c.y + 10, '#f0e68c', 10, 3);
            } else if (c.type === 'egg') {
                score += 150;
                bones += 2;
                spawnParticles(c.x + 10, c.y + 10, '#90ee90', 12, 3);
                // egg: extra particles already spawned above
            }
            updateHUD();
        }
    });

    // Enemies
    enemies.forEach(e => {
        if (!e.alive) return;
        if (rectOverlap(player.hitbox, e.hitbox)) {
            // Stomp check (player falling from above)
            const playerBottom = player.y + player.h;
            const enemyTop = e.y + 8;
            const stomping = player.vy > 1 && playerBottom - player.vy <= enemyTop + 4;

            if (stomping || player.isStomping()) {
                // Kill enemy!
                e.alive = false;
                player.vy = -9;
                player.stompCooldown = 10;
                const pts = e.type === 'triceratops' ? 200 : e.type === 'pterodactyl' ? 150 : 100;
                score += pts;
                bones += e.type === 'triceratops' ? 3 : 1;
                spawnParticles(e.x + e.w/2, e.y + e.h/2, e.type === 'pterodactyl' ? '#cc44ff' : '#ff8800', 15, 4);
                // (no popup — stomp feedback is particles + sound of numbers rising)
                updateHUD();
            } else {
                // Player takes damage
                player.invincible = 90;
                lives--;
                updateHUD();
                spawnParticles(player.x + player.w/2, player.y + player.h/2, '#ff4444', 12, 4);
                if (lives <= 0) {
                    triggerGameOver();
                } else {
                    // (no popup — red particles convey damage)
                }
            }
        }
    });

    // Boss collision (contact damage / stomp to damage)
    if (boss && boss.alive && rectOverlap(player.hitbox, boss.hitbox)) {
        const playerBottom = player.y + player.h;
        const bossTop = boss.y + 12;
        const stomping = player.vy > 1 && playerBottom - player.vy <= bossTop + 6;
        if ((stomping || player.isStomping()) && boss.invuln === 0) {
            if (boss.hit()) {
                player.vy = -12;
                player.stompCooldown = 12;
                score += 250;
                updateHUD();
                if (!boss.alive) {
                    // Boss defeated! Spawn portal in arena center on ground
                    score += 2000;
                    bones += 10;
                    updateHUD();
                    spawnParticles(boss.x + boss.w/2, boss.y + boss.h/2, '#ffd700', 60, 8);
                    const px = levelDef.width / 2 - 22;
                    const py = 380;
                    portal = new Portal(px, py);
                }
            }
        } else if (boss.invuln === 0) {
            player.invincible = 100;
            lives--;
            updateHUD();
            spawnParticles(player.x + player.w/2, player.y + player.h/2, '#ff4444', 14, 4);
            // Knock the player back
            player.vx = (player.x < boss.x ? -1 : 1) * 9;
            player.vy = -8;
            if (lives <= 0) triggerGameOver();
        }
    }

    // Boss projectile hits
    if (!player.invincible) {
        bossProjectiles.forEach(pr => {
            if (pr.dead) return;
            if (rectOverlap(player.hitbox, {x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2})) {
                pr.dead = true;
                player.invincible = 80;
                lives--;
                updateHUD();
                spawnParticles(pr.x, pr.y, '#ff8800', 14, 4);
                if (lives <= 0) triggerGameOver();
            }
        });
    }

    // Portal (instant teleport — no delay, no message wait)
    if (portal && !levelTransitioning && rectOverlap(player.hitbox, portal.hitbox)) {
        levelTransitioning = true;
        score += 500;
        updateHUD();
        // Quick flash of particles for feedback but no modal / setTimeout delay
        spawnParticles(player.x + player.w/2, player.y + player.h/2, '#00ffff', 40, 6);
        if (currentLevel < TOTAL_LEVELS) {
            currentLevel++;
            const csKey = (currentLevel === 6) ? 'sector5'
                       : (currentLevel === 11) ? 'sector10'
                       : (currentLevel === 15) ? 'finalApproach'
                       : null;
            if (csKey && CUTSCENES[csKey]) {
                gameRunning = false;
                playCutscene(CUTSCENES[csKey], () => {
                    loadLevel(currentLevel);
                    if (!gameRunning) { gameRunning = true; loop(); }
                });
            } else {
                loadLevel(currentLevel);
            }
        } else {
            triggerWin();
        }
    }
}

// ── Boss projectile update/draw ───────────────────────────────
function updateBossProjectiles() {
    bossProjectiles.forEach(p => {
        if (p.dead) return;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        // Slight gravity for lab/dome projectiles; hazard ones fly straight
        if (p.kind !== 'hazard') p.vy += 0.12;
        if (p.y > H - 40 || p.x < 0 || p.x > levelDef.width || p.life <= 0) p.dead = true;
    });
    bossProjectiles = bossProjectiles.filter(p => !p.dead);
}

function drawBossProjectiles() {
    bossProjectiles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        let color = '#ff5500', glow = '#ff8800';
        if (p.kind === 'dome')        { color = '#4caf50'; glow = '#aaff77'; }
        else if (p.kind === 'hazard') { color = '#aa00ff'; glow = '#ff33ff'; }
        ctx.shadowColor = glow;
        ctx.shadowBlur = 14;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(-p.r/3, -p.r/3, p.r/3, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    });
}

// ── Draw HUD overlay on canvas (viewport-space, drawn after world) ──
function drawCanvasHUD() {
    // Level title band
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 28);
    ctx.fillStyle = levelDef.isBoss ? '#ff4444' : '#ffd700';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'center';
    const emoji = levelDef.isBoss ? '☣️' : '🧪';
    const subtitle = levelDef.isBoss
        ? `— Terminate ${levelDef.theme.bossName}! —`
        : '— Reach the containment portal! —';
    ctx.fillText(`${emoji} ${levelDef.name}  ${subtitle}  ${emoji}`, W/2, 18);
    ctx.textAlign = 'left';

    // Progress bar (how far across the level)
    if (!levelDef.isBoss) {
        const barW = 140, barH = 6;
        const bx = W - barW - 14, by = 10;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(bx, by, barW, barH);
        const prog = clamp((player.x + player.w/2) / levelDef.width, 0, 1);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(bx, by, barW * prog, barH);
    }

    // Boss HP bar
    if (boss && boss.alive) {
        const barW = 520, barH = 16;
        const bx = (W - barW) / 2, by = 36;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx - 4, by - 4, barW + 8, barH + 8);
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);
        const hpFrac = boss.hp / boss.hpMax;
        const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
        grad.addColorStop(0, '#ff2200');
        grad.addColorStop(1, '#ff8844');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, barW * hpFrac, barH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, barW, barH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`${boss.name}  —  ${boss.hp}/${boss.hpMax} HP`, W/2, by + 12);
        ctx.textAlign = 'left';
    }
}

// ── Main Game Loop ────────────────────────────────────────────
let lastTime = 0;
function loop(ts = 0) {
    if (!gameRunning) return;
    requestAnimationFrame(loop);

    // Update phase (world state) before drawing
    if (!messageActive) {
        player.update(platforms);
        enemies.forEach(e => {
            if (e.type === 'pterodactyl') e.update();
            else e.update(platforms);
        });
        collectibles.forEach(c => c.update());
        if (portal) portal.update();
        if (boss) boss.update(platforms, player);
        updateBossProjectiles();
    }
    updateCamera();

    // ── Render ──
    // Background (viewport-space, uses camera for parallax internally)
    drawBackground(levelDef);

    // World-space rendering: translate by -camera.x
    ctx.save();
    ctx.translate(-camera.x, 0);

    drawPlatforms(levelDef, platforms);
    collectibles.forEach(c => c.draw());
    enemies.forEach(e => e.draw());
    if (boss) boss.draw();
    if (portal) portal.draw();
    player.draw();
    drawBossProjectiles();
    drawParticles();

    ctx.restore();

    // Collisions (post-update)
    if (!messageActive && !levelTransitioning) {
        checkCollisions();
    }

    // Handle message dismissal
    if (messageActive && (keys['Space'] || keys['Enter'])) {
        hideMessage();
    }

    updateParticles();
    drawCanvasHUD();
}

// ── Kick off ──────────────────────────────────────────────────
generateStars();
generateClouds();
// Initialize HUD so the persisted bone wallet is visible on the title screen
updateHUD();

// Make functions globally accessible
window.startGame = startGame;
window.beginNewGameWithIntro = beginNewGameWithIntro;
window.restartGame = restartGame;
window.openShop = openShop;
window.closeShop = closeShop;

// Auto-play the opening cutscene on first page load, before the title screen.
maybeAutoPlayBootCutscene();
