/**
 * Ambients - End-of-Block Micro-Debrief & High-Five Celebration
 * 30-second transition modal summarizing achievements and mutual high-fives.
 */

import { wsClient } from './ws-client.js';
import { audio } from './audio.js';
import { taskManager } from './tasks.js';

export class DebriefManager {
  constructor() {
    this.modalEl = null;
    this.countdownEl = null;
    this.countdownTimer = null;
    this.remainingSeconds = 30;
    this.highFiveBtn = null;
    this.skipToBreakBtn = null;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.modalEl = elements.modal;
    this.countdownEl = elements.countdown;
    this.highFiveBtn = elements.highFiveBtn;
    this.skipToBreakBtn = elements.skipToBreakBtn;

    this.bindEvents();
  }

  bindEvents() {
    if (this.highFiveBtn) {
      this.highFiveBtn.addEventListener('click', () => {
        this.sendHighFive();
      });
    }

    if (this.skipToBreakBtn) {
      this.skipToBreakBtn.addEventListener('click', () => {
        this.closeDebrief();
        if (window.timer) {
          window.timer.setMode('5m');
          window.timer.toggleRunState(); // auto-start break
        }
      });
    }
  }

  initWebSocketListeners() {
    wsClient.on('HIGH_FIVE_RECEIVED', (data) => {
      this.showHighFiveCelebration(data?.fromName || 'Partner');
    });
  }

  openDebrief() {
    if (!this.modalEl) return;

    this.remainingSeconds = 30;
    this.modalEl.classList.remove('hidden');

    // Populate Task Summaries
    const mySummaryEl = document.getElementById('debrief-my-tasks');
    const partnerSummaryEl = document.getElementById('debrief-partner-tasks');

    const myCompleted = taskManager.myTasks.filter(t => t.completed);
    const partnerCompleted = taskManager.partnerTasks.filter(t => t.completed);

    if (mySummaryEl) {
      mySummaryEl.innerHTML = myCompleted.length > 0
        ? myCompleted.map(t => `<li class="flex items-center gap-2 text-xs text-slate-200"><span>✓</span> <span class="truncate">${t.title}</span></li>`).join('')
        : '<li class="text-xs text-slate-500 italic">No tasks completed in this block.</li>';
    }

    if (partnerSummaryEl) {
      partnerSummaryEl.innerHTML = partnerCompleted.length > 0
        ? partnerCompleted.map(t => `<li class="flex items-center gap-2 text-xs text-slate-200"><span>✓</span> <span class="truncate">${t.title}</span></li>`).join('')
        : '<li class="text-xs text-slate-500 italic">Partner has not checked off tasks.</li>';
    }

    // Start 30s Countdown
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    const updateCountdown = () => {
      if (this.countdownEl) {
        this.countdownEl.textContent = `${this.remainingSeconds}s`;
      }

      if (this.remainingSeconds <= 0) {
        clearInterval(this.countdownTimer);
        this.closeDebrief();
        if (window.timer) {
          window.timer.setMode('5m');
          window.timer.toggleRunState();
        }
      } else {
        this.remainingSeconds--;
      }
    };

    updateCountdown();
    this.countdownTimer = setInterval(updateCountdown, 1000);
  }

  closeDebrief() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.modalEl) this.modalEl.classList.add('hidden');
  }

  sendHighFive() {
    wsClient.send('HIGH_FIVE', {});
    this.showHighFiveCelebration('You');
  }

  showHighFiveCelebration(senderName) {
    audio.playNudgeSound('celebrate');

    // Spawn high-five celebration emojis across screen
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'particle-nudge text-4xl';
      el.textContent = i % 2 === 0 ? '✋' : '✨';
      el.style.left = `${window.innerWidth * 0.3 + Math.random() * (window.innerWidth * 0.4)}px`;
      el.style.top = `${window.innerHeight * 0.6 + Math.random() * 50}px`;
      el.style.setProperty('--rot', `${Math.random() * 40 - 20}deg`);
      el.style.animationDelay = `${i * 0.08}s`;
      document.body.appendChild(el);

      setTimeout(() => el.remove(), 2400);
    }

    if (window.nudgeManager) {
      window.nudgeManager.showToast(`✋ High Five! Great block together!`, 'nudge', 2500);
    }
  }
}

export const debriefManager = new DebriefManager();
window.debriefManager = debriefManager;
