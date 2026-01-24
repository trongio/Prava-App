import { usePage } from '@inertiajs/react';
import { ChevronRight, LogOut } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { logout } from '@/routes/auth';
import type { SharedData } from '@/types';

import { HapticToggle } from './haptic-toggle';
import { LicenseTypeSelector } from './license-selector';
import { ThemeToggle } from './theme-toggle';

type SettingsView = 'main' | 'profile';

interface MainViewProps {
    user: SharedData['auth']['user'];
    onNavigate: (view: SettingsView) => void;
    onClose: () => void;
}

export function MainView({ user, onNavigate }: MainViewProps) {
    const { licenseTypes } = usePage<SharedData>().props;

    const handleLogout = () => {
        window.location.href = logout.url();
    };

    return (
        <div className="flex h-full flex-col">
            <SheetHeader className="flex-row items-center gap-3 border-b px-4 pb-4 pl-14">
                <SheetTitle className="text-xl">პარამეტრები</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
                {/* User profile card */}
                <button
                    type="button"
                    onClick={() => onNavigate('profile')}
                    className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                >
                    <Avatar className="h-14 w-14">
                        {user.profile_image_url ? (
                            <AvatarImage
                                src={user.profile_image_url}
                                alt={user.name}
                            />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-lg text-primary">
                            {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-medium">
                            {user.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            პროფილის რედაქტირება
                        </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>

                {/* License type selector */}
                <div className="border-t px-4 py-4">
                    <LicenseTypeSelector
                        licenseTypes={licenseTypes}
                        selectedId={user.default_license_type_id}
                        userName={user.name}
                    />
                </div>

                {/* Theme section */}
                <div className="border-t px-4 py-4">
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                        თემა
                    </h4>
                    <ThemeToggle />
                </div>

                {/* Haptic feedback toggle */}
                <div className="border-t px-4 py-4">
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                        შეტყობინებები
                    </h4>
                    <HapticToggle />
                </div>
            </div>

            {/* Logout button */}
            <div className="border-t p-4">
                <Button
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={handleLogout}
                >
                    <LogOut className="h-5 w-5" />
                    გასვლა
                </Button>
            </div>
        </div>
    );
}
