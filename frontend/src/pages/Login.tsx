import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const cryptoFragments = [
  'ML-KEM-768', 'RSA-2048', 'ECDHE-P384', 'SHA-256', 'AES-256-GCM',
  'ML-DSA-65', 'SLH-DSA-128s', 'X25519', 'FIPS 203', 'FIPS 204',
  '0xA1B2C3D4', '0xDEADBEEF', '0x7F3E2A1B', 'NIST PQC', 'TLS 1.3',
  'CHACHA20', 'POLY1305', 'HKDF', 'CRYSTALS-Kyber', 'SPHINCS+',
  '0xCAFEBABE', 'Ed25519', 'Dilithium', 'Falcon-512', 'SHAKE-256',
];

const FloatingFragment = ({ text, delay, x }: { text: string; delay: number; x: number }) => (
  <motion.span
    className="absolute font-mono text-[11px] text-white/[0.06] whitespace-nowrap select-none pointer-events-none"
    style={{ left: `${x}%` }}
    initial={{ opacity: 0, y: '100vh' }}
    animate={{ opacity: [0, 0.08, 0.08, 0], y: [0, -800] }}
    transition={{ duration: 18 + Math.random() * 10, delay, repeat: Infinity, ease: 'linear' }}
  >
    {text}
  </motion.span>
);

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (email.includes('aegis') && password === 'aegis2026') {
      localStorage.setItem('aegis-auth', 'true');
      navigate('/dashboard');
    } else {
      setError('Invalid credentials. Use the demo credentials below.');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — animated dark panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden" style={{ background: 'hsl(var(--brand-primary))' }}>
        {cryptoFragments.map((text, i) => (
          <FloatingFragment key={i} text={text} delay={i * 0.7} x={5 + (i * 3.7) % 90} />
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <img src="/logo.jpeg" alt="Aegis" className="w-16 h-16 rounded-xl mb-6 mx-auto" />
            <h2 className="font-display text-4xl italic text-white text-center mb-3">Quantum-Safe Banking</h2>
            <p className="font-body text-sm text-white/50 text-center max-w-sm">
              Protecting financial infrastructure against quantum computing threats with NIST-compliant post-quantum cryptography.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 lg:max-w-[520px] flex flex-col" style={{ background: 'hsl(258 38% 12%)' }}>
        {/* Institution strip */}
        <div className="px-8 py-3 text-center border-b border-white/5">
          <span className="font-mono text-[10px] text-white/30 tracking-wider">AEGIS · Quantum Cryptographic Intelligence Platform</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-8">
          <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Logo + Tagline */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <img src="/logo.jpeg" alt="Aegis" className="w-8 h-8 rounded" />
                <h1 className="font-mono text-3xl font-bold text-white tracking-wide">AEGIS</h1>
              </div>
              <p className="font-body text-xs text-white/40 leading-relaxed">
                Quantum Cryptographic Intelligence for Indian Banking Infrastructure
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="font-body text-xs text-white/50 mb-1.5 block">Email / Username</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@aegis.bank"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11"
                />
              </div>
              <div>
                <label className="font-body text-xs text-white/50 mb-1.5 block">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={remember}
                    onClick={() => setRemember((value) => !value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      remember
                        ? 'bg-[hsl(var(--brand-primary))] border-[hsl(var(--brand-primary))]'
                        : 'bg-white/10 border-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        remember ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="font-body text-xs text-white/70">Remember me</span>
                </div>
                <button type="button" className="font-body text-xs text-accent-amber/70 hover:text-accent-amber">
                  Forgot Password?
                </button>
              </div>

              {error && (
                <p className="font-body text-xs text-[hsl(var(--status-critical))] bg-[hsl(var(--status-critical)/0.1)] px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-body font-semibold text-sm"
                style={{ background: 'hsl(var(--brand-crimson))', color: 'hsl(var(--accent-amber))' }}
              >
                Sign In
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-5 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="font-mono text-[10px] text-white/30 mb-1.5">DEMO CREDENTIALS</p>
              <p className="font-mono text-xs text-white/50">demo@aegis.bank <span className="text-white/20">/</span> aegis2026</p>
            </div>
          </motion.div>
        </div>

        {/* Bottom strip */}
        <div className="px-8 py-3 text-center border-t border-white/5">
          <span className="font-mono text-[10px] text-white/20">AEGIS Platform · NIST FIPS 203/204/205 Compliant</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
