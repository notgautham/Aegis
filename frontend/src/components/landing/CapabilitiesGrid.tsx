import { motion } from 'framer-motion';
import { Key, ClipboardList, Star, Clock, Bot, TrendingDown } from 'lucide-react';

const capabilities = [
  {
    icon: Key,
    title: 'Negotiation Policy Analyzer',
    desc: 'Detects what each client tier actually negotiates — not what the server supports. Catches downgrade vulnerabilities invisible to standard SSL scanners.',
    tag: '→ FIPS 204 Aligned',
  },
  {
    icon: ClipboardList,
    title: 'CycloneDX 1.7 CBOM',
    desc: 'Generates spec-compliant Cryptographic Bill of Materials: key length distribution, cipher usage, CA breakdown, and Ed25519-signed attestation.',
    tag: '→ CycloneDX 1.7',
  },
  {
    icon: Star,
    title: 'Enterprise Cyber Rating',
    desc: 'Aggregated 0–1000 score across all assets. Tier thresholds: Legacy <400, Standard 400–700, Elite-PQC >700. Mapped to NIST compliance.',
    tag: '→ 0–1000 Score',
  },
  {
    icon: Clock,
    title: 'HNDL Detection',
    desc: 'Identifies assets whose today-encrypted traffic will be decryptable by quantum computers. Per-asset break-year timeline based on IBM qubit roadmap.',
    tag: '→ Harvest-Now-Decrypt-Later',
  },
  {
    icon: Bot,
    title: 'AI Patch Generator',
    desc: 'Claude-powered remediation. Generates exact nginx/Apache/Java config snippets to enable ML-KEM-768 hybrid key exchange per asset.',
    tag: '→ AI-Powered',
  },
  {
    icon: TrendingDown,
    title: 'Regression Detection',
    desc: 'Compares every scan to history. Alerts on Q-Score drops ≥5, algorithm downgrades, and new vulnerable assets appearing in your perimeter.',
    tag: '→ Automated Alerts',
  },
];

const CapabilitiesGrid = () => {
  return (
    <section id="capabilities" className="bg-surface py-28 lg:py-32 px-6 lg:px-12">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <span className="font-mono text-[11px] text-muted-foreground tracking-wider uppercase">Capabilities</span>
          <h2 className="font-body font-bold text-3xl lg:text-[42px] text-foreground mt-3 leading-tight">
            Everything a bank needs<br />
            to <span className="font-display italic text-brand-crimson">go quantum-safe</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group bg-white border border-[hsl(var(--border-default))] rounded-[14px] p-7 hover:border-brand-accent hover:shadow-[0_8px_32px_rgba(107,33,168,0.08)] hover:-translate-y-[3px] transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-primary/[0.06] flex items-center justify-center mb-4">
                <cap.icon className="w-5 h-5 text-brand-primary" />
              </div>
              <h3 className="font-body font-bold text-base text-foreground mb-2">{cap.title}</h3>
              <p className="font-body text-sm text-[hsl(var(--text-secondary))] leading-[1.7] mb-4">{cap.desc}</p>
              <span className="font-mono text-[11px] text-muted-foreground">{cap.tag}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CapabilitiesGrid;
