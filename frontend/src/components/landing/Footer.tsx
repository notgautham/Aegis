const Footer = () => {
  return (
    <footer className="bg-brand-primary border-t border-white/[0.08] py-10 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left */}
        <div>
          <div className="font-body font-extrabold text-xl text-accent-amber mb-1">AEGIS</div>
          <p className="font-body text-[13px] text-white/50">
            Quantum-Aware Cryptographic Intelligence for Banking Infrastructure
          </p>
          <p className="font-mono text-[11px] text-white/30 mt-2">Production-ready cryptographic posture platform</p>
        </div>

        {/* Right */}
        <div className="text-right space-y-1">
          <p className="font-body text-[13px] text-white/40">
            NIST FIPS 203 · NIST FIPS 204 · NIST FIPS 205
          </p>
          <p className="font-body text-[13px] text-white/40">
            CycloneDX 1.7 · Ed25519 Attestation
          </p>
          <p className="font-body text-[13px] text-white/40">
            Platform · Pipeline · Standards · Documentation
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
