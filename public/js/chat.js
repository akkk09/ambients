/**
 * Ambients - Gemini AI Focus Overseer & Agentic Chatbar
 * Provides real-time bidirectional conversation & direct desk control
 */
import { nudgeManager } from './nudges.js';
import { audio } from './audio.js';
import { taskManager } from './tasks.js';
import { storage } from './storage.js';
import { wsClient } from './ws-client.js';
import { authManager } from './auth.js';
import { flashcardManager } from './flashcards.js';

class OverseerChatManager {
  constructor() {
    this.drawerEl = null;
    this.messagesListEl = null;
    this.inputEl = null;
    this.sendBtn = null;
    this.isOpen = false;
    this.chatHistory = [];
  }

  init() {
    this.drawerEl = document.getElementById('overseer-drawer');
    this.messagesListEl = document.getElementById('overseer-messages-list');
    this.inputEl = document.getElementById('overseer-input');
    this.sendBtn = document.getElementById('overseer-send-btn');

    // Load saved chat history
    this.loadHistory();
    this.bindEvents();
    this.renderMessages();
  }

  loadHistory() {
    if (authManager.currentUser?.chatHistory) {
      this.chatHistory = authManager.currentUser.chatHistory;
    } else {
      try {
        const saved = localStorage.getItem('ambients_overseer_chat');
        this.chatHistory = saved ? JSON.parse(saved) : [
          {
            id: 'm_intro',
            sender: 'ai',
            text: "Hello! I'm your **Ambients AI Overseer**. I can oversee your focus blocks, create tasks, start timers, or generate flashcards for you. How can I assist your study session?",
            actions: [],
            timestamp: Date.now()
          }
        ];
      } catch (e) {
        this.chatHistory = [];
      }
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('ambients_overseer_chat', JSON.stringify(this.chatHistory));
      if (authManager.currentUser) {
        authManager.syncUserData({ chatHistory: this.chatHistory });
      }
    } catch (e) {}
  }

  toggleDrawer(openState) {
    this.isOpen = openState !== undefined ? openState : !this.isOpen;
    if (!this.drawerEl) return;

    if (this.isOpen) {
      this.drawerEl.classList.remove('translate-x-full');
      if (this.inputEl) this.inputEl.focus();
    } else {
      this.drawerEl.classList.add('translate-x-full');
    }
  }

