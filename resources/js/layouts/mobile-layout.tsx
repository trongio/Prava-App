import { Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    ClipboardList,
    History,
    Home,
    ImageIcon,
    Settings,
} from 'lucide-react';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { SettingsSheet } from '@/components/settings-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
    children: ReactNode;
    title?: string;
    showBackButton?: boolean;
}

const navItems = [
    { id: 'home', label: 'მთავარი', icon: Home, href: '/dashboard' },
    { id: 'test', label: 'ტესტი', icon: ClipboardList, href: '/test' },
    { id: 'history', label: 'ისტორია', icon: History, href: '/test/history' },
    { id: 'tickets', label: 'ბილეთები', icon: BookOpen, href: '/questions' },
    { id: 'signs', label: 'ნიშნები', icon: ImageIcon, href: '/signs' },
];

function getActiveTab(path: string): string {
    if (path.startsWith('/dashboard') || path === '/') return 'home';
    if (path.startsWith('/test/history')) return 'history';
    if (path.startsWith('/test')) return 'test';
    if (path.startsWith('/questions') || path.startsWith('/tickets'))
        return 'tickets';
    if (path.startsWith('/signs')) return 'signs';
    return 'home';
}

export default function MobileLayout({
    children,
    title = 'მართვის მოწმობა',
}: MobileLayoutProps) {
    const { url } = usePage();
    const activeTab = getActiveTab(url);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showExitToast, setShowExitToast] = useState(false);
    const exitPressedRef = useRef(false);
    const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isOnDashboard = activeTab === 'home';

    // Handle back button for "press again to exit" behavior
    const handleBackButton = useCallback(() => {
        if (!isOnDashboard) {
            // Not on dashboard - navigate to dashboard
            router.visit('/dashboard');
            return;
        }

        // On dashboard - check if this is second press
        if (exitPressedRef.current) {
            // Second press - allow app to close (don't prevent)
            return true;
        }

        // First press on dashboard - show toast
        exitPressedRef.current = true;
        setShowExitToast(true);

        // Clear previous timeout
        if (exitTimeoutRef.current) {
            clearTimeout(exitTimeoutRef.current);
        }

        // Reset after 2 seconds
        exitTimeoutRef.current = setTimeout(() => {
            exitPressedRef.current = false;
            setShowExitToast(false);
        }, 2000);

        return false;
    }, [isOnDashboard]);

    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            // Check if another component (like SignPreview) already handled this
            const win = window as Window & { __backHandled?: boolean };
            if (win.__backHandled) {
                win.__backHandled = false;
                return;
            }

            const shouldClose = handleBackButton();
            if (!shouldClose) {
                e.preventDefault();
                window.history.pushState(null, '', window.location.href);
            }
        };

        // Push initial state
        window.history.pushState(null, '', window.location.href);

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            if (exitTimeoutRef.current) {
                clearTimeout(exitTimeoutRef.current);
            }
        };
    }, [handleBackButton]);

    return (
        <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
            {/* Top Bar - uses safe area inset for status bar */}
            <header className="flex h-[calc(var(--inset-top)+3.5rem)] flex-none items-center justify-between border-b bg-background/95 pt-[var(--inset-top)] pr-[calc(var(--inset-right)+1rem)] pl-[calc(var(--inset-left)+1rem)] backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <h1 className="text-lg font-semibold">{title}</h1>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSettingsOpen(true)}
                >
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">პარამეტრები</span>
                </Button>
            </header>

            {/* Settings Sheet */}
            <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />

            {/* Main Content - scrollable area */}
            <main
                id="main-scroll-container"
                className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
            >
                {children}
            </main>

            {/* Bottom Navigation - uses safe area inset */}
            <nav className="flex-none border-t bg-background/95 pb-[var(--inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center justify-around">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        // Dashboard and test pages need fresh data (activeTest), so don't cache them
                        const shouldCache =
                            item.id !== 'home' && item.id !== 'test';

                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                prefetch={shouldCache ? 'mount' : undefined}
                                cacheFor={shouldCache ? '5m' : undefined}
                                className={cn(
                                    'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors',
                                    isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Icon
                                    className={cn(
                                        'h-5 w-5',
                                        isActive && 'text-primary',
                                    )}
                                />
                                <span className={cn(isActive && 'font-medium')}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Exit Toast */}
            <div
                className={cn(
                    'pointer-events-none fixed inset-x-0 z-50 flex justify-center transition-all duration-300',
                    showExitToast
                        ? 'translate-y-0 opacity-100'
                        : 'translate-y-4 opacity-0',
                )}
                style={{ bottom: 'calc(5rem + var(--inset-bottom, 0px))' }}
            >
                <div className="rounded-full bg-foreground/90 px-4 py-2 text-sm text-background shadow-lg">
                    გასასვლელად კიდევ ერთხელ დააჭირეთ უკან
                </div>
            </div>
        </div>
    );
}
