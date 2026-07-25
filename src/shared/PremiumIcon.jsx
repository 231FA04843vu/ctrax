import React from 'react';

export default function PremiumIcon({
  icon: Icon,
  className = "",
  size = 24,
  color = "blue",
  variant = "gradient", // 'gradient', 'glass', 'solid'
  glow = false
}) {
  const gradientColors = {
    blue: ['#60A5FA', '#4F46E5'], // blue-400 to indigo-600
    purple: ['#A78BFA', '#EC4899'], // purple-400 to pink-500
    emerald: ['#34D399', '#14B8A6'], // emerald-400 to teal-500
    gray: ['#9CA3AF', '#4B5563'], // gray-400 to gray-600
    white: ['#FFFFFF', '#E5E7EB'] // white to gray-200
  };

  const [start, end] = gradientColors[color] || gradientColors.blue;
  const gradId = `grad-${color}-${variant}`;

  if (variant === 'gradient') {
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        {glow && (
          <div 
            className="absolute inset-0 blur-md rounded-full opacity-40 mix-blend-multiply" 
            style={{ background: `linear-gradient(to bottom right, ${start}, ${end})`, width: size, height: size, zIndex: 0 }} 
          />
        )}
        <svg width="0" height="0" className="absolute">
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor={start} offset="0%" />
            <stop stopColor={end} offset="100%" />
          </linearGradient>
        </svg>
        <Icon size={size} stroke={`url(#${gradId})`} strokeWidth={2} style={{ zIndex: 1, position: 'relative' }} />
      </div>
    );
  }

  // Background variants
  const bgClasses = {
    blue: 'from-blue-400 to-indigo-500 shadow-indigo-500/30',
    purple: 'from-purple-400 to-pink-500 shadow-pink-500/30',
    emerald: 'from-emerald-400 to-teal-500 shadow-teal-500/30',
    gray: 'from-gray-300 to-gray-500 shadow-gray-500/30',
  };
  const bg = bgClasses[color] || bgClasses.blue;

  if (variant === 'solid') {
    return (
      <div 
        className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br ${bg} ${glow ? 'shadow-lg' : ''} ${className}`} 
        style={{ width: size * 2, height: size * 2 }}
      >
        <div className="absolute inset-0 rounded-2xl border border-white/30 mix-blend-overlay" />
        <Icon size={size} className="text-white drop-shadow-sm" strokeWidth={1.5} />
      </div>
    );
  }

  if (variant === 'glass') {
    return (
      <div 
        className={`relative flex items-center justify-center rounded-2xl bg-white/30 backdrop-blur-xl border border-white/50 shadow-xl ${className}`} 
        style={{ width: size * 2, height: size * 2 }}
      >
        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${bg.split(' ')[0]} opacity-10`} />
        {glow && <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${bg.split(' ')[0]} opacity-20 blur-lg -z-10`} />}
        <svg width="0" height="0" className="absolute">
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor={start} offset="0%" />
            <stop stopColor={end} offset="100%" />
          </linearGradient>
        </svg>
        <Icon size={size} stroke={`url(#${gradId})`} strokeWidth={1.5} />
      </div>
    );
  }
}
