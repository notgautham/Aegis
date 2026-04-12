import { Link } from 'react-router-dom';
import LiveRiskMatrix from './LiveRiskMatrix';

const Hero = () => {
  const scrollToPipeline = () => {
    document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="min-h-screen pt-16 grid grid-cols-1 lg:grid-cols-[45%_55%]">
      {/* Left dark column */}
      <div className="bg-brand-primary relative flex flex-col justify-center px-8 lg:px-16 xl:px-20 py-20 lg:py-0">
        {/* Live badge */}
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] text-accent-amber px-3 py-1.5 rounded-full border border-[rgba(232,160,32,0.2)] bg-[rgba(232,160,32,0.12)]">
            <span className="animate-pulse-dot">●</span> LIVE PLATFORM
          </span>
        </div>

        {/* Headline */}
        <h1 className="leading-[1.05] mb-6">
          <span className="block font-body font-bold text-4xl lg:text-5xl xl:text-6xl text-white">Scan.</span>
          <span className="block font-body font-bold text-4xl lg:text-5xl xl:text-6xl text-white">Classify.</span>
          <span className="block font-display italic text-4xl lg:text-5xl xl:text-6xl text-accent-amber">Go Quantum-Safe.</span>
        </h1>

        {/* Sub */}
        <p className="font-body text-base text-white/65 max-w-[380px] leading-relaxed mb-10">
          The sovereign standard for post-quantum institutional risk. Automate your Cryptography Bill of Materials and protect financial infrastructure before quantum computers arrive.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/scanner"
            className="inline-flex items-center gap-2 font-body text-sm font-bold bg-accent-amber text-brand-primary px-7 py-3.5 rounded-lg hover:brightness-105 transition-all"
          >
            ▶ Initiate Pipeline
          </Link>
          <button
            onClick={scrollToPipeline}
            className="inline-flex items-center gap-2 font-body text-sm text-white border border-white/20 px-7 py-3.5 rounded-lg hover:bg-white/5 transition-all"
          >
            Review Security Framework
          </button>
        </div>

        {/* Bottom stats */}
        <div className="absolute bottom-8 left-8 lg:left-16 xl:left-20 flex items-center gap-3 font-mono text-[11px] text-white/40">
          <span>21+ Assets Scanned</span>
          <span>·</span>
          <span>5-Phase CBOM Pipeline</span>
          <span>·</span>
          <span>NIST FIPS 203/204/205</span>
        </div>
      </div>

      {/* Right light column */}
      <div className="bg-background flex items-center justify-center p-8 lg:p-16">
        <LiveRiskMatrix />
      </div>
    </section>
  );
};

export default Hero;
