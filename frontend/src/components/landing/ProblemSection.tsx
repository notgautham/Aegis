import { motion } from 'framer-motion';

const ProblemSection = () => {
  const stats = [
    { num: '2031', label: 'Projected RSA break year', sub: 'IBM Quantum Roadmap' },
    { num: '₹∞', label: 'Cost of post-quantum breach', sub: 'unquantifiable' },
    { num: '0', label: 'Banks with full CBOM today', sub: 'The gap AEGIS closes' },
  ];

  return (
    <section id="problem" className="bg-surface py-28 lg:py-32 px-6 lg:px-12">
      <div className="max-w-[800px] mx-auto text-center">
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
            Quantum computers won't ask permission.
          </h2>

          <p className="font-body text-lg text-[hsl(var(--text-secondary))] leading-[1.8] max-w-[600px] mx-auto mb-16">
            By 2031, IBM's quantum roadmap projects machines capable of breaking RSA-2048 in hours.
            Every encrypted transaction your bank made today is being harvested by adversaries right now
            — waiting to be decrypted. This is called <strong>Harvest Now, Decrypt Later (HNDL)</strong>
            — and it's already happening.
            <br /><br />
            AEGIS gives Indian banks a complete, auditable picture of their cryptographic exposure
            — and a clear, NIST-aligned path to quantum safety.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-0"
        >
          {stats.map((s, i) => (
            <div
              key={s.num}
              className={`py-8 px-4 ${
                i < stats.length - 1 ? 'md:border-r border-[hsl(var(--border-default))]' : ''
              }`}
            >
              <div className="font-mono text-4xl lg:text-5xl font-bold text-brand-primary mb-2">{s.num}</div>
              <div className="font-body text-sm text-[hsl(var(--text-secondary))] mb-1">{s.label}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ProblemSection;
