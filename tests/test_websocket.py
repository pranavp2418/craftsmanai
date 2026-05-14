"""
WebSocket Test Suite - Comprehensive tests for Socket.IO functionality

Tests cover:
- Connection/authentication with JWT tokens
- Room management (subscribe/unsubscribe/join/leave)
- Chat functionality (send message, typing indicators, mark read)
- Notifications (direct and broadcast)
- Stats and health endpoints
- REST endpoints for websocket status
"""

import pytest
import asyncio
from typing import Generator, Dict, Any
from unittest.mock import Mock, AsyncMock, patch
from app.core.jwt import create_access_token
from app.core.socket_manager import sio, get_online_users, emit_to_user, send_notification
from app.schemas.websocket import (
    ChatMessageData,
    SendChatMessageRequest,
    SendNotificationRequest,
    TypingIndicatorRequest,
    MarkMessagesReadRequest,
)
from app.models.user import User


class TestWebSocketConnection:
    """Test WebSocket connection and authentication"""

    @pytest.fixture
    def valid_token(self, create_verified_user) -> str:
        """Create a valid JWT access token for testing"""
        user = create_verified_user()
        token, _, _ = create_access_token(user.id)
        return token

    @pytest.fixture
    def invalid_token(self) -> str:
        """Create an invalid JWT token"""
        return "invalid_token_12345"

    @pytest.mark.asyncio
    async def test_connect_with_valid_token(self, valid_token: str):
        """Test successful connection with valid JWT token"""
        # Mock the session save and emit operations
        with patch.object(sio, 'save_session', new_callable=AsyncMock) as mock_save_session, \
             patch.object(sio, 'enter_room', new_callable=AsyncMock) as mock_enter_room, \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            # Simulate connection handler
            from app.core.socket_manager import connect, _authenticate
            
            sid = "test_sid_123"
            environ = {"QUERY_STRING": ""}
            auth = {"token": valid_token}
            
            result = await connect(sid, environ, auth)
            
            assert result is True
            mock_save_session.assert_called_once()
            assert mock_enter_room.call_count >= 2  # user:{id} and notifications rooms
            mock_emit.assert_called()

    @pytest.mark.asyncio
    async def test_connect_with_invalid_token(self, invalid_token: str):
        """Test connection rejection with invalid JWT token"""
        from app.core.socket_manager import connect
        
        sid = "test_sid_123"
        environ = {"QUERY_STRING": ""}
        auth = {"token": invalid_token}
        
        result = await connect(sid, environ, auth)
        
        assert result is False

    @pytest.mark.asyncio
    async def test_connect_without_token(self):
        """Test connection rejection when no token is provided"""
        from app.core.socket_manager import connect
        
        sid = "test_sid_123"
        environ = {"QUERY_STRING": ""}
        auth = {}
        
        result = await connect(sid, environ, auth)
        
        assert result is False

    @pytest.mark.asyncio
    async def test_connect_with_token_from_query_string(self, valid_token: str):
        """Test connection with token from query string (Postman support)"""
        with patch.object(sio, 'save_session', new_callable=AsyncMock), \
             patch.object(sio, 'enter_room', new_callable=AsyncMock), \
             patch.object(sio, 'emit', new_callable=AsyncMock):
            
            from app.core.socket_manager import connect
            
            sid = "test_sid_123"
            environ = {"QUERY_STRING": f"token={valid_token}"}
            auth = {}
            
            result = await connect(sid, environ, auth)
            
            assert result is True

    @pytest.mark.asyncio
    async def test_disconnect_broadcasts_user_status(self, valid_token: str):
        """Test that disconnect broadcasts user offline status"""
        with patch.object(sio, 'get_session', new_callable=AsyncMock) as mock_get_session, \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            from app.core.socket_manager import disconnect
            
            sid = "test_sid_123"
            mock_get_session.return_value = {
                "user_id": "user_123",
                "username": "testuser",
                "email": "test@example.com"
            }
            
            await disconnect(sid)
            
            mock_emit.assert_called_once()
            call_args = mock_emit.call_args
            assert call_args[0][0] == "user_status"
            assert call_args[1]["room"] == "user_updates"
            assert call_args[0][1]["status"] == "offline"


