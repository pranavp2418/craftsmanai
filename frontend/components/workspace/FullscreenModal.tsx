'use client';

interface FullscreenModalProps {
  image: string;
  onClose: () => void;
}

export default function FullscreenModal({ image, onClose }: FullscreenModalProps) {
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] rounded-[20px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image}
          alt="Fullscreen View"
          className="max-w-[90vw] max-h-[90vh] object-contain"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
        >
          <i className="ri-close-line text-[18px] text-white"></i>
        </button>
      </div>
    </div>
  );
}
