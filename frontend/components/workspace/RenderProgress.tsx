'use client';

import { useState, useEffect } from 'react';

const phases = [
  { key: 'intent', label: 'Design Intent', icon: 'ri-lightbulb-flash-line', title: 'UNDERSTANDING DESIGN INTENT…', subtitle: 'Analyzing structure and composition…' },
  { key: 'cad', label: 'CAD Processing', icon: 'ri-box-3-line', title: 'PROCESSING CAD GEOMETRY…', subtitle: 'Refining dimensions and craftsmanship…' },
  { key: 'render', label: 'Final Render', icon: 'ri-image-ai-line', title: 'GENERATING FINAL RENDER…', subtitle: 'Applying materials and realistic lighting…' },
];

interface RenderProgressProps { 
  onComplete?: () => void;
  progressKey?: string;
}

export default function RenderProgress({ onComplete, progressKey }: RenderProgressProps) {
  const [progress, setProgress] = useState(() => {
    if (typeof window !== 'undefined' && progressKey) {
      try {
        const saved = localStorage.getItem(`render_progress_${progressKey}`);
        if (saved) {
          const val = parseFloat(saved);
          if (!isNaN(val) && val > 0 && val < 99) {
            return val;
          }
        }
      } catch (e) {}
    }
    return 0;
  });
  const [fadingOut, setFadingOut] = useState(false);

  // Compute active phase based on progress percentage
  const activePhase = progress < 30
    ? 0
    : progress < 65
      ? 1
      : 2;

  const orbs = [
    'w-[340px] h-[340px] top-[8%] left-[12%] blur-[70px] bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] animate-[orb1_14s_ease-in-out_infinite]',
    'w-[300px] h-[300px] top-[45%] right-[8%] blur-[60px] bg-[radial-gradient(circle,rgba(34,197,94,0.06)_0%,transparent_70%)] animate-[orb2_17s_ease-in-out_infinite]',
    'w-[260px] h-[260px] bottom-[8%] left-[38%] blur-[65px] bg-[radial-gradient(circle,rgba(59,130,246,0.06)_0%,transparent_70%)] animate-[orb3_20s_ease-in-out_infinite]',
  ];

  const particles = [
    'left-[12%] bottom-[6%] animate-[particle_7s_ease-in-out_0s_infinite]',
    'left-[22%] bottom-[10%] animate-[particle_8.5s_ease-in-out_1.1s_infinite]',
    'left-[32%] bottom-[5%] animate-[particle_6.5s_ease-in-out_2.3s_infinite]',
    'left-[45%] bottom-[12%] animate-[particle_9s_ease-in-out_0.7s_infinite]',
    'left-[55%] bottom-[7%] animate-[particle_7.5s_ease-in-out_3.2s_infinite]',
    'left-[65%] bottom-[14%] animate-[particle_8s_ease-in-out_1.8s_infinite]',
    'left-[78%] bottom-[4%] animate-[particle_6s_ease-in-out_4s_infinite]',
    'left-[88%] bottom-[9%] animate-[particle_7.2s_ease-in-out_2.6s_infinite]',
  ];

  // Organically increment progress over time
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        let next = prev;
        if (prev < 30) {
          next = prev + 1.2; // Smooth Phase 1 progress
        } else if (prev < 65) {
          next = prev + 0.5; // Smooth Phase 2 progress
        } else if (prev < 95) {
          next = prev + 0.15; // Creep Phase 3 progress slowly, keeping it under 95%
        }
        
        if (typeof window !== 'undefined' && progressKey && next !== prev) {
          try {
            localStorage.setItem(`render_progress_${progressKey}`, String(next));
          } catch (e) {}
        }
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [progressKey]);

  return (
    <div className={`render-bg relative overflow-hidden rounded-[22px] transition-opacity duration-700 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}>
      <style>{`
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.32}50%{transform:translate(50px,-35px) scale(1.18);opacity:0.52} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.22}50%{transform:translate(-40px,45px) scale(1.22);opacity:0.42} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.18}50%{transform:translate(25px,25px) scale(0.92);opacity:0.36} }
        @keyframes particle { 0%{transform:translateY(0) scale(0.55);opacity:0}12%{opacity:0.45}88%{opacity:0.28}100%{transform:translateY(-260px) scale(1.05);opacity:0} }
        @keyframes shimmer-bar { 0%{background-position:150% 0}100%{background-position:-150% 0} }
        @keyframes soft-pulse { 0%,100%{opacity:0.75;transform:scale(1)}50%{opacity:1;transform:scale(1.04)} }
        @keyframes gentle-breathe { 0%,100%{transform:translateY(0);opacity:0.9}50%{transform:translateY(-6px);opacity:1} }
        @keyframes loading-dots { 0%, 100% { opacity: 0.3; transform: scale(0.75); } 50% { opacity: 1; transform: scale(1.1); } }
        .render-bg { min-height: 340px; background: linear-gradient(180deg, rgba(244, 244, 244, 0.9) 0.75%, rgba(255, 255, 255, 0.9) 45.94%, rgba(255, 255, 255, 0) 100%); position: relative; z-index: 0; overflow: hidden; }
        @media (min-width: 640px) {
          .render-bg { min-height: 480px; }
        }
        .render-bg::before { content: ''; position: absolute; inset: 0; background-image: url('/rendergif.gif'); background-repeat: no-repeat; background-position: center; background-size: cover; filter: blur(6px) brightness(0.78) saturate(0.9); transform: scale(1.03); opacity: 0.22; pointer-events: none; z-index: 1; }
        .progress-bar { background: linear-gradient(90deg, #60A5FA 0%, #3B82F6 40%, #2563EB 100%); background-size: 200% 100%; box-shadow: 0 0 14px rgba(59,130,246,0.18); }
      `}</style>

      {/* Background orbs & particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {orbs.map((orbClass, i) => (
          <div key={i} className={`absolute rounded-full ${orbClass}`} />
        ))}

        {particles.map((particleClass, i) => (
          <div
            key={i}
            className={`absolute w-[3px] h-[3px] rounded-full bg-[rgba(34,197,94,0.32)] ${particleClass}`}
          />
        ))}

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_40%,rgba(212,175,55,0.025)_100%)]" />
      </div>

      {/* Content: header, progress bar, centered steps */}
      <div className="relative z-30 px-4 sm:px-8 py-6 sm:py-8 min-h-[340px] sm:min-h-[420px]">
        <div className="flex items-center justify-between gap-3 mb-6 relative z-40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex-shrink-0 flex items-center justify-center text-blue-600 font-semibold text-sm sm:text-base"><img src="/logo_new.png" alt="Craftmen AI Logo" /></div>
            <div className="min-w-0">
              <div className="text-[13.5px] sm:text-[15px] font-semibold text-[#111827] truncate">CraftsmanAI at work</div>
              <div className="text-[11px] sm:text-[12px] text-[#9CA3AF] truncate">{phases[activePhase].subtitle}</div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <span className="text-[11px] sm:text-[12px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium whitespace-nowrap">
              Phase {activePhase + 1} of 3
            </span>
          </div>
        </div>

        <div className="mb-8 relative z-40">
          <div className="w-full h-[6px] rounded-full bg-[#E5E7EB] overflow-hidden">
            <div 
              style={{ width: `${progress}%` }} 
              className="progress-bar h-full rounded-full transition-all duration-300 ease-out animate-[shimmer-bar_2.5s_linear_infinite]" 
            />
          </div>
        </div>

        <div className="flex items-center justify-center w-full relative z-40">
          <div className="flex items-start">
            {phases.map((phase, idx) => {
              const isDone = idx < activePhase;
              const isActive = idx === activePhase;
              const isLast = idx === phases.length - 1;
              const lineCompleted = idx < activePhase;
              return (
                <div key={phase.key} className="flex items-start">
                  <div className="flex flex-col items-center relative z-40 min-w-[70px] sm:min-w-[90px] md:min-w-[100px]">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full transition-all ${isDone ? 'bg-green-500/10' : isActive ? 'bg-blue-500/10' : 'bg-[#F3F4F6]'} ${isActive ? 'shadow-[0_0_28px_rgba(59,130,246,0.12)] animate-[soft-pulse_2.8s_ease-in-out_infinite]' : isDone ? 'shadow-[0_0_16px_rgba(34,197,94,0.08)]' : ''}`}>
                      {isDone ? <i className="ri-check-line text-[14px] sm:text-[16px] md:text-[18px] text-[#16A34A]" /> : <i className={`${phase.icon} text-[14px] sm:text-[16px] md:text-[18px] ${isActive ? 'text-[#3B82F6]' : 'text-[#C4C4C4]'}`} />}
                    </div>
                    <div className={`text-[10px] sm:text-[12px] md:text-[12.5px] font-medium mt-3 whitespace-nowrap text-center ${isDone ? 'text-[#16A34A]' : isActive ? 'text-[#2563EB]' : 'text-[#C4C4C4]'}`}>{phase.label}</div>
                    {isActive && (
                      <div className="flex gap-0.5 sm:gap-1 mt-1 sm:mt-2 justify-center h-2">
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#3B82F6] animate-[loading-dots_1.4s_ease-in-out_infinite_0ms]" />
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#3B82F6] animate-[loading-dots_1.4s_ease-in-out_infinite_200ms]" />
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#3B82F6] animate-[loading-dots_1.4s_ease-in-out_infinite_400ms]" />
                      </div>
                    )}
                  </div>
                  {!isLast && (
                    <div className="w-6 sm:w-8 md:w-12 h-[3px] bg-[#E5E7EB] mt-[18.5px] sm:mt-[22.5px] md:mt-[26.5px] mx-1 sm:mx-2 rounded-full overflow-hidden relative z-30 flex-shrink-0">
                      <div className={`h-full bg-[#16A34A] transition-all duration-500 ${lineCompleted ? 'w-full' : 'w-0'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}