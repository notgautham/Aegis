import { useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const PageNavButtons = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navHistory = useRef<string[]>([]);
  const navPointer = useRef<number>(-1);
  const isNavAction = useRef(false);

  useEffect(() => {
    const path = location.pathname + location.search;

    if (isNavAction.current) {
      isNavAction.current = false;
      return;
    }

    // If current pointer path is the same, skip
    if (navPointer.current >= 0 && navHistory.current[navPointer.current] === path) return;

    // Truncate forward history and push
    navHistory.current = navHistory.current.slice(0, navPointer.current + 1);
    navHistory.current.push(path);

    // Cap at 30
    if (navHistory.current.length > 30) {
      navHistory.current = navHistory.current.slice(-30);
    }

    navPointer.current = navHistory.current.length - 1;
  }, [location.pathname, location.search]);

  const canGoBack = navPointer.current > 0;
  const canGoForward = navPointer.current < navHistory.current.length - 1;

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    isNavAction.current = true;
    navPointer.current -= 1;
    navigate(navHistory.current[navPointer.current], { replace: false });
  }, [canGoBack, navigate]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    isNavAction.current = true;
    navPointer.current += 1;
    navigate(navHistory.current[navPointer.current], { replace: false });
  }, [canGoForward, navigate]);

  return (
    <div
      style={{ position: 'fixed', top: '14px', left: '68px', zIndex: 50 }}
      className="flex items-center gap-0.5 bg-[hsl(var(--bg-sunken))] rounded-full p-0.5 border border-border"
    >
      <button
        onClick={goBack}
        disabled={!canGoBack}
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center transition-opacity",
          canGoBack ? "text-muted-foreground hover:text-foreground hover:bg-background" : "opacity-30 cursor-default"
        )}
        title="Back"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-3.5 bg-border" />
      <button
        onClick={goForward}
        disabled={!canGoForward}
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center transition-opacity",
          canGoForward ? "text-muted-foreground hover:text-foreground hover:bg-background" : "opacity-30 cursor-default"
        )}
        title="Forward"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default PageNavButtons;
