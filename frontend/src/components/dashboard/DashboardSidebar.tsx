import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useScanContext } from '@/contexts/ScanContext';
import { usePinnedPages, type PinnedPage } from '@/contexts/PinnedPagesContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Shield, Home, Search, Package, ClipboardList, ShieldCheck,
  Star, Wrench, BarChart3, Settings,
  Globe, Key, FileText, Server, Cpu, Lock, ChevronRight,
  Sparkles, Map, Calendar, PenTool, Terminal, Pin, Clock, LogOut,
} from 'lucide-react';

interface SubMenuItem {
  label: string;
  icon: React.ElementType;
  pinId: string;
  pinRoute: string;
  pinIcon: string;
}

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  pinRoute: string;
  pinIcon: string;
  sub?: SubMenuItem[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: Home, label: 'Dashboard', pinRoute: '/dashboard', pinIcon: 'Home' },
  {
    id: 'discovery', icon: Search, label: 'Asset Discovery', pinRoute: '/dashboard/discovery', pinIcon: 'Search',
    sub: [
      { label: 'Domains', icon: Globe, pinId: 'discovery:domains', pinRoute: '/dashboard/discovery', pinIcon: 'Globe' },
      { label: 'SSL Certificates', icon: Key, pinId: 'discovery:ssl', pinRoute: '/dashboard/discovery?tab=ssl', pinIcon: 'Key' },
      { label: 'IP Subnets', icon: Server, pinId: 'discovery:ip', pinRoute: '/dashboard/discovery?tab=ip', pinIcon: 'Server' },
      { label: 'Software & Services', icon: Cpu, pinId: 'discovery:software', pinRoute: '/dashboard/discovery?tab=software', pinIcon: 'Cpu' },
      { label: 'Network Graph', icon: Globe, pinId: 'discovery:network', pinRoute: '/dashboard/discovery?tab=network', pinIcon: 'Globe' },
      { label: 'Shadow IT', icon: Shield, pinId: 'discovery:shadow', pinRoute: '/dashboard/discovery?tab=shadow', pinIcon: 'Shield' },
    ],
  },
  { id: 'inventory', icon: Package, label: 'Asset Inventory', pinRoute: '/dashboard/inventory', pinIcon: 'Package' },
  {
    id: 'cbom', icon: ClipboardList, label: 'CBOM', pinRoute: '/dashboard/cbom', pinIcon: 'ClipboardList',
    sub: [
      { label: 'Overview', icon: FileText, pinId: 'cbom:overview', pinRoute: '/dashboard/cbom', pinIcon: 'ClipboardList' },
      { label: 'Per-Asset', icon: Cpu, pinId: 'cbom:per-asset', pinRoute: '/dashboard/cbom/per-asset', pinIcon: 'Cpu' },
      { label: 'Export Center', icon: Package, pinId: 'cbom:export', pinRoute: '/dashboard/cbom/export', pinIcon: 'Package' },
    ],
  },
  {
    id: 'pqc', icon: ShieldCheck, label: 'PQC Posture', pinRoute: '/dashboard/pqc/compliance', pinIcon: 'ShieldCheck',
    sub: [
      { label: 'Compliance', icon: FileText, pinId: 'pqc:compliance', pinRoute: '/dashboard/pqc/compliance', pinIcon: 'ShieldCheck' },
      { label: 'HNDL Intel', icon: Lock, pinId: 'pqc:hndl', pinRoute: '/dashboard/pqc/hndl', pinIcon: 'Lock' },
      { label: 'Quantum Debt', icon: BarChart3, pinId: 'pqc:quantum-debt', pinRoute: '/dashboard/pqc/quantum-debt', pinIcon: 'BarChart3' },
    ],
  },
  {
    id: 'rating', icon: Star, label: 'Cyber Rating', pinRoute: '/dashboard/rating/enterprise', pinIcon: 'Star',
    sub: [
      { label: 'Enterprise Score', icon: Star, pinId: 'rating:enterprise', pinRoute: '/dashboard/rating/enterprise', pinIcon: 'Star' },
      { label: 'Per-Asset', icon: FileText, pinId: 'rating:per-asset', pinRoute: '/dashboard/rating/per-asset', pinIcon: 'FileText' },
    ],
  },
  {
    id: 'remediation', icon: Wrench, label: 'Remediation Center', pinRoute: '/dashboard/remediation/action-plan', pinIcon: 'Wrench',
    sub: [
      { label: 'Action Plan', icon: ClipboardList, pinId: 'remediation:action-plan', pinRoute: '/dashboard/remediation/action-plan', pinIcon: 'Wrench' },
      { label: 'AI Patch Generator', icon: Sparkles, pinId: 'remediation:ai-patch', pinRoute: '/dashboard/remediation/ai-patch', pinIcon: 'Sparkles' },
      { label: 'Migration Roadmap', icon: Map, pinId: 'remediation:roadmap', pinRoute: '/dashboard/remediation/roadmap', pinIcon: 'Map' },
    ],
  },
  {
    id: 'reporting', icon: BarChart3, label: 'Reporting', pinRoute: '/dashboard/reporting/executive', pinIcon: 'BarChart3',
    sub: [
      { label: 'Executive Reports', icon: FileText, pinId: 'reporting:executive', pinRoute: '/dashboard/reporting/executive', pinIcon: 'BarChart3' },
      { label: 'Scheduled Reports', icon: Calendar, pinId: 'reporting:scheduled', pinRoute: '/dashboard/reporting/scheduled', pinIcon: 'Calendar' },
      { label: 'On-Demand Builder', icon: PenTool, pinId: 'reporting:on-demand', pinRoute: '/dashboard/reporting/on-demand', pinIcon: 'PenTool' },
    ],
  },
  { id: 'scan-console', icon: Terminal, label: 'Scan Console', pinRoute: '/dashboard/scan-console', pinIcon: 'Terminal' },
  { id: 'history', icon: Clock, label: 'Scan History', pinRoute: '/dashboard/history', pinIcon: 'Clock' },
];

