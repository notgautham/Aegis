import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 lg:px-12 transition-all duration-300 ${
        scrolled
          ? 'bg-surface/80 backdrop-blur-xl border-b border-[hsl(var(--border-default))]'
          : 'bg-surface border-b border-[hsl(var(--border-default))]'
      }`}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <img src="/logo.jpeg" alt="Aegis" className="w-6 h-6 rounded" />
        <div className="flex flex-col">
          <span className="font-body font-bold text-lg text-brand-primary leading-tight tracking-tight">AEGIS</span>
          <span className="font-mono text-[10px] text-muted-foreground leading-none">by Punjab National Bank</span>
        </div>
      </div>

      {/* Center: Nav links */}
      <div className="hidden md:flex items-center gap-8">
        {[
          { label: 'Platform', id: 'capabilities' },
          { label: 'Pipeline', id: 'pipeline' },
          { label: 'Standards', id: 'standards' },
          { label: 'Security', id: 'problem' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => scrollToSection(item.id)}
            className="font-body text-sm text-[hsl(var(--text-secondary))] hover:text-brand-primary transition-colors duration-200"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Right: CTAs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => scrollToSection('standards')}
          className="hidden sm:block font-body text-sm text-[hsl(var(--text-secondary))] border border-[hsl(var(--border-default))] px-4 py-2 rounded-lg hover:bg-sunken transition-colors"
        >
          Documentation
        </button>
        <Link
          to="/login"
          className="font-body text-sm font-bold bg-accent-amber text-brand-primary px-4 py-2 rounded-lg hover:brightness-105 transition-all"
        >
          Sign In →
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
