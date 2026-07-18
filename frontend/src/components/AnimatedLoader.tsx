'use client';

interface AnimatedLoaderProps {
  width?: number;
  height?: number;
  className?: string;
  onComplete?: () => void;
}

const AnimatedLoader: React.FC<AnimatedLoaderProps> = ({ 

  onComplete
}) => (
  <div className={`flex items-center justify-center h-[100vh] w-[100vw] bg-black`}>
    <div
      className="relative overflow-hidden md:h-[100vh] md:w-[100vw]"
    >
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        loop={!onComplete}
        onEnded={onComplete}
         className="md:h-[100vh] md:w-[100vw] object-cover"
      >
        <source src="/loader/craftsmanai-intro.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
);

export default AnimatedLoader;

// Full screen loader overlay
export const FullScreenLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 bg-black md:h-[100vh] md:w-[100vw]">
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        loop
        className="md:h-[100vh] md:w-[100vw] object-cover"
      >
        <source src="/loader/craftsmanai-intro.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

// Inline loader for buttons/cards
export const InlineLoader: React.FC<{ scale?: number }> = ({ scale = 0.5 }) => {
  return (
    <AnimatedLoader 
      width={159 * scale} 
      height={94.65 * scale} 
      className="inline-block" 
    />
  );
};
