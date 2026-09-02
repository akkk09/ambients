/**
 * Ambients - Synchronized Session Timer (Pomodoro / Stopwatch)
 * Precise, drift-compensated timer engine with Web Audio acoustic cues,
 * end-of-block debrief integration, and dynamic ambient lighting.
 */

import { wsClient } from './ws-client.js';
import { audio } from './audio.js';
import { storage } from './storage.js';

export class SessionTimer {
  constructor() {
    this.mode = '25m'; // '25m' | '5m' | '50m' | 'stopwatch' | 'custom'
    this.duration = 25 * 60;
    this.remaining = 25 * 60;
    this.isRunning = false;
    this.isLinked = true;
    this.intervalId = null;

    // UI Elements
    this.digitsEl = null;
    this.modeButtons = {};
    this.toggleBtn = null;
    this.resetBtn = null;
    this.linkToggleBtn = null;
    this.progressBarEl = null;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.digitsEl = elements.digits;
    this.toggleBtn = elements.toggleBtn;
    this.resetBtn = elements.resetBtn;
    this.linkToggleBtn = elements.linkToggleBtn;
    this.progressBarEl = elements.progressBar;
    this.modeButtons = elements.modeButtons || {};

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleRunState());
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.resetTimer());
    }

    if (this.linkToggleBtn) {
      this.linkToggleBtn.addEventListener('click', () => this.toggleLinkMode());
    }

    Object.entries(this.modeButtons).forEach(([modeKey, btn]) => {
      btn.addEventListener('click', () => this.setMode(modeKey));
    });
  }

  initWebSocketListeners() {
    wsClient.on('ROOM_SNAPSHOT', (data) => {
      if (data && data.timer) {
        this.applyServerTimerState(data.timer);
      }
    });

    wsClient.on('TIMER_SYNC', (data) => {
      if (this.isLinked) {
        this.applyServerTimerState(data);
      }
    });

    wsClient.on('TIMER_TICK', (data) => {
      if (this.isLinked && data) {
        this.remaining = data.remaining;
        this.isRunning = data.isRunning;
        if (data.isFinished) {
          this.handleTimerFinished();
        }
        this.render();
      }
    });
  }

  applyServerTimerState(timerState) {
    this.mode = timerState.mode || '25m';
    this.duration = timerState.duration !== undefined ? timerState.duration : 25 * 60;
    this.remaining = timerState.remaining !== undefined ? timerState.remaining : 25 * 60;
    this.isRunning = !!timerState.isRunning;
    if (timerState.linked !== undefined) {
      this.isLinked = timerState.linked;
    }

    if (this.isRunning) {
      this.startLocalTicker();
    } else {
      this.stopLocalTicker();
    }

    this.render();
  }

  startLocalTicker() {
    this.stopLocalTicker();
    this.intervalId = setInterval(() => {
      if (this.mode === 'stopwatch') {
        this.remaining++;
      } else {
        if (this.remaining > 0) {
          this.remaining--;
          if (this.remaining === 0) {
            this.handleTimerFinished();
          }
        }
      }
      this.render();
    }, 1000);
  }

  stopLocalTicker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  handleTimerFinished() {
    this.isRunning = false;
    this.stopLocalTicker();

    if (this.mode === '5m') {
      audio.playBreakChime();
    } else {
      audio.playFocusBell();
      const focusMins = this.mode === '50m' ? 50 : 25;
      storage.addFocusMinutes(focusMins);

      // Trigger End-of-Block Debrief Modal
      if (window.debriefManager) {
        window.debriefManager.openDebrief();
      }
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(this.mode === '5m' ? 'Break Complete! ⚡' : 'Focus Session Complete! 🔔', {
        body: this.mode === '5m' ? 'Ready to dive back into deep focus?' : 'Great job! Take 30s to debrief and recharge.',
        icon: '/favicon.ico'
      });
    }

    this.render();
  }

  toggleRunState() {
    // Request notification permission on first interaction
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    this.isRunning = !this.isRunning;

    if (this.isRunning) {
      this.startLocalTicker();
    } else {
      this.stopLocalTicker();
    }

    if (this.isLinked) {
      wsClient.send('TIMER_ACTION', {
        action: this.isRunning ? 'start' : 'pause',
        mode: this.mode,
        duration: this.duration,
        remaining: this.remaining
      });
    }

    this.render();
  }

  resetTimer() {
    this.isRunning = false;
    this.stopLocalTicker();

    if (this.mode === 'stopwatch') {
      this.remaining = 0;
    } else {
      this.remaining = this.duration;
    }

    if (this.isLinked) {
      wsClient.send('TIMER_ACTION', {
        action: 'reset',
        mode: this.mode,
        duration: this.duration
      });
    }

    this.render();
  }

  setMode(newMode, customDuration = null) {
    this.mode = newMode;
    this.isRunning = false;
    this.stopLocalTicker();

    if (newMode === '25m') {
      this.duration = 25 * 60;
      this.remaining = 25 * 60;
    } else if (newMode === '5m') {
      this.duration = 5 * 60;
      this.remaining = 5 * 60;
    } else if (newMode === '50m') {
      this.duration = 50 * 60;
      this.remaining = 50 * 60;
    } else if (newMode === 'stopwatch') {
      this.duration = 0;
      this.remaining = 0;
    } else if (newMode === 'custom' && customDuration) {
      this.duration = customDuration;
      this.remaining = customDuration;
    }

    if (this.isLinked) {
      wsClient.send('TIMER_ACTION', {
        action: 'set_mode',
        mode: newMode,
        duration: this.duration
      });
    }

    this.render();
  }

  toggleLinkMode() {
    this.isLinked = !this.isLinked;
    if (this.isLinked) {
      wsClient.send('TIMER_ACTION', {
        action: 'toggle_link',
        linked: true
      });
    }
    this.render();
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  render() {
    const formatted = this.formatTime(this.remaining);

    if (this.digitsEl) {
      this.digitsEl.textContent = formatted;
    }

    const modeLabel = this.mode === '5m' ? 'Break' : (this.mode === 'stopwatch' ? 'Stopwatch' : 'Focus');
    document.title = `${this.isRunning ? '▶ ' : '⏸ '}(${formatted}) Ambients - ${modeLabel}`;

    // Dynamic Ambient Lighting on Body
    document.body.classList.remove('theme-focus', 'theme-break', 'theme-deep');
    if (this.mode === '5m') {
      document.body.classList.add('theme-break');
    } else if (this.mode === '50m') {
      document.body.classList.add('theme-deep');
    } else {
      document.body.classList.add('theme-focus');
    }

    // Toggle button
    if (this.toggleBtn) {
      const icon = this.toggleBtn.querySelector('i, span.btn-icon');
      const text = this.toggleBtn.querySelector('span.btn-text');
      if (this.isRunning) {
        this.toggleBtn.classList.remove('bg-sky-500/20', 'border-sky-500/40', 'text-sky-400');
        this.toggleBtn.classList.add('bg-amber-500/20', 'border-amber-500/40', 'text-amber-300');
        if (text) text.textContent = 'Pause';
        if (icon) icon.setAttribute('data-lucide', 'pause');
      } else {
        this.toggleBtn.classList.remove('bg-amber-500/20', 'border-amber-500/40', 'text-amber-300');
        this.toggleBtn.classList.add('bg-sky-500/20', 'border-sky-500/40', 'text-sky-400');
        if (text) text.textContent = 'Start';
        if (icon) icon.setAttribute('data-lucide', 'play');
      }
    }

    // Mode Buttons active state
    Object.entries(this.modeButtons).forEach(([modeKey, btn]) => {
      if (modeKey === this.mode) {
        btn.classList.add('bg-white/15', 'text-white', 'border-white/30', 'shadow-sm');
        btn.classList.remove('text-slate-400', 'hover:text-slate-200', 'border-transparent');
      } else {
        btn.classList.remove('bg-white/15', 'text-white', 'border-white/30', 'shadow-sm');
        btn.classList.add('text-slate-400', 'hover:text-slate-200', 'border-transparent');
      }
    });

    // Link Toggle
    if (this.linkToggleBtn) {
      if (this.isLinked) {
        this.linkToggleBtn.classList.add('text-sky-400', 'border-sky-500/30', 'bg-sky-500/10');
        this.linkToggleBtn.classList.remove('text-slate-400', 'border-transparent', 'bg-white/5');
      } else {
        this.linkToggleBtn.classList.remove('text-sky-400', 'border-sky-500/30', 'bg-sky-500/10');
        this.linkToggleBtn.classList.add('text-slate-400', 'border-transparent', 'bg-white/5');
      }
    }

    // Progress Bar
    if (this.progressBarEl) {
      if (this.mode === 'stopwatch') {
        this.progressBarEl.style.width = '100%';
      } else {
        const pct = Math.max(0, Math.min(100, (1 - this.remaining / this.duration) * 100));
        this.progressBarEl.style.width = `${pct}%`;
      }
    }

    // Update Zen Mode if active
    if (window.zenManager) {
      window.zenManager.updateZenDisplay();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

export const timer = new SessionTimer();
window.timer = timer;
