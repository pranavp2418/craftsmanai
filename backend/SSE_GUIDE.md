# Server-Sent Events (SSE) Guide

## Overview

This backend now exposes a lightweight **Server-Sent Events (SSE)** layer that
complements the existing Socket.IO integration.  SSE provides a unidirectional
stream from server to client, making it ideal for background jobs (e.g. image
generation) or long-running tasks where updates must be pushed to the
frontend without requiring the client to poll.

Key characteristics:

| Feature | SSE | Socket.IO |
|---------|-----|-----------|
| Direction | Server → Client (unidirectional) | Bidirectional |
| Transport | Plain HTTP (EventSource) | WebSocket (with fallback) |
| Best for | Progressive updates, logs, statuses | Chats, presence, interactive UX |
| Implementation | `EventSource` browser API | Socket.IO client |

SSE is simpler to consume on the frontend (native browser `EventSource`) and is
firewall-friendly because it rides over HTTP.  It is not a replacement for
Socket.IO but a complementary option where a streaming feed suffices.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     FastAPI App                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ REST API (api_router)                         │  │
│  │  ├─ /api/v2/auth/...                          │  │
│  │  ├─ /api/v2/endpoints/...                     │  │
│  │  └─ /api/v2/endpoints/sse/...   ← NEW         │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ SSE Manager                                   │  │
│  │  ├─ app/core/sse_manager.py                   │  │
│  │  │   • Manages async queues per channel       │  │
│  │  │   • Formats SSE payloads                   │  │
│  │  └─ app/services/sse_service.py               │  │
│  │      • High-level publish facade              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Files Introduced

| File | Purpose |
|------|---------|
| `app/core/sse_manager.py` | Async pub/sub manager producing SSE-formatted strings |
| `app/services/sse_service.py` | Facade used by REST endpoints, Celery tasks, etc. |
| `app/schemas/sse.py` | Pydantic schemas for publish requests and metadata |
| `app/api/v2/endpoints/sse.py` | REST API exposing stream & publish endpoints |
| `SSE_GUIDE.md` | This document |

FastAPI routes are wired under `/api/v2/endpoints/sse` via
`app/api/v2/router.py`.

---

## Configuration

`app/core/config.py` exposes `SSE_HEARTBEAT_INTERVAL` (default **25 seconds**)
which controls the keep-alive ping cadence.  Override via `.env`:

```ini
SSE_HEARTBEAT_INTERVAL=15.0
```

---

## REST API Endpoints

All endpoints require the caller to be an authenticated **verified user**.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v2/endpoints/sse/stream/{channel}` | Open an SSE stream for `channel` |
| `POST` | `/api/v2/endpoints/sse/publish` | Publish an event to `channel` |

### 1. Stream Endpoint

```http
GET /api/v2/endpoints/sse/stream/job:123
Authorization: Bearer <ACCESS_TOKEN>
Accept: text/event-stream
```

Response:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
X-SSE-Channel: job:123
X-SSE-Heartbeat: 25.0

data: {"status":"pending"}

: keep-alive

data: {"status":"completed","url":"https://..."}

```

The body is a continuous stream.  Heartbeats are sent as `: keep-alive` comments
when no events occur within the heartbeat window.

### 2. Publish Endpoint

```http
POST /api/v2/endpoints/sse/publish
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "channel": "job:123",
  "event": "job_progress",
  "data": { "percent": 42 },
  "event_id": "job-123-0042"
}
```

Response:

```json
{
  "success": true,
  "delivered_to": 1
}
```

`delivered_to` reports how many active subscribers were present when the event
was enqueued.

---

## Usage Examples

### Backend (Celery Task)

```python
from app.services.sse_service import sse_service


async def publish_job_update(job_id: str, status: str, **payload):
    channel = f"job:{job_id}"
    await sse_service.publish(
        channel,
        event="job_status",
        data={"status": status, **payload},
    )
```

If you're inside synchronous code (e.g., a Celery worker), ensure you run the
coroutine in the event loop (`asyncio.run` or the worker's loop).

### Frontend (Browser)

```javascript
function openJobStream(jobId, accessToken) {
  const channel = `job:${jobId}`;
  const url = new URL(`/api/v2/endpoints/sse/stream/${encodeURIComponent(channel)}`, API_BASE_URL);

  const source = new EventSource(url, {
    withCredentials: false,
  });

  source.onopen = () => console.log("SSE connected", channel);
  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("job update", data);
  };

  source.addEventListener("job_status", (event) => {
    const data = JSON.parse(event.data);
    updateProgress(data);
  });

  source.onerror = (error) => {
    console.error("SSE error", error);
    source.close();
  };

  return source;
}
```

> **Authentication:** Since `EventSource` cannot set custom headers directly,
> proxy the request through your frontend or use a session cookie.  An
> alternative is to append a short-lived token in the query string.

---

## Best Practices

1. **Channel Naming:** Follow a consistent scheme (e.g., `job:{id}`,
   `user:{id}:updates`).
2. **Short-Lived Tokens:** If embedding tokens in the query string, mint
   purpose-specific tokens that expire quickly.
3. **Backpressure:** The internal queues are unbounded to avoid blocking; ensure
   publishers do not flood channels faster than consumers can process.
4. **Reconnect Handling:** Browsers auto-reconnect.  Use the `id` field to allow
   clients to resume missed messages.
5. **Heartbeats:** Tune `SSE_HEARTBEAT_INTERVAL` if proxies terminate idle
   connections prematurely.

---

## Troubleshooting

| Symptom | Possible Cause | Fix |
|---------|----------------|-----|
| Stream closes immediately | Missing/invalid auth | Ensure user is verified & token valid |
| Proxy buffers events | Reverse proxy buffering enabled | Set `X-Accel-Buffering: no` (already configured) |
| No events received | Wrong channel name | Confirm publisher and subscriber use identical channel |
| High latency | Heartbeat interval too large | Lower `SSE_HEARTBEAT_INTERVAL` |

---

## Future Enhancements

* Persist events for replay on reconnect
* Multi-worker broadcast via Redis pub/sub
* Admin dashboard summarising active SSE channels

---

**Last Updated:** 2026-05-14  
**Maintainer:** Craftmen Backend Team