class TestRoomManagement:
    """Test room subscription and management"""

    @pytest.fixture
    def mock_session(self):
        """Mock user session"""
        return {
            "user_id": "user_123",
            "username": "testuser",
            "email": "test@example.com"
        }

    @pytest.mark.asyncio
    async def test_subscribe_to_custom_room(self, mock_session: Dict[str, Any]):
        """Test subscribing to a custom room"""
        from app.core.websocket_events import subscribe
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'enter_room', new_callable=AsyncMock) as mock_enter_room, \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            room = "chat_room:456"
            
            result = await subscribe(sid, room)
            
            assert result["success"] is True
            mock_enter_room.assert_called_once_with(sid, room)
            mock_emit.assert_called_once_with("room_subscribed", {"room": room}, to=sid)

    @pytest.mark.asyncio
    async def test_subscribe_to_reserved_room_fails(self, mock_session: Dict[str, Any]):
        """Test that subscribing to reserved rooms fails"""
        from app.core.websocket_events import subscribe
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            reserved_rooms = ["user:123", "notifications", "broadcast", "admin"]
            
            for room in reserved_rooms:
                result = await subscribe(sid, room)
                assert result["success"] is False
                assert "Reserved room" in result["error"]
            
            mock_emit.assert_called()

    @pytest.mark.asyncio
    async def test_unsubscribe_from_custom_room(self, mock_session: Dict[str, Any]):
        """Test unsubscribing from a custom room"""
        from app.core.websocket_events import unsubscribe
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'leave_room', new_callable=AsyncMock) as mock_leave_room, \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            room = "chat_room:456"
            
            result = await unsubscribe(sid, room)
            
            assert result["success"] is True
            mock_leave_room.assert_called_once_with(sid, room)
            mock_emit.assert_called_once_with("room_unsubscribed", {"room": room}, to=sid)

    @pytest.mark.asyncio
    async def test_unsubscribe_from_reserved_room_fails(self, mock_session: Dict[str, Any]):
        """Test that unsubscribing from reserved rooms fails"""
        from app.core.websocket_events import unsubscribe
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            reserved_rooms = ["user:123", "notifications"]
            
            for room in reserved_rooms:
                result = await unsubscribe(sid, room)
                assert result["success"] is False
                assert "Reserved room" in result["error"]
            
            mock_emit.assert_called()

    @pytest.mark.asyncio
    async def test_join_chat_room(self, mock_session: Dict[str, Any]):
        """Test joining a chat room with notification"""
        from app.core.websocket_events import join_chat_room
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'enter_room', new_callable=AsyncMock) as mock_enter_room, \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {"room_id": "123"}
            
            result = await join_chat_room(sid, data)
            
            assert result["success"] is True
            mock_enter_room.assert_called_once_with(sid, "chat_room:123")
            assert mock_emit.call_count >= 2  # room_update and room_joined

    @pytest.mark.asyncio
    async def test_join_chat_room_without_room_id(self, mock_session: Dict[str, Any]):
        """Test joining a chat room without room_id fails"""
        from app.core.websocket_events import join_chat_room
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {}
            
            result = await join_chat_room(sid, data)
            
            assert result["success"] is False
            assert "room_id required" in result["error"]
            mock_emit.assert_called_once()

    @pytest.mark.asyncio
    async def test_leave_chat_room(self, mock_session: Dict[str, Any]):
        """Test leaving a chat room with notification"""
        from app.core.websocket_events import leave_chat_room
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'leave_room', new_callable=AsyncMock) as mock_leave_room, \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {"room_id": "123"}
            
            result = await leave_chat_room(sid, data)
            
            assert result["success"] is True
            mock_leave_room.assert_called_once_with(sid, "chat_room:123")
            mock_emit.assert_called_once()


