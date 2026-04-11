import { createContext, useContext, useState, ReactNode } from 'react';

interface ScanContextType {
  scannedDomain: string;
  setScannedDomain: (domain: string) => void;
  /** e.g. "aegis.com" → "aegis.com" (root domain) */
  rootDomain: string;
  /** e.g. "aegis.com" → "PNB" or "example.com" → "EXAMPLE" */
  orgLabel: string;
}

function deriveRootDomain(domain: string): string {
  // Strip subdomains: "vpn.aegis.com" → "aegis.com"
  const parts = domain.replace(/^https?:\/\//, '').split('.');
  // Handle TLDs like .co.in, .com.au (2-part TLDs)
  const knownSecondLevel = ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'];
  if (parts.length >= 3 && knownSecondLevel.includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function deriveOrgLabel(domain: string): string {
  const root = deriveRootDomain(domain);
  const name = root.split('.')[0];
  return name.toUpperCase();
}

const ScanContext = createContext<ScanContextType | undefined>(undefined);

export const ScanProvider = ({ children }: { children: ReactNode }) => {
  const [scannedDomain, setScannedDomain] = useState('');

  const rootDomain = scannedDomain ? deriveRootDomain(scannedDomain) : '';
  const orgLabel = scannedDomain ? deriveOrgLabel(scannedDomain) : '';

  return (
    <ScanContext.Provider value={{ scannedDomain, setScannedDomain, rootDomain, orgLabel }}>
      {children}
    </ScanContext.Provider>
  );
};

export const useScanContext = () => {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScanContext must be used within ScanProvider');
  return ctx;
};
