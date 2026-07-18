'use client';

import { useEffect, useRef, useState } from 'react';

interface CameraCaptureProps {
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export default function CameraCapture({ onClose, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      setError(null);
      setPermissionBlocked(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!window.isSecureContext) {
          setError('Camera access is blocked on HTTP sites due to browser security. Please access via localhost or HTTPS.');
        } else {
          setError('Camera not supported in this browser.');
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!mounted) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        console.error('[CameraCapture] getUserMedia error:', e);
        if (!window.isSecureContext) {
          setError('Camera access is blocked on HTTP sites due to browser security. Please access via localhost or HTTPS.');
        } else if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setPermissionBlocked(true);
          setError('Camera permission denied.');
        } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
          setError('No camera device found on this system.');
        } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
          setError('Camera is already in use by another application.');
        } else {
          setError('Unable to access camera. Please check your browser permissions.');
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      stopStream();
    };
  }, [retryTrigger]);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current || document.createElement('canvas');
    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopStream();
    onCapture(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[92%] max-w-[720px] bg-white dark:bg-[#1F252D] rounded-xl overflow-hidden shadow-lg border dark:border-[#3A424D]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-[#3A424D]">
          <div className="text-sm font-semibold dark:text-[#A1A8B3]">Take a photo</div>
          <button
            onClick={handleClose}
            aria-label="Close camera"
            className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center text-ink dark:text-[#A1A8B3]"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Video area */}
        <div className="bg-[#1A1A1A] relative flex items-center justify-center min-h-[40vh] sm:min-h-[50vh]">
          {permissionBlocked ? (
            <div className="p-8 text-center max-w-[480px] text-white flex flex-col items-center justify-center font-inter select-none">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-4 animate-pulse">
                <i className="ri-camera-off-line text-[28px] text-red-500"></i>
              </div>
              <h4 className="text-[16px] font-bold text-white font-satoshi mb-2">
                Camera Access is Blocked
              </h4>
              <p className="text-[12.5px] text-[#A3A3A3] leading-relaxed mb-6">
                Browser security prevents automatic permission popups once blocked. Please follow these quick steps to turn it on:
              </p>
              
              <div className="w-full text-left space-y-3.5 mb-6 text-[12.5px] bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#3B82F6] text-white font-bold text-[10.5px]">1</span>
                  <p className="text-[#E5E5E5]">
                    Click the <i className="ri-lock-line mx-0.5 text-blue-400"></i> **Lock** or <i className="ri-settings-3-line mx-0.5 text-blue-400"></i> **Site Controls** icon next to the URL in your address bar.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#3B82F6] text-white font-bold text-[10.5px]">2</span>
                  <p className="text-[#E5E5E5]">
                    Find **Camera** and switch the toggle to <span className="text-green-400 font-semibold">Allow</span>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#3B82F6] text-white font-bold text-[10.5px]">3</span>
                  <p className="text-[#E5E5E5]">
                    Click the **Try Again** button below or refresh the page.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRetryTrigger((prev) => prev + 1)}
                className="px-6 py-2.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-[13px] shadow-lg transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                <i className="ri-refresh-line mr-1 text-[13px]"></i> Try Again
              </button>
            </div>
          ) : error ? (
            <div className="p-8 text-center max-w-[460px] text-white flex flex-col items-center justify-center font-inter select-none">
              <div className="w-14 h-14 flex items-center justify-center rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-4">
                <i className="ri-alert-line text-[24px] text-yellow-500"></i>
              </div>
              <h4 className="text-[15px] font-semibold text-white font-satoshi mb-2">
                Cannot Open Camera
              </h4>
              <p className="text-[12.5px] text-[#A3A3A3] leading-relaxed mb-6">
                {error}
              </p>
              {!window.isSecureContext && (
                <div className="text-[11.5px] text-[#A3A3A3] border-t border-white/10 pt-4 mt-2 w-full text-center">
                  💡 Hint: Try using <strong className="text-white">localhost</strong> in your browser address bar.
                </div>
              )}
            </div>
          ) : (
            <video ref={videoRef} className="w-full h-[56vh] object-cover bg-black" playsInline />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t dark:border-[#3A424D] bg-white dark:bg-[#1F252D]">
          <button
            onClick={handleClose}
            className="text-sm text-slate-600 dark:text-[#A1A8B3] px-4 py-2 rounded hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleCapture}
            disabled={Boolean(error)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-semibold shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <i className="ri-camera-line" />
            <span>Capture</span>
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
