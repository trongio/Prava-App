import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    ClipboardList,
    History,
    Home,
    ImageIcon,
    Settings,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

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
    { id: 'history', label: 'ისტორია', icon: History, href: '/history' },
    { id: 'tickets', label: 'ბილეთები', icon: BookOpen, href: '/questions' },
    { id: 'signs', label: 'ნიშნები', icon: ImageIcon, href: '/signs' },
];

function getActiveTab(path: string): string {
    if (path.startsWith('/dashboard') || path === '/') return 'home';
    if (path.startsWith('/test')) return 'test';
    if (path.startsWith('/history')) return 'history';
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
            <main className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                {children}
            </main>

            {/* Bottom Navigation - uses safe area inset */}
            <nav className="flex-none border-t bg-background/95 pb-[var(--inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center justify-around">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.id}
                                href={item.href}
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
        </div>
    );
}
