import { Transition } from '@headlessui/react';
import { router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Camera,
    ChevronRight,
    ImagePlus,
    Trash2,
    User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { camera, Events, isMobile, off, on, secureStorage } from '#nativephp';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';

interface ProfileViewProps {
    user: SharedData['auth']['user'];
    onBack: () => void;
    onClose: () => void;
}

export function ProfileView({ user, onBack, onClose }: ProfileViewProps) {
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

            if (isNative && base64Data) {
                const token = await secureStorage.get('auth_token');

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

                if (response.ok && data.success) {
                    setSavingImage(false);
                    setImageSaved(true);
                    setTimeout(() => setImageSaved(false), 3000);
                } else {
                    console.error('Settings: API save error:', data);
                    setSavingImage(false);
                }
            } else {
                // Web: Use Inertia router (works with session auth)
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
                                setSavingImage(false);
                                setImageSaved(true);
                                setTimeout(() => setImageSaved(false), 3000);
                            },
                            onError: () => {
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
                            setSavingImage(false);
                            setImageSaved(true);
                            setTimeout(() => setImageSaved(false), 3000);
                        },
                        onError: () => {
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

    // Convert native file to base64 data URL for preview
    const loadNativeFilePreview = async (path: string) => {
        try {
            const url = `/native-file/preview?path=${encodeURIComponent(path)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.dataUrl) {
                setNativeImagePath(path);
                setPreviewUrl(data.dataUrl);
                profileForm.setData('profile_image', null);
                saveImage(null, data.dataUrl);
            }
        } catch (error) {
            console.error('Settings: Failed to load native file preview:', error);
        }
    };

    // Handle native camera photo capture
    const handleTakePhoto = async () => {
        setShowImagePicker(false);
        try {
            await camera.getPhoto().id('settings-photo');
        } catch (error) {
            console.error('Settings: camera.getPhoto() error:', error);
        }
    };

    // Handle native gallery picker
    const handlePickFromGallery = async () => {
        setShowImagePicker(false);
        try {
            await camera.pickImages().images().id('settings-gallery');
        } catch (error) {
            console.error('Settings: camera.pickImages() error:', error);
        }
    };

    // Handle click on avatar - show native picker or file input
    const handleAvatarClick = async () => {
        try {
            const isNative = await isMobile();
            if (isNative) {
                setShowImagePicker(true);
            } else {
                fileInputRef.current?.click();
            }
        } catch {
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
            if (payload.success && payload.files && payload.files.length > 0) {
                loadNativeFilePreview(payload.files[0].path);
            }
        };

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            profileForm.setData('profile_image', file);
            setNativeImagePath(null);
            setPreviewUrl(URL.createObjectURL(file));
            saveImage(file, null);
        }
    };

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();

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
                                        onClick={() => setShowImagePicker(false)}
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
                                    value={passwordForm.data.password_confirmation}
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
                                        passwordForm.errors.password_confirmation
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
