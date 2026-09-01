/**
 * Ambients - 30-Day Study Activity Heatmap & Subject Analytics
 * Renders GitHub-style study grid and subject distribution charts.
 */

import { storage } from './storage.js';
import { taskManager } from './tasks.js';

export class HeatmapManager {
  constructor() {
    this.modalEl = null;
    this.openModalBtn = null;
    this.closeModalBtn = null;
    this.gridContainerEl = null;
    this.totalMinsTextEl = null;
    this.subjectBreakdownEl = null;
  }

  mount(elements) {
    this.modalEl = elements.modal;
    this.openModalBtn = elements.openModalBtn;
    this.closeModalBtn = elements.closeModalBtn;
    this.gridContainerEl = elements.gridContainer;
    this.totalMinsTextEl = elements.totalMinsText;
    this.subjectBreakdownEl = elements.subjectBreakdown;

    this.bindEvents();
  }

  bindEvents() {
    if (this.openModalBtn && this.modalEl) {
      this.openModalBtn.addEventListener('click', () => {
        this.render();
        this.modalEl.classList.remove('hidden');
      });
    }

    if (this.closeModalBtn && this.modalEl) {
      this.closeModalBtn.addEventListener('click', () => {
        this.modalEl.classList.add('hidden');
      });
    }
  }

  render() {
    const activityLog = storage.getActivityLog();
    const metrics = storage.getMetrics();

    if (this.totalMinsTextEl) {
      this.totalMinsTextEl.textContent = `${metrics.totalFocusMinutes || 120} mins total`;
    }

    // Render 30-Day Heatmap Grid
    if (this.gridContainerEl) {
      const days = [];
      const now = new Date();

      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const mins = activityLog[dateStr] || 0;
        days.push({ dateStr, mins });
      }

      this.gridContainerEl.innerHTML = days.map(d => {
        let colorClass = 'bg-white/5 border-white/5';
        if (d.mins > 60) colorClass = 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400/20';
        else if (d.mins > 30) colorClass = 'bg-emerald-500/60 border-emerald-500/40';
        else if (d.mins > 10) colorClass = 'bg-emerald-600/30 border-emerald-600/30';
        else if (d.mins > 0) colorClass = 'bg-emerald-700/20 border-emerald-700/20';

        return `
          <div 
            class="w-5 h-5 rounded border ${colorClass} transition-transform hover:scale-125 cursor-pointer" 
            title="${d.dateStr}: ${d.mins} focus mins"
          ></div>
        `;
      }).join('');
    }

    // Render Subject Breakdown
    if (this.subjectBreakdownEl) {
      const tasks = taskManager.myTasks;
      const counts = { general: 0, math: 0, physics: 0, chemistry: 0, biology: 0, code: 0 };
      tasks.forEach(t => {
        const tag = t.tag || 'general';
        counts[tag] = (counts[tag] || 0) + (t.dots || 1);
      });

      const totalDots = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

      this.subjectBreakdownEl.innerHTML = Object.entries(counts)
        .filter(([_, count]) => count > 0)
        .map(([subject, count]) => {
          const pct = Math.round((count / totalDots) * 100);
          return `
            <div class="flex items-center justify-between text-xs py-1 border-b border-white/5">
              <span class="capitalize text-slate-300">${subject}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div class="h-full bg-sky-400" style="width: ${pct}%;"></div>
                </div>
                <span class="font-mono text-slate-400 w-8 text-right">${pct}%</span>
              </div>
            </div>
          `;
        }).join('');
    }
  }
}

export const heatmapManager = new HeatmapManager();
