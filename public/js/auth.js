/**
 * Ambients - Client-Side Authentication & Multi-User Account Manager
 */
import { nudgeManager } from './nudges.js';
import { storage } from './storage.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('ambients_auth_token') || null;
    this.modalEl = null;
    this.isRegisterMode = false;
  }

  async init() {
    this.modalEl = document.getElementById('auth-modal');
    this.bindEvents();

    if (this.token) {
      await this.fetchCurrentUser();
    } else {
      this.renderAuthUI();
    }
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async fetchCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        this.applyUserDataToSession(data.user);
        this.renderAuthUI();
      } else {
        this.clearSession();
      }
    } catch (err) {
      console.error('[AuthManager] Fetch current user failed:', err);
    }
  }

  async register(username, password, displayName) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          profile: { name: displayName || username }
        })
      });

      let data = {};
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch (_) {
        throw new Error(res.ok ? 'Unexpected response format' : (responseText.slice(0, 100) || 'Server error during registration'));
      }

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('ambients_auth_token', this.token);
      
      this.applyUserDataToSession(data.user);
      this.renderAuthUI();
      this.closeModal();

      nudgeManager.showToast(`Welcome to Ambients, ${data.user.profile.name}! 🚀`, 'info', 3000);
      return { success: true };
    } catch (err) {
      nudgeManager.showToast(err.message, 'warning', 3500);
      return { success: false, error: err.message };
    }
  }

  async login(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      let data = {};
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch (_) {
        throw new Error(res.ok ? 'Unexpected response format' : (responseText.slice(0, 100) || 'Server error during login'));
      }

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('ambients_auth_token', this.token);

      this.applyUserDataToSession(data.user);
      this.renderAuthUI();
      this.closeModal();

      nudgeManager.showToast(`Welcome back, ${data.user.profile.name}! 📚`, 'info', 3000);
      return { success: true };
    } catch (err) {
      nudgeManager.showToast(err.message, 'warning', 3500);
      return { success: false, error: err.message };
    }
  }

  async logout() {
    try {
      if (this.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
      }
    } catch (e) {}

    this.clearSession();
    nudgeManager.showToast('Logged out of Ambients', 'info', 2000);
    // Reload page to reset desk cleanly to guest
    setTimeout(() => window.location.reload(), 300);
  }

  clearSession() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('ambients_auth_token');
    this.renderAuthUI();
  }

  applyUserDataToSession(user) {
    if (!user) return;

    try {
      // 1. Profile Name
      const nameInput = document.getElementById('my-name-input');
      if (nameInput && user.profile?.name) {
        nameInput.value = user.profile.name;
      }

      // 2. Exam Target
      if (user.examTarget) {
        storage.saveExamTarget(user.examTarget);
        if (window.examManager && typeof window.examManager.render === 'function') {
          window.examManager.render();
        }
      }

      // 3. Consistency Metrics & Heatmap
      if (user.metrics) {
        storage.saveMetrics(user.metrics);
      }
      if (user.activityLog) {
        localStorage.setItem('ambients_activity_30d', JSON.stringify(user.activityLog));
        if (window.heatmapManager && typeof window.heatmapManager.render === 'function') {
          window.heatmapManager.render();
        }
      }

      // 4. Gemini Key
      if (user.geminiKey) {
        localStorage.setItem('ambients_gemini_key', user.geminiKey);
        const keyInput = document.getElementById('gemini-key-input');
        if (keyInput) keyInput.value = user.geminiKey;
      }

      // 5. Tasks & Marks
      if (user.tasks && user.tasks.length > 0) {
        storage.saveTasks(user.tasks);
        if (window.taskManager) {
          window.taskManager.myTasks = user.tasks;
          if (typeof window.taskManager.renderMyTasks === 'function') {
            window.taskManager.renderMyTasks();
          }
        }
      }
      if (user.marks && user.marks.length > 0) {
        storage.saveMarks(user.marks);
        if (window.marksManager) {
          window.marksManager.marks = user.marks;
          if (typeof window.marksManager.renderMarks === 'function') {
            window.marksManager.renderMarks();
          }
        }
      }

      // 6. Theme
      if (user.theme && window.ambientsApp?.applyTheme) {
        window.ambientsApp.applyTheme(user.theme);
      }
    } catch (err) {
      console.warn('[AuthManager] applyUserDataToSession error:', err.message);
    }
  }

  async syncUserData(changes) {
    if (!this.token) return;
    try {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(changes)
      });
    } catch (err) {
      console.error('[AuthManager] Sync error:', err);
    }
  }

  renderAuthUI() {
    const userBadgeEl = document.getElementById('top-user-badge');
    const authBtnEl = document.getElementById('top-auth-btn');

    if (!userBadgeEl || !authBtnEl) return;

    if (this.currentUser) {
      authBtnEl.classList.add('hidden');
      userBadgeEl.classList.remove('hidden');
      
      const usernameEl = document.getElementById('top-user-name');
      const avatarEl = document.getElementById('top-user-avatar');
      if (usernameEl) usernameEl.textContent = this.currentUser.profile?.name || this.currentUser.username;
      if (avatarEl) avatarEl.textContent = (this.currentUser.profile?.name || this.currentUser.username).charAt(0).toUpperCase();
    } else {
      userBadgeEl.classList.add('hidden');
      authBtnEl.classList.remove('hidden');
    }
  }

  openModal(isRegister = false) {
    this.isRegisterMode = isRegister;
    this.updateModalView();
    if (this.modalEl) this.modalEl.classList.remove('hidden');
  }

  closeModal() {
    if (this.modalEl) this.modalEl.classList.add('hidden');
  }

  updateModalView() {
    const titleEl = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-mode-text');
    const toggleBtn = document.getElementById('auth-toggle-mode-btn');
    const nameGroup = document.getElementById('auth-name-group');

    if (this.isRegisterMode) {
      if (titleEl) titleEl.textContent = 'Create Study Account';
      if (submitBtn) submitBtn.textContent = 'Sign Up & Start';
      if (nameGroup) nameGroup.classList.remove('hidden');
      if (toggleText) toggleText.textContent = 'Already have an account?';
      if (toggleBtn) toggleBtn.textContent = 'Log In';
    } else {
      if (titleEl) titleEl.textContent = 'Log In to Ambients';
      if (submitBtn) submitBtn.textContent = 'Log In';
      if (nameGroup) nameGroup.classList.add('hidden');
      if (toggleText) toggleText.textContent = "Don't have an account?";
      if (toggleBtn) toggleBtn.textContent = 'Create Account';
    }
  }

  bindEvents() {
    // Header Auth Buttons
    const openLoginBtn = document.getElementById('top-auth-btn');
    const userBadgeBtn = document.getElementById('top-user-badge');
    const logoutBtn = document.getElementById('top-logout-btn');
    const closeBtn = document.getElementById('close-auth-modal');
    const toggleModeBtn = document.getElementById('auth-toggle-mode-btn');
    const form = document.getElementById('auth-form');

    if (openLoginBtn) {
      openLoginBtn.addEventListener('click', () => this.openModal(false));
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.logout();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    if (toggleModeBtn) {
      toggleModeBtn.addEventListener('click', () => {
        this.isRegisterMode = !this.isRegisterMode;
        this.updateModalView();
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username-input')?.value;
        const password = document.getElementById('auth-password-input')?.value;
        const displayName = document.getElementById('auth-name-input')?.value;

        if (this.isRegisterMode) {
          await this.register(username, password, displayName);
        } else {
          await this.login(username, password);
        }
      });
    }
  }
}

export const authManager = new AuthManager();
