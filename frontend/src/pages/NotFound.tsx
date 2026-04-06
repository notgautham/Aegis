import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="w-8 h-8 text-accent-amber fill-accent-amber/20" />
          <span className="font-mono text-xl font-bold text-brand-primary">AEGIS</span>
        </div>
        <h1 className="font-display text-6xl italic text-brand-primary">404</h1>
        <p className="font-body text-lg text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/dashboard">
            <Button className="text-xs">Go to Dashboard</Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="text-xs">Landing Page</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
