/**
 * Ambients - Zen Flow Screen Mode
 * Fullscreen, distraction-free view with large glowing timer digits
 * and ambient partner presence. Toggle with 'F' key or Zen button.
 */

import { timer } from './timer.js';
import { taskManager } from './tasks.js';
import { presenceManager } from './presence.js';

export class ZenModeManager {
  constructor() {
    this.isActive = false;
    this.overlayEl = null;
    this.timerDigitsEl = null;
    this.myFocusEl = null;
    this.partnerFocusEl = null;
    this.presenceDotEl = null;
    this.exitBtn = null;
    this.zenToggleBtn = null;
  }

  mount(elements) {
    this.overlayEl = elements.overlay;
    this.timerDigitsEl = elements.timerDigits;
    this.myFocusEl = elements.myFocus;
    this.partnerFocusEl = elements.partnerFocus;
    this.presenceDotEl = elements.presenceDot;
    this.exitBtn = elements.exitBtn;
    this.zenToggleBtn = elements.zenToggleBtn;

    this.bindEvents();
  }

  bindEvents() {
    if (this.zenToggleBtn) {
      this.zenToggleBtn.addEventListener('click', () => this.toggleZenMode());
    }

    if (this.exitBtn) {
      this.exitBtn.addEventListener('click', () => this.exitZenMode());
    }

    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      // 'F' key toggles Zen mode when not in input
      if (e.key.toLowerCase() === 'f' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.toggleZenMode();
      }

      // 'Escape' key exits Zen mode
      if (e.key === 'Escape' && this.isActive) {
        this.exitZenMode();
      }
    });
  }

  toggleZenMode() {
    if (this.isActive) {
      this.exitZenMode();
    } else {
      this.enterZenMode();
    }
  }

  enterZenMode() {
    this.isActive = true;
    if (this.overlayEl) {
      this.overlayEl.classList.remove('hidden');
    }
    this.updateZenDisplay();

    // Try requesting browser fullscreen if available
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  exitZenMode() {
    this.isActive = false;
    if (this.overlayEl) {
      this.overlayEl.classList.add('hidden');
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  updateZenDisplay() {
    if (!this.isActive) return;

    if (this.timerDigitsEl) {
      this.timerDigitsEl.textContent = timer.formatTime(timer.remaining);
    }

    if (this.myFocusEl) {
      this.myFocusEl.textContent = taskManager.myFocusText || 'Deep Focus Block';
    }

    if (this.partnerFocusEl) {
      this.partnerFocusEl.textContent = taskManager.partnerFocusText || 'Partner in session';
    }

    if (this.presenceDotEl) {
      const isPartnerActive = presenceManager.partnerStatus?.isTabActive;
      this.presenceDotEl.className = isPartnerActive
        ? 'w-2.5 h-2.5 rounded-full bg-emerald-400 ambient-dot-pulse'
        : 'w-2.5 h-2.5 rounded-full bg-amber-400/80';
    }
  }
}

export const zenManager = new ZenModeManager();
