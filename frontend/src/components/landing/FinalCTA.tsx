import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const FinalCTA = () => {
  const scrollToPipeline = () => {
    document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-brand-primary py-32 lg:py-36 px-6 lg:px-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto"
      >
        <span className="inline-block font-mono text-[11px] px-3 py-1 rounded-full border border-accent-amber/40 text-accent-amber mb-8">
          GET STARTED
        </span>

        <h2 className="font-body font-bold text-3xl lg:text-[56px] text-white leading-tight mb-6">
          Your bank's quantum<br />
          readiness starts <span className="font-display italic text-accent-amber">today.</span>
        </h2>

        <p className="font-body text-lg text-white/65 max-w-[520px] mx-auto mb-10 leading-relaxed">
          Run a demo scan on any domain and see your full Cryptographic Bill of Materials in under 60 seconds.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="font-body text-base font-bold bg-accent-amber text-brand-primary px-10 py-4 rounded-[10px] hover:brightness-105 transition-all"
          >
            ▶ Launch Demo Scan
          </Link>
          <button
            onClick={scrollToPipeline}
            className="font-body text-base text-white border border-white/20 px-10 py-4 rounded-[10px] hover:bg-white/5 transition-all"
          >
            View Architecture →
          </button>
        </div>

        <div className="mt-20 font-mono text-[11px] text-white/40 tracking-[2px] uppercase">
          PNB Cybersecurity Hackathon 2026 · NIST FIPS 203 / 204 / 205 · CycloneDX 1.7 · Ed25519 Attestation
        </div>
      </motion.div>
    </section>
  );
};

export default FinalCTA;