class TestChatFunctionality:
    """Test chat message functionality"""

    @pytest.fixture
    def mock_session(self):
        """Mock user session"""
        return {
            "user_id": "user_123",
            "username": "testuser",
            "email": "test@example.com"
        }

    @pytest.mark.asyncio
    async def test_send_chat_message(self, mock_session: Dict[str, Any]):
        """Test sending a chat message to a room"""
        from app.core.websocket_events import send_chat_message
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {
                "room_id": "chat_room:456",
                "message": "Hello, world!",
                "message_type": "text",
                "attachments": []
            }
            
            result = await send_chat_message(sid, data)
            
            assert result["success"] is True
            assert "message_id" in result
            assert mock_emit.call_count >= 2  # chat_message and message_sent

    @pytest.mark.asyncio
    async def test_send_chat_message_without_session(self):
        """Test sending a chat message without session fails"""
        from app.core.websocket_events import send_chat_message
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=None), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {
                "room_id": "chat_room:456",
                "message": "Hello, world!",
            }
            
            result = await send_chat_message(sid, data)
            
            assert result["success"] is False
            mock_emit.assert_called_once_with("error", {"code": "SESSION_EXPIRED", "message": "Session not found – please reconnect"}, to=sid)

    @pytest.mark.asyncio
    async def test_typing_start(self, mock_session: Dict[str, Any]):
        """Test typing start indicator"""
        from app.core.websocket_events import typing_start
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {"room_id": "chat_room:456"}
            
            result = await typing_start(sid, data)
            
            assert result["success"] is True
            mock_emit.assert_called_once()
            call_args = mock_emit.call_args
            assert call_args[0][0] == "user_typing"
            assert call_args[0][1]["is_typing"] is True
            assert call_args[1]["skip_sid"] == sid

    @pytest.mark.asyncio
    async def test_typing_stop(self, mock_session: Dict[str, Any]):
        """Test typing stop indicator"""
        from app.core.websocket_events import typing_stop
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {"room_id": "chat_room:456"}
            
            result = await typing_stop(sid, data)
            
            assert result["success"] is True
            mock_emit.assert_called_once()
            call_args = mock_emit.call_args
            assert call_args[0][0] == "user_typing"
            assert call_args[0][1]["is_typing"] is False
            assert call_args[1]["skip_sid"] == sid

    @pytest.mark.asyncio
    async def test_mark_messages_read(self, mock_session: Dict[str, Any]):
        """Test marking messages as read"""
        from app.core.websocket_events import mark_messages_read
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {
                "room_id": "chat_room:456",
                "message_ids": ["msg_1", "msg_2", "msg_3"]
            }
            
            result = await mark_messages_read(sid, data)
            
            assert result["success"] is True
            assert result["message_ids"] == ["msg_1", "msg_2", "msg_3"]
            mock_emit.assert_called_once()
            call_args = mock_emit.call_args
            assert call_args[0][0] == "messages_read"


class TestNotifications:
    """Test notification functionality"""

    @pytest.fixture
    def mock_session(self):
        """Mock user session"""
        return {
            "user_id": "user_123",
            "username": "testuser",
            "email": "test@example.com"
        }

    @pytest.mark.asyncio
    async def test_send_direct_notification(self, mock_session: Dict[str, Any]):
        """Test sending a direct notification to a specific user"""
        from app.core.websocket_events import send_notification
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {
                "to_user_id": "user_456",
                "broadcast": False,
                "type": "message",
                "title": "New Message",
                "message": "You have a new message",
                "data": {"message_id": "msg_123"}
            }
            
            result = await send_notification(sid, data)
            
            assert result["success"] is True
            assert mock_emit.call_count >= 2  # notification and notification_sent

    @pytest.mark.asyncio
    async def test_send_broadcast_notification(self, mock_session: Dict[str, Any]):
        """Test broadcasting a notification to all users"""
        from app.core.websocket_events import send_notification
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            data = {
                "broadcast": True,
                "type": "announcement",
                "title": "System Update",
                "message": "Server maintenance scheduled"
            }
            
            result = await send_notification(sid, data)
            
            assert result["success"] is True
            mock_emit.assert_called()
            # Check that broadcast was sent to notifications room
            call_args = mock_emit.call_args_list[0]
            assert call_args[1]["room"] == "notifications"

    @pytest.mark.asyncio
    async def test_send_notification_via_helper(self):
        """Test sending notification via socket_manager helper"""
        with patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            user_id = "user_123"
            title = "Test Notification"
            message = "This is a test notification"
            notification_type = "test"
            
            await send_notification(user_id, title, message, notification_type)
            
            mock_emit.assert_called_once()
            call_args = mock_emit.call_args
            assert call_args[0][0] == "notification"
            assert call_args[1]["room"] == f"user:{user_id}"


