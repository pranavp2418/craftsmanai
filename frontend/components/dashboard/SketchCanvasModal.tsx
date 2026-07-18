'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppearance } from '@/lib/appearance-context';

interface SketchCanvasModalProps {
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

export default function SketchCanvasModal({ onClose, onSave }: SketchCanvasModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useAppearance();
  const isDark = resolvedTheme === 'dark';

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  const [brushSize, setBrushSize] = useState(3);
  const [color, setColor] = useState('#3B82F6');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const colors = [
    { value: '#3B82F6', className: 'bg-[#3B82F6]' },
    { value: isDark ? '#FFFFFF' : '#1F2937', className: isDark ? 'bg-white' : 'bg-[#1F2937]' },
    { value: '#EF4444', className: 'bg-[#EF4444]' },
    { value: '#10B981', className: 'bg-[#10B981]' },
    { value: '#F59E0B', className: 'bg-[#F59E0B]' },
    { value: '#8B5CF6', className: 'bg-[#8B5CF6]' },
  ];
  const sizes = [
    { value: 2, className: 'w-[2px] h-[2px]' },
    { value: 4, className: 'w-1 h-1' },
    { value: 8, className: 'w-2 h-2' },
    { value: 12, className: 'w-3 h-3' },
  ];

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
    const isDarkTheme = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDarkTheme ? '#1F252D' : '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    saveHistory();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] h-full w-full flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-[94vw] sm:w-[90vw] max-w-[900px] h-[88vh] sm:h-[80vh] max-h-[calc(100dvh-2rem)] sm:max-h-[600px] rounded-[16px] sm:rounded-[20px] overflow-hidden flex flex-col bg-[#FDF8F3] dark:bg-[#1F252D] shadow-[0px_24px_64px_rgba(0,0,0,0.14),_0px_4px_16px_rgba(0,0,0,0.06)] border border-black/[0.06] dark:border-[#3A424D]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#EBE5DF] dark:border-[#3A424D]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#1A1A1A] dark:text-[#A1A8B3] font-inter">
              Sketch Canvas
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[12px] sm:text-[13px] font-medium text-[#1F2937] dark:text-[#A1A8B3] transition-all cursor-pointer whitespace-nowrap hover:opacity-80 bg-white dark:bg-[#1F252D] border border-[#E5E7EB] dark:border-[#3A424D]"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-save-line text-[14px]"></i>
                </span>
                <span className="hidden sm:inline">Save Sketch</span>
              </button>
              <button
                onClick={onClose}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]/50 transition-all cursor-pointer"
              >
                <i className="ri-close-line text-[16px] sm:text-[18px]"></i>
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {/* Tools */}
            <button
              onClick={() => setTool('pencil')}
              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${tool === 'pencil' ? 'bg-[#EBF3FF] dark:bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]'}`}
            >
              <i className="ri-pencil-line text-[14px] sm:text-[16px]"></i>
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${tool === 'eraser' ? 'bg-[#EBF3FF] dark:bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-[#94A3B8] hover:bg-[#F3F4F6] dark:hover:bg-[#3A424D]'}`}
            >
              <i className="ri-eraser-line text-[14px] sm:text-[16px]"></i>
            </button>

            <div className="w-px h-5 bg-[#E5E7EB] dark:bg-[#3A424D] mx-1 hidden sm:block" />

            {/* Brush sizes */}
            {sizes.map((s) => (
              <button
                key={s.value}
                onClick={() => setBrushSize(s.value)}
                className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${brushSize === s.value ? 'bg-[#1F2937] dark:bg-white' : 'bg-[#E5E7EB] dark:bg-[#3A424D] hover:bg-[#D1D5DB] dark:hover:bg-[#3A424D]/80'}`}
              >
                <div className={`rounded-full bg-white ${s.className}`} />
              </button>
            ))}

            <div className="w-px h-5 bg-[#E5E7EB] dark:bg-[#3A424D] mx-1 hidden sm:block" />

            {/* Colors */}
            {colors.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all cursor-pointer ${color === c.value ? 'ring-2 ring-offset-1 ring-[#1F2937] dark:ring-white dark:ring-offset-[#1F252D]' : ''} ${c.className}`}
              />
            ))}

            <div className="w-px h-5 bg-[#E5E7EB] dark:bg-[#3A424D] mx-1 hidden sm:block" />

            {/* Undo / Redo / Clear */}
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

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 relative bg-white dark:bg-[#1F252D] m-3 sm:m-4 rounded-[10px] sm:rounded-[12px] overflow-hidden border border-[#F3F4F6] dark:border-[#3A424D]">
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