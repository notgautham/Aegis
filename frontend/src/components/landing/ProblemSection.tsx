import { motion } from 'framer-motion';

const ProblemSection = () => {
  const stats = [
    { num: '45/35/10/10', label: 'Deterministic risk weighting', sub: 'KEX / SIG / SYM / TLS model' },
    { num: '3', label: 'Certification tiers', sub: 'Fully Safe / Transitioning / Vulnerable' },
    { num: '1', label: 'Target per scanner run', sub: 'Single-target auditable execution flow' },
  ];

  return (
    <section id="problem" className="bg-surface py-24 lg:py-28 px-6 lg:px-12">
      <div className="max-w-[2000px] mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block font-mono text-[11px] px-3 py-1 rounded-full bg-[rgba(185,28,28,0.07)] text-status-critical mb-8">
            THE THREAT
          </span>

          <h2 className="font-body font-bold text-3xl lg:text-5xl text-foreground mb-8">
            Banks are already accumulating quantum debt.
          </h2>

          <p className="font-body text-lg text-[hsl(var(--text-secondary))] leading-[1.8] max-w-[680px] mx-auto mb-12">
            Aegis is built around the <strong>Harvest Now, Decrypt Later (HNDL)</strong> threat model.
            TLS sessions captured today can become readable later when cryptanalytically relevant quantum
            machines emerge. The solution is not guesswork: discover assets continuously, evaluate cryptography
            deterministically, generate CBOM evidence, and issue compliance labels tied to NIST-aligned logic.
            <br /><br />
            AEGIS gives Indian banks a complete, auditable view of cryptographic exposure and an actionable,
            standards-aligned migration path from vulnerable algorithms toward post-quantum readiness.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-0"
        >
          {stats.map((s, i) => (
            <div
              key={s.num}
              className={`rounded-xl md:rounded-none py-7 px-4 bg-background/30 md:bg-transparent ${
                i < stats.length - 1 ? 'md:border-r border-[hsl(var(--border-default))]' : ''
              }`}
            >
              <div className="font-mono text-4xl lg:text-5xl font-bold text-brand-primary mb-2 tracking-tight">{s.num}</div>
              <div className="font-body text-sm text-[hsl(var(--text-secondary))] mb-1">{s.label}</div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">{s.sub}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ProblemSection;