class TestStatsAndHealth:
    """Test stats and health endpoints"""

    @pytest.fixture
    def mock_session(self):
        """Mock user session"""
        return {
            "user_id": "user_123",
            "username": "testuser",
            "email": "test@example.com"
        }

    @pytest.mark.asyncio
    async def test_get_stats(self, mock_session: Dict[str, Any]):
        """Test getting server statistics"""
        from app.core.websocket_events import get_stats
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            
            result = await get_stats(sid)
            
            assert result["success"] is True
            assert "data" in result
            assert "total_connections" in result["data"]
            assert "total_users_online" in result["data"]
            assert "total_rooms" in result["data"]
            mock_emit.assert_called_once()

    @pytest.mark.asyncio
    async def test_ping_pong(self, mock_session: Dict[str, Any]):
        """Test ping/pong heartbeat"""
        from app.core.websocket_events import ping
        
        with patch.object(sio, 'get_session', new_callable=AsyncMock, return_value=mock_session), \
             patch.object(sio, 'emit', new_callable=AsyncMock) as mock_emit:
            
            sid = "test_sid_123"
            
            result = await ping(sid)
            
            assert result["success"] is True
            mock_emit.assert_called_once()
            call_args = mock_emit.call_args
            assert call_args[0][0] == "pong"
            assert "timestamp" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_get_online_users(self):
        """Test getting list of online users"""
        with patch.object(sio, 'manager') as mock_manager:
            mock_manager.rooms = {
                "/": {
                    "user:user1": {"sid1"},
                    "user:user2": {"sid2"},
                    "chat_room:123": {"sid3"},
                    "notifications": {"sid1", "sid2"}
                }
            }
            
            users = await get_online_users()
            
            assert isinstance(users, list)
            assert "user1" in users
            assert "user2" in users


class TestWebSocketService:
    """Test WebSocket service layer"""

    @pytest.mark.asyncio
    async def test_broadcast_notification_service(self):
        """Test broadcasting notification via service"""
        from app.services.websocket_service import websocket_service
        from app.schemas.websocket import NotificationData
        
        with patch('app.services.websocket_service.emit_broadcast', new_callable=AsyncMock) as mock_emit:
            
            notification_data = NotificationData(
                type="announcement",
                title="Test",
                message="Test message"
            )
            
            result = await websocket_service.broadcast_notification(
                notification_data,
                broadcast=True
            )
            
            assert result["sent_to"] == ["*broadcast*"]
            mock_emit.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_notification_to_user_service(self):
        """Test sending notification to specific user via service"""
        from app.services.websocket_service import websocket_service
        from app.schemas.websocket import NotificationData
        
        with patch('app.services.websocket_service._send_notification', new_callable=AsyncMock) as mock_send:
            
            notification_data = NotificationData(
                type="message",
                title="Test",
                message="Test message"
            )
            
            result = await websocket_service.broadcast_notification(
                notification_data,
                target_user_id="user_123"
            )
            
            assert result["sent_to"] == ["user_123"]
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_status_online(self):
        """Test getting user status when online"""
        from app.services.websocket_service import websocket_service
        
        with patch('app.services.websocket_service.get_online_users', new_callable=AsyncMock, return_value=["user_123", "user_456"]):
            
            status = await websocket_service.get_user_status("user_123")
            
            assert status.user_id == "user_123"
            assert status.status == "online"

    @pytest.mark.asyncio
    async def test_get_user_status_offline(self):
        """Test getting user status when offline"""
        from app.services.websocket_service import websocket_service
        
        with patch('app.services.websocket_service.get_online_users', new_callable=AsyncMock, return_value=["user_456"]):
            
            status = await websocket_service.get_user_status("user_123")
            
            assert status.user_id == "user_123"
            assert status.status == "offline"

    @pytest.mark.asyncio
    async def test_send_chat_message_service(self):
        """Test sending chat message via service"""
        from app.services.websocket_service import websocket_service
        from app.schemas.websocket import ChatMessageData
        
        with patch('app.services.websocket_service.emit_to_room', new_callable=AsyncMock) as mock_emit:
            
            message_data = ChatMessageData(
                room_id="chat_room:123",
                message="Hello",
                message_type="text"
            )
            
            result = await websocket_service.send_chat_message(
                room_id="chat_room:123",
                message_data=message_data,
                sender_id="user_123",
                sender_name="testuser"
            )
            
            assert result["sent_to_room"] == "chat_room:123"
            mock_emit.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_socket_stats_service(self):
        """Test getting socket stats via service"""
        from app.services.websocket_service import websocket_service
        
        with patch.object(sio, 'manager') as mock_manager:
            mock_manager.rooms = {
                "/": {
                    "user:user1": {"sid1"},
                    "user:user2": {"sid2"},
                    "chat_room:123": {"sid3"}
                }
            }
            
            stats = await websocket_service.get_socket_stats()
            
            assert "total_connections" in stats
            assert "total_users_online" in stats
            assert "total_rooms" in stats


