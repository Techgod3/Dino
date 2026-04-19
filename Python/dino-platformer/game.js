// ============================================================
//  DINOLAND - Prehistoric Platformer
//  Full game engine in vanilla JS + Canvas
// ============================================================

const canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
const realCtx = ctx;
const W = canvas.width;
const H = canvas.height;

// ── Global State ─────────────────────────────────────────────
let score = 0, lives = 3, bones = 0, currentLevel = 1;
let gameRunning = false, gameOver = false;
let keys = {};
let particles = [];
let clouds = [];
let bgStars = [];
let bgStatic = null;         // pre-rendered static backdrop per level
const MAX_PARTICLES = 220;    // cap particles so effects can't tank FPS

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
    const room = MAX_PARTICLES - particles.length;
    if (room <= 0) return;
    const n = Math.min(count, room);
    for (let i = 0; i < n; i++) {
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

// ── Level Definitions ─────────────────────────────────────────
const LEVELS = [
    {
        name: "Lava Valley",
        bgColors: ['#1a0a2e', '#2d0a00', '#1a1500'],
        groundColor: '#5c3317',
        platformColor: '#7a4a20',
        platforms: [
            {x:0,   y:440, w:900, h:60},   // ground
            {x:100, y:360, w:120, h:18},
            {x:280, y:300, w:100, h:18},
            {x:420, y:340, w:130, h:18},
            {x:580, y:270, w:110, h:18},
            {x:710, y:310, w:140, h:18},
            {x:200, y:220, w:100, h:18},
            {x:480, y:190, w:120, h:18},
            {x:650, y:180, w:100, h:18},
        ],
        enemies: [
            {type:'raptor', x:320, y:400},
            {type:'raptor', x:560, y:400},
            {type:'pterodactyl', x:420, y:200, range:150},
            {type:'raptor', x:720, y:270},
        ],
        collectibles: [
            {type:'bone', x:130, y:335},
            {type:'bone', x:305, y:275},
            {type:'egg',  x:455, y:315},
            {type:'bone', x:615, y:245},
            {type:'bone', x:735, y:285},
            {type:'egg',  x:220, y:195},
            {type:'bone', x:510, y:165},
            {type:'egg',  x:670, y:155},
        ],
        portal: {x:820, y:280},
        playerStart: {x:50, y:380},
    },
    {
        name: "Jungle Canopy",
        bgColors: ['#001a00', '#003300', '#001100'],
        groundColor: '#2d4a1e',
        platformColor: '#3a6b22',
        platforms: [
            {x:0,   y:440, w:900, h:60},
            {x:60,  y:360, w:100, h:18},
            {x:220, y:310, w:80,  h:18},
            {x:360, y:260, w:110, h:18},
            {x:500, y:340, w:90,  h:18},
            {x:640, y:290, w:120, h:18},
            {x:760, y:230, w:100, h:18},
            {x:130, y:240, w:100, h:18},
            {x:290, y:180, w:80,  h:18},
            {x:450, y:160, w:100, h:18},
            {x:590, y:200, w:90,  h:18},
        ],
        enemies: [
            {type:'raptor', x:200, y:400},
            {type:'pterodactyl', x:350, y:150, range:180},
            {type:'raptor', x:510, y:400},
            {type:'pterodactyl', x:650, y:170, range:120},
            {type:'raptor', x:780, y:190},
            {type:'triceratops', x:420, y:400},
        ],
        collectibles: [
            {type:'bone', x:80,  y:335},
            {type:'egg',  x:245, y:285},
            {type:'bone', x:385, y:235},
            {type:'bone', x:525, y:315},
            {type:'egg',  x:660, y:265},
            {type:'bone', x:790, y:205},
            {type:'bone', x:155, y:215},
            {type:'egg',  x:315, y:155},
            {type:'bone', x:475, y:135},
        ],
        portal: {x:820, y:195},
        playerStart: {x:50, y:380},
    },
    {
        name: "Volcanic Summit",
        bgColors: ['#1a0000', '#3d0000', '#1a0800'],
        groundColor: '#4a1a00',
        platformColor: '#6b2200',
        platforms: [
            {x:0,   y:440, w:300, h:60},
            {x:350, y:440, w:200, h:60},
            {x:600, y:440, w:300, h:60},
            {x:80,  y:360, w:100, h:18},
            {x:240, y:300, w:100, h:18},
            {x:400, y:350, w:80,  h:18},
            {x:520, y:290, w:120, h:18},
            {x:680, y:330, w:100, h:18},
            {x:160, y:230, w:90,  h:18},
            {x:340, y:200, w:80,  h:18},
            {x:500, y:220, w:100, h:18},
            {x:660, y:250, w:90,  h:18},
            {x:750, y:180, w:100, h:18},
            {x:380, y:140, w:120, h:18},
        ],
        enemies: [
            {type:'raptor', x:100, y:400},
            {type:'triceratops', x:450, y:400},
            {type:'raptor', x:700, y:400},
            {type:'pterodactyl', x:280, y:170, range:200},
            {type:'pterodactyl', x:550, y:180, range:150},
            {type:'raptor', x:270, y:270},
            {type:'raptor', x:540, y:255},
            {type:'triceratops', x:380, y:110},
        ],
        collectibles: [
            {type:'egg',  x:105, y:335},
            {type:'bone', x:265, y:275},
            {type:'bone', x:425, y:325},
            {type:'egg',  x:545, y:265},
            {type:'bone', x:705, y:305},
            {type:'bone', x:185, y:205},
            {type:'egg',  x:360, y:175},
            {type:'bone', x:525, y:195},
            {type:'egg',  x:685, y:225},
            {type:'bone', x:775, y:155},
            {type:'egg',  x:405, y:115},
        ],
        portal: {x:820, y:340},
        playerStart: {x:40, y:380},
    },
    {
        name: "Frozen Tundra",
        bgColors: ['#0d1f3d', '#1a3a66', '#2a5b8f'],
        groundColor: '#8fb4d9',
        platformColor: '#b7d4ee',
        platforms: [
            {x:0,   y:440, w:280, h:60},
            {x:340, y:440, w:220, h:60},
            {x:620, y:440, w:280, h:60},
            {x:90,  y:360, w:110, h:18},
            {x:260, y:300, w:100, h:18},
            {x:410, y:340, w:90,  h:18},
            {x:540, y:290, w:110, h:18},
            {x:700, y:330, w:120, h:18},
            {x:150, y:230, w:100, h:18},
            {x:330, y:190, w:100, h:18},
            {x:510, y:210, w:110, h:18},
            {x:680, y:240, w:90,  h:18},
            {x:400, y:130, w:120, h:18},
        ],
        enemies: [
            {type:'raptor', x:160, y:400},
            {type:'raptor', x:460, y:400},
            {type:'triceratops', x:720, y:400},
            {type:'pterodactyl', x:300, y:160, range:180},
            {type:'pterodactyl', x:600, y:180, range:150},
            {type:'raptor', x:290, y:270},
            {type:'raptor', x:560, y:260},
        ],
        collectibles: [
            {type:'bone', x:115, y:335},
            {type:'egg',  x:285, y:275},
            {type:'bone', x:435, y:315},
            {type:'bone', x:565, y:265},
            {type:'egg',  x:725, y:305},
            {type:'bone', x:175, y:205},
            {type:'egg',  x:355, y:165},
            {type:'bone', x:535, y:185},
            {type:'bone', x:700, y:215},
            {type:'egg',  x:425, y:105},
        ],
        portal: {x:820, y:380},
        playerStart: {x:40, y:380},
    },
    {
        name: "Bone Caverns",
        bgColors: ['#12081a', '#2a1640', '#1a0a2e'],
        groundColor: '#3a2a4a',
        platformColor: '#5a3a6a',
        platforms: [
            {x:0,   y:440, w:900, h:60},
            {x:80,  y:370, w:100, h:18},
            {x:240, y:320, w:90,  h:18},
            {x:380, y:370, w:110, h:18},
            {x:540, y:310, w:100, h:18},
            {x:690, y:360, w:120, h:18},
            {x:150, y:260, w:90,  h:18},
            {x:290, y:220, w:80,  h:18},
            {x:440, y:240, w:100, h:18},
            {x:600, y:210, w:110, h:18},
            {x:760, y:250, w:100, h:18},
            {x:220, y:140, w:120, h:18},
            {x:430, y:150, w:100, h:18},
            {x:620, y:130, w:110, h:18},
        ],
        enemies: [
            {type:'raptor', x:180, y:400},
            {type:'raptor', x:430, y:400},
            {type:'raptor', x:720, y:400},
            {type:'triceratops', x:550, y:400},
            {type:'pterodactyl', x:350, y:180, range:180},
            {type:'pterodactyl', x:680, y:170, range:140},
            {type:'raptor', x:310, y:190},
            {type:'raptor', x:620, y:180},
        ],
        collectibles: [
            {type:'bone', x:105, y:345},
            {type:'bone', x:265, y:295},
            {type:'egg',  x:405, y:345},
            {type:'bone', x:565, y:285},
            {type:'bone', x:715, y:335},
            {type:'egg',  x:175, y:235},
            {type:'bone', x:315, y:195},
            {type:'bone', x:465, y:215},
            {type:'egg',  x:625, y:185},
            {type:'bone', x:785, y:225},
            {type:'bone', x:245, y:115},
            {type:'egg',  x:455, y:125},
            {type:'bone', x:645, y:105},
        ],
        portal: {x:820, y:70},
        playerStart: {x:40, y:380},
    },
    {
        name: "Meteor Strike",
        bgColors: ['#1a0000', '#4a0500', '#2a0000'],
        groundColor: '#5a1a00',
        platformColor: '#8a2a00',
        platforms: [
            {x:0,   y:440, w:240, h:60},
            {x:300, y:440, w:160, h:60},
            {x:520, y:440, w:140, h:60},
            {x:720, y:440, w:180, h:60},
            {x:100, y:370, w:90,  h:18},
            {x:230, y:310, w:80,  h:18},
            {x:350, y:360, w:80,  h:18},
            {x:470, y:300, w:100, h:18},
            {x:610, y:340, w:90,  h:18},
            {x:750, y:290, w:110, h:18},
            {x:180, y:240, w:80,  h:18},
            {x:320, y:200, w:90,  h:18},
            {x:470, y:220, w:80,  h:18},
            {x:610, y:190, w:100, h:18},
            {x:360, y:120, w:130, h:18},
            {x:590, y:90,  w:120, h:18},
        ],
        enemies: [
            {type:'raptor', x:140, y:400},
            {type:'raptor', x:340, y:400},
            {type:'triceratops', x:560, y:400},
            {type:'raptor', x:780, y:400},
            {type:'pterodactyl', x:260, y:160, range:200},
            {type:'pterodactyl', x:560, y:150, range:200},
            {type:'pterodactyl', x:700, y:80, range:160},
            {type:'raptor', x:260, y:280},
            {type:'raptor', x:500, y:270},
            {type:'triceratops', x:400, y:90},
        ],
        collectibles: [
            {type:'bone', x:125, y:345},
            {type:'egg',  x:255, y:285},
            {type:'bone', x:375, y:335},
            {type:'egg',  x:495, y:275},
            {type:'bone', x:635, y:315},
            {type:'bone', x:775, y:265},
            {type:'egg',  x:205, y:215},
            {type:'bone', x:345, y:175},
            {type:'bone', x:495, y:195},
            {type:'egg',  x:635, y:165},
            {type:'egg',  x:385, y:95},
            {type:'bone', x:615, y:65},
        ],
        portal: {x:820, y:30},
        playerStart: {x:40, y:380},
    }
];

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
        this.x = clamp(this.x, 0, W - this.w);

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
        if (lives <= 0) {
            triggerGameOver();
        } else {
            showMessage('💀 OUCH!', 'You lost a life! Press SPACE to continue...', true);
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
        ctx.fillStyle = '#2d8a2d';
        ctx.beginPath();
        ctx.ellipse(-8, 4, 14, 7, -0.4, 0, Math.PI*2);
        ctx.fill();
        // Tail tip
        ctx.fillStyle = '#1a6b1a';
        ctx.beginPath();
        ctx.ellipse(-18, 8, 7, 4, -0.6, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // Body
        ctx.fillStyle = '#3aaa3a';
        ctx.beginPath();
        ctx.ellipse(0, 4, 16, 20, 0, 0, Math.PI*2);
        ctx.fill();

        // Belly
        ctx.fillStyle = '#90ee90';
        ctx.beginPath();
        ctx.ellipse(4, 8, 9, 14, 0.2, 0, Math.PI*2);
        ctx.fill();

        // Neck + Head
        ctx.fillStyle = '#3aaa3a';
        ctx.beginPath();
        ctx.ellipse(8, -14, 10, 14, 0.3, 0, Math.PI*2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#3aaa3a';
        ctx.beginPath();
        ctx.ellipse(16, -22, 13, 10, 0.15, 0, Math.PI*2);
        ctx.fill();

        // Snout
        ctx.fillStyle = '#2d8a2d';
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
        ctx.fillStyle = '#1a6b1a';
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
        ctx.fillStyle = '#2d8a2d';
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
        ctx.fillStyle = '#2d8a2d';
        // Left leg
        ctx.save();
        ctx.translate(-4, 14);
        ctx.rotate(-legSwing);
        ctx.beginPath();
        ctx.ellipse(0, 5, 5, 9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#1a6b1a';
        ctx.beginPath();
        ctx.ellipse(-2, 14, 6, 4, -0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        // Right leg
        ctx.save();
        ctx.translate(4, 14);
        ctx.rotate(legSwing);
        ctx.beginPath();
        ctx.fillStyle = '#2d8a2d';
        ctx.ellipse(0, 5, 5, 9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#1a6b1a';
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
    }
    get hitbox() { return {x:this.x+4, y:this.y+4, w:this.w-8, h:this.h-8}; }
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
        if (this.x < 0 || this.x + this.w > W) { this.vx = -this.vx; }
        this.facing = this.vx > 0 ? 1 : -1;

        // Animation
        this.frameTimer++;
        if (this.frameTimer > 8) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
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
        if (this.x + this.w > W) { this.vx = -Math.abs(this.vx); this.facing = -1; }
        this.facing = this.vx > 0 ? 1 : -1;
        this.wingAngle += 0.18;
        this.frameTimer++;
        if (this.frameTimer > 6) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
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
        if (this.x < 0 || this.x + this.w > W) this.vx = -this.vx;
        this.facing = this.vx > 0 ? 1 : -1;

        this.frameTimer++;
        if (this.frameTimer > 10) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
    }

    draw() {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + this.h/2);
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
            // Glow
            ctx.shadowColor = '#ffffaa';
            ctx.shadowBlur = 8 + glow * 6;
            // Bone shape
            ctx.fillStyle = '#f0e68c';
            ctx.beginPath(); ctx.arc(-6, -3, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(6, -3, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(-6, 4, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(6, 4, 5, 0, Math.PI*2); ctx.fill();
            ctx.fillRect(-4, -3, 8, 7);
            // Shine
            ctx.fillStyle = '#fffff0';
            ctx.beginPath(); ctx.arc(-5, -4, 1.5, 0, Math.PI*2); ctx.fill();
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

// Static layer: gradient + fixed stars + mountains/trees/lava (per level)
function drawBackgroundStatic(levelDef) {
    const [c1, c2, c3] = levelDef.bgColors;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.5, c2);
    grad.addColorStop(1, c3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Static stars (twinkle baked in at a mid-alpha; avoids per-frame arcs)
    bgStars.forEach(s => {
        ctx.fillStyle = `rgba(255,255,255,${0.45 + s.size * 0.15})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Distant mountains/volcano/trees/etc silhouettes
    drawMountains(levelDef);
}

// Dynamic layer: clouds drift across the screen each frame
function drawClouds() {
    clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.w < 0) c.x = W;
        ctx.fillStyle = `rgba(255,200,100,${c.opacity})`;
        ctx.beginPath();
        ctx.ellipse(c.x + c.w/2, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2);
        ctx.fill();
    });
}

// Pre-render the static scene (background + platforms) into an offscreen
// canvas. This is the single biggest perf win: we go from hundreds of
// gradient/path calls per frame to one drawImage per frame.
function buildStaticBackground() {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const prev = ctx;
    ctx = off.getContext('2d');
    try {
        drawBackgroundStatic(levelDef);
        drawPlatforms(levelDef, platforms);
    } finally {
        ctx = prev;
    }
    bgStatic = off;
}

function drawMountains(levelDef) {
    const isVolcano = levelDef.name.includes("Volcanic") || levelDef.name.includes("Lava");
    const isJungle = levelDef.name.includes("Jungle");

    if (isVolcano || levelDef.name.includes("Lava")) {
        // Volcanoes
        ctx.fillStyle = '#3d1200';
        for (let i = 0; i < 3; i++) {
            const bx = 120 + i * 290;
            const bh = 130 + i * 30;
            ctx.beginPath();
            ctx.moveTo(bx - 90, H);
            ctx.lineTo(bx, H - bh);
            ctx.lineTo(bx + 90, H);
            ctx.closePath(); ctx.fill();
            // Lava glow at tip
            const lavGrad = ctx.createRadialGradient(bx, H - bh - 5, 2, bx, H - bh, 25);
            lavGrad.addColorStop(0, 'rgba(255,140,0,0.9)');
            lavGrad.addColorStop(0.5, 'rgba(255,50,0,0.4)');
            lavGrad.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = lavGrad;
            ctx.beginPath();
            ctx.arc(bx, H - bh - 5, 25, 0, Math.PI*2);
            ctx.fill();
        }
        // Lava pools on ground
        ctx.fillStyle = '#ff4400';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.ellipse(180, H - 28, 50, 12, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(550, H - 28, 40, 10, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    if (isJungle) {
        // Trees silhouette
        ctx.fillStyle = '#003300';
        for (let i = 0; i < 12; i++) {
            const tx = i * 80 + 20;
            const th = 80 + Math.sin(i * 1.3) * 40;
            // Trunk
            ctx.fillRect(tx + 12, H - th, 10, th);
            // Canopy
            ctx.beginPath();
            ctx.arc(tx + 17, H - th - 15, 28, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tx + 5, H - th - 5, 20, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tx + 30, H - th - 8, 22, 0, Math.PI*2);
            ctx.fill();
        }
    }

    if (levelDef.name.includes('Tundra') || levelDef.name.includes('Glacier')) {
        // Snowy peaks
        ctx.fillStyle = '#6a7a90';
        for (let i = 0; i < 4; i++) {
            const bx = 90 + i * 240;
            const bh = 120 + (i % 2) * 40;
            ctx.beginPath();
            ctx.moveTo(bx - 110, H);
            ctx.lineTo(bx, H - bh);
            ctx.lineTo(bx + 110, H);
            ctx.closePath(); ctx.fill();
            // Snow cap
            ctx.fillStyle = '#e8f2ff';
            ctx.beginPath();
            ctx.moveTo(bx - 28, H - bh + 30);
            ctx.lineTo(bx, H - bh);
            ctx.lineTo(bx + 28, H - bh + 30);
            ctx.lineTo(bx + 14, H - bh + 26);
            ctx.lineTo(bx + 4, H - bh + 34);
            ctx.lineTo(bx - 10, H - bh + 24);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#6a7a90';
        }
        // Frozen ground glaze
        ctx.fillStyle = 'rgba(200,230,255,0.25)';
        ctx.fillRect(0, H - 60, W, 4);
    }

    if (levelDef.name.includes('Cavern') || levelDef.name.includes('Cave')) {
        // Stalactites from the top
        ctx.fillStyle = '#2a1a3a';
        for (let i = 0; i < 14; i++) {
            const sx = i * 66 + 12;
            const sh = 30 + ((i * 53) % 40);
            ctx.beginPath();
            ctx.moveTo(sx - 10, 0);
            ctx.lineTo(sx, sh);
            ctx.lineTo(sx + 10, 0);
            ctx.closePath(); ctx.fill();
        }
        // Glowing crystal clusters on the walls
        const crystalSpots = [[40, 340], [860, 300], [60, 240], [840, 200]];
        crystalSpots.forEach(([cx, cy]) => {
            ctx.fillStyle = 'rgba(170,120,255,0.9)';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 14);
            ctx.lineTo(cx + 8, cy);
            ctx.lineTo(cx, cy + 10);
            ctx.lineTo(cx - 8, cy);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(230,200,255,0.7)';
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 4, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    if (levelDef.name.includes('Meteor') || levelDef.name.includes('Apocalypse')) {
        // Angry sky glow
        const skyGrad = ctx.createRadialGradient(W / 2, H, 30, W / 2, H, W);
        skyGrad.addColorStop(0, 'rgba(255,140,0,0.35)');
        skyGrad.addColorStop(1, 'rgba(120,0,0,0)');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);
        // Falling meteor streaks (static)
        ctx.strokeStyle = '#ffcc66';
        ctx.lineWidth = 2;
        const streaks = [[100, 30, 180, 120], [420, 10, 500, 110], [720, 20, 820, 140]];
        streaks.forEach(([x1, y1, x2, y2]) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.fillStyle = '#ff7722';
            ctx.beginPath();
            ctx.arc(x2, y2, 5, 0, Math.PI * 2);
            ctx.fill();
        });
        // Jagged cliff silhouette in the distance
        ctx.fillStyle = '#1a0000';
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 40) {
            ctx.lineTo(x, H - 90 - Math.abs(Math.sin(x * 0.03)) * 80);
        }
        ctx.lineTo(W, H);
        ctx.closePath(); ctx.fill();
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
    levelDef = LEVELS[levelIdx - 1];
    platforms = levelDef.platforms;
    player = new Player(levelDef.playerStart.x, levelDef.playerStart.y);
    enemies = levelDef.enemies.map(e => {
        if (e.type === 'raptor') return new Raptor(e.x, e.y);
        if (e.type === 'pterodactyl') return new Pterodactyl(e.x, e.y, e.range);
        if (e.type === 'triceratops') return new Triceratops(e.x, e.y);
    });
    collectibles = levelDef.collectibles.map(c => new Collectible(c.x, c.y, c.type));
    portal = new Portal(levelDef.portal.x, levelDef.portal.y);
    particles = [];
    generateClouds();
    generateStars();
    buildStaticBackground();
    levelTransitioning = false;
    document.getElementById('level-display').textContent = `Level ${levelIdx}`;
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
    document.getElementById('score-display').textContent = `Score: ${score}`;
    document.getElementById('lives-display').textContent = `x${lives}`;
    document.getElementById('bones-display').textContent = `Bones: ${bones}`;
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
function triggerGameOver() {
    gameRunning = false;
    gameOver = true;
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
        <div class="deco">💀</div>
        <h1 style="color:#ff4444">GAME OVER</h1>
        <div class="subtitle" style="color:#ffaa66">The dinos got you! Score: ${score}</div>
        <div class="controls-info">You collected <span>${bones} bones</span> and <span>${score} points</span></div>
        <button id=\"start-btn\" style=\"padding:14px 40px;font-size:20px;font-family:Courier New,monospace;font-weight:bold;background:linear-gradient(135deg,#ff6b1a,#cc4400);color:white;border:3px solid #ffd700;border-radius:8px;cursor:pointer;\">🔄 TRY AGAIN</button>
    `;
    ov.style.display = 'flex';
    setTimeout(() => { const b = document.getElementById('start-btn'); if(b) b.addEventListener('click', restartGame); }, 50);
}

function triggerWin() {
    gameRunning = false;
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
        <div class="deco">🏆🦕🎉</div>
        <h1 style="color:#ffd700">YOU WIN!</h1>
        <div class="subtitle" style="color:#90ee90">The dinos are free! Final Score: ${score}</div>
        <div class="controls-info">Bones collected: <span>${bones}</span> | Final score: <span>${score}</span></div>
        <button id=\"start-btn\" style=\"padding:14px 40px;font-size:20px;font-family:Courier New,monospace;font-weight:bold;background:linear-gradient(135deg,#ff6b1a,#cc4400);color:white;border:3px solid #ffd700;border-radius:8px;cursor:pointer;\">🔄 PLAY AGAIN</button>
    `;
    ov.style.display = 'flex';
    setTimeout(() => { const b = document.getElementById('start-btn'); if(b) b.addEventListener('click', restartGame); }, 50);
}

function restartGame() {
    score = 0; lives = 3; bones = 0; currentLevel = 1;
    updateHUD();
    loadLevel(1);
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('message-box').style.display = 'none';
    messageActive = false;
    const wasRunning = gameRunning;
    gameRunning = true;
    gameOver = false;
    // The main loop returns early when gameRunning is false, so we need to
    // kick it back off after a game-over or win. Guard against kicking a
    // second loop if one is somehow still active.
    if (!wasRunning) loop();
}

function startGame() {
    document.getElementById('overlay').style.display = 'none';
    loadLevel(1);
    gameRunning = true;
    loop();
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
                showMessage('🥚 Dino Egg!', '+150 pts +2 bones!', false);
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
                showMessage(`💥 ${e.type.charAt(0).toUpperCase()+e.type.slice(1)} stomped!`, `+${pts} pts!`, false);
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
                    showMessage('💥 OUCH!', `${lives} lives remaining!`, false);
                }
            }
        }
    });

    // Portal
    if (!levelTransitioning && rectOverlap(player.hitbox, portal.hitbox)) {
        levelTransitioning = true;
        score += 500;
        updateHUD();
        if (currentLevel < LEVELS.length) {
            currentLevel++;
            showMessage(`🌟 Level ${currentLevel}!`, `Entering ${LEVELS[currentLevel-1].name}...`, false, () => {
                loadLevel(currentLevel);
            });
        } else {
            setTimeout(triggerWin, 500);
        }
    }
}

// ── Draw HUD overlay on canvas ────────────────────────────────
function drawCanvasHUD() {
    // Level name
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, 28);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`🌋 ${levelDef.name} — Reach the portal! 🚪`, W/2, 18);
    ctx.textAlign = 'left';
}

// ── Main Game Loop ────────────────────────────────────────────
let lastTime = 0;
function loop(ts = 0) {
    if (!gameRunning) return;
    requestAnimationFrame(loop);

    // Clear & draw static scene from the pre-rendered offscreen canvas
    if (bgStatic) {
        ctx.drawImage(bgStatic, 0, 0);
    } else {
        drawBackgroundStatic(levelDef);
        drawPlatforms(levelDef, platforms);
    }
    drawClouds();

    // Update & draw entities
    portal.update(); portal.draw();
    collectibles.forEach(c => { c.update(); c.draw(); });
    enemies.forEach(e => {
        if (e.type === 'pterodactyl') e.update();
        else e.update(platforms);
        e.draw();
    });

    if (!messageActive) {
        player.update(platforms);
    }
    player.draw();

    // Collisions
    if (!messageActive && !levelTransitioning) {
        checkCollisions();
    }

    // Handle message dismissal
    if (messageActive && (keys['Space'] || keys['Enter'])) {
        hideMessage();
    }

    updateParticles();
    drawParticles();
    drawCanvasHUD();
}

// ── Kick off ──────────────────────────────────────────────────
generateStars();
generateClouds();

// Make functions globally accessible
window.startGame = startGame;
window.restartGame = restartGame;
