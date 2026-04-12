import { motion } from 'framer-motion';

const terms = [
  {
    symbol: (
      <span>
        V<sub>kex</sub>
      </span>
    ),
    title: 'Key exchange vulnerability',
    note: 'Derived from negotiated KEX families and PQC readiness.',
  },
  {
    symbol: (
      <span>
        V<sub>sig</sub>
      </span>
    ),
    title: 'Signature vulnerability',
    note: 'Based on certificate signature algorithms and trust chain metadata.',
  },
  {
    symbol: (
      <span>
        V<sub>sym</sub>
      </span>
    ),
    title: 'Symmetric cipher vulnerability',
    note: 'Evaluates negotiated encryption strength and downgrade exposure.',
  },
  {
    symbol: (
      <span>
        V<sub>tls</sub>
      </span>
    ),
    title: 'Protocol version vulnerability',
    note: 'Penalizes legacy protocol posture and weak negotiation floors.',
  },
];

const MathematicalCoreSection = () => {
  return (
    <section id="mathematical-core" className="bg-background py-24 lg:py-28 px-6 lg:px-12">
      <div className="max-w-[1100px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="text-center"
        >
          <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
            Mathematical Core
          </span>
          <h2 className="font-body font-bold text-3xl lg:text-5xl text-foreground mt-4 leading-tight">
            Deterministic risk scoring, <span className="font-display italic text-brand-crimson">clearly explainable.</span>
          </h2>
          <p className="font-body text-base lg:text-lg text-[hsl(var(--text-secondary))] mt-6 max-w-[760px] mx-auto leading-relaxed">
            The weighted model below is used directly by the backend scoring engine. The compliance tier and
            readiness outputs are computed from these deterministic terms, not from generated text.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="mt-10 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-sunken))] px-5 py-6 lg:px-8"
        >
          <div className="font-mono text-xs lg:text-sm text-foreground overflow-x-auto whitespace-nowrap text-center">
            QuantumRiskScore = (0.45 x V<sub>kex</sub>) + (0.35 x V<sub>sig</sub>) + (0.10 x V<sub>sym</sub>) + (0.10 x V<sub>tls</sub>)
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.16 }}
          className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {terms.map((term) => (
            <div
              key={term.title}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-white p-4 text-center"
            >
              <div className="font-mono text-2xl text-brand-primary leading-none">{term.symbol}</div>
              <div className="font-body text-xs font-semibold text-foreground mt-3">{term.title}</div>
              <div className="font-body text-[11px] text-muted-foreground leading-relaxed mt-2">{term.note}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default MathematicalCoreSection;
