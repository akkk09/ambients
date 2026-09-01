/**
 * Ambients - Theme FX & Interactive Confetti / Particle Engine
 * Triggers interactive theme-specific effects (confetti, bubbles, cyber sparks)
 */
class ThemeFXEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrame = null;
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'theme-fx-canvas';
    this.canvas.className = 'fixed inset-0 pointer-events-none';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  spawnTaskCelebration(x = window.innerWidth / 2, y = window.innerHeight / 2) {
    const currentTheme = document.body.getAttribute('data-theme') || 'nextjs';

    if (currentTheme === 'sakura' || currentTheme === 'sunset') {
      // Bubbly Pink Confetti & Hearts
      const colors = ['#f472b6', '#fb7185', '#fda4af', '#f43f5e', '#e879f9', '#ffffff'];
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 7;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          radius: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.015 + Math.random() * 0.015,
          type: Math.random() > 0.5 ? 'circle' : 'heart',
          rotation: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.1
        });
      }
    } else if (currentTheme === 'matrix' || currentTheme === 'obsidian') {
      // Cyber Terminal Sparks
      const colors = ['#10b981', '#34d399', '#6ee7b7', '#059669', '#a7f3d0'];
      for (let i = 0; i < 30; i++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          radius: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.02 + Math.random() * 0.02,
          type: 'spark'
        });
      }
    } else {
      // Clean Minimalist Star Dust (NextJS / Aurora / Coffee / Matcha)
      const colors = ['#38bdf8', '#818cf8', '#ffffff', '#a855f7'];
      for (let i = 0; i < 25; i++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          radius: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.02 + Math.random() * 0.015,
          type: 'circle'
        });
      }
    }
  }

  loop() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // subtle gravity
      p.vx *= 0.98;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;

      if (p.type === 'heart') {
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation || 0);
        if (p.vRot) p.rotation += p.vRot;
        this.drawHeart(0, 0, p.radius);
      } else if (p.type === 'spark') {
        this.ctx.fillRect(p.x, p.y, p.radius * 1.5, p.radius * 1.5);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    requestAnimationFrame(() => this.loop());
  }

  drawHeart(x, y, size) {
    const s = size * 0.8;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + s / 4);
    this.ctx.quadraticCurveTo(x, y, x + s / 4, y);
    this.ctx.quadraticCurveTo(x + s / 2, y, x + s / 2, y + s / 4);
    this.ctx.quadraticCurveTo(x + s / 2, y, x + (s * 3) / 4, y);
    this.ctx.quadraticCurveTo(x + s, y, x + s, y + s / 4);
    this.ctx.quadraticCurveTo(x + s, y + s / 2, x + (s * 3) / 4, y + (s * 3) / 4);
    this.ctx.lineTo(x + s / 2, y + s);
    this.ctx.lineTo(x + s / 4, y + (s * 3) / 4);
    this.ctx.quadraticCurveTo(x, y + s / 2, x, y + s / 4);
    this.ctx.fill();
  }
}

export const themeFX = new ThemeFXEngine();
