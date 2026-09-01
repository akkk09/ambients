/**
 * Ambients - Ambient Presence & Tab Focus Detection
 * Monitors user status (Deep Focus, Reviewing, Break, Stepped Away),
 * tab visibility state, and avatar/profile personalization.
 */

import { wsClient } from './ws-client.js';
import { storage } from './storage.js';

export const PRESENCE_STATES = {
  deep_focus: { label: 'Deep Focus', color: '#38bdf8', icon: 'zap', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  reviewing: { label: 'Reviewing', color: '#a855f7', icon: 'book-open', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  break: { label: 'On Break', color: '#10b981', icon: 'coffee', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  away: { label: 'Stepped Away', color: '#f59e0b', icon: 'clock', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
};

export class PresenceManager {
  constructor() {
    this.profile = storage.getProfile();
    this.myStatus = 'deep_focus';
    this.isTabActive = !document.hidden;

    this.partnerProfile = null;
    this.partnerStatus = {
      state: 'deep_focus',
      isTabActive: true
    };

    // DOM Elements
    this.statusSelectEl = null;
    this.myAvatarEl = null;
    this.myNameEl = null;
    this.myTabStatusDotEl = null;
    this.myTabStatusTextEl = null;

    this.partnerDeskCardEl = null;
    this.partnerAvatarEl = null;
    this.partnerNameEl = null;
    this.partnerStatusBadgeEl = null;
    this.partnerTabStatusDotEl = null;
    this.partnerTabStatusTextEl = null;
    this.partnerEmptyStateEl = null;
    this.partnerContentEl = null;

    this.initTabVisibilityListener();
    this.initWebSocketListeners();
  }

  mount(elements) {
    this.statusSelectEl = elements.statusSelect;
    this.myAvatarEl = elements.myAvatar;
    this.myNameEl = elements.myName;
    this.myTabStatusDotEl = elements.myTabStatusDot;
    this.myTabStatusTextEl = elements.myTabStatusText;

    this.partnerDeskCardEl = elements.partnerDeskCard;
    this.partnerAvatarEl = elements.partnerAvatar;
    this.partnerNameEl = elements.partnerName;
    this.partnerStatusBadgeEl = elements.partnerStatusBadge;
    this.partnerTabStatusDotEl = elements.partnerTabStatusDot;
    this.partnerTabStatusTextEl = elements.partnerTabStatusText;
    this.partnerEmptyStateEl = elements.partnerEmptyState;
    this.partnerContentEl = elements.partnerContent;

    this.bindEvents();
    this.renderMyProfile();
    this.renderPartnerPresence();
  }

  bindEvents() {
    // 1. Status Dropdown
    if (this.statusSelectEl) {
      this.statusSelectEl.value = this.myStatus;
      this.statusSelectEl.addEventListener('change', (e) => {
        this.setStatus(e.target.value);
      });
    }

    // 2. Editable User Name
    if (this.myNameEl) {
      this.myNameEl.value = this.profile.name || 'Desk A';
      this.myNameEl.addEventListener('input', (e) => {
        this.profile.name = e.target.value.trim() || 'Study Partner';
        storage.saveProfile(this.profile);
        this.renderMyProfile();
        wsClient.send('UPDATE_PROFILE', { name: this.profile.name });
      });
    }
  }

  initTabVisibilityListener() {
    const handleVisibility = () => {
      const active = !document.hidden && document.hasFocus();
      if (this.isTabActive !== active) {
        this.isTabActive = active;
        this.broadcastStatus();
        this.renderMyProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('blur', handleVisibility);
  }

  initWebSocketListeners() {
    // 1. Room snapshot
    wsClient.on('ROOM_SNAPSHOT', (data) => {
      if (data) {
        if (data.slot === 'userA') {
          this.profile.name = this.profile.name || 'Desk A';
        } else {
          this.profile.name = this.profile.name || 'Desk B';
        }

        if (data.partner) {
          this.partnerProfile = data.partner.profile;
          this.partnerStatus = data.partner.status || { state: 'deep_focus', isTabActive: true };
        } else {
          this.partnerProfile = null;
        }

        this.renderMyProfile();
        this.renderPartnerPresence();
      }
    });

    // 2. Partner Joined
    wsClient.on('PEER_JOINED', (data) => {
      if (data && data.partner) {
        this.partnerProfile = data.partner.profile;
        this.partnerStatus = data.partner.status || { state: 'deep_focus', isTabActive: true };
        this.renderPartnerPresence();
      }
    });

    // 3. Partner Left
    wsClient.on('PEER_LEFT', (data) => {
      this.partnerProfile = null;
      this.renderPartnerPresence();
    });

    // 4. Partner Profile Updated
    wsClient.on('PARTNER_PROFILE_UPDATED', (data) => {
      if (data && data.profile) {
        this.partnerProfile = { ...this.partnerProfile, ...data.profile };
        this.renderPartnerPresence();
      }
    });

    // 5. Partner Status Updated
    wsClient.on('PARTNER_STATUS_UPDATED', (data) => {
      if (data && data.status) {
        this.partnerStatus = data.status;
        this.renderPartnerPresence();
      }
    });
  }

  setStatus(newState) {
    if (!PRESENCE_STATES[newState]) return;
    this.myStatus = newState;
    this.broadcastStatus();
    this.renderMyProfile();
  }

  broadcastStatus() {
    wsClient.send('UPDATE_STATUS', {
      state: this.myStatus,
      isTabActive: this.isTabActive
    });
  }

  renderMyProfile() {
    if (this.myAvatarEl) {
      const initial = (this.profile.name || 'A').charAt(0).toUpperCase();
      this.myAvatarEl.textContent = initial;
      this.myAvatarEl.style.borderColor = this.profile.avatarColor || '#38bdf8';
    }

    if (this.myTabStatusDotEl) {
      if (this.isTabActive) {
        this.myTabStatusDotEl.className = 'w-2 h-2 rounded-full bg-emerald-400 ambient-dot-pulse';
        if (this.myTabStatusTextEl) this.myTabStatusTextEl.textContent = 'Active on Tab';
      } else {
        this.myTabStatusDotEl.className = 'w-2 h-2 rounded-full bg-amber-400/80';
        if (this.myTabStatusTextEl) this.myTabStatusTextEl.textContent = 'Tab Blurred / Away';
      }
    }
  }

  renderPartnerPresence() {
    // Check if partner is present
    if (!this.partnerProfile) {
      if (this.partnerEmptyStateEl) this.partnerEmptyStateEl.classList.remove('hidden');
      if (this.partnerContentEl) this.partnerContentEl.classList.add('hidden');
      return;
    }

    if (this.partnerEmptyStateEl) this.partnerEmptyStateEl.classList.add('hidden');
    if (this.partnerContentEl) this.partnerContentEl.classList.remove('hidden');

    // Update Partner Avatar & Name
    if (this.partnerAvatarEl) {
      const initial = (this.partnerProfile.name || 'P').charAt(0).toUpperCase();
      this.partnerAvatarEl.textContent = initial;
      this.partnerAvatarEl.style.borderColor = this.partnerProfile.avatarColor || '#a855f7';
    }

    if (this.partnerNameEl) {
      this.partnerNameEl.textContent = this.partnerProfile.name || 'Partner';
    }

    // Update Partner Status Badge
    const stateConfig = PRESENCE_STATES[this.partnerStatus.state] || PRESENCE_STATES.deep_focus;
    if (this.partnerStatusBadgeEl) {
      this.partnerStatusBadgeEl.className = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${stateConfig.bg}`;
      this.partnerStatusBadgeEl.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${stateConfig.color}"></span>
        <span>${stateConfig.label}</span>
      `;
    }

    // Update Partner Tab Focus Dot
    if (this.partnerTabStatusDotEl) {
      if (this.partnerStatus.isTabActive) {
        this.partnerTabStatusDotEl.className = 'w-2 h-2 rounded-full bg-emerald-400 ambient-dot-pulse';
        if (this.partnerTabStatusTextEl) this.partnerTabStatusTextEl.textContent = 'Active on Tab';
      } else {
        this.partnerTabStatusDotEl.className = 'w-2 h-2 rounded-full bg-amber-400/80';
        if (this.partnerTabStatusTextEl) this.partnerTabStatusTextEl.textContent = 'Tab Blurred / Away';
      }
    }

    // Deep Focus Visual Dimming / Serene Shield on Partner Desk
    if (this.partnerDeskCardEl) {
      if (this.partnerStatus.state === 'deep_focus') {
        this.partnerDeskCardEl.classList.add('deep-focus-active');
      } else {
        this.partnerDeskCardEl.classList.remove('deep-focus-active');
      }
    }

    // Inform Nudge Manager about partner's focus state
    if (window.nudgeManager) {
      window.nudgeManager.setPartnerDeepFocus(this.partnerStatus.state === 'deep_focus');
    }

    if (window.lucide) window.lucide.createIcons();
  }
}

export const presenceManager = new PresenceManager();
