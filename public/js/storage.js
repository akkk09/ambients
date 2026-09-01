/**
 * Ambients - Multi-Disciplinary Storage & Analytics Persistence
 * Supports Mathematics, Science, Social Sciences, Language & Literature
 */

const STORAGE_KEYS = {
  PROFILE: 'ambients_user_profile',
  TASKS: 'ambients_tasks',
  METRICS: 'ambients_metrics',
  PREFERENCES: 'ambients_prefs',
  SAVED_ROOM: 'ambients_last_room',
  PERSONAL_NOTES: 'ambients_personal_notes',
  EXAM_TARGET: 'ambients_exam_target',
  FLASHCARD_DECKS: 'ambients_flashcard_decks',
  COMPANION: 'ambients_companion',
  ACTIVITY_LOG: 'ambients_activity_30d',
  SELECTED_DOMAIN: 'ambients_selected_domain',
  THEME: 'ambients_theme'
};

const DEFAULT_PROFILE = {
  name: 'Study Partner',
  avatarColor: '#38bdf8',
  focusText: 'Reviewing multi-disciplinary concepts',
  domain: 'math' // 'math' | 'science' | 'social_science' | 'language'
};

const DEFAULT_PERSONAL_NOTES = `# 🔒 My Multi-Disciplinary Scratchpad

### 📐 Mathematics & Science
$$\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)$$
$$\\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\longrightarrow 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + 36\\text{ ATP}$$

### 🏛️ Social Science
- **Law of Diminishing Marginal Utility**: As consumption increases, marginal utility decreases.
- **Price Elasticity of Demand**: $$E_d = \\frac{\\% \\Delta Q_d}{\\% \\Delta P}$$

### 📖 Language & Literature
- **Ephemeral** *(adj.)*: Lasting for a very short time. *Synonym: Transient, Fleeting.*
- **Chiasmus**: Reversal of grammatical structures in successive phrases (e.g. *"Never let a fool kiss you or a kiss fool you"*).
`;

