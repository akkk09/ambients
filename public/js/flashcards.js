/**
 * Ambients - Duo Flashcards / Active Recall Drill Co-Op
 * Interactive spaced repetition flashcards with 3D flip animation,
 * KaTeX formula support, and live partner drill presence.
 */

import { wsClient } from './ws-client.js';
import { storage } from './storage.js';
import { audio } from './audio.js';
import { companionManager } from './companion.js';

export class FlashcardManager {
  constructor() {
    this.decks = storage.getFlashcardDecks();
    this.currentDeckIndex = 0;
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.drillStats = { correct: 0, totalAnswered: 0 };
    this.partnerDrillProgress = null;

    // DOM Elements
    this.modalEl = null;
    this.openModalBtn = null;
    this.closeModalBtn = null;
    this.cardEl = null;
    this.cardFrontEl = null;
    this.cardBackEl = null;
    this.deckSelectEl = null;
    this.progressTextEl = null;
    this.progressBarEl = null;
    this.correctBtn = null;
    this.reviewBtn = null;
    this.flipBtn = null;

    this.initWebSocketListeners();
  }

  mount(elements) {
    this.modalEl = elements.modal;
    this.openModalBtn = elements.openModalBtn;
    this.closeModalBtn = elements.closeModalBtn;
    this.cardEl = elements.card;
    this.cardFrontEl = elements.cardFront;
    this.cardBackEl = elements.cardBack;
    this.deckSelectEl = elements.deckSelect;
    this.progressTextEl = elements.progressText;
    this.progressBarEl = elements.progressBar;
    this.correctBtn = elements.correctBtn;
    this.reviewBtn = elements.reviewBtn;
    this.flipBtn = elements.flipBtn;

    this.bindEvents();
    this.populateDeckSelect();
    this.loadCurrentCard();
  }

