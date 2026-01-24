import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

import type { SharedData } from '@/types';

import { MainView } from './settings/main-view';
import { ProfileView } from './settings/profile-view';
import { Sheet, SheetContent } from './ui/sheet';

interface SettingsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type SettingsView = 'main' | 'profile';

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const [currentView, setCurrentView] = useState<SettingsView>('main');
    const historyDepthRef = useRef(0);
    const currentViewRef = useRef<SettingsView>('main');

    // Keep ref in sync with state
    useEffect(() => {
        currentViewRef.current = currentView;
    }, [currentView]);

    // Track open state in ref for Inertia event handler
    const openRef = useRef(open);
    useEffect(() => {
        openRef.current = open;
    }, [open]);

    // Handle Android back button - only depend on `open`
    useEffect(() => {
        if (!open) {
            historyDepthRef.current = 0;
            return;
        }

        // Push initial state when sheet opens
        window.history.pushState({ settingsSheet: true, view: 'main' }, '');
        historyDepthRef.current = 1;

        // Use Inertia's router events to intercept navigation BEFORE it happens
        const removeBeforeListener = router.on('before', (event) => {
            if (openRef.current) {
                // Only block navigation to a DIFFERENT page, not same-page updates
                const targetUrl = new URL(event.detail.visit.url);
                const currentPath = window.location.pathname;

                // Allow navigation to the same page (e.g., saving settings)
                if (targetUrl.pathname === currentPath) {
                    return;
                }

                // Cancel navigation to different pages and handle like a back button press
                event.preventDefault();
                if (historyDepthRef.current > 0) {
                    historyDepthRef.current--;
                    if (currentViewRef.current !== 'main') {
                        setCurrentView('main');
                    } else {
                        onOpenChange(false);
                    }
                }
                return false;
            }
        });

        // Also handle browser back button via popstate for non-Inertia navigation
        const handlePopState = () => {
            if (historyDepthRef.current <= 0) {
                return;
            }

            historyDepthRef.current--;

            if (currentViewRef.current !== 'main') {
                setCurrentView('main');
            } else {
                onOpenChange(false);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            removeBeforeListener();
            window.removeEventListener('popstate', handlePopState);
        };
    }, [open, onOpenChange]);

    // Navigate to a view and push history state
    const navigateToView = (view: SettingsView) => {
        if (view !== 'main') {
            window.history.pushState({ settingsSheet: true, view }, '');
            historyDepthRef.current++;
        }
        setCurrentView(view);
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setTimeout(() => {
                setCurrentView('main');
            }, 300);
        }
        onOpenChange(newOpen);
    };

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full flex-col p-0"
                hideClose={currentView !== 'main'}
            >
                {currentView === 'main' && (
                    <MainView
                        user={user}
                        onNavigate={navigateToView}
                        onClose={() => onOpenChange(false)}
                    />
                )}
                {currentView === 'profile' && (
                    <ProfileView
                        user={user}
                        onBack={() => window.history.back()}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}