const DEFAULT_FLASHCARDS = [
  // 1. MATHEMATICS
  {
    id: 'deck_math_calc',
    title: '📐 Calculus & Linear Algebra',
    subject: 'math',
    domain: 'math',
    cards: [
      { id: 'm1', q: 'Fundamental Theorem of Calculus (Part 1)', a: '$$\\frac{d}{dx} \\left[ \\int_{a}^{x} f(t) \\, dt \\right] = f(x)$$' },
      { id: 'm2', q: 'Integration by Parts Formula', a: '$$\\int u \\, dv = uv - \\int v \\, du$$' },
      { id: 'm3', q: 'Eigenvalue Characteristic Equation', a: '$$\\det(A - \\lambda I) = 0$$' },
      { id: 'm4', q: 'Taylor Series Expansion around $a$', a: '$$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n$$' },
      { id: 'm5', q: 'Gaussian Normal Distribution PDF', a: '$$f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}$$' }
    ]
  },

  // 2. SCIENCE (Physics, Chemistry, Biology, CS)
  {
    id: 'deck_science_core',
    title: '🔬 Physics, Chemistry & Biology Laws',
    subject: 'science',
    domain: 'science',
    cards: [
      { id: 's1', q: 'Maxwell-Faraday Law of Induction', a: '$$\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}$$' },
      { id: 's2', q: 'Gibbs Free Energy Equation', a: '$$\\Delta G = \\Delta H - T\\Delta S \\quad (\\Delta G < 0 \\text{ for spontaneous})$$' },
      { id: 's3', q: 'Photosynthesis Overall Chemical Reaction', a: '$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{light}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$' },
      { id: 's4', q: 'Central Dogma of Molecular Biology', a: '$$\\text{DNA} \\xrightarrow{\\text{Transcription}} \\text{mRNA} \\xrightarrow{\\text{Translation}} \\text{Protein}$$' },
      { id: 's5', q: 'Heisenberg Uncertainty Principle', a: '$$\\Delta x \\cdot \\Delta p \\ge \\frac{\\hbar}{2}$$' }
    ]
  },

  // 3. SOCIAL SCIENCE (Economics, History, Psychology, Civics)
  {
    id: 'deck_social_science',
    title: '🏛️ Social Sciences, Economics & History',
    subject: 'social_science',
    domain: 'social_science',
    cards: [
      { id: 'ss1', q: 'Price Elasticity of Demand ($E_d$)', a: '$$E_d = \\frac{\\% \\Delta Q_d}{\\% \\Delta P} = \\frac{\\Delta Q / Q}{\\Delta P / P}$$ ($|E_d| > 1$: Elastic, $< 1$: Inelastic)' },
      { id: 'ss2', q: 'Treaty of Westphalia (1648) Significance', a: 'Established the principle of **national state sovereignty** and modern international diplomacy.' },
      { id: 'ss3', q: 'Cognitive Dissonance Theory (Festinger)', a: 'Mental discomfort experienced when holding contradictory beliefs, values, or actions, leading individuals to rationalize or change beliefs.' },
      { id: 'ss4', q: 'Keynesian Aggregate Expenditure Equation', a: '$$Y = C + I + G + (X - M)$$ where $C = c_0 + c_1(Y - T)$' },
      { id: 'ss5', q: 'Separation of Powers Principle (Montesquieu)', a: 'Division of government responsibilities into **Legislative**, **Executive**, and **Judicial** branches to prevent tyranny.' }
    ]
  },

  // 4. LANGUAGE & LITERATURE
  {
    id: 'deck_language_lit',
    title: '📖 Advanced Vocabulary & Literary Devices',
    subject: 'language',
    domain: 'language',
    cards: [
      { id: 'l1', q: 'Ephemeral *(adj.)*', a: '**Definition**: Lasting for a very brief time; fleeting.\n**Example**: *The ephemeral beauty of cherry blossoms in April.*' },
      { id: 'l2', q: 'Oxymoron vs Paradox', a: '**Oxymoron**: Compressed phrase pairing contradictory terms (*deafening silence*).\n**Paradox**: A self-contradictory statement revealing deeper truth (*the only constant is change*).' },
      { id: 'l3', q: 'Ubiquitous *(adj.)*', a: '**Definition**: Present, appearing, or found everywhere simultaneously.\n**Example**: *Smartphones have become ubiquitous in daily life.*' },
      { id: 'l4', q: 'Synecdoche vs Metonymy', a: '**Synecdoche**: A part represents the whole (*all hands on deck* = crew).\n**Metonymy**: An associated concept represents the entity (*the Crown* = monarch).' },
      { id: 'l5', q: 'Juxtaposition in Rhetoric', a: 'Placing two contrasting ideas, characters, or settings side-by-side to highlight comparisons and differences.' }
    ]
  }
];

