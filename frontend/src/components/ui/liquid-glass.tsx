import React from "react";

interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const GlassFilter: React.FC = () => (
  <svg className="hidden absolute" width="0" height="0">
    <defs>
      <filter id="glass-filter">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
          result="goo"
        />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
      </filter>
    </defs>
  </svg>
);

const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
}) => {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        boxShadow:
          "0 6px 6px rgba(0, 0, 0, 0.1), 0 0 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.15)",
        ...style,
      }}
    >
      {/* Glass layers */}
      <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.06]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.12] to-transparent pointer-events-none" />
      <div className="absolute inset-0 border border-white/[0.18] rounded-[inherit] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export { GlassEffect, GlassFilter };
export default GlassEffect;
