import { Transition } from '@headlessui/react';
import { router, useForm, usePage } from '@inertiajs/react';
import {
    Camera,
    ChevronRight,
    LogOut,
    Monitor,
    Moon,
    Sun,
    Trash2,
    User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

import InputError from './input-error';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

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

    // Handle Android back button - only depend on `open`
    useEffect(() => {
        if (!open) {
            historyDepthRef.current = 0;
            return;
        }

        // Push initial state when sheet opens
        window.history.pushState({ settingsSheet: true, view: 'main' }, '');
        historyDepthRef.current = 1;

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
            <SheetContent side="right" className="flex w-full flex-col p-0">
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

// Theme toggle component
function ThemeToggle() {
    const { appearance, updateAppearance } = useAppearance();

    const themes: { value: Appearance; icon: typeof Sun }[] = [
        { value: 'light', icon: Sun },
        { value: 'dark', icon: Moon },
        { value: 'system', icon: Monitor },
    ];

    return (
        <div className="flex gap-2">
            {themes.map(({ value, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => updateAppearance(value)}
                    className={cn(
                        'flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl p-3 transition-all',
                        appearance === value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                    )}
                >
                    <Icon className="h-5 w-5" />
                </button>
            ))}
        </div>
    );
}

// Main settings menu
function MainView({
    user,
    onNavigate,
}: {
    user: SharedData['auth']['user'];
    onNavigate: (view: SettingsView) => void;
    onClose: () => void;
}) {
    const handleLogout = () => {
        router.post('/logout');
    };

    return (
        <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-4 pb-4">
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

                {/* Theme section */}
                <div className="border-t px-4 py-4">
                    <ThemeToggle />
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

// Profile editing view with password and delete
function ProfileView({
    user,
    onBack,
    onClose,
}: {
    user: SharedData['auth']['user'];
    onBack: () => void;
    onClose: () => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
    const [showFinalDialog, setShowFinalDialog] = useState(false);

    const profileForm = useForm({
        name: user.name,
        profile_image: null as File | null,
    });

    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const deleteForm = useForm({
        password: '',
    });

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            profileForm.setData('profile_image', file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        profileForm.post('/settings/profile', {
            forceFormData: !!profileForm.data.profile_image,
            preserveScroll: true,
        });
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        passwordForm.put('/settings/password', {
            preserveScroll: true,
            onSuccess: () => {
                passwordForm.reset();
                setShowPasswordForm(false);
            },
            onError: () => {
                passwordForm.reset('password', 'password_confirmation');
            },
        });
    };

    const handleDeleteConfirm = () => {
        if (deleteStep === 0) {
            setDeleteStep(1);
        } else if (deleteStep === 1) {
            setDeleteStep(2);
            setShowFinalDialog(true);
        }
    };

    const handleFinalDelete = () => {
        const hasPassword = user.has_password || user.password !== null;
        if (hasPassword) {
            deleteForm.delete('/settings/profile', {
                onSuccess: () => {
                    setShowFinalDialog(false);
                    onClose();
                },
            });
        } else {
            router.delete('/settings/profile', {
                onSuccess: () => {
                    setShowFinalDialog(false);
                    onClose();
                },
            });
        }
    };

    const displayImage = previewUrl || user.profile_image_url;
    const hasPassword = user.has_password ?? false;

    return (
        <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-4 pb-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="-ml-2"
                    >
                        უკან
                    </Button>
                </div>
                <SheetTitle className="text-xl">პროფილი</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
                {/* Profile form */}
                <form onSubmit={handleProfileSubmit} className="p-4">
                    {/* Avatar upload */}
                    <div className="mb-6 flex flex-col items-center">
                        <div className="relative">
                            <Avatar className="h-24 w-24">
                                {displayImage ? (
                                    <AvatarImage
                                        src={displayImage}
                                        alt={profileForm.data.name}
                                    />
                                ) : null}
                                <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                                    {profileForm.data.name
                                        .slice(0, 2)
                                        .toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm"
                            >
                                <Camera className="h-4 w-4" />
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                        <p className="mt-2 text-sm text-muted-foreground">
                            შეეხეთ ფოტოს შესაცვლელად
                        </p>
                    </div>

                    {/* Name field */}
                    <div className="space-y-2">
                        <Label htmlFor="name">სახელი</Label>
                        <Input
                            id="name"
                            value={profileForm.data.name}
                            onChange={(e) =>
                                profileForm.setData('name', e.target.value)
                            }
                            placeholder="თქვენი სახელი"
                        />
                        <InputError message={profileForm.errors.name} />
                    </div>

                    {/* Save button */}
                    <Button
                        type="submit"
                        className="mt-4 w-full"
                        disabled={profileForm.processing}
                    >
                        {profileForm.processing ? 'იტვირთება...' : 'შენახვა'}
                    </Button>
                    <Transition
                        show={profileForm.recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="mt-2 text-center text-sm text-green-600">
                            შენახულია
                        </p>
                    </Transition>
                </form>

                {/* Password section */}
                <div className="border-t px-4 py-4">
                    <button
                        type="button"
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        className="flex w-full items-center justify-between rounded-lg bg-muted/50 p-3 text-left"
                    >
                        <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">
                                {hasPassword
                                    ? 'პაროლის შეცვლა'
                                    : 'პაროლის დამატება'}
                            </span>
                        </div>
                        <ChevronRight
                            className={cn(
                                'h-5 w-5 text-muted-foreground transition-transform',
                                showPasswordForm && 'rotate-90',
                            )}
                        />
                    </button>

                    {showPasswordForm && (
                        <form
                            onSubmit={handlePasswordSubmit}
                            className="mt-4 space-y-4"
                        >
                            {hasPassword && (
                                <div className="space-y-2">
                                    <Label htmlFor="current_password">
                                        მიმდინარე პაროლი
                                    </Label>
                                    <Input
                                        id="current_password"
                                        type="password"
                                        value={passwordForm.data.current_password}
                                        onChange={(e) =>
                                            passwordForm.setData(
                                                'current_password',
                                                e.target.value,
                                            )
                                        }
                                        autoComplete="current-password"
                                    />
                                    <InputError
                                        message={
                                            passwordForm.errors.current_password
                                        }
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="password">
                                    {hasPassword ? 'ახალი პაროლი' : 'პაროლი'}
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={passwordForm.data.password}
                                    onChange={(e) =>
                                        passwordForm.setData(
                                            'password',
                                            e.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                />
                                <InputError
                                    message={passwordForm.errors.password}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation">
                                    დაადასტურეთ პაროლი
                                </Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={
                                        passwordForm.data.password_confirmation
                                    }
                                    onChange={(e) =>
                                        passwordForm.setData(
                                            'password_confirmation',
                                            e.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                />
                                <InputError
                                    message={
                                        passwordForm.errors
                                            .password_confirmation
                                    }
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={passwordForm.processing}
                            >
                                {passwordForm.processing
                                    ? 'იტვირთება...'
                                    : hasPassword
                                      ? 'პაროლის შეცვლა'
                                      : 'პაროლის დამატება'}
                            </Button>
                        </form>
                    )}
                </div>

                {/* Delete account section */}
                <div className="border-t px-4 py-4">
                    <h4 className="mb-3 text-sm font-medium text-destructive">
                        საშიში ზონა
                    </h4>

                    {deleteStep === 0 ? (
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-3 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleDeleteConfirm}
                        >
                            <Trash2 className="h-5 w-5" />
                            ანგარიშის წაშლა
                        </Button>
                    ) : (
                        <div className="space-y-3 rounded-lg bg-destructive/10 p-4">
                            <p className="text-sm text-destructive">
                                {deleteStep === 1
                                    ? 'ნამდვილად გსურთ ანგარიშის წაშლა? ეს მოქმედება შეუქცევადია.'
                                    : 'ბოლო გაფრთხილება! თქვენი ყველა მონაცემი სამუდამოდ წაიშლება.'}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setDeleteStep(0)}
                                >
                                    გაუქმება
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="flex-1"
                                    onClick={handleDeleteConfirm}
                                >
                                    {deleteStep === 1
                                        ? 'დიახ, წაშლა'
                                        : 'წაშლა სამუდამოდ'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Final confirmation dialog */}
            <Dialog open={showFinalDialog} onOpenChange={setShowFinalDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive">
                            საბოლოო დადასტურება
                        </DialogTitle>
                        <DialogDescription>
                            {hasPassword
                                ? 'შეიყვანეთ პაროლი ანგარიშის წასაშლელად'
                                : 'დააჭირეთ ღილაკს ანგარიშის წასაშლელად'}
                        </DialogDescription>
                    </DialogHeader>

                    {hasPassword && (
                        <div className="space-y-2">
                            <Label htmlFor="delete_password">პაროლი</Label>
                            <Input
                                id="delete_password"
                                type="password"
                                value={deleteForm.data.password}
                                onChange={(e) =>
                                    deleteForm.setData('password', e.target.value)
                                }
                                autoComplete="current-password"
                            />
                            <InputError message={deleteForm.errors.password} />
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowFinalDialog(false);
                                setDeleteStep(0);
                            }}
                        >
                            გაუქმება
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleFinalDelete}
                            disabled={deleteForm.processing}
                        >
                            {deleteForm.processing ? 'იშლება...' : 'წაშლა'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