  async sendMessage(userText) {
    if (!userText || !userText.trim()) return;

    const text = userText.trim();
    if (this.inputEl) this.inputEl.value = '';

    // Add user message
    const userMsg = {
      id: 'm_' + Date.now(),
      sender: 'user',
      text,
      timestamp: Date.now()
    };
    this.chatHistory.push(userMsg);
    this.renderMessages();
    this.saveHistory();

    // Show typing indicator
    this.renderTypingIndicator(true);

    // Build current desk context
    const myTasks = storage.getTasks() || [];
    const focusInput = document.getElementById('my-focus-input');
    const examTarget = storage.getExamTarget();
    const metrics = storage.getMetrics();
    const companion = storage.getCompanion();

    const roomContext = {
      tasks: myTasks.map(t => ({ title: t.title, completed: t.completed, tag: t.tag })),
      focusText: focusInput ? focusInput.value : '',
      examTarget,
      totalFocusMinutes: metrics.totalFocusMinutes,
      companion
    };

    try {
      const apiKey = localStorage.getItem('ambients_gemini_key') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-gemini-key'] = apiKey;

      const res = await fetch('/api/ai/overseer-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          chatHistory: this.chatHistory,
          roomContext
        })
      });

      const data = await res.json();
      this.renderTypingIndicator(false);

      if (data.error) {
        const errorMsg = {
          id: 'm_' + Date.now(),
          sender: 'ai',
          text: `⚠️ **Gemini API Notice**: ${data.error}. Please ensure your Gemini API Key is entered in Settings (⚙️).`,
          actions: [],
          timestamp: Date.now()
        };
        this.chatHistory.push(errorMsg);
        this.renderMessages();
        this.saveHistory();
        return;
      }

      if (data.reply) {
        const aiMsg = {
          id: 'm_' + Date.now(),
          sender: 'ai',
          text: data.reply,
          actions: data.actions || [],
          timestamp: Date.now()
        };
        this.chatHistory.push(aiMsg);
        this.renderMessages();
        this.saveHistory();

        // Execute any returned tool actions on the desk
        if (data.actions && data.actions.length > 0) {
          this.executeOverseerActions(data.actions);
        }
      }
    } catch (err) {
      console.error('[Overseer Chat] Error:', err);
      this.renderTypingIndicator(false);
      const fallbackMsg = {
        id: 'm_' + Date.now(),
        sender: 'ai',
        text: `⚠️ Could not complete request: ${err.message || 'Network error'}`,
        actions: [],
        timestamp: Date.now()
      };
      this.chatHistory.push(fallbackMsg);
      this.renderMessages();
      this.saveHistory();
    }
  }

  executeOverseerActions(actions) {
    actions.forEach(action => {
      try {
        switch (action.type) {
          case 'add_task':
            taskManager.addTask(action.title, action.tag || 'focus', action.dots || 1);
            audio.playTaskDing();
            nudgeManager.showToast(`✨ Overseer added task: "${action.title}"`, 'info', 2500);
            break;

          case 'complete_task':
            if (action.title && taskManager.tasks) {
              const target = taskManager.tasks.find(t => t.title.toLowerCase().includes(action.title.toLowerCase()));
              if (target && !target.completed) {
                taskManager.toggleTask(target.id);
                nudgeManager.showToast(`✨ Overseer checked off: "${target.title}"`, 'info', 2500);
              }
            }
            break;

          case 'set_timer':
            if (action.mode) {
              const modeBtn = document.getElementById(`mode-${action.mode}`);
              if (modeBtn) modeBtn.click();
            }
            if (action.state === 'start') {
              const toggleBtn = document.getElementById('timer-toggle-btn');
              if (toggleBtn && toggleBtn.textContent.includes('Start')) toggleBtn.click();
            } else if (action.state === 'pause') {
              const toggleBtn = document.getElementById('timer-toggle-btn');
              if (toggleBtn && toggleBtn.textContent.includes('Pause')) toggleBtn.click();
            } else if (action.state === 'reset') {
              const resetBtn = document.getElementById('timer-reset-btn');
              if (resetBtn) resetBtn.click();
            }
            nudgeManager.showToast(`✨ Overseer updated timer: ${action.mode || ''} ${action.state || ''}`, 'info', 2000);
            break;

          case 'set_focus':
            const focusInput = document.getElementById('my-focus-input');
            if (focusInput && action.focusText) {
              focusInput.value = action.focusText;
              focusInput.dispatchEvent(new Event('input'));
              nudgeManager.showToast(`✨ Overseer set focus: "${action.focusText}"`, 'info', 2500);
            }
            break;

          case 'set_soundscape':
            if (action.soundType === 'rain') {
              const rainSlider = document.getElementById('slider-rain-noise');
              if (rainSlider) {
                rainSlider.value = action.level || 0.4;
                rainSlider.dispatchEvent(new Event('input'));
              }
            } else if (action.soundType === 'brown') {
              const brownSlider = document.getElementById('slider-brown-noise');
              if (brownSlider) {
                brownSlider.value = action.level || 0.4;
                brownSlider.dispatchEvent(new Event('input'));
              }
            } else if (action.soundType === 'binaural') {
              const binauralSlider = document.getElementById('slider-binaural');
              if (binauralSlider) {
                binauralSlider.value = action.level || 0.4;
                binauralSlider.dispatchEvent(new Event('input'));
              }
            }
            nudgeManager.showToast(`✨ Overseer adjusted soundscape (${action.soundType})`, 'info', 2000);
            break;

          case 'set_exam':
            if (action.title) {
              const examTarget = {
                title: action.title,
                targetDate: action.targetDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                targetPercentage: action.targetPercentage || 90
              };
              storage.saveExamTarget(examTarget);
              if (window.examManager) window.examManager.renderUI();
              nudgeManager.showToast(`✨ Overseer set exam target: "${action.title}"`, 'info', 2500);
            }
            break;

          case 'generate_deck':
            if (action.topic && window.geminiAI) {
              window.geminiAI.generateFlashcards(action.topic);
            }
            break;
        }
      } catch (e) {
        console.error('[Overseer Action Execution Error]:', e);
      }
    });
  }

  renderMessages() {
    if (!this.messagesListEl) return;

    this.messagesListEl.innerHTML = this.chatHistory.map(m => {
      const isAI = m.sender === 'ai';
      const actionBadges = (m.actions && m.actions.length > 0)
        ? `<div class="flex flex-wrap gap-1 mt-2">
            ${m.actions.map(a => `<span class="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">⚡ ${a.type.replace('_', ' ')}</span>`).join('')}
           </div>`
        : '';

      return `
        <div class="flex flex-col gap-1 ${isAI ? 'items-start' : 'items-end'}">
          <div class="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono px-1">
            <span>${isAI ? '✨ Overseer' : 'You'}</span>
            <span>•</span>
            <span>${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
            isAI 
              ? 'bg-slate-800/90 border border-purple-500/20 text-slate-100 shadow-md' 
              : 'bg-sky-500 text-slate-950 font-medium shadow-md'
          }">
            <div>${this.formatMessageMarkdown(m.text)}</div>
            ${actionBadges}
          </div>
        </div>
      `;
    }).join('');

    this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
  }

  formatMessageMarkdown(text) {
    if (!text) return '';
    let formatted = String(text);
    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 py-0.5 rounded text-sky-300 font-mono text-[11px]">$1</code>');
    return formatted;
  }

  renderTypingIndicator(show) {
    const typingEl = document.getElementById('overseer-typing-indicator');
    if (typingEl) {
      if (show) {
        typingEl.classList.remove('hidden');
      } else {
        typingEl.classList.add('hidden');
      }
    }
  }

  bindEvents() {
    const toggleBtn = document.getElementById('toggle-overseer-btn');
    const closeBtn = document.getElementById('close-overseer-btn');
    const form = document.getElementById('overseer-form');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleDrawer());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleDrawer(false));
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.inputEl?.value;
        this.sendMessage(text);
      });
    }

    // Shortcut: ⌘/ or Ctrl+/
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        this.toggleDrawer();
      }
    });
  }
}

export const overseerManager = new OverseerChatManager();
