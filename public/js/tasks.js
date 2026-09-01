/**
 * Ambients - Enhanced Dual Todo & Focus HUD Manager
 * Features:
 * - Effort Dots (• 15m, •• 30m, ••• 45m)
 * - Category / Subject Tags
 * - 1-Click Export to Markdown / Notion
 * - Real-time partner reflection, drag-reorder & ripple celebrations
 */

import { wsClient } from './ws-client.js';
import { audio } from './audio.js';
import { storage } from './storage.js';

export const TASK_TAGS = {
  general: { label: 'General', color: 'text-slate-400 bg-white/5 border-white/10' },
  exam: { label: 'Exam', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  practice: { label: 'Practice', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  reading: { label: 'Reading', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  code: { label: 'Code', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
};

export class TaskManager {
  constructor() {
    this.myTasks = storage.getTasks();
    this.myFocusText = storage.getProfile().focusText || '';
    this.partnerTasks = [];
    this.partnerFocusText = '';

    // Active task creation state
    this.selectedTag = 'general';
    this.selectedDots = 1;

    // DOM Elements
    this.myTaskListEl = null;
    this.myTaskInputEl = null;
    this.myFocusInputEl = null;
    this.myTaskCountEl = null;
    this.myProgressBarEl = null;
    this.myDeskCardEl = null;

    this.partnerTaskListEl = null;
    this.partnerFocusTextEl = null;
    this.partnerTaskCountEl = null;
    this.partnerProgressBarEl = null;
    this.partnerDeskCardEl = null;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.myTaskListEl = elements.myTaskList;
    this.myTaskInputEl = elements.myTaskInput;
    this.myFocusInputEl = elements.myFocusInput;
    this.myTaskCountEl = elements.myTaskCount;
    this.myProgressBarEl = elements.myProgressBar;
    this.myDeskCardEl = elements.myDeskCard;

    this.partnerTaskListEl = elements.partnerTaskList;
    this.partnerFocusTextEl = elements.partnerFocusText;
    this.partnerTaskCountEl = elements.partnerTaskCount;
    this.partnerProgressBarEl = elements.partnerProgressBar;
    this.partnerDeskCardEl = elements.partnerDeskCard;

    this.bindEvents();
    this.renderMyTasks();
    this.renderMyFocus();
    this.renderPartnerTasks();
    this.renderPartnerFocus();
  }

  bindEvents() {
    // 1. Add Task Input
    if (this.myTaskInputEl) {
      this.myTaskInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.myTaskInputEl.value.trim()) {
          this.addTask(this.myTaskInputEl.value.trim(), this.selectedTag, this.selectedDots);
          this.myTaskInputEl.value = '';
        }
      });
    }

    // 2. Current Focus Input
    if (this.myFocusInputEl) {
      this.myFocusInputEl.value = this.myFocusText;
      this.myFocusInputEl.addEventListener('input', (e) => {
        this.myFocusText = e.target.value;
        const profile = storage.getProfile();
        profile.focusText = this.myFocusText;
        storage.saveProfile(profile);

        wsClient.send('UPDATE_PROFILE', { focusText: this.myFocusText });
      });
    }

    // 3. Export Session Button
    const exportBtn = document.getElementById('export-session-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportSessionToMarkdown());
    }
  }

  initWebSocketListeners() {
    wsClient.on('ROOM_SNAPSHOT', (data) => {
      if (data && data.partner) {
        this.partnerTasks = data.partner.tasks || [];
        this.partnerFocusText = data.partner.profile?.focusText || '';
        this.renderPartnerTasks();
        this.renderPartnerFocus();
      }
    });

    wsClient.on('PEER_JOINED', (data) => {
      if (data && data.partner) {
        this.partnerTasks = data.partner.tasks || [];
        this.partnerFocusText = data.partner.profile?.focusText || '';
        this.renderPartnerTasks();
        this.renderPartnerFocus();
      }
    });

    wsClient.on('PARTNER_TASKS_UPDATED', (data) => {
      if (data) {
        this.partnerTasks = data.tasks || [];
        this.renderPartnerTasks();

        if (data.completedTaskId) {
          this.triggerPartnerCompletionRipple();
          audio.playTaskDing();
        }
      }
    });

    wsClient.on('PARTNER_PROFILE_UPDATED', (data) => {
      if (data && data.profile && data.profile.focusText !== undefined) {
        this.partnerFocusText = data.profile.focusText;
        this.renderPartnerFocus();
      }
    });
  }

  addTask(title, tag = 'general', dots = 1) {
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: title,
      tag: tag || 'general',
      dots: dots || 1, // 1 = 15m, 2 = 30m, 3 = 45m
      completed: false,
      createdAt: Date.now()
    };

    this.myTasks.push(newTask);
    this.persistAndBroadcastTasks('add');
    this.renderMyTasks();
  }

  toggleTask(taskId) {
    const task = this.myTasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;

    if (task.completed) {
      audio.playTaskDing();
      this.triggerLocalCompletionRipple(taskId);
      if (window.themeFX) {
        window.themeFX.spawnTaskCelebration(window.innerWidth / 2, window.innerHeight / 2);
      }
      storage.incrementCompletedTask();
      if (window.appMetrics) {
        window.appMetrics.updateMetricsUI();
      }
    }

    this.persistAndBroadcastTasks('toggle', task.completed ? taskId : null);
    this.renderMyTasks();
  }

  deleteTask(taskId) {
    this.myTasks = this.myTasks.filter(t => t.id !== taskId);
    this.persistAndBroadcastTasks('delete');
    this.renderMyTasks();
  }

  editTask(taskId, newTitle) {
    const task = this.myTasks.find(t => t.id === taskId);
    if (task && newTitle.trim()) {
      task.title = newTitle.trim();
      this.persistAndBroadcastTasks('edit');
      this.renderMyTasks();
    }
  }

  reorderTasks(draggedId, targetId) {
    const fromIndex = this.myTasks.findIndex(t => t.id === draggedId);
    const toIndex = this.myTasks.findIndex(t => t.id === targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [movedTask] = this.myTasks.splice(fromIndex, 1);
    this.myTasks.splice(toIndex, 0, movedTask);

    this.persistAndBroadcastTasks('reorder');
    this.renderMyTasks();
  }

  persistAndBroadcastTasks(action = 'update', completedTaskId = null) {
    storage.saveTasks(this.myTasks);
    wsClient.send('TASK_ACTION', {
      action,
      tasks: this.myTasks,
      completedTaskId
    });
  }

  triggerLocalCompletionRipple(taskId) {
    const taskRow = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskRow) {
      taskRow.classList.remove('task-ripple-anim');
      void taskRow.offsetWidth;
      taskRow.classList.add('task-ripple-anim');
    }
  }

  triggerPartnerCompletionRipple() {
    if (this.partnerDeskCardEl) {
      this.partnerDeskCardEl.classList.remove('partner-ripple-flash');
      void this.partnerDeskCardEl.offsetWidth;
      this.partnerDeskCardEl.classList.add('partner-ripple-flash');
    }
  }

  renderDots(dots) {
    const count = Math.max(1, Math.min(3, dots || 1));
    return '•'.repeat(count);
  }

  renderMyTasks() {
    if (!this.myTaskListEl) return;

    if (this.myTasks.length === 0) {
      this.myTaskListEl.innerHTML = `
        <div class="py-8 text-center text-slate-500 text-sm italic">
          No tasks added for this block yet. <br>
          <span class="text-xs text-slate-600">Type a micro-task above and press Enter ↵</span>
        </div>
      `;
    } else {
      this.myTaskListEl.innerHTML = this.myTasks.map(task => {
        const tagConfig = TASK_TAGS[task.tag] || TASK_TAGS.general;
        const dotStr = this.renderDots(task.dots);

        return `
          <div 
            data-task-id="${task.id}" 
            draggable="true" 
            class="group flex items-center justify-between gap-2.5 p-2.5 rounded-lg border ${task.completed ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400' : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-200'} transition-all"
          >
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <span class="cursor-grab text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
              </span>
              <input 
                type="checkbox" 
                class="task-checkbox" 
                ${task.completed ? 'checked' : ''} 
                data-toggle-id="${task.id}"
              />
              <span 
                class="text-sm truncate select-text cursor-pointer ${task.completed ? 'line-through text-slate-500' : ''}" 
                data-edit-id="${task.id}" 
                title="Double click to edit"
              >
                ${this.escapeHtml(task.title)}
              </span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <!-- Effort Dots -->
              <span class="font-mono text-xs text-sky-400/80 tracking-widest" title="${(task.dots || 1) * 15}m estimated">${dotStr}</span>
              
              <!-- Tag Badge -->
              ${task.tag && task.tag !== 'general' ? `
                <span class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${tagConfig.color}">
                  ${tagConfig.label}
                </span>
              ` : ''}

              <button 
                data-delete-id="${task.id}" 
                class="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all" 
                title="Delete task"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      this.myTaskListEl.querySelectorAll('[data-toggle-id]').forEach(chk => {
        chk.addEventListener('change', (e) => {
          this.toggleTask(e.target.dataset.toggleId);
        });
      });

      this.myTaskListEl.querySelectorAll('[data-delete-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.closest('[data-delete-id]').dataset.deleteId;
          this.deleteTask(id);
        });
      });

      this.myTaskListEl.querySelectorAll('[data-edit-id]').forEach(span => {
        span.addEventListener('dblclick', () => {
          const id = span.dataset.editId;
          const currentText = span.textContent.trim();
          const input = document.createElement('input');
          input.type = 'text';
          input.value = currentText;
          input.className = 'w-full bg-slate-900 border border-sky-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none';
          
          input.addEventListener('blur', () => this.editTask(id, input.value));
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.editTask(id, input.value);
            if (e.key === 'Escape') this.renderMyTasks();
          });

          span.replaceWith(input);
          input.focus();
        });
      });

      this.setupDragAndDrop();
    }

    const completedCount = this.myTasks.filter(t => t.completed).length;
    const totalCount = this.myTasks.length;

    if (this.myTaskCountEl) {
      this.myTaskCountEl.textContent = `${completedCount}/${totalCount}`;
    }

    if (this.myProgressBarEl) {
      const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
      this.myProgressBarEl.style.width = `${pct}%`;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  setupDragAndDrop() {
    let draggedId = null;

    this.myTaskListEl.querySelectorAll('[data-task-id]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedId = item.dataset.taskId;
        item.classList.add('opacity-40');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('opacity-40');
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('border-sky-500');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('border-sky-500');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('border-sky-500');
        const targetId = item.dataset.taskId;
        if (draggedId && targetId && draggedId !== targetId) {
          this.reorderTasks(draggedId, targetId);
        }
      });
    });
  }

  renderPartnerTasks() {
    if (!this.partnerTaskListEl) return;

    if (this.partnerTasks.length === 0) {
      this.partnerTaskListEl.innerHTML = `
        <div class="py-8 text-center text-slate-500 text-sm italic">
          Partner has not added tasks yet.
        </div>
      `;
    } else {
      this.partnerTaskListEl.innerHTML = this.partnerTasks.map(task => {
        const dotStr = this.renderDots(task.dots);
        const tagConfig = TASK_TAGS[task.tag] || TASK_TAGS.general;

        return `
          <div class="flex items-center justify-between gap-2.5 p-2.5 rounded-lg border ${task.completed ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400' : 'bg-white/5 border-white/10 text-slate-200'}">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <span class="w-4 h-4 rounded flex items-center justify-center border ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 bg-white/5'}">
                ${task.completed ? '✓' : ''}
              </span>
              <span class="text-sm truncate ${task.completed ? 'line-through text-slate-500' : ''}">
                ${this.escapeHtml(task.title)}
              </span>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-mono text-xs text-purple-400/80 tracking-widest">${dotStr}</span>
              ${task.tag && task.tag !== 'general' ? `
                <span class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${tagConfig.color}">
                  ${tagConfig.label}
                </span>
              ` : ''}
              ${task.completed ? '<span class="text-xs text-emerald-400 font-mono">done</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    const completedCount = this.partnerTasks.filter(t => t.completed).length;
    const totalCount = this.partnerTasks.length;

    if (this.partnerTaskCountEl) {
      this.partnerTaskCountEl.textContent = `${completedCount}/${totalCount}`;
    }

    if (this.partnerProgressBarEl) {
      const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
      this.partnerProgressBarEl.style.width = `${pct}%`;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  renderMyFocus() {
    if (this.myFocusInputEl && this.myFocusInputEl.value !== this.myFocusText) {
      this.myFocusInputEl.value = this.myFocusText;
    }
  }

  renderPartnerFocus() {
    if (this.partnerFocusTextEl) {
      this.partnerFocusTextEl.textContent = this.partnerFocusText || 'No current focus set';
      if (this.partnerFocusText) {
        this.partnerFocusTextEl.classList.remove('text-slate-500', 'italic');
        this.partnerFocusTextEl.classList.add('text-sky-300');
      } else {
        this.partnerFocusTextEl.classList.add('text-slate-500', 'italic');
        this.partnerFocusTextEl.classList.remove('text-sky-300');
      }
    }
  }

  /**
   * 1-Click Markdown / Notion Export
   */
  exportSessionToMarkdown() {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const metrics = storage.getMetrics();
    const marksData = storage.getProfile();
    const scratchpad = document.getElementById('scratchpad-textarea')?.value || '';

    const completedTasks = this.myTasks.filter(t => t.completed);
    const pendingTasks = this.myTasks.filter(t => !t.completed);

    let md = `# Ambients Study Session — ${today}\n\n`;
    md += `**Focus Stats**: ⏱ ${metrics.todayFocusMinutes || 0} mins focused | 🔥 ${metrics.streak || 1} day streak | ✓ ${metrics.todayCompletedTasks || 0} tasks completed\n\n`;
    
    md += `## 🎯 Current Focus\n> ${this.myFocusText || 'Session Study Goals'}\n\n`;

    md += `## ✅ Completed Tasks\n`;
    if (completedTasks.length > 0) {
      completedTasks.forEach(t => {
        md += `- [x] ${t.title} (${t.dots * 15}m est)\n`;
      });
    } else {
      md += `*No tasks completed yet.*\n`;
    }
    md += `\n`;

    if (pendingTasks.length > 0) {
      md += `## ⏳ Next Up / In-Progress\n`;
      pendingTasks.forEach(t => {
        md += `- [ ] ${t.title}\n`;
      });
      md += `\n`;
    }

    if (scratchpad.trim()) {
      md += `## 📝 Session Notes & Formulas\n\n${scratchpad.trim()}\n\n`;
    }

    md += `---\n*Generated by [Ambients](https://github.com) ambient study co-working*`;

    navigator.clipboard.writeText(md).then(() => {
      if (window.nudgeManager) {
        window.nudgeManager.showToast('📋 Study session exported to clipboard as Markdown!', 'info', 3000);
      } else {
        alert('Session summary copied to clipboard!');
      }
    }).catch(() => {
      prompt('Copy your session markdown:', md);
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}

export const taskManager = new TaskManager();