export const storage = {
  getProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return data ? { ...DEFAULT_PROFILE, ...JSON.parse(data) } : { ...DEFAULT_PROFILE };
    } catch (e) {
      return { ...DEFAULT_PROFILE };
    }
  },

  saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {}
  },

  getSelectedDomain() {
    try {
      return localStorage.getItem(STORAGE_KEYS.SELECTED_DOMAIN) || 'math';
    } catch (e) {
      return 'math';
    }
  },

  saveSelectedDomain(domain) {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_DOMAIN, domain);
    } catch (e) {}
  },

  getTheme() {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) || 'midnight';
    } catch (e) {
      return 'midnight';
    }
  },

  saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {}
  },

  getTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  syncAccountData(partial) {
    try {
      const token = localStorage.getItem('ambients_auth_token');
      if (token) {
        fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(partial)
        }).catch(() => {});
      }
    } catch (e) {}
  },

  saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      this.syncAccountData({ tasks });
    } catch (e) {}
  },

  getPersonalNotes() {
    try {
      return localStorage.getItem(STORAGE_KEYS.PERSONAL_NOTES) || DEFAULT_PERSONAL_NOTES;
    } catch (e) {
      return DEFAULT_PERSONAL_NOTES;
    }
  },

  savePersonalNotes(notes) {
    try {
      localStorage.setItem(STORAGE_KEYS.PERSONAL_NOTES, notes);
    } catch (e) {}
  },

  getExamTarget() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXAM_TARGET);
      return data ? JSON.parse(data) : {
        title: 'Target Exam',
        targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        targetPercentage: 90
      };
    } catch (e) {
      return null;
    }
  },

  saveExamTarget(target) {
    try {
      localStorage.setItem(STORAGE_KEYS.EXAM_TARGET, JSON.stringify(target));
      this.syncAccountData({ examTarget: target });
    } catch (e) {}
  },

  getFlashcardDecks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FLASHCARD_DECKS);
      return data ? JSON.parse(data) : DEFAULT_FLASHCARDS;
    } catch (e) {
      return DEFAULT_FLASHCARDS;
    }
  },

  saveFlashcardDecks(decks) {
    try {
      localStorage.setItem(STORAGE_KEYS.FLASHCARD_DECKS, JSON.stringify(decks));
    } catch (e) {}
  },

  getCompanion() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMPANION);
      return data ? JSON.parse(data) : { type: 'bonsai', name: 'Zen Bonsai', xp: 45, stage: 1 };
    } catch (e) {
      return { type: 'bonsai', name: 'Zen Bonsai', xp: 45, stage: 1 };
    }
  },

  saveCompanion(companion) {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPANION, JSON.stringify(companion));
      this.syncAccountData({ companion });
    } catch (e) {}
  },

  getActivityLog() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG);
      if (data) return JSON.parse(data);

      const log = {};
      const now = new Date();
      for (let i = 28; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        log[key] = Math.floor(Math.random() * 85);
      }
      return log;
    } catch (e) {
      return {};
    }
  },

  recordActivity(minutes) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const log = this.getActivityLog();
    log[todayStr] = (log[todayStr] || 0) + minutes;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(log));
      this.syncAccountData({ activityLog: log });
    } catch (e) {}
    return log;
  },

  getMetrics() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const defaultMetrics = {
      lastDate: todayStr,
      streak: 1,
      todayCompletedTasks: 0,
      todayFocusMinutes: 0,
      totalFocusMinutes: 0
    };

    try {
      const data = localStorage.getItem(STORAGE_KEYS.METRICS);
      if (!data) return defaultMetrics;

      const parsed = JSON.parse(data);

      if (parsed.lastDate !== todayStr) {
        const lastDate = new Date(parsed.lastDate);
        const today = new Date(todayStr);
        const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          parsed.streak = (parsed.streak || 0) + 1;
        } else if (diffDays > 1) {
          parsed.streak = 1;
        }

        parsed.lastDate = todayStr;
        parsed.todayCompletedTasks = 0;
        parsed.todayFocusMinutes = 0;
        localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(parsed));
      }

      return parsed;
    } catch (e) {
      return defaultMetrics;
    }
  },

  incrementCompletedTask() {
    const metrics = this.getMetrics();
    metrics.todayCompletedTasks = (metrics.todayCompletedTasks || 0) + 1;
    try {
      localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(metrics));
    } catch (e) {}
    return metrics;
  },

  addFocusMinutes(minutes) {
    const metrics = this.getMetrics();
    metrics.todayFocusMinutes = (metrics.todayFocusMinutes || 0) + minutes;
    metrics.totalFocusMinutes = (metrics.totalFocusMinutes || 0) + minutes;
    try {
      localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(metrics));
    } catch (e) {}
    this.recordActivity(minutes);
    return metrics;
  },

  setLastRoom(roomId) {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_ROOM, roomId);
    } catch (e) {}
  },

  getLastRoom() {
    try {
      return localStorage.getItem(STORAGE_KEYS.SAVED_ROOM) || 'focus-room';
    } catch (e) {
      return 'focus-room';
    }
  }
};