  bindEvents() {
    if (this.openModalBtn && this.modalEl) {
      this.openModalBtn.addEventListener('click', () => {
        this.modalEl.classList.remove('hidden');
        this.loadCurrentCard();
      });
    }

    if (this.closeModalBtn && this.modalEl) {
      this.closeModalBtn.addEventListener('click', () => {
        this.modalEl.classList.add('hidden');
      });
    }

    if (this.cardEl) {
      this.cardEl.addEventListener('click', () => this.flipCard());
    }

    if (this.flipBtn) {
      this.flipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.flipCard();
      });
    }

    if (this.correctBtn) {
      this.correctBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markCard(true);
      });
    }

    if (this.reviewBtn) {
      this.reviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markCard(false);
      });
    }

    if (this.deckSelectEl) {
      this.deckSelectEl.addEventListener('change', (e) => {
        this.currentDeckIndex = parseInt(e.target.value, 10);
        this.currentCardIndex = 0;
        this.drillStats = { correct: 0, totalAnswered: 0 };
        this.loadCurrentCard();
      });
    }

    // Keyboard shortcuts inside drill
    window.addEventListener('keydown', (e) => {
      if (this.modalEl && !this.modalEl.classList.contains('hidden')) {
        if (e.code === 'Space') {
          e.preventDefault();
          this.flipCard();
        } else if (e.key === '1') {
          this.markCard(false);
        } else if (e.key === '2') {
          this.markCard(true);
        }
      }
    });
  }

  initWebSocketListeners() {
    wsClient.on('PARTNER_FLASHCARD_UPDATED', (data) => {
      if (data && data.progress) {
        this.partnerDrillProgress = data.progress;
        this.renderPartnerProgress();
      }
    });
  }

  populateDeckSelect() {
    if (!this.deckSelectEl) return;
    this.deckSelectEl.innerHTML = this.decks.map((d, idx) => `
      <option value="${idx}">${d.title} (${d.cards.length} cards)</option>
    `).join('');
  }

  getCurrentDeck() {
    return this.decks[this.currentDeckIndex] || this.decks[0];
  }

  getCurrentCard() {
    const deck = this.getCurrentDeck();
    return deck?.cards[this.currentCardIndex] || null;
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    if (this.cardEl) {
      if (this.isFlipped) {
        this.cardEl.classList.add('flipped');
      } else {
        this.cardEl.classList.remove('flipped');
      }
    }
  }

  markCard(isCorrect) {
    if (isCorrect) {
      audio.playTaskDing();
      companionManager.addXp(4);
      this.drillStats.correct++;
    }

    this.drillStats.totalAnswered++;

    const deck = this.getCurrentDeck();
    this.currentCardIndex = (this.currentCardIndex + 1) % deck.cards.length;
    this.isFlipped = false;
    if (this.cardEl) this.cardEl.classList.remove('flipped');

    // Broadcast drill progress to partner
    const accuracy = Math.round((this.drillStats.correct / this.drillStats.totalAnswered) * 100);
    wsClient.send('FLASHCARD_ACTION', {
      progress: {
        cardIndex: this.currentCardIndex + 1,
        totalCards: deck.cards.length,
        accuracy
      }
    });

    this.loadCurrentCard();
  }

  loadCurrentCard() {
    const card = this.getCurrentCard();
    const deck = this.getCurrentDeck();

    if (!card) return;

    if (this.cardFrontEl) {
      this.cardFrontEl.innerHTML = this.formatKaTeX(card.q);
      this.renderKaTeXInElement(this.cardFrontEl);
    }
    if (this.cardBackEl) {
      this.cardBackEl.innerHTML = this.formatKaTeX(card.a);
      this.renderKaTeXInElement(this.cardBackEl);
    }

    if (this.progressTextEl) {
      const accuracy = this.drillStats.totalAnswered > 0
        ? ` • ${Math.round((this.drillStats.correct / this.drillStats.totalAnswered) * 100)}% Accuracy`
        : '';
      this.progressTextEl.textContent = `Card ${this.currentCardIndex + 1} of ${deck.cards.length}${accuracy}`;
    }

    if (this.progressBarEl) {
      const pct = ((this.currentCardIndex + 1) / deck.cards.length) * 100;
      this.progressBarEl.style.width = `${pct}%`;
    }
  }

  renderKaTeXInElement(el) {
    if (!el) return;
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) {}
    }
  }

  formatKaTeX(text) {
    if (!text) return '';
    let formatted = String(text);

    if (window.katex && window.katex.renderToString) {
      // 1. Replace block formulas $$ ... $$
      formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        try {
          const rendered = window.katex.renderToString(formula.trim(), {
            displayMode: true,
            throwOnError: false
          });
          return `<div class="my-3 py-2 px-3 bg-black/40 border border-sky-500/20 rounded-xl text-center overflow-x-auto text-sky-300 font-serif">${rendered}</div>`;
        } catch (e) {
          return match;
        }
      });

      // 2. Replace inline formulas $ ... $
      formatted = formatted.replace(/\$([^\$\n\r]+?)\$/g, (match, formula) => {
        try {
          return window.katex.renderToString(formula.trim(), {
            displayMode: false,
            throwOnError: false
          });
        } catch (e) {
          return match;
        }
      });
    }

    return formatted;
  }

  renderPartnerProgress() {
    const partnerHud = document.getElementById('partner-flashcard-hud');
    if (partnerHud && this.partnerDrillProgress) {
      partnerHud.classList.remove('hidden');
      partnerHud.textContent = `🃏 Partner Flashcards: Card ${this.partnerDrillProgress.cardIndex}/${this.partnerDrillProgress.totalCards} (${this.partnerDrillProgress.accuracy}%)`;
    }
  }
}

export const flashcardManager = new FlashcardManager();

// Ensure KaTeX re-renders once window finishes loading CDN scripts
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (flashcardManager) {
      flashcardManager.loadCurrentCard();
    }
  });
}
