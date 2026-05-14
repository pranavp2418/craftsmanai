# WebSocket (Socket.IO) Implementation Guide

## Overview

This document describes the **Socket.IO** implementation for real-time, full-duplex communication in the Craftsman backend. The system provides a **single, unified WebSocket connection** per user that handles all real-time features: notifications, live chat, user presence, and more.

> **Stack:** [`python-socketio`](https://python-socketio.readthedocs.io/) (server) + Socket.IO v4+ (client) | Redis adapter for horizontal scaling | JWT authentication

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  FastAPI App                      │
│  ┌────────────────────────────────────────────┐   │
│  │  REST API (api_router)                     │   │
│  │  /api/v2/auth, /api/v2/endpoints/...       │   │
│  └────────────────────────────────────────────┘   │
│                                                   │
│  ┌────────────────────────────────────────────┐   │
│  │  Socket.IO (mounted at /ws/socket.io)      │   │
│  │  ┌────────────────────────────────────┐    │   │
│  │  │  app/core/socket_manager.py  (sio) │    │   │
│  │  │  → Connection lifecycle            │    │   │
│  │  │  → Auth via JWT                    │    │   │
│  │  │  → Redis adapter (optional)        │    │   │
│  │  └────────────────────────────────────┘    │   │
│  │  ┌────────────────────────────────────┐    │   │
│  │  │  app/core/websocket_events.py      │    │   │
│  │  │  → Chat handlers                   │    │   │
│  │  │  → Notification handlers           │    │   │
│  │  │  → Room mgmt                       │    │   │
│  │  │  → Typing indicator                │    │   │
│  │  └────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single Socket.IO server** | One connection per user, all services multiplexed over it |
| **ASGI mount on FastAPI** | `socketio.ASGIApp` wraps our `AsyncServer` and mounts at `/ws/socket.io` |
| **JWT auth on connect** | Token passed in `auth.token`, validated before accepting connection |
| **Room-based routing** | `user:{id}` = personal, `chat_room:{id}` = chat, `notifications` = broadcast |
| **Redis adapter** | Optional; enables multi-instance scaling |

---

## 1. Server Setup

### 1.1 Dependencies

Add to `requirements.txt`:

```
python-socketio==5.11.1
python-engineio==4.8.0
socketio-redis==0.3.0      # only if Redis scaling is needed
```

### 1.2 Configuration (`app/core/config.py`)

```python
# Socket.IO
SOCKETIO_PATH: str = "/ws/socket.io"
SOCKETIO_CORS_ALLOWED_ORIGINS: List[str] = ["*"]
SOCKETIO_REDIS_ADAPTER: bool = False   # toggle for production
```

### 1.3 How the Server Starts

In `app/main.py`:

```python
from app.core.socket_manager import sio
from app.core import websocket_events   # registers all @sio.event handlers

# Create ASGI wrapper
sio_asgi_app = socketio.ASGIApp(
    socketio_server=sio,
    other_app=api_router,         # REST falls through to FastAPI
    socketio_path="ws/socket.io",
)

# Mount on FastAPI
app.mount("/ws/socket.io", sio_asgi_app)
```

> **No** `@app.websocket("/ws")` endpoint is needed. The `ASGIApp` intercepts Socket.IO protocol traffic at the mount path.

---

## 2. Connection Flow

```
Client                          Server
  │                               │
  │  io("https://host", {         │
  │    auth: { token: "jwt..." }  │
  │  })                           │
  │──────────────────────────────>│
  │                               │  _auth_handler() validates JWT
  │                               │  connect() runs:
  │                               │    • save_session(sid, user_info)
  │                               │    • enter_room(sid, "user:{id}")
  │                               │    • enter_room(sid, "notifications")
  │                               │    • emit("user_status", ..., room="user_updates")
  │                               │
  │  ← "authenticated" {          │
  │       socket_id, user_id,     │
  │       email, username         │
  │     }                         │
  │                               │
  │  ← "user_status" {            │
  │       user_id, status:online  │
  │     }                         │  (broadcast to user_updates room)
  │                               │
```

---

## 3. Client Implementation

### 3.1 Install Socket.IO Client

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

### 3.2 Connect with JWT

```javascript
import { io } from "socket.io-client";

const socket = io("https://api.craftsman.ai", {
  path: "/ws/socket.io",            // must match server SOCKETIO_PATH
  auth: {
    token: "YOUR_JWT_ACCESS_TOKEN", // required
  },
  transports: ["websocket"],        // optional: skip polling
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

// --- Built-in lifecycle events ---

socket.on("connect", () => {
  console.log("Socket.IO connected:", socket.id);
});

socket.on("authenticated", (data) => {
  console.log("Authenticated as", data.user_id);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  // reason === "io server disconnect" → reconnect manually
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});
```

### 3.3 TypeScript Typed Example

```typescript
import { io, Socket } from "socket.io-client";

interface ServerToClientEvents {
  authenticated: (data: {
    socket_id: string;
    user_id: string;
    email: string;
    username: string;
    connected_at: string;
  }) => void;
  notification: (data: {
    id?: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    created_at: string;
  }) => void;
  chat_message: (data: {
    id: string;
    room_id: string;
    sender_id: string;
    sender_name: string;
    message: string;
    message_type: string;
    timestamp: string;
    attachments: any[];
  }) => void;
  user_typing: (data: {
    room_id: string;
    user_id: string;
    username: string;
    is_typing: boolean;
  }) => void;
  user_status: (data: {
    user_id: string;
    status: "online" | "offline";
    username?: string;
    last_seen?: string;
  }) => void;
  room_update: (data: {
    room_id: string;
    type: "user_joined" | "user_left" | "room_updated";
    user_id?: string;
    user_name?: string;
    timestamp: string;
  }) => void;
  message_sent: (data: {
    message_id: string;
    room_id: string;
    timestamp: string;
  }) => void;
  room_subscribed: (data: { room: string }) => void;
  room_unsubscribed: (data: { room: string }) => void;
  room_joined: (data: { room_id: string }) => void;
  stats: (data: {
    total_connections: number;
    total_users_online: number;
    total_rooms: number;
  }) => void;
  pong: (data: { timestamp: string }) => void;
  error: (data: { code: string; message: string }) => void;
}

interface ClientToServerEvents {
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
  send_chat_message: (data: {
    room_id: string;
    message: string;
    message_type?: string;
    attachments?: any[];
  }) => void;
  typing_start: (data: { room_id: string }) => void;
  typing_stop: (data: { room_id: string }) => void;
  mark_messages_read: (data: {
    room_id: string;
    message_ids: string[];
  }) => void;
  send_notification: (data: {
    to_user_id?: string;
    broadcast?: boolean;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) => void;
  join_chat_room: (data: { room_id: string }) => void;
  leave_chat_room: (data: { room_id: string }) => void;
  get_stats: (data?: unknown) => void;
  ping: (data?: unknown) => void;
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  "https://api.craftsman.ai",
  {
    path: "/ws/socket.io",
    auth: { token: accessToken },
  }
);
```

---

## 4. Server-to-Client Events (Read)

These events are **emitted by the server**. Clients listen for them:

### 4.1 `authenticated`

Sent once after a successful connection. Confirm the user is logged in.

```javascript
socket.on("authenticated", (data) => {
  const { socket_id, user_id, email, username } = data;
});
```

### 4.2 `notification`

Delivered when a notification is pushed to the user (direct or broadcast).

```javascript
socket.on("notification", (data) => {
  // data = { id?, type, title, message, data?, created_at }
  showToast(data.title, data.message);
});
```

### 4.3 `chat_message`

New chat message in a subscribed room.

```javascript
socket.on("chat_message", (data) => {
  // data = { id, room_id, sender_id, sender_name, message,
  //          message_type, timestamp, attachments }
  appendMessage(data);
});
```

### 4.4 `user_typing`

Sent to a chat room when someone starts/stops typing.

```javascript
socket.on("user_typing", (data) => {
  // data = { room_id, user_id, username, is_typing }
  if (data.is_typing) showTypingIndicator(data.username);
  else hideTypingIndicator(data.username);
});
```

### 4.5 `user_status`

Broadcast to the `user_updates` room when a user comes online or goes offline.

```javascript
socket.on("user_status", (data) => {
  // data = { user_id, status, username?, last_seen? }
  updatePresence(data.user_id, data.status);
});
```

### 4.6 `room_update`

Sent when a user joins or leaves a chat room.

```javascript
socket.on("room_update", (data) => {
  // data = { room_id, type, user_id?, user_name?, timestamp }
  console.log(`${data.user_name} ${data.type}`);
});
```

### 4.7 `message_sent`

Confirmation that a chat message was delivered to the room.

```javascript
socket.on("message_sent", (data) => {
  // data = { message_id, room_id, timestamp }
  markAsDelivered(data.message_id);
});
```

### 4.8 `messages_read`

Acknowledgment after marking messages as read.

```javascript
socket.on("messages_read", (data) => {
  // data = { room_id, message_ids, user_id, timestamp }
});
```

### 4.9 `stats` / `pong`

Response to `get_stats` and `ping` events.

---

## 5. Client-to-Server Events (Write)

These events are **emitted by the client**. The server handles them.

### 5.1 `subscribe`

Join a room manually (e.g., a chat room or admin channel).

```javascript
socket.emit("subscribe", "chat_room:123");
socket.emit("subscribe", "admin");
socket.emit("subscribe", "user_updates");
```

> **Reserved rooms** (cannot be subscribed manually):
> - `user:{id}` — personal notification room
> - `notifications` — general broadcast room

### 5.2 `unsubscribe`

Leave a room. Use `"*"` to leave all non-reserved rooms.

```javascript
socket.emit("unsubscribe", "chat_room:123");
socket.emit("unsubscribe", "*");           // leave all custom rooms
```

### 5.3 `send_chat_message`

Send a message to a chat room.

```javascript
socket.emit("send_chat_message", {
  room_id: "chat_room:123",
  message: "Hello everyone!",
  message_type: "text",       // "text" | "image" | "file" | ...
  attachments: [],            // optional array of {url, type, name}
});
```

### 5.4 `typing_start` / `typing_stop`

Indicate the user is typing in a chat room.

```javascript
socket.emit("typing_start", { room_id: "chat_room:123" });
// ... later ...
socket.emit("typing_stop", { room_id: "chat_room:123" });
```

> **Best practice:** Debounce `typing_start` and auto-send `typing_stop` after 2 seconds of inactivity.

### 5.5 `mark_messages_read`

Mark chat messages as read.

```javascript
socket.emit("mark_messages_read", {
  room_id: "chat_room:123",
  message_ids: ["msg_1", "msg_2"],
});
```

### 5.6 `send_notification`

Send a notification (typically admin-only, but open to any authenticated user for now).

```javascript
// Direct to a user
socket.emit("send_notification", {
  to_user_id: "user_abc",
  type: "message",
  title: "New message",
  message: "You have a new message from John",
  data: { message_id: "msg_456" },
});

// Broadcast to all connected users
socket.emit("send_notification", {
  broadcast: true,
  type: "announcement",
  title: "System update",
  message: "Server maintenance at 2 AM UTC",
});
```

### 5.7 `join_chat_room` / `leave_chat_room`

Explicitly join/leave a chat room with room update broadcasts (preferred over generic `subscribe` for chat UX).

```javascript
socket.emit("join_chat_room", { room_id: "123" });
// → server broadcasts "room_update" {type: "user_joined"} to all members

socket.emit("leave_chat_room", { room_id: "123" });
// → server broadcasts "room_update" {type: "user_left"}
```

### 5.8 `ping` / `get_stats`

Heartbeat and diagnostics.

```javascript
socket.emit("ping");
socket.on("pong", (data) => console.log("Latency OK"));

socket.emit("get_stats");
socket.on("stats", (data) => console.log("Server stats:", data));
```

---

## 6. Room System

### Room Naming Convention

| Room Name | Purpose | Who Can Join | Auto-joined |
|-----------|---------|--------------|-------------|
| `user:{user_id}` | Personal notifications for that user | Authenticated user | ✅ Yes |
| `notifications` | General broadcast to all users | All authenticated users | ✅ Yes |
| `user_updates` | Presence (online/offline) | Users who want presence | ❌ Manual |
| `chat_room:{id}` | Specific chat room | Room members (via `join_chat_room`) | ❌ Manual |
| `admin` | Admin-only channel | Admin users | ❌ Manual |
| `broadcast` | System-wide broadcasts | All users | ❌ Manual |

### Reserved Room Rules

- Rooms prefixed with `user:` or `notifications` **cannot** be subscribed/unsubscribed manually via the `subscribe`/`unsubscribe` events. They are managed automatically by the server.
- Attempting to do so returns an `error` event with code `RESERVED_ROOM`.

---

## 7. Backend Services Integration

### 7.1 Push Notifications from REST Endpoints

Use `send_notification()` from `app.core.socket_manager`:

```python
from app.core.socket_manager import send_notification

# Inside a REST endpoint
await send_notification(
    user_id="user_abc",
    title="Order confirmed",
    message="Your order #123 has been confirmed.",
    notification_type="order",
    data={"order_id": 123},
)
```

### 7.2 Push Notifications from Celery Tasks

```python
# tasks/notifications.py
from app.core.socket_manager import send_notification
import asyncio

@celery.task
def notify_user(user_id: str, title: str, message: str):
    loop = asyncio.get_event_loop()
    loop.run_until_complete(
        send_notification(user_id, title, message)
    )
```

### 7.3 REST Endpoints for Status

The following REST endpoints are available (from `app.api.v2.endpoints.websocket`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/endpoints/ws/status` | Socket.IO server stats |
| GET | `/api/v2/endpoints/user/{user_id}/status` | User online/offline |
| GET | `/api/v2/endpoints/users/online` | List of all online users |
| POST | `/api/v2/endpoints/notify/user/{user_id}?title=...&message=...` | Send notification via REST |

---

## 8. Redis Adapter (Horizontal Scaling)

Enable the Redis adapter to scale across multiple server instances:

```bash
pip install socketio-redis==0.3.0
```

In `.env`:

```ini
SOCKETIO_REDIS_ADAPTER=True
REDIS_URL=redis://redis-host:6379/0
```

When enabled, `socket_manager.py` automatically uses `AsyncRedisManager` so events broadcast across all instances.

---

## 9. Error Handling

### 9.1 Connection Errors

| Error Code | Meaning | Client Action |
|------------|---------|---------------|
| `AUTH_REQUIRED` | No token provided | Provide token and reconnect |
| `INVALID_TOKEN` | Token expired or invalid | Refresh token and reconnect |
| `INVALID_PAYLOAD` | Token missing claims | Check token generation |
| `RESERVED_ROOM` | Cannot subscribe to `user:` or `notifications` rooms | Do not attempt |

### 9.2 Handling in Client

```javascript
socket.on("connect_error", (err) => {
  try {
    const { code, message } = JSON.parse(err.message);
    if (code === "INVALID_TOKEN") {
      // Redirect to login
      window.location.href = "/login";
    }
  } catch {
    console.error("Connection error:", err.message);
  }
});

socket.on("error", (data) => {
  // data = { code, message }
  if (data.code === "RESERVED_ROOM") {
    console.warn(data.message);
  }
});
```

---

## 10. Best Practices

### 10.1 Single Socket Instance

```javascript
// Store in a module-level variable
let socket = null;

export function getSocket() {
  if (!socket || !socket.connected) {
    socket = io(BASE_URL, {
      path: "/ws/socket.io",
      auth: { token: getAccessToken() },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

### 10.2 Debounce Typing Indicators

```javascript
import { debounce } from "lodash";

const socket = getSocket();

const emitTypingStart = debounce(
  (roomId) => socket.emit("typing_start", { room_id: roomId }),
  300
);

let typingTimeout;
function onUserTyping(roomId) {
  emitTypingStart(roomId);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("typing_stop", { room_id: roomId });
  }, 2000);
}
```

### 10.3 Reconnection with Token Refresh

```javascript
socket.on("connect_error", async (err) => {
  if (err.message?.includes("INVALID_TOKEN")) {
    const newToken = await refreshAccessToken();
    socket.auth = { token: newToken };
    socket.connect();
  }
});
```

### 10.4 Clean Up Listeners

```javascript
// In React:
useEffect(() => {
  const s = getSocket();
  s.on("chat_message", handleMsg);
  s.on("notification", handleNotif);

  return () => {
    s.off("chat_message", handleMsg);
    s.off("notification", handleNotif);
  };
}, []);
```

### 10.5 Message Queue for Offline

```javascript
const pendingQueue = [];

socket.on("disconnect", () => {
  // queue outgoing messages
  const originalEmit = socket.emit.bind(socket);
  socket.emit = (event, data) => pendingQueue.push({ event, data });
});

socket.on("reconnect", () => {
  // flush queue
  while (pendingQueue.length) {
    const { event, data } = pendingQueue.shift();
    socket.emit(event, data);
  }
});
```

---

## 11. Testing

### 11.1 Python (pytest)

```python
import socketio

sio = socketio.Client()

@sio.event
def connect():
    print("Connected")

@sio.event
def authenticated(data):
    print(f"Authenticated: {data['user_id']}")

sio.connect(
    "http://localhost:8000",
    socketio_path="ws/socket.io",
    auth={"token": "test_access_token"},
)
sio.sleep(2)
sio.disconnect()
```

### 11.2 JavaScript (Node.js)

```javascript
const { io } = require("socket.io-client");

const socket = io("http://localhost:8000", {
  path: "/ws/socket.io",
  auth: { token: "test_access_token" },
});

socket.on("connect", () => console.log("Connected:", socket.id));
socket.on("authenticated", (d) => console.log("Auth OK:", d));
```

---

## 12. File Reference

| File | Purpose |
|------|---------|
| `app/core/socket_manager.py` | Global `AsyncServer` instance (`sio`), connection lifecycle, public helpers (`emit_to_user`, `send_notification`, etc.) |
| `app/core/websocket_events.py` | All `@sio.event` handlers — chat, notifications, rooms, typing, stats |
| `app/services/websocket_service.py` | Business-logic service wrapping `socket_manager` for REST/Celery integration |
| `app/api/v2/endpoints/websocket.py` | REST endpoints for status, presence, manual notification push |
| `app/schemas/websocket.py` | Pydantic schemas for WebSocket message validation |
| `app/main.py` | Mounts `socketio.ASGIApp` on FastAPI |

---

## 13. Security Considerations

1. **Always use WSS** (WebSocket Secure) in production.
2. **Validate JWT** on every connection — token must be fresh and signed.
3. **Room isolation** — users should only join rooms they are authorized for.
4. **Message limits** — enforce max payload size (e.g., 1 MB) to prevent abuse.
5. **Rate limiting** — consider adding rate limits on `send_chat_message` and `send_notification`.
6. **Sanitize input** — escape HTML in chat messages to prevent XSS.
7. **Audit logging** — log all connection/disconnection events.

---

## Appendix: Event Reference Summary

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | ← | Socket.IO connection established |
| `disconnect` | ← | Socket.IO connection closed |
| `authenticated` | ← | JWT authentication successful |
| `notification` | ← | New notification |
| `chat_message` | ← | New chat message |
| `user_typing` | ← | Typing indicator |
| `user_status` | ← | User online/offline |
| `room_update` | ← | Room membership change |
| `message_sent` | ← | Chat message delivery confirmation |
| `messages_read` | ← | Messages marked as read |
| `room_subscribed` | ← | Successfully subscribed to room |
| `room_unsubscribed` | ← | Successfully unsubscribed from room |
| `room_joined` | ← | Joined a chat room |
| `stats` | ← | Server statistics response |
| `pong` | ← | Heartbeat response |
| `error` | ← | Error notification |
| `subscribe` | → | Client requests to join a room |
| `unsubscribe` | → | Client requests to leave a room |
| `send_chat_message` | → | Client sends a chat message |
| `typing_start` | → | Client started typing |
| `typing_stop` | → | Client stopped typing |
| `mark_messages_read` | → | Client marks messages as read |
| `send_notification` | → | Client sends a notification |
| `join_chat_room` | → | Client joins a chat room with notification |
| `leave_chat_room` | → | Client leaves a chat room with notification |
| `ping` | → | Client heartbeat |
| `get_stats` | → | Client requests server statistics |

---

**Last Updated:** 2024-05-13  
**Version:** 2.0.0 (Socket.IO)