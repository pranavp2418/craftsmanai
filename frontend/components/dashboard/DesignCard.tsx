'use client';



interface DesignCardProps {
  image: string;
  title: string;
  customer: string;
  requestId: string;
  time: string;
  status: 'Approved' | 'Pending' | 'In Production';
}

const statusConfig = {
  Approved: { badgeClass: 'bg-[#22A121]/20 text-[#22A121]', icon: 'ri-checkbox-circle-fill', label: 'Approved' },
  Pending: { badgeClass: 'bg-[#FDA018]/20 text-[#FDA018]', icon: 'ri-time-fill', label: 'Pending' },
  'In Production': { badgeClass: 'bg-blue-500/20 text-blue-500', icon: 'ri-settings-3-fill', label: 'In Production' },
};

export default function DesignCard({ image, title, customer, requestId, time, status }: DesignCardProps) {
  const s = statusConfig[status];

  return (
    <div className="relative overflow-hidden cursor-pointer group rounded-[18px] aspect-[3/4]">
      <img
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
      />

      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_transparent_40%,_rgba(240,235,228,0.72)_72%,_rgba(232,226,218,0.95)_100%)]" />

      <div className={`absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold backdrop-blur-sm ${s.badgeClass}`}>
        <span className={`w-3 h-3 flex items-center justify-center ${s.icon} text-[11px]`}></span>
        {s.label}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <h3
          className="text-[15px] font-bold text-[#1A1A1A] leading-snug font-satoshi"
        >
          {title}
        </h3>
        <p
          className="text-[12.5px] text-[#6B7280] mt-0.5 font-inter"
        >
          {customer} – {requestId}
        </p>
        <p
          className="text-[11.5px] text-[#9CA3AF] mt-1 font-inter"
        >
          {time}
        </p>
      </div>
    </div>
  );
}
