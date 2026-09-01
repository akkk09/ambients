/**
 * Ambients - Shared & Personal Scratchpad with KaTeX LaTeX Rendering
 * 
 * Features:
 * - Shared Tab: Real-time debounced WebSocket synchronization with partner
 * - Personal Tab: 100% private notes saved in LocalStorage
 * - Live KaTeX LaTeX mathematical formulas ($inline$ & $$block$$)
 * - Quick Formula template toolbar
 */

import { wsClient } from './ws-client.js';
import { storage } from './storage.js';

export class ScratchpadManager {
  constructor() {
    this.activeTab = 'shared'; // 'shared' | 'personal'
    this.sharedContent = '';
    this.personalContent = storage.getPersonalNotes();

    this.debounceTimer = null;
    this.typingTimeout = null;
    this.isPartnerTyping = false;
    this.isPreviewMode = false;

    // DOM Elements
    this.sharedTabBtn = null;
    this.personalTabBtn = null;
    this.textareaEl = null;
    this.previewEl = null;
    this.typingIndicatorEl = null;
    this.previewToggleBtn = null;
    this.drawerEl = null;
    this.toggleDrawerBtn = null;
    this.closeDrawerBtn = null;
    this.badgeDotEl = null;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.sharedTabBtn = elements.sharedTabBtn;
    this.personalTabBtn = elements.personalTabBtn;
    this.textareaEl = elements.textarea;
    this.previewEl = elements.preview;
    this.typingIndicatorEl = elements.typingIndicator;
    this.previewToggleBtn = elements.previewToggleBtn;
    this.drawerEl = elements.drawer;
    this.toggleDrawerBtn = elements.toggleDrawerBtn;
    this.closeDrawerBtn = elements.closeDrawerBtn;
    this.badgeDotEl = elements.badgeDot;

    this.bindEvents();
    this.switchTab('shared');
  }