const sidebarVariants = {
  open: { width: '15rem' },
  closed: { width: '3.05rem' },
};

const transitionProps = {
  type: 'tween' as const,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
  duration: 0.25,
};

interface DashboardSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const DashboardSidebar = ({ activeItem, onItemClick }: DashboardSidebarProps) => {
  const { rootDomain } = useScanContext();
  const navigate = useNavigate();
  const { isPinned, togglePin } = usePinnedPages();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);
  const isOverSubmenuRef = useRef(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSubmenu = useMemo(
    () => navItems.find((item) => item.id === openSubmenuId && item.sub),
    [openSubmenuId],
  );

  const cancelCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const closeSubmenu = useCallback(() => {
    setOpenSubmenuId(null);
    setSubmenuPosition(null);
    isOverSubmenuRef.current = false;
    cancelCloseTimeout();
  }, [cancelCloseTimeout]);

  const scheduleClose = useCallback(() => {
    cancelCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      if (!isOverSubmenuRef.current) {
        closeSubmenu();
        setIsCollapsed(true);
      }
    }, 400);
  }, [closeSubmenu, cancelCloseTimeout]);

  const setSubmenuAnchor = (target: HTMLButtonElement, subItemsCount: number) => {
    const rect = target.getBoundingClientRect();
    const estimatedHeight = subItemsCount * 40 + 34;
    const top = Math.max(10, Math.min(rect.top, window.innerHeight - estimatedHeight - 10));
    setSubmenuPosition({ top, left: 240 + 8 });
  };

  const handleNavItemClick = (item: NavItem) => {
    onItemClick(item.id);
    if (!item.sub) closeSubmenu();
  };

  const handleNavItemHover = (item: NavItem, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (item.sub) {
      setSubmenuAnchor(event.currentTarget, item.sub.length);
      setOpenSubmenuId(item.id);
    } else {
      closeSubmenu();
    }
  };

  const handlePinTopLevel = (e: ReactMouseEvent, item: NavItem) => {
    e.stopPropagation();
    const page: PinnedPage = {
      id: item.id,
      label: item.label,
      route: item.pinRoute,
      icon: item.pinIcon,
    };
    togglePin(page);
  };

  const handlePinSub = (e: ReactMouseEvent, parentItem: NavItem, sub: SubMenuItem) => {
    e.stopPropagation();
    const page: PinnedPage = {
      id: sub.pinId,
      label: sub.label,
      route: sub.pinRoute,
      icon: sub.pinIcon,
    };
    togglePin(page);
  };

  useEffect(() => {
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-sidebar-root]') || target.closest('[data-sidebar-submenu]')) return;
      closeSubmenu();
      setIsCollapsed(true);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeSubmenu(); setIsCollapsed(true); }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeSubmenu);
    window.addEventListener('scroll', closeSubmenu, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeSubmenu);
      window.removeEventListener('scroll', closeSubmenu, true);
    };
  }, []);

  return (
    <motion.div
      data-sidebar-root
      className="fixed left-0 top-0 h-screen z-[60] flex flex-col overflow-visible"
      variants={sidebarVariants}
      animate={isCollapsed ? 'closed' : 'open'}
      transition={transitionProps}
      onMouseEnter={() => { cancelCloseTimeout(); setIsCollapsed(false); }}
      onMouseLeave={() => { openSubmenuId ? scheduleClose() : setIsCollapsed(true); }}
      style={{
        background: 'hsl(var(--bg-surface))',
        borderRight: '1px solid hsl(var(--border-default))',
      }}
    >
      {/* Logo */}
      <div className="px-2.5 py-3 flex items-center gap-2 h-14 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 min-w-[24px]">
          <img src="/logo.jpeg" alt="Aegis" className="w-5 h-5 rounded flex-shrink-0" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="font-mono text-sm font-semibold text-brand-primary whitespace-nowrap"
              >AEGIS</motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      <Separator className="mx-1" />

      {/* Nav items */}
      <ScrollArea className="flex-1 py-2 overflow-visible">
        <nav className="px-1.5 space-y-0.5 overflow-visible">
          {navItems.map((item) => {
            const isActive = activeItem === item.id;
            const Icon = item.icon;
            const pinned = isPinned(item.id);

            return (
              <div key={item.id} className="relative group/nav">
                <button
                  data-sidebar-menu-button
                  onClick={() => handleNavItemClick(item)}
                  onMouseEnter={(event) => handleNavItemHover(item, event)}
                  className={cn(
                    'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors text-sm',
                    isActive
                      ? 'bg-brand-primary/10 text-brand-primary font-medium'
                      : 'text-foreground/70 hover:bg-sunken hover:text-foreground'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-accent-amber')} />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="font-body whitespace-nowrap flex-1"
                      >{item.label}</motion.span>
                    )}
                  </AnimatePresence>
                  {/* Pin icon - visible on hover when expanded */}
                  {!isCollapsed && (
                    <button
                      onClick={(e) => handlePinTopLevel(e as any, item)}
                      className={cn(
                        'p-0.5 rounded transition-all',
                        pinned
                          ? 'text-accent-amber opacity-100'
                          : 'text-muted-foreground/40 opacity-0 group-hover/nav:opacity-100 hover:text-accent-amber'
                      )}
                      title={pinned ? 'Unpin from dock' : 'Pin to dock'}
                    >
                      <Pin className={cn('w-3 h-3', pinned && 'fill-accent-amber/30')} />
                    </button>
                  )}
                  {!isCollapsed && item.sub && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Submenu portal */}
      {openSubmenu && submenuPosition && createPortal(
        <AnimatePresence>
          <motion.div
            key={openSubmenuId}
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed z-[9999]"
            style={{ top: submenuPosition.top, left: submenuPosition.left }}
            onMouseEnter={() => { isOverSubmenuRef.current = true; cancelCloseTimeout(); }}
            onMouseLeave={() => { isOverSubmenuRef.current = false; scheduleClose(); }}
          >
            <div
              data-sidebar-submenu
              className="bg-popover rounded-xl border border-border overflow-hidden min-w-[180px] py-1 shadow-[0_20px_48px_-28px_hsl(var(--brand-primary)/0.5)]"
            >
              <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {openSubmenu.label}
              </div>
              {openSubmenu.sub?.map((sub, index) => {
                const SubIcon = sub.icon;
                const subPinned = isPinned(sub.pinId);
                return (
                  <motion.div
                    key={sub.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.15 }}
                    className="group/sub flex items-center"
                  >
                    <button
                      onClick={() => {
                        onItemClick(`${openSubmenu.id}:${sub.label.toLowerCase()}`);
                        closeSubmenu();
                      }}
                      className="flex-1 flex items-center gap-2.5 px-3 py-2 text-sm font-body text-foreground/80 hover:bg-sunken hover:text-foreground transition-colors text-left"
                    >
                      <SubIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      {sub.label}
                    </button>
                    <button
                      onClick={(e) => handlePinSub(e as any, openSubmenu, sub)}
                      className={cn(
                        'p-1 mr-2 rounded transition-all',
                        subPinned
                          ? 'text-accent-amber opacity-100'
                          : 'text-muted-foreground/40 opacity-0 group-hover/sub:opacity-100 hover:text-accent-amber'
                      )}
                      title={subPinned ? 'Unpin from dock' : 'Pin to dock'}
                    >
                      <Pin className={cn('w-3 h-3', subPinned && 'fill-accent-amber/30')} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}

      <Separator className="mx-1" />

      {/* Bottom: Settings + User */}
      <div className="px-1.5 py-2 space-y-0.5">
        <div className="relative group/nav">
          <button
            onClick={() => onItemClick('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors text-sm',
              activeItem === 'settings'
                ? 'bg-brand-primary/10 text-brand-primary font-medium'
                : 'text-foreground/70 hover:bg-sunken hover:text-foreground'
            )}
          >
            <Settings className={cn('w-4 h-4 flex-shrink-0', activeItem === 'settings' && 'text-accent-amber')} />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="font-body whitespace-nowrap flex-1"
                >Settings</motion.span>
              )}
            </AnimatePresence>
            {!isCollapsed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin({ id: 'settings', label: 'Settings', route: '/dashboard/settings/scan-config', icon: 'Settings' });
                }}
                className={cn(
                  'p-0.5 rounded transition-all',
                  isPinned('settings')
                    ? 'text-accent-amber opacity-100'
                    : 'text-muted-foreground/40 opacity-0 group-hover/nav:opacity-100 hover:text-accent-amber'
                )}
              >
                <Pin className={cn('w-3 h-3', isPinned('settings') && 'fill-accent-amber/30')} />
              </button>
            )}
          </button>
        </div>

        <div className={cn(
          'w-full flex items-center py-2 rounded-lg',
          isCollapsed ? 'justify-center' : 'gap-3 px-2.5'
        )}>
          <Avatar className={cn('h-7 w-7 flex-shrink-0', isCollapsed && 'mx-auto')}>
            <AvatarFallback className="bg-brand-primary text-accent-amber text-xs font-mono">A</AvatarFallback>
          </Avatar>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-body font-medium text-foreground truncate">Admin</p>
                <p className="text-[10px] font-body text-muted-foreground truncate">admin@{rootDomain || 'target.com'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sign Out */}
        <button
          onClick={() => { localStorage.removeItem('aegis-auth'); navigate('/landing'); }}
          className={cn(
            'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors text-sm text-foreground/70 hover:bg-[hsl(var(--status-critical)/0.08)] hover:text-[hsl(var(--status-critical))]',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="font-body whitespace-nowrap">
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  );
};

export default DashboardSidebar;
