from fastapi import APIRouter, UploadFile, File, HTTPException, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import logging
import json
from app.services.openai_service import openai_service

logger = logging.getLogger(__name__)

router = APIRouter()

class TranscriptionResponse(BaseModel):
    text: str

@router.post("/speech-to-text", response_model=TranscriptionResponse, status_code=status.HTTP_200_OK)
async def transcribe_audio(
    file: UploadFile = File(...)
):
    """
    Transcribe an audio file to text using OpenAI's Whisper model.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Check if the file is an audio file by extension
    allowed_extensions = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}
    file_ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Allowed formats: {', '.join(allowed_extensions)}"
        )
        
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")
            
        transcribed_text = openai_service.transcribe_audio(
            file_content=content,
            filename=file.filename
        )
        
        return TranscriptionResponse(text=transcribed_text)
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transcribe audio: {str(e)}"
        )

@router.websocket("/ws/speech-to-text")
async def websocket_speech_to_text(websocket: WebSocket):
    """
    WebSocket endpoint for speech-to-text.
    Clients can stream binary audio chunks.
    When the client sends a JSON message {"action": "stop"}, the accumulated audio
    is sent to OpenAI's Whisper API and the transcription is returned.
    """
    await websocket.accept()
    
    # Store incoming audio chunks in a byte array
    audio_buffer = bytearray()
    
    try:
        while True:
            # Receive message from the WebSocket
            # This can be either text (JSON commands) or bytes (audio data)
            message = await websocket.receive()
            
            if "bytes" in message:
                # Append binary audio chunk to our buffer
                audio_buffer.extend(message["bytes"])
                
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                    if data.get("action") == "stop":
                        if not audio_buffer:
                            await websocket.send_json({"error": "No audio data received"})
                            break
                            
                        # Perform transcription when the client signals to stop
                        logger.info(f"Processing {len(audio_buffer)} bytes of audio data")
                        
                        try:
                            # We send it as a generic webm file which is standard for web recording
                            transcribed_text = openai_service.transcribe_audio(
                                file_content=bytes(audio_buffer),
                                filename="audio.webm"
                            )
                            
                            # Send the result back to the client
                            await websocket.send_json({
                                "status": "success", 
                                "text": transcribed_text
                            })
                            
                        except Exception as e:
                            logger.error(f"Whisper API error: {str(e)}")
                            await websocket.send_json({
                                "status": "error", 
                                "message": f"Transcription failed: {str(e)}"
                            })
                            
                        # Clear buffer for next recording if they want to speak again
                        audio_buffer.clear()
                        
                except json.JSONDecodeError:
                    await websocket.send_json({"error": "Invalid text message format"})
                    
    except WebSocketDisconnect:
        logger.info("Client disconnected from speech-to-text websocket")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close()
        except:
            pass
