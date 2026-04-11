import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const HISTORY_MAX_IDX_KEY = 'aegis-history-max-idx';

const PageNavButtons = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [maxIdx, setMaxIdx] = useState<number>(() => {
    const raw = sessionStorage.getItem(HISTORY_MAX_IDX_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });

  const currentIdx = useMemo(() => {
    const value = (window.history.state as { idx?: number } | null)?.idx;
    return typeof value === 'number' ? value : 0;
  }, [location.key]);

  useEffect(() => {
    setMaxIdx((prevMax) => {
      const nextMax = Math.max(prevMax, currentIdx);
      sessionStorage.setItem(HISTORY_MAX_IDX_KEY, String(nextMax));
      return nextMax;
    });
  }, [currentIdx]);

  const canGoBack = currentIdx > 0;
  const canGoForward = currentIdx < maxIdx;

  const goBack = useCallback(() => {
    if (canGoBack) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  }, [canGoBack, navigate]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    navigate(1);
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
