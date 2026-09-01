/**
 * Ambients - Custom Marks & Score Tracker
 * Real-time co-tracking of practice tests, mock exams, problem sets,
 * and mastery percentages between study partners.
 */

import { wsClient } from './ws-client.js';

export const SUBJECTS = {
  general: { label: 'General', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  math: { label: 'Math', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  physics: { label: 'Physics', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  chemistry: { label: 'Chemistry', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  biology: { label: 'Biology', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  cs: { label: 'CS & Code', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
};

export class MarksTracker {
  constructor() {
    this.myMarks = this.loadMarks();
    this.partnerMarks = [];

    // DOM Elements
    this.myMarksListEl = null;
    this.myMarksSummaryEl = null;
    this.myMarksProgressBarEl = null;
    this.addMarkFormEl = null;
    this.openAddModalBtn = null;
    this.addModalEl = null;
    this.closeAddModalBtn = null;

    this.partnerMarksListEl = null;
    this.partnerMarksSummaryEl = null;
    this.partnerMarksProgressBarEl = null;

    this.initWebSocketListeners();
  }

  loadMarks() {
    try {
      const data = localStorage.getItem('ambients_marks');
      return data ? JSON.parse(data) : [
        { id: 'm_1', title: 'Diagnostic Drill 1', subject: 'physics', scored: 22, total: 25, percentage: 88, date: new Date().toISOString() },
        { id: 'm_2', title: 'Problem Set A', subject: 'math', scored: 45, total: 50, percentage: 90, date: new Date().toISOString() }
      ];
    } catch (e) {
      return [];
    }
  }

  saveMarks() {
    try {
      localStorage.setItem('ambients_marks', JSON.stringify(this.myMarks));
    } catch (e) {}
  }

  mount(elements) {
    this.myMarksListEl = elements.myMarksList;
    this.myMarksSummaryEl = elements.myMarksSummary;
    this.myMarksProgressBarEl = elements.myMarksProgressBar;
    this.addMarkFormEl = elements.addMarkForm;
    this.openAddModalBtn = elements.openAddModalBtn;
    this.addModalEl = elements.addModal;
    this.closeAddModalBtn = elements.closeAddModalBtn;

    this.partnerMarksListEl = elements.partnerMarksList;
    this.partnerMarksSummaryEl = elements.partnerMarksSummary;
    this.partnerMarksProgressBarEl = elements.partnerMarksProgressBar;

    this.bindEvents();
    this.renderMyMarks();
    this.renderPartnerMarks();
  }

  bindEvents() {
    // Open Modal
    if (this.openAddModalBtn && this.addModalEl) {
      this.openAddModalBtn.addEventListener('click', () => {
        this.addModalEl.classList.remove('hidden');
      });
    }

    // Close Modal
    if (this.closeAddModalBtn && this.addModalEl) {
      this.closeAddModalBtn.addEventListener('click', () => {
        this.addModalEl.classList.add('hidden');
      });
    }

    // Add Form Submit
    if (this.addMarkFormEl) {
      this.addMarkFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('mark-title-input')?.value.trim();
        const subject = document.getElementById('mark-subject-select')?.value || 'general';
        const scored = parseFloat(document.getElementById('mark-scored-input')?.value);
        const total = parseFloat(document.getElementById('mark-total-input')?.value);

        if (title && !isNaN(scored) && !isNaN(total) && total > 0) {
          this.addMark(title, subject, scored, total);
          this.addMarkFormEl.reset();
          if (this.addModalEl) this.addModalEl.classList.add('hidden');
        }
      });
    }
  }

  initWebSocketListeners() {
    // Initial Snapshot
    wsClient.on('ROOM_SNAPSHOT', (data) => {
      if (data && data.partner && data.partner.marks) {
        this.partnerMarks = data.partner.marks;
        this.renderPartnerMarks();
      }
    });

    // Partner Joined
    wsClient.on('PEER_JOINED', (data) => {
      if (data && data.partner && data.partner.marks) {
        this.partnerMarks = data.partner.marks;
        this.renderPartnerMarks();
      }
    });

    // Partner Marks Updated
    wsClient.on('PARTNER_MARKS_UPDATED', (data) => {
      if (data && data.marks) {
        this.partnerMarks = data.marks;
        this.renderPartnerMarks();
      }
    });
  }

  addMark(title, subject, scored, total) {
    const percentage = Math.round((scored / total) * 100);
    const newEntry = {
      id: 'mark_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title,
      subject,
      scored,
      total,
      percentage,
      date: new Date().toISOString()
    };

    this.myMarks.unshift(newEntry);
    this.saveMarks();
    this.broadcastMarks('add');
    this.renderMyMarks();
  }

  deleteMark(id) {
    this.myMarks = this.myMarks.filter(m => m.id !== id);
    this.saveMarks();
    this.broadcastMarks('delete');
    this.renderMyMarks();
  }

  broadcastMarks(action = 'update') {
    wsClient.send('MARKS_ACTION', {
      action,
      marks: this.myMarks
    });
  }

  calcStats(marksList) {
    if (!marksList || marksList.length === 0) {
      return { totalScored: 0, totalMax: 0, avgPercentage: 0, count: 0 };
    }
    const totalScored = marksList.reduce((acc, m) => acc + (m.scored || 0), 0);
    const totalMax = marksList.reduce((acc, m) => acc + (m.total || 0), 0);
    const avgPercentage = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
    return { totalScored, totalMax, avgPercentage, count: marksList.length };
  }

  renderMyMarks() {
    if (!this.myMarksListEl) return;

    const stats = this.calcStats(this.myMarks);

    if (this.myMarksSummaryEl) {
      this.myMarksSummaryEl.textContent = stats.count > 0 
        ? `${stats.avgPercentage}% Avg (${stats.totalScored}/${stats.totalMax})` 
        : 'No marks logged';
    }

    if (this.myMarksProgressBarEl) {
      this.myMarksProgressBarEl.style.width = `${stats.avgPercentage}%`;
    }

    if (this.myMarks.length === 0) {
      this.myMarksListEl.innerHTML = `
        <div class="py-4 text-center text-slate-500 text-xs italic">
          No test or practice drill scores recorded yet.
        </div>
      `;
    } else {
      this.myMarksListEl.innerHTML = this.myMarks.map(m => {
        const sub = SUBJECTS[m.subject] || SUBJECTS.general;
        return `
          <div class="group flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="px-2 py-0.5 rounded text-[10px] font-medium border ${sub.color} shrink-0">
                ${sub.label}
              </span>
              <span class="truncate text-slate-200 font-medium">${this.escapeHtml(m.title)}</span>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-mono text-sky-400 font-semibold">${m.scored}/${m.total}</span>
              <span class="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300">${m.percentage}%</span>
              <button data-del-mark="${m.id}" class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 transition-opacity" title="Delete score">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      this.myMarksListEl.querySelectorAll('[data-del-mark]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.deleteMark(btn.dataset.delMark);
        });
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  renderPartnerMarks() {
    if (!this.partnerMarksListEl) return;

    const stats = this.calcStats(this.partnerMarks);

    if (this.partnerMarksSummaryEl) {
      this.partnerMarksSummaryEl.textContent = stats.count > 0 
        ? `${stats.avgPercentage}% Avg (${stats.totalScored}/${stats.totalMax})` 
        : 'No marks logged';
    }

    if (this.partnerMarksProgressBarEl) {
      this.partnerMarksProgressBarEl.style.width = `${stats.avgPercentage}%`;
    }

    if (this.partnerMarks.length === 0) {
      this.partnerMarksListEl.innerHTML = `
        <div class="py-4 text-center text-slate-500 text-xs italic">
          Partner has not logged test scores yet.
        </div>
      `;
    } else {
      this.partnerMarksListEl.innerHTML = this.partnerMarks.map(m => {
        const sub = SUBJECTS[m.subject] || SUBJECTS.general;
        return `
          <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/10 text-xs">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="px-2 py-0.5 rounded text-[10px] font-medium border ${sub.color} shrink-0">
                ${sub.label}
              </span>
              <span class="truncate text-slate-200 font-medium">${this.escapeHtml(m.title)}</span>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-mono text-purple-400 font-semibold">${m.scored}/${m.total}</span>
              <span class="font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300">${m.percentage}%</span>
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const marksTracker = new MarksTracker();
