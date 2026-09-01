/**
 * Ambients - Gemini AI Study Assistant Client
 * 
 * Features:
 * - AI Task Scribe: Decomposes broad focus goals into 3-4 structured micro-tasks
 * - AI Flashcard Generator: Generates KaTeX-enabled active recall decks from topic
 * - AI Socratic Tutor: Provides gentle conceptual hints without giving away answers
 */

import { taskManager } from './tasks.js';
import { flashcardManager } from './flashcards.js';
import { nudgeManager } from './nudges.js';
import { audio } from './audio.js';

export class GeminiAIClient {
  constructor() {
    this.apiKey = localStorage.getItem('ambients_gemini_key') || '';
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['x-gemini-key'] = this.apiKey;
    }
    return headers;
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    localStorage.setItem('ambients_gemini_key', this.apiKey);
  }

  /**
   * 1. Decompose Focus Goal into Micro-Tasks
   */
  async breakdownFocusGoal(focusGoal) {
    if (!focusGoal || !focusGoal.trim()) {
      nudgeManager.showToast('Please type a focus goal first!', 'warning');
      return;
    }

    nudgeManager.showToast('✨ Gemini AI is generating micro-tasks...', 'info', 2000);

    try {
      const res = await fetch('/api/ai/breakdown-tasks', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ focusGoal: focusGoal.trim() })
      });

      const data = await res.json();
      if (data.tasks && data.tasks.length > 0) {
        data.tasks.forEach(t => {
          taskManager.addTask(t.title, t.tag || 'focus', t.dots || 1);
        });
        audio.playTaskDing();
        nudgeManager.showToast(`✨ Added ${data.tasks.length} micro-tasks to your list!`, 'info', 2500);
      }
    } catch (err) {
      console.error('[Gemini AI Client] Breakdown error:', err);
      nudgeManager.showToast('Could not generate tasks from AI', 'warning');
    }
  }

  /**
   * 2. Generate Flashcards Deck from Topic
   */
  async generateFlashcards(topic, subject = 'general') {
    if (!topic || !topic.trim()) return;

    nudgeManager.showToast('✨ Generating AI active recall deck...', 'info', 2500);

    try {
      const res = await fetch('/api/ai/generate-flashcards', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ topic: topic.trim(), subject })
      });

      const data = await res.json();
      if (data.cards && data.cards.length > 0) {
        const newDeck = {
          id: 'deck_' + Date.now(),
          title: data.deckTitle || `${topic} Deck`,
          subject: data.subject || subject,
          cards: data.cards
        };

        flashcardManager.decks.push(newDeck);
        flashcardManager.populateDeckSelect();
        flashcardManager.currentDeckIndex = flashcardManager.decks.length - 1;
        flashcardManager.currentCardIndex = 0;
        flashcardManager.loadCurrentCard();

        audio.playTaskDing();
        nudgeManager.showToast(`✨ Generated "${newDeck.title}" (${data.cards.length} cards)!`, 'info', 3000);
      }
    } catch (err) {
      console.error('[Gemini AI Client] Flashcard error:', err);
      nudgeManager.showToast('Could not generate flashcards from AI', 'warning');
    }
  }

  /**
   * 3. Socratic Tutor Hint
   */
  async getSocraticHint(context, question) {
    nudgeManager.showToast('✨ Asking Socratic Tutor...', 'info', 2000);

    try {
      const res = await fetch('/api/ai/socratic-hint', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ context, question })
      });

      const data = await res.json();
      if (data.hint) {
        this.showHintModal(data.hint);
      }
    } catch (err) {
      console.error('[Gemini AI Client] Socratic hint error:', err);
      nudgeManager.showToast('Could not retrieve tutor hint', 'warning');
    }
  }

  showHintModal(hintText) {
    const modal = document.getElementById('ai-hint-modal');
    const content = document.getElementById('ai-hint-content');
    if (modal && content) {
      content.innerHTML = `<p class="leading-relaxed text-slate-200">${hintText}</p>`;
      modal.classList.remove('hidden');
    } else {
      alert(`💡 Socratic Hint:\n\n${hintText}`);
    }
  }
}

export const geminiAI = new GeminiAIClient();
