'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppearance } from '@/lib/appearance-context';

export default function SketchPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { resolvedTheme } = useAppearance();
  const isDark = resolvedTheme === 'dark';

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  const [brushSize, setBrushSize] = useState(3);
  const [color, setColor] = useState('#3B82F6');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const colors = ['#3B82F6', isDark ? '#FFFFFF' : '#1F2937', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
  const sizes = [2, 4, 8, 12];

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const next = prev.slice(0, historyStep + 1);
      next.push(imageData);
      return next;
    });
    setHistoryStep((prev) => prev + 1);
  }, [historyStep, getCtx]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = isDark ? '#1F252D' : '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([imageData]);
    setHistoryStep(0);
  }, [isDark]);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === 'eraser' ? (isDark ? '#1F252D' : '#FFFFFF') : color;
    ctx.lineWidth = brushSize;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const ctx = getCtx();
    if (ctx) ctx.closePath();
    saveHistory();
  };

  const undo = () => {
    if (historyStep <= 0) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const prevStep = historyStep - 1;
    ctx.putImageData(history[prevStep], 0, 0);
    setHistoryStep(prevStep);
  };

  const redo = () => {
    if (historyStep >= history.length - 1) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const nextStep = historyStep + 1;
    ctx.putImageData(history[nextStep], 0, 0);
    setHistoryStep(nextStep);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const container = containerRef.current;
    const w = container ? container.clientWidth : canvas.width;
    const h = container ? container.clientHeight : canvas.height;
    ctx.fillStyle = isDark ? '#1F252D' : '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    saveHistory();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    localStorage.setItem('sketchDraft', dataUrl);
    router.push('/retailer');
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#FDF8F3] dark:bg-[#1F252D]">
      <div
        className="absolute inset-0 pointer-events-none lg:hidden"
        style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(59,130,246,0.08), transparent 45%)' }}
      />
      <div className="relative z-10 flex flex-col flex-1">
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-[#EBE5DF] dark:border-[#3A424D] lg:hidden">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}
              >
                <i className="ri-pen-nib-line text-[17px] sm:text-[19px] text-[#3B82F6]"></i>
              </div>
              <div className="min-w-0">
                <span
                  className="block text-[15px] sm:text-[16px] font-semibold text-[#1A1A1A] dark:text-[#A1A8B3] truncate"
                  style={{ fontFamily: 'Satoshi, sans-serif' }}
                >
                  Sketch Workspace
                </span>
                <span className="block text-[12px] text-[#8A847C] dark:text-[#8A847C]/80 truncate">Draft and refine your idea</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[12px] sm:text-[13px] font-medium text-white transition-all duration-150 cursor-pointer whitespace-nowrap hover:opacity-90"
                style={{ backgroundColor: '#3B82F6', boxShadow: '0px 6px 16px rgba(59,130,246,0.28)' }}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-save-line text-[14px]"></i>
                </span>
                <span className="hidden sm:inline">Save</span>
              </button>

              <button
                onClick={() => router.push('/retailer')}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]/50 transition-all cursor-pointer"
                aria-label="Close"
              >
                <i className="ri-close-line text-[16px] sm:text-[18px]"></i>
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#EEE7DF] dark:border-[#3A424D] bg-white/80 dark:bg-[#1F252D]/80 shadow-[0px_10px_24px_rgba(24,24,24,0.06)] backdrop-blur px-2.5 sm:px-3 py-2">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
              <div className="flex items-center gap-1.5 pr-2 sm:pr-3 border-r border-[#EFE9E2] dark:border-[#3A424D]">
                <button
                  onClick={() => setTool('pencil')}
                  className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer ${tool === 'pencil' ? 'bg-[#EBF3FF] dark:bg-[#3B82F6]/20 text-[#3B82F6] shadow-sm' : 'text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]'}`}
                >
                  <i className="ri-pencil-line text-[14px] sm:text-[16px]"></i>
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer ${tool === 'eraser' ? 'bg-[#EBF3FF] dark:bg-[#3B82F6]/20 text-[#3B82F6] shadow-sm' : 'text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]'}`}
                >
                  <i className="ri-eraser-line text-[14px] sm:text-[16px]"></i>
                </button>
              </div>

              <div className="flex items-center gap-1.5 pr-2 sm:pr-3 border-r border-[#EFE9E2] dark:border-[#3A424D]">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setBrushSize(s)}
                    className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${brushSize === s ? 'bg-[#1F2937] dark:bg-white' : 'bg-[#F2F1EE] dark:bg-[#3A424D] hover:bg-[#E7E4DF] dark:hover:bg-[#3A424D]/80'}`}
                  >
                    <div className="rounded-full bg-white" style={{ width: s, height: s }} />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pr-2 sm:pr-3 border-r border-[#EFE9E2] dark:border-[#3A424D]">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all cursor-pointer ${color === c ? 'ring-2 ring-offset-1 ring-[#1F2937] dark:ring-white dark:ring-offset-[#1F252D]' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={undo}
                  disabled={historyStep <= 0}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D] transition-all cursor-pointer disabled:opacity-30"
                >
                  <i className="ri-arrow-go-back-line text-[14px] sm:text-[16px]"></i>
                </button>
                <button
                  onClick={redo}
                  disabled={historyStep >= history.length - 1}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D] transition-all cursor-pointer disabled:opacity-30"
                >
                  <i className="ri-arrow-go-forward-line text-[14px] sm:text-[16px]"></i>
                </button>
                <button
                  onClick={clearCanvas}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D] transition-all cursor-pointer"
                >
                  <i className="ri-delete-bin-line text-[14px] sm:text-[16px]"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-[#EBE5DF] dark:border-[#3A424D]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(59,130,246,0.08)' }}
            >
              <i className="ri-pen-nib-line text-[18px] text-[#3B82F6]"></i>
            </div>
            <span
              className="text-[15px] font-semibold text-[#1A1A1A] dark:text-[#A1A8B3]"
              style={{ fontFamily: 'Satoshi, sans-serif' }}
            >
              Sketch Workspace
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setTool('pencil')}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer ${tool === 'pencil' ? 'bg-[#EBF3FF] dark:bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]'}`}
            >
              <i className="ri-pencil-line text-[16px]"></i>
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer ${tool === 'eraser' ? 'bg-[#EBF3FF] dark:bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]'}`}
            >
              <i className="ri-eraser-line text-[16px]"></i>
            </button>

            <div className="w-px h-5 bg-[#E5E7EB] dark:bg-[#3A424D] mx-1" />

            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${brushSize === s ? 'bg-[#1F2937] dark:bg-white' : 'bg-[#E5E7EB] dark:bg-[#3A424D] hover:bg-[#D1D5DB] dark:hover:bg-[#3A424D]/80'}`}
              >
                <div className="rounded-full bg-white" style={{ width: s, height: s }} />
              </button>
            ))}

            <div className="w-px h-5 bg-[#E5E7EB] dark:bg-[#3A424D] mx-1" />

            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-all cursor-pointer ${color === c ? 'ring-2 ring-offset-1 ring-[#1F2937] dark:ring-white dark:ring-offset-[#1F252D]' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}

            <div className="w-px h-5 bg-[#E5E7EB] dark:bg-[#3A424D] mx-1" />

            <button
              onClick={undo}
              disabled={historyStep <= 0}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D] transition-all cursor-pointer disabled:opacity-30"
            >
              <i className="ri-arrow-go-back-line text-[16px]"></i>
            </button>
            <button
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D] transition-all cursor-pointer disabled:opacity-30"
            >
              <i className="ri-arrow-go-forward-line text-[16px]"></i>
            </button>
            <button
              onClick={clearCanvas}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D] transition-all cursor-pointer"
            >
              <i className="ri-delete-bin-line text-[16px]"></i>
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium text-white transition-all duration-150 cursor-pointer whitespace-nowrap hover:opacity-90"
              style={{ backgroundColor: '#3B82F6', boxShadow: '0px 4px 12px rgba(59,130,246,0.25)' }}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-save-line text-[14px]"></i>
              </span>
              Save
            </button>

            <button
              onClick={() => router.push('/retailer')}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]/50 transition-all cursor-pointer ml-1"
            >
              <i className="ri-close-line text-[18px]"></i>
            </button>
          </div>
        </div>
        <div
          ref={containerRef}
          className="flex-1 relative bg-white dark:bg-[#1F252D] mx-4 sm:mx-6 mb-4 sm:mb-6 mt-4 rounded-[18px] sm:rounded-[22px] overflow-hidden shadow-[0px_18px_36px_rgba(20,20,20,0.08)] lg:m-6 lg:rounded-[16px] lg:shadow-none"
          style={{ border: isDark ? '1px solid #3A424D' : '1px solid #F0F0F0' }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
}