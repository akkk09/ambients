/**
 * Ambients - Micro-Encouragement & Nudge System
 * Anti-spam throttled reactions, floating particle effects, and acoustic micro-chimes.
 */

import { wsClient } from './ws-client.js';
import { audio } from './audio.js';

export const NUDGE_CONFIG = {
  fistbump: { emoji: '👊', label: 'Fist Bump', text: 'Fist bump from partner!' },
  coffee: { emoji: '☕', label: 'Coffee Ping', text: 'Grab some coffee/tea!' },
  sparkle: { emoji: '✨', label: 'Sparkle', text: 'You’re doing amazing!' },
  bolt: { emoji: '⚡', label: 'Keep Going', text: 'Keep that momentum!' },
  water: { emoji: '💧', label: 'Hydrate', text: 'Stay hydrated!' },
  celebrate: { emoji: '🎉', label: 'Celebrate', text: 'Crushing this block!' }
};

export class NudgeManager {
  constructor() {
    this.dockEl = null;
    this.targetDeskEl = null;
    this.toastContainerEl = null;
    this.isCoolingDown = false;
    this.cooldownEndTime = 0;
    this.cooldownInterval = null;
    this.isPartnerDeepFocus = false;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.dockEl = elements.dock;
    this.targetDeskEl = elements.targetDesk;
    this.toastContainerEl = elements.toastContainer;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.dockEl) return;

    this.dockEl.querySelectorAll('[data-nudge]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nudgeType = btn.dataset.nudge;
        this.sendNudge(nudgeType);
      });
    });
  }

  initWebSocketListeners() {
    // 1. Nudge received from partner
    wsClient.on('NUDGE_RECEIVED', (data) => {
      if (!data) return;
      this.displayIncomingNudge(data);
    });

    // 2. Nudge sent acknowledgment with cooldown
    wsClient.on('NUDGE_SENT_ACK', (data) => {
      this.startCooldown(data?.cooldownMs || 5000);
    });

    // 3. Nudge throttled notification
    wsClient.on('NUDGE_THROTTLED', (data) => {
      this.showToast(data.message || 'Please wait before sending another encouragement.', 'warning');
    });
  }

  setPartnerDeepFocus(isDeepFocus) {
    this.isPartnerDeepFocus = isDeepFocus;
    if (this.dockEl) {
      if (isDeepFocus) {
        this.dockEl.classList.add('opacity-70');
        this.dockEl.title = 'Partner is in Deep Focus — nudges will be delivered softly';
      } else {
        this.dockEl.classList.remove('opacity-70');
        this.dockEl.removeAttribute('title');
      }
    }
  }

  sendNudge(nudgeType) {
    if (this.isCoolingDown) {
      const remainingSecs = Math.ceil((this.cooldownEndTime - Date.now()) / 1000);
      this.showToast(`Cooldown active (${remainingSecs}s remaining)`, 'warning');
      return;
    }

    const config = NUDGE_CONFIG[nudgeType];
    if (!config) return;

    // Send to WebSocket server
    wsClient.send('SEND_NUDGE', {
      nudgeType,
      text: config.text
    });

    // Optimistically trigger local cooldown & audio
    audio.playNudgeSound(nudgeType);
    this.startCooldown(5000);
  }

  startCooldown(durationMs = 5000) {
    this.isCoolingDown = true;
    this.cooldownEndTime = Date.now() + durationMs;

    if (this.cooldownInterval) clearInterval(this.cooldownInterval);

    const updateCooldownUI = () => {
      const now = Date.now();
      const remaining = Math.max(0, this.cooldownEndTime - now);

      if (remaining <= 0) {
        this.isCoolingDown = false;
        clearInterval(this.cooldownInterval);
        this.clearCooldownUI();
      } else {
        const seconds = (remaining / 1000).toFixed(0);
        this.renderCooldownOverlay(seconds);
      }
    };

    updateCooldownUI();
    this.cooldownInterval = setInterval(updateCooldownUI, 200);
  }

  renderCooldownOverlay(seconds) {
    if (!this.dockEl) return;
    this.dockEl.querySelectorAll('[data-nudge]').forEach(btn => {
      btn.disabled = true;
      let overlay = btn.querySelector('.cooldown-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'cooldown-overlay';
        btn.appendChild(overlay);
      }
      overlay.textContent = `${seconds}s`;
    });
  }

  clearCooldownUI() {
    if (!this.dockEl) return;
    this.dockEl.querySelectorAll('[data-nudge]').forEach(btn => {
      btn.disabled = false;
      const overlay = btn.querySelector('.cooldown-overlay');
      if (overlay) overlay.remove();
    });
  }

  displayIncomingNudge(data) {
    const { nudgeType, fromName, text, isSuppressed } = data;
    const config = NUDGE_CONFIG[nudgeType] || { emoji: '✨', label: 'Cheer', text: 'Encouragement!' };

    // Play subtle synthesized sound
    if (!isSuppressed) {
      audio.playNudgeSound(nudgeType);
    }

    // Spawn floating particle reaction on partner card / screen
    this.spawnFloatingParticles(config.emoji);

    // Render 2-second floating toast notification
    const sender = fromName || 'Partner';
    const message = `${config.emoji} <strong>${sender}</strong>: ${text || config.text}`;
    this.showToast(message, 'nudge', 2200);
  }

  spawnFloatingParticles(emoji) {
    const target = this.targetDeskEl || document.body;
    const rect = target.getBoundingClientRect();

    // Spawn 3 to 5 floating micro-particles
    const particleCount = 4;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle-nudge text-2xl';
      particle.textContent = emoji;

      // Random horizontal offset within target area
      const offsetX = rect.left + rect.width * 0.3 + Math.random() * (rect.width * 0.4);
      const offsetY = rect.top + rect.height * 0.7 + (Math.random() * 40 - 20);
      const rot = (Math.random() * 30 - 15) + 'deg';

      particle.style.left = `${offsetX}px`;
      particle.style.top = `${offsetY}px`;
      particle.style.setProperty('--rot', rot);
      particle.style.animationDelay = `${i * 0.1}s`;

      document.body.appendChild(particle);

      setTimeout(() => {
        particle.remove();
      }, 2300);
    }
  }

  showToast(htmlContent, type = 'info', duration = 2000) {
    if (!this.toastContainerEl) return;

    const toast = document.createElement('div');
    toast.className = `toast-anim flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-md shadow-lg border transition-all ${
      type === 'nudge'
        ? 'bg-slate-900/90 text-white border-sky-500/40 shadow-sky-500/10'
        : type === 'warning'
        ? 'bg-amber-950/90 text-amber-200 border-amber-500/40'
        : 'bg-slate-900/90 text-slate-200 border-white/15'
    }`;

    toast.innerHTML = htmlContent;
    this.toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }
}

export const nudgeManager = new NudgeManager();
window.nudgeManager = nudgeManager;
