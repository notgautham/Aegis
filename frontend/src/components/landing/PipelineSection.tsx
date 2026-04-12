import { motion } from 'framer-motion';

const phases = [
  {
    title: 'Asset Discovery',
    desc: 'Discovers in-scope domains, hostnames, IPs, and exposed cryptographic services using deterministic scope enforcement.',
    tag: 'DNSx · Amass · Nmap',
  },
  {
    title: 'Tri-Mode TLS Probing',
    desc: 'Performs TLS handshake probing and metadata extraction to capture negotiated versions, ciphers, and certificate chains.',
    tag: 'TLS Handshake · Certificate Chain',
  },
  {
    title: 'PQC Classification',
    desc: 'Applies deterministic vulnerability mappings and weighted quantum risk scoring, then assigns compliance tiers.',
    tag: 'Risk Engine · Rules Engine',
  },
  {
    title: 'CBOM Generation',
    desc: 'Builds CycloneDX 1.6 cryptographic inventories and persists auditable scan artifacts for each asset.',
    tag: 'CycloneDX 1.6 · Persisted Artifacts',
  },
  {
    title: 'Certification Labeling',
    desc: 'Issues three-tier compliance certificates and remediation bundles aligned with NIST FIPS 203/204/205 migration goals.',
    tag: 'Fully Safe · Transitioning · Vulnerable',
  },
];

const PipelineSection = () => {
  return (
    <section id="pipeline" className="bg-background py-28 lg:py-32 px-6 lg:px-12">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <span className="font-mono text-[11px] text-muted-foreground tracking-wider uppercase">
            Solution Execution Pipeline
          </span>
          <h2 className="font-body font-bold text-3xl lg:text-[42px] text-foreground mt-3 leading-tight">
            From attack surface to <span className="font-display italic text-brand-crimson">certified CBOM</span> — automatically.
          </h2>
          <p className="font-body text-base text-[hsl(var(--text-secondary))] mt-4 max-w-xl leading-relaxed">
            Every scan flows through a deterministic five-phase architecture described in the solution blueprint,
            grounded in NIST FIPS 203, 204, and 205 with auditable outputs.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Horizontal line */}
          <div className="hidden lg:block absolute top-[26px] left-[5%] right-[5%] h-0.5 bg-[hsl(var(--border-strong))]" />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-4">
            {phases.map((phase, i) => {
              const isOdd = i % 2 === 0;
              return (
                <motion.div
                  key={phase.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex flex-col items-center text-center"
                >
                  {/* Node */}
                  <div
                    className={`w-[52px] h-[52px] rounded-full flex items-center justify-center font-mono text-base font-bold z-10 relative ${
                      isOdd
                        ? 'bg-brand-primary text-white'
                        : 'bg-accent-amber text-brand-primary'
                    }`}
                  >
                    {i + 1}
                  </div>

                  {/* Connector */}
                  <div className="w-0.5 h-6 bg-[hsl(var(--border-strong))]" />

                  {/* Content */}
                  <div className="max-w-[200px]">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      PHASE {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="font-body font-bold text-sm text-foreground mt-1 mb-2">{phase.title}</h3>
                    <p className="font-body text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed mb-3">
                      {phase.desc}
                    </p>
                    <span className="inline-block font-mono text-[10px] text-muted-foreground bg-sunken px-2 py-1 rounded">
                      {phase.tag}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PipelineSection;