  bindEvents() {
    // 1. Tab Switching (Shared vs Personal)
    if (this.sharedTabBtn) {
      this.sharedTabBtn.addEventListener('click', () => this.switchTab('shared'));
    }
    if (this.personalTabBtn) {
      this.personalTabBtn.addEventListener('click', () => this.switchTab('personal'));
    }

    // 2. Textarea Input
    if (this.textareaEl) {
      this.textareaEl.addEventListener('input', (e) => {
        const text = e.target.value;

        if (this.activeTab === 'shared') {
          this.sharedContent = text;
          this.notifyTyping(true);

          clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            wsClient.send('SCRATCHPAD_UPDATE', { content: this.sharedContent });
            this.notifyTyping(false);
          }, 250);
        } else {
          this.personalContent = text;
          storage.savePersonalNotes(this.personalContent);
        }

        this.renderPreview();
      });
    }

    // 3. Formula Toolbar Buttons
    document.querySelectorAll('[data-formula]').forEach(btn => {
      btn.addEventListener('click', () => {
        const template = btn.dataset.formula;
        this.insertFormulaTemplate(template);
      });
    });

    // 4. Markdown Preview Toggle
    if (this.previewToggleBtn) {
      this.previewToggleBtn.addEventListener('click', () => this.togglePreviewMode());
    }

    // 5. Drawer Toggle
    if (this.toggleDrawerBtn) {
      this.toggleDrawerBtn.addEventListener('click', () => this.toggleDrawer());
    }
    if (this.closeDrawerBtn) {
      this.closeDrawerBtn.addEventListener('click', () => this.closeDrawer());
    }
  }

  initWebSocketListeners() {
    wsClient.on('ROOM_SNAPSHOT', (data) => {
      if (data && data.scratchpad) {
        this.sharedContent = data.scratchpad.content || '';
        if (this.activeTab === 'shared' && this.textareaEl) {
          this.textareaEl.value = this.sharedContent;
          this.renderPreview();
        }
      }
    });

    wsClient.on('SCRATCHPAD_UPDATED', (data) => {
      if (data && data.content !== undefined) {
        this.sharedContent = data.content;
        if (this.activeTab === 'shared') {
          if (this.textareaEl) {
            const start = this.textareaEl.selectionStart;
            const end = this.textareaEl.selectionEnd;
            this.textareaEl.value = this.sharedContent;
            if (document.activeElement === this.textareaEl) {
              this.textareaEl.setSelectionRange(start, end);
            }
          }
          this.renderPreview();
        }
        this.flashUnreadBadge();
      }
    });

    wsClient.on('PARTNER_TYPING', (data) => {
      if (data) {
        this.setPartnerTyping(data.isTyping);
      }
    });
  }

  switchTab(tab) {
    this.activeTab = tab;

    if (tab === 'shared') {
      if (this.sharedTabBtn) this.sharedTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-all';
      if (this.personalTabBtn) this.personalTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white border border-transparent transition-all';
      if (this.textareaEl) this.textareaEl.value = this.sharedContent;
      if (this.typingIndicatorEl && this.isPartnerTyping) {
        this.typingIndicatorEl.classList.remove('hidden');
      }
    } else {
      if (this.personalTabBtn) this.personalTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all';
      if (this.sharedTabBtn) this.sharedTabBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white border border-transparent transition-all';
      if (this.textareaEl) this.textareaEl.value = this.personalContent;
      if (this.typingIndicatorEl) {
        this.typingIndicatorEl.classList.add('hidden');
      }
    }

    this.renderPreview();
  }

  insertFormulaTemplate(template) {
    if (!this.textareaEl) return;

    let snippet = '';
    switch (template) {
      // Mathematics
      case 'integral':
        snippet = '\n$$\\int_{a}^{b} f(x) \\, dx$$\n';
        break;
      case 'derivative':
        snippet = '\n$$\\frac{d}{dx} \\left[ f(x) \\right]$$\n';
        break;
      case 'limit':
        snippet = '\n$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$\n';
        break;
      case 'matrix':
        snippet = '\n$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$\n';
        break;
      case 'sum':
        snippet = '\n$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$\n';
        break;

      // Science (Physics / Chem / Bio)
      case 'physics':
        snippet = '\n$$\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}$$\n';
        break;
      case 'chem_reaction':
        snippet = '\n$$\\text{Reactants} \\xrightarrow{\\Delta, \\text{ cat.}} \\text{Products} \\quad (\\Delta H = -\\text{kJ/mol})$$\n';
        break;
      case 'bio_pathway':
        snippet = '\n- **Pathway**: $\\text{Glucose} \\to \\text{Pyruvate} \\to \\text{Acetyl-CoA} \\to \\text{Krebs Cycle} \\to 36\\text{ ATP}$\n';
        break;

      // Social Science (Economics / History / Psych)
      case 'elasticity':
        snippet = '\n$$E_d = \\frac{\\% \\Delta Q_d}{\\% \\Delta P} = \\frac{\\Delta Q / Q}{\\Delta P / P}$$\n';
        break;
      case 'timeline':
        snippet = '\n- **[Year/Date]**: **Event** $\\to$ **Immediate Cause** $\\to$ **Long-term Consequence**\n';
        break;
      case 'gdp':
        snippet = '\n$$Y = C + I + G + (X - M)$$\n';
        break;

      // Language & Literature
      case 'vocab_entry':
        snippet = '\n- **Word** *(adj./noun)*: Definition.\n  - *Example*: In-context sentence illustrating usage.\n  - *Synonyms*: Syn1, Syn2.\n';
        break;
      case 'literary_device':
        snippet = '\n- **Device (e.g. Allegory / Metaphor)**: Context in passage $\\to$ Author\'s intended thematic effect.\n';
        break;
      case 'accents':
        snippet = ' é à è ñ ü ç î ô ';
        break;

      default:
        snippet = '\n$$E = mc^2$$\n';
    }

    const start = this.textareaEl.selectionStart;
    const end = this.textareaEl.selectionEnd;
    const current = this.textareaEl.value;

    this.textareaEl.value = current.slice(0, start) + snippet + current.slice(end);
    this.textareaEl.selectionStart = this.textareaEl.selectionEnd = start + snippet.length;
    this.textareaEl.focus();

    // Trigger input event
    this.textareaEl.dispatchEvent(new Event('input'));
  }

  notifyTyping(isTyping) {
    if (this.activeTab === 'shared') {
      wsClient.send('SCRATCHPAD_TYPING', { isTyping });
    }
  }

  setPartnerTyping(isTyping) {
    this.isPartnerTyping = isTyping;
    if (this.typingIndicatorEl && this.activeTab === 'shared') {
      if (isTyping) {
        this.typingIndicatorEl.classList.remove('opacity-0');
        this.typingIndicatorEl.classList.add('opacity-100');
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.setPartnerTyping(false), 3000);
      } else {
        this.typingIndicatorEl.classList.add('opacity-0');
        this.typingIndicatorEl.classList.remove('opacity-100');
      }
    }
  }

  togglePreviewMode() {
    this.isPreviewMode = !this.isPreviewMode;
    if (this.isPreviewMode) {
      if (this.textareaEl) this.textareaEl.classList.add('hidden');
      if (this.previewEl) this.previewEl.classList.remove('hidden');
      if (this.previewToggleBtn) this.previewToggleBtn.innerHTML = `<i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit`;
      this.renderPreview();
    } else {
      if (this.textareaEl) this.textareaEl.classList.remove('hidden');
      if (this.previewEl) this.previewEl.classList.add('hidden');
      if (this.previewToggleBtn) this.previewToggleBtn.innerHTML = `<i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview`;
      if (this.textareaEl) this.textareaEl.focus();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  toggleDrawer() {
    if (this.drawerEl) {
      const isOpen = !this.drawerEl.classList.contains('translate-x-full');
      if (isOpen) {
        this.closeDrawer();
      } else {
        this.openDrawer();
      }
    }
  }

  openDrawer() {
    if (this.drawerEl) {
      this.drawerEl.classList.remove('translate-x-full');
      if (this.badgeDotEl) this.badgeDotEl.classList.add('hidden');
      if (this.textareaEl && !this.isPreviewMode) {
        setTimeout(() => this.textareaEl.focus(), 150);
      }
    }
  }

  closeDrawer() {
    if (this.drawerEl) {
      this.drawerEl.classList.add('translate-x-full');
    }
  }

  flashUnreadBadge() {
    if (this.drawerEl && this.drawerEl.classList.contains('translate-x-full') && this.badgeDotEl) {
      this.badgeDotEl.classList.remove('hidden');
    }
  }

  renderPreview() {
    if (!this.previewEl) return;
    const text = this.activeTab === 'shared' ? this.sharedContent : this.personalContent;
    this.previewEl.innerHTML = this.parseMarkdownWithKaTeX(text);
  }

  parseMarkdownWithKaTeX(text) {
    if (!text) return '<p class="text-slate-500 italic">Empty scratchpad. Click edit to type.</p>';

    let html = text;

    // 1. Process Math block $$...$$ with KaTeX if available
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, equation) => {
      if (window.katex) {
        try {
          return `<div class="my-3 py-2 px-3 bg-black/40 border border-white/10 rounded-lg text-center overflow-x-auto text-sky-300 font-serif">${window.katex.renderToString(equation.trim(), { displayMode: true, throwOnError: false })}</div>`;
        } catch (e) {
          return `<div class="text-rose-400 font-mono text-xs">$$${this.escapeHtml(equation)}$$</div>`;
        }
      }
      return `<div class="font-mono text-sky-300 bg-black/30 p-2 rounded">$$${this.escapeHtml(equation)}$$</div>`;
    });

    // 2. Process Inline Math $...$ with KaTeX
    html = html.replace(/\$([^\$\n]+)\$/g, (match, equation) => {
      if (window.katex) {
        try {
          return window.katex.renderToString(equation.trim(), { displayMode: false, throwOnError: false });
        } catch (e) {
          return `$${this.escapeHtml(equation)}$`;
        }
      }
      return `<span class="font-mono text-sky-300">$${this.escapeHtml(equation)}$</span>`;
    });

    // 3. Process Standard Markdown
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-md font-semibold text-slate-200 mt-3 mb-1">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-white mt-4 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-white mt-4 mb-2 pb-1 border-b border-white/10">$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="text-white font-semibold">$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em class="italic text-slate-300">$1</em>');
    html = html.replace(/```([\s\S]*?)```/gim, '<pre class="bg-black/40 p-3 rounded my-2 text-xs font-mono overflow-x-auto text-sky-300 border border-white/10"><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/gim, '<code class="bg-white/10 px-1.5 py-0.5 rounded font-mono text-xs text-sky-400">$1</code>');
    html = html.replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-slate-300 my-0.5">$1</li>');
    html = html.replace(/\[ \]/g, '☐');
    html = html.replace(/\[x\]/gi, '☑');
    html = html.replace(/\n/gim, '<br>');

    return `<div class="markdown-body text-sm leading-relaxed">${html}</div>`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const scratchpadManager = new ScratchpadManager();
