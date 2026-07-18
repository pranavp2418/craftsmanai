import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/src/utils/auth';

type Handler = (...args: any[]) => void;

const isBrowser = (): boolean => typeof window !== 'undefined';

class SocketManager {
  private handlers: Map<string, Set<Handler>> = new Map();
  private socket: Socket | null = null;
  private connecting = false;
  private connected = false;
  private lastToken: string | null = null;

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((h) => h(...args));
  }

  private ensureSocket(): Socket | null {
    if (!isBrowser()) return null;
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!baseUrl) {
      setTimeout(() => this.emit('close', 'missing_base_url'), 0);
      return null;
    }

    const token = getAccessToken();

    if (this.socket) {
      if (token && token !== this.lastToken) {
        this.socket.auth = { token };
        this.lastToken = token;
      }
      return this.socket;
    }

    this.lastToken = token;
    this.socket = io(baseUrl, {
      path: '/socket.io',
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.emit('open');
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.emit('close', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.connected = false;
      this.emit('close', error);
    });

    this.socket.on('notification', (payload) => this.emit('notification', payload));
    this.socket.on('message', (payload) => this.emit('message', payload));
    this.socket.on('authenticated', (payload) => this.emit('authenticated', payload));

    return this.socket;
  }

  connect() {
    const socket = this.ensureSocket();
    if (!socket || this.connected || this.connecting) return;

    this.connecting = true;
    socket.connect();
    socket.once('connect', () => {
      this.connecting = false;
    });
    socket.once('connect_error', () => {
      this.connecting = false;
    });
  }

  disconnect() {
    if (!this.socket) return;

    this.connecting = false;
    this.connected = false;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.lastToken = null;
  }
}

const socketManager = new SocketManager();

export default socketManager;
