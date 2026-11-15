import React from 'react';

interface SvgProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
  trackColor?: string;
  label?: string;
}

export const SvgProgressRing: React.FC<SvgProgressRingProps> = ({
  value,
  max,
  size = 52,
  strokeWidth = 5,
  accentColor = '#EA580C',
  trackColor = 'var(--border-subtle)',
  label,
}) => {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(1, Math.max(0, value / safeMax));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={label ?? `${Math.round(pct * 100)}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={pct >= 1 ? '#16A34A' : accentColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-mono font-semibold tabular-nums text-[var(--text-secondary)] dark:text-slate-200">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
};
