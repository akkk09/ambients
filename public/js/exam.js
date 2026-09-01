/**
 * Ambients - Exam Countdown & Target Marks Trajectory
 * Real-time exam date countdown and SVG trajectory sparkline
 * tracking mock test performance toward goal score.
 */

import { wsClient } from './ws-client.js';
import { storage } from './storage.js';
import { marksTracker } from './marks.js';

export class ExamManager {
  constructor() {
    this.examTarget = storage.getExamTarget() || {
      title: 'Physics Midterm Exam',
      targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      targetPercentage: 90
    };
    this.partnerExamTarget = null;

    // DOM Elements
    this.countdownTextEl = null;
    this.examTitleEl = null;
    this.targetScoreEl = null;
    this.sparklineSvgEl = null;
    this.modalEl = null;
    this.openModalBtn = null;
    this.closeModalBtn = null;
    this.formEl = null;

    this.initWebSocketListeners();
    this.startCountdownTimer();
  }

  mount(elements) {
    this.countdownTextEl = elements.countdownText;
    this.examTitleEl = elements.examTitle;
    this.targetScoreEl = elements.targetScore;
    this.sparklineSvgEl = elements.sparklineSvg;
    this.modalEl = elements.modal;
    this.openModalBtn = elements.openModalBtn;
    this.closeModalBtn = elements.closeModalBtn;
    this.formEl = elements.form;

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    if (this.openModalBtn && this.modalEl) {
      this.openModalBtn.addEventListener('click', () => {
        this.populateModalForm();
        this.modalEl.classList.remove('hidden');
      });
    }

    if (this.closeModalBtn && this.modalEl) {
      this.closeModalBtn.addEventListener('click', () => {
        this.modalEl.classList.add('hidden');
      });
    }

    if (this.formEl) {
      this.formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('exam-title-input')?.value.trim();
        const targetDate = document.getElementById('exam-date-input')?.value;
        const targetPercentage = parseFloat(document.getElementById('exam-target-score-input')?.value);

        if (title && targetDate && !isNaN(targetPercentage)) {
          this.setExamTarget({ title, targetDate, targetPercentage });
          if (this.modalEl) this.modalEl.classList.add('hidden');
        }
      });
    }
  }

  initWebSocketListeners() {
    wsClient.on('ROOM_SNAPSHOT', (data) => {
      if (data && data.partner && data.partner.examTarget) {
        this.partnerExamTarget = data.partner.examTarget;
      }
    });

    wsClient.on('PEER_JOINED', (data) => {
      if (data && data.partner && data.partner.examTarget) {
        this.partnerExamTarget = data.partner.examTarget;
      }
    });

    wsClient.on('PARTNER_EXAM_UPDATED', (data) => {
      if (data && data.examTarget) {
        this.partnerExamTarget = data.examTarget;
      }
    });
  }

  setExamTarget(target) {
    this.examTarget = target;
    storage.saveExamTarget(this.examTarget);
    wsClient.send('EXAM_ACTION', { examTarget: this.examTarget });
    this.render();
  }

  populateModalForm() {
    const titleInp = document.getElementById('exam-title-input');
    const dateInp = document.getElementById('exam-date-input');
    const targetInp = document.getElementById('exam-target-score-input');

    if (titleInp) titleInp.value = this.examTarget.title || '';
    if (dateInp) dateInp.value = this.examTarget.targetDate || '';
    if (targetInp) targetInp.value = this.examTarget.targetPercentage || 90;
  }

  startCountdownTimer() {
    setInterval(() => {
      this.updateCountdownDisplay();
    }, 60000);
  }

  updateCountdownDisplay() {
    if (!this.countdownTextEl || !this.examTarget?.targetDate) return;

    const targetTime = new Date(this.examTarget.targetDate + 'T09:00:00').getTime();
    const now = Date.now();
    const diffMs = targetTime - now;

    if (diffMs <= 0) {
      this.countdownTextEl.textContent = 'Exam Day Today! 🎯';
      return;
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    this.countdownTextEl.textContent = `${days}d ${hours}h left`;
  }

  render() {
    if (this.examTitleEl) {
      this.examTitleEl.textContent = this.examTarget.title || 'Upcoming Exam';
    }

    if (this.targetScoreEl) {
      this.targetScoreEl.textContent = `Target: ${this.examTarget.targetPercentage || 90}%`;
    }

    this.updateCountdownDisplay();
    this.renderTrajectorySparkline();
  }

  renderTrajectorySparkline() {
    if (!this.sparklineSvgEl) return;

    const marks = [...marksTracker.myMarks].reverse(); // chronological order
    const width = 240;
    const height = 48;
    const padding = 4;

    const targetPct = this.examTarget.targetPercentage || 90;
    const targetY = height - (targetPct / 100) * (height - padding * 2) - padding;

    let points = '';
    if (marks.length >= 2) {
      const stepX = (width - padding * 2) / (marks.length - 1);
      points = marks.map((m, idx) => {
        const x = padding + idx * stepX;
        const y = height - (Math.min(100, Math.max(0, m.percentage)) / 100) * (height - padding * 2) - padding;
        return `${x},${y}`;
      }).join(' ');
    }

    this.sparklineSvgEl.innerHTML = `
      <!-- Target Threshold Line -->
      <line x1="0" y1="${targetY}" x2="${width}" y2="${targetY}" stroke="#f59e0b" stroke-dasharray="3,3" stroke-width="1.5" opacity="0.6"/>
      <text x="${width - 4}" y="${targetY - 3}" fill="#f59e0b" font-size="9" text-anchor="end" font-family="JetBrains Mono">${targetPct}%</text>

      <!-- Actual Score Trajectory Path -->
      ${points ? `
        <polyline fill="none" stroke="#38bdf8" stroke-width="2" points="${points}" stroke-linecap="round" stroke-linejoin="round"/>
      ` : ''}

      ${marks.length < 2 ? `
        <text x="${width / 2}" y="${height / 2 + 3}" fill="#64748b" font-size="9" text-anchor="middle">Log 2+ test scores to see trajectory curve</text>
      ` : ''}
    `;
  }
}

export const examManager = new ExamManager();
