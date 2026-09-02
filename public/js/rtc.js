/**
 * Ambients - WebRTC Audio Manager
 * Provides peer-to-peer audio streaming over Ably signaling.
 */

import { wsClient } from './ws-client.js';
import { nudgeManager } from './nudges.js';

export class RTCManager {
  constructor() {
    this.localStream = null;
    this.peerConnection = null;
    this.isMuted = false;
    this.isInVoice = false;

    // UI
    this.joinBtn = null;
    this.remoteAudio = new Audio();
    this.remoteAudio.autoplay = true;

    this.initSignaling();
  }

  mount(elements) {
    this.joinBtn = elements.joinBtn;
    if (this.joinBtn) {
      this.joinBtn.addEventListener('click', () => this.toggleVoice());
    }
  }

  async toggleVoice() {
    if (this.isInVoice) {
      this.leaveVoice();
    } else {
      await this.joinVoice();
    }
  }

  async joinVoice() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.isInVoice = true;
      this.updateUI();
      
      nudgeManager.showToast('🎤 Joined voice channel', 'info', 1500);

      // Tell partner we joined and want to initiate connection
      wsClient.send('WEBRTC_SIGNAL', { type: 'join' });
      this.createPeerConnection();
    } catch (err) {
      console.error('[WebRTC] Failed to get microphone:', err);
      nudgeManager.showToast('Failed to access microphone', 'warning');
    }
  }

  leaveVoice() {
    this.isInVoice = false;
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteAudio.srcObject = null;
    this.updateUI();
    nudgeManager.showToast('🔇 Left voice channel', 'info', 1500);
    wsClient.send('WEBRTC_SIGNAL', { type: 'leave' });
  }

  createPeerConnection() {
    if (this.peerConnection) return;

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send('WEBRTC_SIGNAL', {
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteAudio.srcObject = event.streams[0];
    };
  }

  initSignaling() {
    wsClient.on('WEBRTC_SIGNAL', async (data) => {
      if (!this.isInVoice && data.type !== 'join') return;

      if (data.type === 'join' && !this.isInVoice) {
        nudgeManager.showToast('Partner joined voice channel', 'info', 2000);
        return;
      }

      if (data.type === 'join' && this.isInVoice) {
        // They joined, let's create offer
        this.createPeerConnection();
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        wsClient.send('WEBRTC_SIGNAL', { type: 'offer', offer });
      } else if (data.type === 'offer') {
        this.createPeerConnection();
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        wsClient.send('WEBRTC_SIGNAL', { type: 'answer', answer });
      } else if (data.type === 'answer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.type === 'candidate') {
        if (this.peerConnection) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } else if (data.type === 'leave') {
        nudgeManager.showToast('Partner left voice channel', 'info', 2000);
        if (this.peerConnection) {
          this.peerConnection.close();
          this.peerConnection = null;
        }
        this.remoteAudio.srcObject = null;
        if (this.isInVoice) {
          this.createPeerConnection(); // Recreate empty ready for next join
        }
      }
    });
  }

  updateUI() {
    if (!this.joinBtn) return;
    const icon = this.joinBtn.querySelector('i');
    if (this.isInVoice) {
      this.joinBtn.classList.add('bg-emerald-500/20', 'border-emerald-500/40', 'text-emerald-300');
      this.joinBtn.classList.remove('bg-white/5', 'border-white/10', 'text-slate-300');
      if (icon) icon.setAttribute('data-lucide', 'mic');
    } else {
      this.joinBtn.classList.remove('bg-emerald-500/20', 'border-emerald-500/40', 'text-emerald-300');
      this.joinBtn.classList.add('bg-white/5', 'border-white/10', 'text-slate-300');
      if (icon) icon.setAttribute('data-lucide', 'mic-off');
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

export const rtcManager = new RTCManager();
window.rtcManager = rtcManager;
