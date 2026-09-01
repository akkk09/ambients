/**
 * Ambients - Ambient Desk Companion / "Flow Pet"
 * Virtual Bonsai / Study Cat companion that grows and levels up
 * as you complete focus blocks and check off tasks.
 */

import { wsClient } from './ws-client.js';
import { storage } from './storage.js';
import { audio } from './audio.js';

export const COMPANION_STAGES = {
  bonsai: [
    { level: 1, name: 'Tiny Sprout', icon: '🌱', minXp: 0, maxXp: 60, desc: 'Planting your study roots' },
    { level: 2, name: 'Growing Bonsai', icon: '🌿', minXp: 60, maxXp: 180, desc: 'Branching into steady focus' },
    { level: 3, name: 'Blooming Bonsai', icon: '🌸', minXp: 180, maxXp: 360, desc: 'Flourishing in deep flow' },
    { level: 4, name: 'Celestial Tree', icon: '👑🌳', minXp: 360, maxXp: 1000, desc: 'Master of quiet discipline' }
  ],
  cat: [
    { level: 1, name: 'Sleeping Kitten', icon: '😴🐱', minXp: 0, maxXp: 60, desc: 'Quietly snoozing on your desk' },
    { level: 2, name: 'Attentive Cat', icon: '🐱', minXp: 60, maxXp: 180, desc: 'Watching you study diligently' },
    { level: 3, name: 'Purring Companion', icon: '😻✨', minXp: 180, maxXp: 360, desc: 'Radiating calm study vibes' },
    { level: 4, name: 'Crowned Study Lion', icon: '🦁👑', minXp: 360, maxXp: 1000, desc: 'Guardian of peak focus' }
  ]
};

export class CompanionManager {
  constructor() {
    this.companion = storage.getCompanion();
    this.partnerCompanion = null;

    // DOM Elements
    this.myCompanionIconEl = null;
    this.myCompanionNameEl = null;
    this.myCompanionStageEl = null;
    this.myCompanionProgressEl = null;
    this.waterBtn = null;

    this.partnerCompanionIconEl = null;
    this.partnerCompanionNameEl = null;
    this.partnerCompanionStageEl = null;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.myCompanionIconEl = elements.myCompanionIcon;
    this.myCompanionNameEl = elements.myCompanionName;
    this.myCompanionStageEl = elements.myCompanionStage;
    this.myCompanionProgressEl = elements.myCompanionProgress;
    this.waterBtn = elements.waterBtn;

    this.partnerCompanionIconEl = elements.partnerCompanionIcon;
    this.partnerCompanionNameEl = elements.partnerCompanionName;
    this.partnerCompanionStageEl = elements.partnerCompanionStage;

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    if (this.waterBtn) {
      this.waterBtn.addEventListener('click', () => {
        this.interactCompanion();
      });
    }
  }

  initWebSocketListeners() {
    wsClient.on('ROOM_SNAPSHOT', (data) => {
      if (data && data.partner && data.partner.companion) {
        this.partnerCompanion = data.partner.companion;
        this.renderPartnerCompanion();
      }
    });

    wsClient.on('PEER_JOINED', (data) => {
      if (data && data.partner && data.partner.companion) {
        this.partnerCompanion = data.partner.companion;
        this.renderPartnerCompanion();
      }
    });

    wsClient.on('PARTNER_COMPANION_UPDATED', (data) => {
      if (data && data.companion) {
        this.partnerCompanion = data.companion;
        this.renderPartnerCompanion();
      }
    });
  }

  addXp(amount) {
    this.companion.xp = (this.companion.xp || 0) + amount;
    this.updateStage();
    storage.saveCompanion(this.companion);
    this.broadcastCompanion('xp_gain');
    this.render();
  }

  updateStage() {
    const list = COMPANION_STAGES[this.companion.type] || COMPANION_STAGES.bonsai;
    let newStage = 1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (this.companion.xp >= list[i].minXp) {
        newStage = list[i].level;
        break;
      }
    }
    this.companion.stage = newStage;
  }

  interactCompanion() {
    this.addXp(5);
    audio.playTaskDing();

    // Spawn water/heart particles exactly above the water/companion button
    const targetEl = this.waterBtn || this.myCompanionIconEl;
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const p = document.createElement('div');
      p.className = 'particle-nudge text-xl';
      p.textContent = this.companion.type === 'cat' ? '💖' : '💧';
      p.style.position = 'fixed';
      p.style.left = `${rect.left + rect.width / 2}px`;
      p.style.top = `${rect.top - 8}px`;
      p.style.zIndex = '9999';
      p.style.pointerEvents = 'none';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }
  }

  broadcastCompanion(action = 'update') {
    wsClient.send('COMPANION_ACTION', {
      action,
      companion: this.companion
    });
  }

  getStageConfig(comp) {
    const type = comp.type || 'bonsai';
    const list = COMPANION_STAGES[type] || COMPANION_STAGES.bonsai;
    const stageIdx = Math.max(0, Math.min(list.length - 1, (comp.stage || 1) - 1));
    return list[stageIdx];
  }

  render() {
    const stage = this.getStageConfig(this.companion);

    if (this.myCompanionIconEl) {
      this.myCompanionIconEl.textContent = stage.icon;
    }

    if (this.myCompanionNameEl) {
      this.myCompanionNameEl.textContent = stage.name;
    }

    if (this.myCompanionStageEl) {
      this.myCompanionStageEl.textContent = `Lvl ${stage.level} • ${stage.desc}`;
    }

    if (this.myCompanionProgressEl) {
      const range = stage.maxXp - stage.minXp;
      const current = Math.max(0, this.companion.xp - stage.minXp);
      const pct = Math.min(100, Math.round((current / range) * 100));
      this.myCompanionProgressEl.style.width = `${pct}%`;
    }

    this.renderPartnerCompanion();
  }

  renderPartnerCompanion() {
    if (!this.partnerCompanion || !this.partnerCompanionIconEl) return;

    const stage = this.getStageConfig(this.partnerCompanion);

    if (this.partnerCompanionIconEl) {
      this.partnerCompanionIconEl.textContent = stage.icon;
    }
    if (this.partnerCompanionNameEl) {
      this.partnerCompanionNameEl.textContent = stage.name;
    }
    if (this.partnerCompanionStageEl) {
      this.partnerCompanionStageEl.textContent = `Lvl ${stage.level} • ${stage.desc}`;
    }
  }
}

export const companionManager = new CompanionManager();