class TestWebSocketRESTEndpoints:
    """Test REST endpoints for WebSocket functionality"""

    @pytest.mark.asyncio
    async def test_websocket_status_endpoint(self, client):
        """Test /ws/status endpoint"""
        response = client.get("/api/v2/endpoints/ws/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert data["websocket_enabled"] is True
        assert "stats" in data

    @pytest.mark.asyncio
    async def test_get_user_status_endpoint_online(self, client):
        """Test /user/{user_id}/status endpoint for online user"""
        with patch('app.api.v2.endpoints.websocket.get_online_users', new_callable=AsyncMock, return_value=["user_123"]):
            response = client.get("/api/v2/endpoints/user/user_123/status")
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["user_id"] == "user_123"
            assert data["data"]["status"] == "online"

    @pytest.mark.asyncio
    async def test_get_user_status_endpoint_offline(self, client):
        """Test /user/{user_id}/status endpoint for offline user"""
        with patch('app.api.v2.endpoints.websocket.get_online_users', new_callable=AsyncMock, return_value=["user_456"]):
            response = client.get("/api/v2/endpoints/user/user_123/status")
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["user_id"] == "user_123"
            assert data["data"]["status"] == "offline"

    @pytest.mark.asyncio
    async def test_get_online_users_endpoint(self, client):
        """Test /users/online endpoint"""
        with patch('app.api.v2.endpoints.websocket.get_online_users', new_callable=AsyncMock, return_value=["user_123", "user_456"]):
            response = client.get("/api/v2/endpoints/users/online")
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "user_123" in data["data"]["online_users"]
            assert "user_456" in data["data"]["online_users"]
            assert data["data"]["count"] == 2

    @pytest.mark.asyncio
    async def test_notify_user_endpoint(self, client):
        """Test /notify/user/{user_id} endpoint"""
        with patch('app.api.v2.endpoints.websocket.send_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v2/endpoints/notify/user/user_123",
                params={
                    "title": "Test Notification",
                    "message": "This is a test",
                    "notification_type": "test"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "user_123" in data["message"]


class TestWebSocketSchemas:
    """Test WebSocket schema validation"""

    def test_send_chat_message_request_schema(self):
        """Test SendChatMessageRequest schema validation"""
        data = {
            "room_id": "chat_room:123",
            "message": "Hello, world!",
            "message_type": "text",
            "attachments": []
        }
        
        request = SendChatMessageRequest(**data)
        
        assert request.room_id == "chat_room:123"
        assert request.message == "Hello, world!"
        assert request.message_type == "text"
        assert request.attachments == []

    def test_send_notification_request_schema(self):
        """Test SendNotificationRequest schema validation"""
        data = {
            "to_user_id": "user_123",
            "broadcast": False,
            "type": "message",
            "title": "New Message",
            "message": "You have a new message",
            "data": {"message_id": "msg_123"}
        }
        
        request = SendNotificationRequest(**data)
        
        assert request.to_user_id == "user_123"
        assert request.broadcast is False
        assert request.type == "message"
        assert request.title == "New Message"

    def test_typing_indicator_request_schema(self):
        """Test TypingIndicatorRequest schema validation"""
        data = {"room_id": "chat_room:123"}
        
        request = TypingIndicatorRequest(**data)
        
        assert request.room_id == "chat_room:123"

    def test_mark_messages_read_request_schema(self):
        """Test MarkMessagesReadRequest schema validation"""
        data = {
            "room_id": "chat_room:123",
            "message_ids": ["msg_1", "msg_2", "msg_3"]
        }
        
        request = MarkMessagesReadRequest(**data)
        
        assert request.room_id == "chat_room:123"
        assert request.message_ids == ["msg_1", "msg_2", "msg_3"]

    def test_chat_message_data_schema(self):
        """Test ChatMessageData schema validation"""
        data = {
            "id": "msg_123",
            "room_id": "chat_room:123",
            "sender_id": "user_123",
            "sender_name": "testuser",
            "message": "Hello, world!",
            "message_type": "text",
            "timestamp": "2024-01-01T00:00:00",
            "attachments": []
        }
        
        message = ChatMessageData(**data)
        
        assert message.id == "msg_123"
        assert message.room_id == "chat_room:123"
        assert message.sender_id == "user_123"
        assert message.message == "Hello, world!"
