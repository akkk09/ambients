/**
 * Ambients - Real-Time WebSocket Client & Latency Monitor
 * Handles auto-reconnect, message routing, and sub-millisecond ping-pong latency tracking.
 */

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.peerId = this.getOrCreatePeerId();
    this.roomId = null;
    this.handlers = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 8000;
    this.pingInterval = null;
    this.lastPingTimestamp = 0;
    this.latencyMs = 0;
    this.onLatencyUpdate = null;
    this.onConnectionStatusChange = null;
  }

  getOrCreatePeerId() {
    let id = localStorage.getItem('ambients_peer_id');
    if (!id) {
      id = 'peer_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('ambients_peer_id', id);
    }
    return id;
  }

  /**
   * Connect to WebSocket server
   */
  connect(roomId, profile) {
    this.roomId = roomId;
    this.profile = profile;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.onConnectionStatusChange) this.onConnectionStatusChange(true);

        // Immediately send JOIN_ROOM payload
        this.send('JOIN_ROOM', {
          roomId: this.roomId,
          peerId: this.peerId,
          profile: this.profile
        });

        // Start ping-pong heartbeat
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { type, payload } = data;

          if (type === 'PONG') {
            if (payload && payload.clientTimestamp) {
              this.latencyMs = Math.max(1, Math.round(Date.now() - payload.clientTimestamp));
              if (this.onLatencyUpdate) this.onLatencyUpdate(this.latencyMs);
            }
            return;
          }

          // Trigger registered event handlers
          if (this.handlers.has(type)) {
            this.handlers.get(type).forEach(handler => {
              try {
                handler(payload);
              } catch (err) {
                console.error(`[WSClient] Error in handler for '${type}':`, err);
              }
            });
          }
        } catch (err) {
          console.error('[WSClient] Error parsing incoming WS message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        if (this.onConnectionStatusChange) this.onConnectionStatusChange(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WSClient] WebSocket connection error:', err);
      };
    } catch (err) {
      console.error('[WSClient] Failed to establish WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Exponential backoff reconnection
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => {
      if (!this.isConnected && this.roomId) {
        console.log(`[WSClient] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this.connect(this.roomId, this.profile);
      }
    }, delay);
  }

  /**
   * Periodic ping for live latency indicator
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTimestamp = Date.now();
        this.send('PING', { clientTimestamp: this.lastPingTimestamp });
      }
    }, 4000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Subscribe to incoming message types
   */
  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    if (!this.handlers.has(type)) return;
    const list = this.handlers.get(type).filter(h => h !== handler);
    this.handlers.set(type, list);
  }

  /**
   * Send JSON message to server
   */
  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }
}

export const wsClient = new WebSocketClient();
