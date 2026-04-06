import { motion } from 'framer-motion';

const standards = [
  {
    code: 'NIST FIPS 203',
    name: 'ML-KEM — Key Encapsulation Mechanism',
    desc: 'Replaces ECDH and RSA key exchange. The primary post-quantum KEM standard for TLS key negotiation.',
    tags: ['ML-KEM-512', 'ML-KEM-768', 'ML-KEM-1024'],
  },
  {
    code: 'NIST FIPS 204',
    name: 'ML-DSA — Digital Signature Algorithm',
    desc: 'Replaces ECDSA and RSA signatures. Used in certificate authentication chains across all PQC-compliant TLS handshakes.',
    tags: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  },
  {
    code: 'NIST FIPS 205',
    name: 'SLH-DSA — Hash-Based Signatures',
    desc: 'Stateless hash-based digital signature standard. Conservative security assumptions. Ideal for high-assurance certificate signing.',
    tags: ['SLH-DSA-128s', 'SLH-DSA-192f', 'SLH-DSA-256f'],
  },
];

const NistStandards = () => {
  return (
    <section id="standards" className="bg-surface py-28 lg:py-32 px-6 lg:px-12">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-body font-bold text-3xl lg:text-[42px] text-foreground leading-tight">
            Built on the final<br />NIST PQC standards
          </h2>
          <p className="font-body text-base text-[hsl(var(--text-secondary))] mt-4 max-w-xl mx-auto">
            Not experimental algorithms. Not drafts. AEGIS implements all three finalized NIST post-quantum cryptography standards — production-ready, globally standardized.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {standards.map((s, i) => (
            <motion.div
              key={s.code}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-white border border-[hsl(var(--border-default))] rounded-[14px] p-7"
            >
              <div className="font-mono text-2xl text-brand-primary font-bold mb-2">{s.code}</div>
              <h3 className="font-body font-bold text-lg text-foreground mb-3">{s.name}</h3>
              <p className="font-body text-sm text-[hsl(var(--text-secondary))] leading-[1.7] mb-5">{s.desc}</p>
              <div className="flex flex-wrap gap-2">
                {s.tags.map((tag) => (
                  <span key={tag} className="font-mono text-xs bg-brand-primary/[0.07] text-brand-primary px-2.5 py-1 rounded-md">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NistStandards;
