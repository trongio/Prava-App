import { Transition } from '@headlessui/react';
import { router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Camera,
    Check,
    ChevronRight,
    ImagePlus,
    LogOut,
    Monitor,
    Moon,
    Sun,
    Trash2,
    User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// NativePHP imports for camera access
import { camera, Events, isMobile, off, on, secureStorage } from '#nativephp';
import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { logout } from '@/routes/auth';
import { type LicenseType, type SharedData } from '@/types';

import InputError from './input-error';
import { getLicenseTypeIcon } from './license-type-select';
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

// License type selector for settings
function LicenseTypeSelector({
    licenseTypes,
    selectedId,
    userName,
}: {
    licenseTypes: LicenseType[];
    selectedId: number | null | undefined;
    userName: string;
}) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSelect = (id: number) => {
        if (id === selectedId) return;

        setSaving(true);
        setSaved(false);

        router.post(
            '/settings/profile',
            {
                name: userName,
                default_license_type_id: id,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSaving(false);
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                },
                onError: () => {
                    setSaving(false);
                },
            },
        );
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">
                    კატეგორია
                </h4>
                {saving && (
                    <span className="text-xs text-muted-foreground">
                        ინახება...
                    </span>
                )}
                {saved && (
                    <span className="text-xs text-green-600">შენახულია</span>
                )}
            </div>
            <div className="grid grid-cols-4 gap-2">
                {licenseTypes.map((lt) => {
                    const isSelected = lt.id === selectedId;
                    const childCodes =
                        lt.children && lt.children.length > 0
                            ? lt.children.map((c) => c.code).join(', ')
                            : null;

                    return (
                        <button
                            key={lt.id}
                            type="button"
                            onClick={() => handleSelect(lt.id)}
                            disabled={saving}
                            className={cn(
                                'relative flex flex-col items-center justify-center gap-1 rounded-xl p-3 transition-all',
                                isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                                saving && 'opacity-50',
                            )}
                        >
                            {getLicenseTypeIcon(
                                lt.code,
                                cn(
                                    'h-5 w-5',
                                    isSelected && 'text-primary-foreground',
                                ),
                            )}
                            <span className="text-xs font-medium">
                                {lt.code}
                            </span>
                            {childCodes && (
                                <span className="text-[10px] opacity-70">
                                    {childCodes}
                                </span>
                            )}
                            {isSelected && (
                                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                                    <Check className="h-3 w-3 text-white" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
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
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [nativeImagePath, setNativeImagePath] = useState<string | null>(null);
    const [imageSaved, setImageSaved] = useState(false);
    const [savingImage, setSavingImage] = useState(false);

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

    // Auto-save image to server using API (same pattern as registration)
    const saveImage = async (file: File | null, base64Data: string | null) => {
        setSavingImage(true);
        setImageSaved(false);

        try {
            const isNative = await isMobile();
            console.log('Settings: saveImage - isNative:', isNative);

            if (isNative && base64Data) {
                // Use API with Sanctum token (like registration does)
                console.log('Settings: Saving via API with token...');
                const token = await secureStorage.get('auth_token');
                console.log('Settings: Got token:', token ? 'yes' : 'no');

                const response = await fetch('/api/profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        name: user.name,
                        profile_image_base64: base64Data,
                    }),
                });

                const data = await response.json();
                console.log('Settings: API response:', response.status, data);

                if (response.ok && data.success) {
                    console.log('Settings: Image saved successfully via API');
                    setSavingImage(false);
                    setImageSaved(true);
                    setTimeout(() => setImageSaved(false), 3000);
                } else {
                    console.error('Settings: API save error:', data);
                    setSavingImage(false);
                }
            } else {
                // Web: Use Inertia router (works with session auth)
                console.log('Settings: Saving via Inertia router...');
                if (base64Data) {
                    router.post(
                        '/settings/profile',
                        {
                            name: user.name,
                            profile_image_base64: base64Data,
                        },
                        {
                            preserveScroll: true,
                            preserveState: true,
                            onSuccess: () => {
                                console.log(
                                    'Settings: Image saved successfully via Inertia',
                                );
                                setSavingImage(false);
                                setImageSaved(true);
                                setTimeout(() => setImageSaved(false), 3000);
                            },
                            onError: (errors) => {
                                console.error(
                                    'Settings: Inertia save error:',
                                    errors,
                                );
                                setSavingImage(false);
                            },
                        },
                    );
                } else if (file) {
                    const formData = new FormData();
                    formData.append('name', user.name);
                    formData.append('profile_image', file);

                    router.post('/settings/profile', formData, {
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: () => {
                            console.log(
                                'Settings: File saved successfully via Inertia',
                            );
                            setSavingImage(false);
                            setImageSaved(true);
                            setTimeout(() => setImageSaved(false), 3000);
                        },
                        onError: (errors) => {
                            console.error(
                                'Settings: Inertia file save error:',
                                errors,
                            );
                            setSavingImage(false);
                        },
                    });
                }
            }
        } catch (error) {
            console.error('Settings: saveImage error:', error);
            setSavingImage(false);
        }
    };

    // Convert native file to base64 data URL for preview (GET to avoid NativePHP POST interception)
    const loadNativeFilePreview = async (path: string) => {
        try {
            console.log('Settings: Loading preview for:', path);
            const url = `/native-file/preview?path=${encodeURIComponent(path)}`;
            const response = await fetch(url);

            const data = await response.json();
            console.log(
                'Settings: Preview response received, dataUrl length:',
                data.dataUrl?.length,
            );

            if (data.dataUrl) {
                console.log(
                    'Settings: Setting base64 preview and nativeImagePath',
                );
                setNativeImagePath(path);
                setPreviewUrl(data.dataUrl);
                console.log('Settings: previewUrl state updated');
                profileForm.setData('profile_image', null);
                // Auto-save the native image using base64 data
                saveImage(null, data.dataUrl);
            } else {
                console.error('Settings: Preview failed:', data.error);
            }
        } catch (error) {
            console.error(
                'Settings: Failed to load native file preview:',
                error,
            );
        }
    };

    // Handle native camera photo capture
    const handleTakePhoto = async () => {
        console.log('Settings: handleTakePhoto called');
        setShowImagePicker(false);
        try {
            console.log('Settings: Calling camera.getPhoto()...');
            await camera.getPhoto().id('settings-photo');
            console.log('Settings: camera.getPhoto() completed');
        } catch (error) {
            console.error('Settings: camera.getPhoto() error:', error);
        }
    };

    // Handle native gallery picker
    const handlePickFromGallery = async () => {
        console.log('Settings: handlePickFromGallery called');
        setShowImagePicker(false);
        try {
            console.log('Settings: Calling camera.pickImages()...');
            await camera.pickImages().images().id('settings-gallery');
            console.log('Settings: camera.pickImages() completed');
        } catch (error) {
            console.error('Settings: camera.pickImages() error:', error);
        }
    };

    // Handle click on avatar - show native picker or file input
    const handleAvatarClick = async () => {
        console.log('Settings: handleAvatarClick called');
        try {
            const isNative = await isMobile();
            console.log('Settings: isMobile() returned:', isNative);

            if (isNative) {
                console.log('Settings: Showing native image picker');
                setShowImagePicker(true);
            } else {
                console.log('Settings: Falling back to file input');
                fileInputRef.current?.click();
            }
        } catch (error) {
            console.error('Settings: isMobile() error:', error);
            // Fallback to file input on error
            fileInputRef.current?.click();
        }
    };

    // Set up NativePHP event listeners for camera and gallery
    useEffect(() => {
        const handlePhotoTaken = (payload: {
            path: string;
            mimeType: string;
            id: string;
        }) => {
            console.log('PhotoTaken event (settings):', payload);
            if (payload.path && payload.id?.startsWith('settings-')) {
                loadNativeFilePreview(payload.path);
            }
        };

        const handleMediaSelected = (payload: {
            success: boolean;
            files: Array<{
                path: string;
                mimeType: string;
                extension: string;
                type: string;
            }>;
            count: number;
        }) => {
            console.log('MediaSelected event (settings):', payload);
            if (payload.success && payload.files && payload.files.length > 0) {
                loadNativeFilePreview(payload.files[0].path);
            }
        };

        // Use Events object if available, fallback to string names
        console.log('Settings: Registering NativePHP event listeners...');
        console.log('Events.Camera.PhotoTaken:', Events?.Camera?.PhotoTaken);
        console.log(
            'Events.Gallery.MediaSelected:',
            Events?.Gallery?.MediaSelected,
        );

        const photoEvent =
            Events?.Camera?.PhotoTaken ||
            'Native\\Mobile\\Events\\Camera\\PhotoTaken';
        const mediaEvent =
            Events?.Gallery?.MediaSelected ||
            'Native\\Mobile\\Events\\Gallery\\MediaSelected';

        on(photoEvent, handlePhotoTaken);
        on(mediaEvent, handleMediaSelected);

        return () => {
            off(photoEvent, handlePhotoTaken);
            off(mediaEvent, handleMediaSelected);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Event listeners set up once on mount; handlers use current refs
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            profileForm.setData('profile_image', file);
            setNativeImagePath(null);
            setPreviewUrl(URL.createObjectURL(file));
            // Auto-save the image
            saveImage(file, null);
        }
    };

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // If we have a native image (indicated by nativeImagePath), send base64 data
        if (nativeImagePath && previewUrl) {
            router.post('/settings/profile', {
                name: profileForm.data.name,
                profile_image_base64: previewUrl,
            });
        } else if (profileForm.data.profile_image) {
            profileForm.post('/settings/profile', {
                forceFormData: true,
                preserveScroll: true,
            });
        } else {
            profileForm.post('/settings/profile', {
                preserveScroll: true,
            });
        }
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

    // Debug: log the display image source
    console.log(
        'Settings: Render - previewUrl:',
        previewUrl ? 'set (base64)' : null,
        'user.profile_image_url:',
        user.profile_image_url,
        'displayImage:',
        displayImage ? 'has value' : 'null',
    );

    return (
        <div className="flex h-full flex-col">
            <SheetHeader className="flex-row items-center gap-3 border-b px-4 pb-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
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
                                onClick={handleAvatarClick}
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
                        <p
                            className={cn(
                                'mt-2 text-sm',
                                imageSaved
                                    ? 'text-green-600'
                                    : savingImage
                                      ? 'text-muted-foreground'
                                      : 'text-muted-foreground',
                            )}
                        >
                            {savingImage
                                ? 'იტვირთება...'
                                : imageSaved
                                  ? 'ფოტო შენახულია'
                                  : 'შეეხეთ ფოტოს შესაცვლელად'}
                        </p>

                        {/* Native Image Picker Modal */}
                        {showImagePicker && (
                            <div
                                className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-4"
                                onClick={() => setShowImagePicker(false)}
                            >
                                <div
                                    className="w-full max-w-sm space-y-2 rounded-t-xl bg-background p-4 pb-8"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <p className="mb-4 text-center text-sm text-muted-foreground">
                                        აირჩიეთ ფოტოს წყარო
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start gap-3"
                                        onClick={handleTakePhoto}
                                    >
                                        <Camera className="h-5 w-5" />
                                        გადაიღეთ ფოტო
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start gap-3"
                                        onClick={handlePickFromGallery}
                                    >
                                        <ImagePlus className="h-5 w-5" />
                                        აირჩიეთ გალერიიდან
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="mt-2 w-full"
                                        onClick={() =>
                                            setShowImagePicker(false)
                                        }
                                    >
                                        გაუქმება
                                    </Button>
                                </div>
                            </div>
                        )}
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
                                        value={
                                            passwordForm.data.current_password
                                        }
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
                                    deleteForm.setData(
                                        'password',
                                        e.target.value,
                                    )
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
