import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Camera, ImagePlus, Lock, Plus, User } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

// NativePHP imports for camera access and secure storage
import { camera, Events, isMobile, off, on, secureStorage } from '#nativephp';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AUTH_TOKEN_KEY = 'auth_token';

interface UserData {
    id: number;
    name: string;
    profile_image_url: string | null;
    has_password: boolean;
}

interface Props {
    users: UserData[];
}

// Color palette based on name for avatar backgrounds
const avatarColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
];

function getAvatarColor(name: string): string {
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// API helper for token-based auth
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(options.headers as Record<string, string>),
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw data;
    }

    return data as T;
}

export default function UserSelection({ users }: Props) {
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [nativeImagePath, setNativeImagePath] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mobile-specific state for API-based auth
    const [isNative, setIsNative] = useState(false);
    const [apiProcessing, setApiProcessing] = useState(false);
    const [apiErrors, setApiErrors] = useState<Record<string, string>>({});

    // Check if running in NativePHP mobile
    useEffect(() => {
        // Try calling isMobile() and catch any errors for web environments
        isMobile()
            .then((result) => {
                console.log('isMobile() result:', result);
                setIsNative(result);
            })
            .catch((error) => {
                console.log('isMobile() error (likely web browser):', error);
                setIsNative(false);
            });
    }, []);

    // Login form - include 'error' for general auth errors from Laravel
    const loginForm = useForm<{
        user_id: number;
        password: string;
        error?: string;
    }>({
        user_id: 0,
        password: '',
    });

    // Registration form
    const registerForm = useForm<{
        name: string;
        password: string;
        profile_image: File | null;
    }>({
        name: '',
        password: '',
        profile_image: null,
    });

    // Local state for API-based forms
    const [loginPassword, setLoginPassword] = useState('');
    const [registerName, setRegisterName] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');

    const handleUserClick = async (user: UserData) => {
        console.log(
            'handleUserClick called, isNative:',
            isNative,
            'user:',
            user,
        );

        if (user.has_password) {
            setSelectedUser(user);
            setLoginPassword('');
            setApiErrors({});
            loginForm.setData('user_id', user.id);
            loginForm.setData('password', '');
            loginForm.clearErrors();
        } else {
            // Direct login for passwordless users
            if (isNative) {
                console.log('Using API login for mobile');
                setApiProcessing(true);
                try {
                    console.log('Calling /api/login...');
                    const response = await apiRequest<{
                        user: UserData;
                        token: string;
                    }>('/login', {
                        method: 'POST',
                        body: JSON.stringify({
                            user_id: user.id,
                            password: '',
                        }),
                    });
                    console.log('API login response:', response);

                    // Store token in SecureStorage
                    console.log('Storing token in SecureStorage...');
                    await secureStorage.set(AUTH_TOKEN_KEY, response.token);
                    console.log('Token stored successfully');

                    // Navigate to dashboard
                    console.log('Navigating to dashboard...');
                    router.visit('/dashboard');
                } catch (error: unknown) {
                    console.error('API login error:', error);
                    const err = error as { errors?: Record<string, string[]> };
                    if (err.errors) {
                        const flatErrors: Record<string, string> = {};
                        Object.entries(err.errors).forEach(([key, msgs]) => {
                            flatErrors[key] = msgs[0];
                        });
                        setApiErrors(flatErrors);
                    }
                } finally {
                    setApiProcessing(false);
                }
            } else {
                console.log('Using Inertia login for web');
                router.post('/login', { user_id: user.id, password: '' });
            }
        }
    };

    const handlePasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        console.log('handlePasswordSubmit called, isNative:', isNative);

        if (isNative && selectedUser) {
            console.log('Using API login with password for mobile');
            setApiProcessing(true);
            setApiErrors({});
            try {
                console.log('Calling /api/login with password...');
                const response = await apiRequest<{
                    user: UserData;
                    token: string;
                }>('/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: selectedUser.id,
                        password: loginPassword,
                    }),
                });
                console.log('API login response:', response);

                // Store token in SecureStorage
                console.log('Storing token in SecureStorage...');
                await secureStorage.set(AUTH_TOKEN_KEY, response.token);
                console.log('Token stored successfully');

                // Navigate to dashboard
                console.log('Navigating to dashboard...');
                router.visit('/dashboard');
            } catch (error: unknown) {
                console.error('API login error:', error);
                const err = error as {
                    message?: string;
                    errors?: Record<string, string[]>;
                };
                if (err.errors) {
                    const flatErrors: Record<string, string> = {};
                    Object.entries(err.errors).forEach(([key, msgs]) => {
                        flatErrors[key] = msgs[0];
                    });
                    setApiErrors(flatErrors);
                } else if (err.message) {
                    setApiErrors({ password: err.message });
                }
            } finally {
                setApiProcessing(false);
            }
        } else {
            console.log('Using Inertia login for web');
            loginForm.post('/login');
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            registerForm.setData('profile_image', file);
            setNativeImagePath(null); // Clear native path when using file input
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle native camera photo capture
    const handleTakePhoto = async () => {
        console.log('handleTakePhoto called');
        setShowImagePicker(false);
        try {
            console.log('Calling camera.getPhoto()...');
            await camera.getPhoto().id('profile-photo');
            console.log('camera.getPhoto() completed');
        } catch (error) {
            console.error('camera.getPhoto() error:', error);
        }
    };

    // Handle native gallery picker
    const handlePickFromGallery = async () => {
        console.log('handlePickFromGallery called');
        setShowImagePicker(false);
        try {
            console.log('Calling camera.pickImages()...');
            await camera.pickImages().images().id('profile-gallery');
            console.log('camera.pickImages() completed');
        } catch (error) {
            console.error('camera.pickImages() error:', error);
        }
    };

    // Handle click on avatar - show native picker or file input
    const handleAvatarClick = async () => {
        console.log('handleAvatarClick - isNative:', isNative);
        if (isNative) {
            console.log('Showing native image picker');
            setShowImagePicker(true);
        } else {
            console.log('Falling back to file input');
            fileInputRef.current?.click();
        }
    };

    // Convert native file to base64 data URL for preview (GET to avoid NativePHP POST interception)
    const loadNativeFilePreview = async (path: string) => {
        try {
            console.log('Loading preview for:', path);
            const url = `/native-file/preview?path=${encodeURIComponent(path)}`;
            const response = await fetch(url);

            const data = await response.json();
            console.log('Preview response:', data);

            if (data.dataUrl) {
                console.log('Setting base64 preview');
                setNativeImagePath(path);
                setNewImagePreview(data.dataUrl);
                registerForm.setData('profile_image', null);
            } else {
                console.error('Preview failed:', data.error);
            }
        } catch (error) {
            console.error('Failed to load native file preview:', error);
        }
    };

    // Set up NativePHP event listeners for camera and gallery
    useEffect(() => {
        const handlePhotoTaken = (payload: {
            path: string;
            mimeType: string;
            id: string;
        }) => {
            console.log('PhotoTaken event:', payload);
            if (payload.path) {
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
            console.log('MediaSelected event:', payload);
            if (payload.success && payload.files && payload.files.length > 0) {
                loadNativeFilePreview(payload.files[0].path);
            }
        };

        // Register event listeners using NativePHP Events object (v2 API)
        console.log('Registering NativePHP event listeners...');
        console.log('Events.Camera.PhotoTaken:', Events?.Camera?.PhotoTaken);
        console.log('Events.Gallery.MediaSelected:', Events?.Gallery?.MediaSelected);

        // Use Events object if available, fallback to string names
        const photoEvent = Events?.Camera?.PhotoTaken || 'Native\\Mobile\\Events\\Camera\\PhotoTaken';
        const mediaEvent = Events?.Gallery?.MediaSelected || 'Native\\Mobile\\Events\\Gallery\\MediaSelected';

        on(photoEvent, handlePhotoTaken);
        on(mediaEvent, handleMediaSelected);

        // Cleanup on unmount
        return () => {
            off(photoEvent, handlePhotoTaken);
            off(mediaEvent, handleMediaSelected);
        };
    }, []);

    const handleCreateUser = async (e: FormEvent) => {
        e.preventDefault();

        if (isNative) {
            setApiProcessing(true);
            setApiErrors({});
            try {
                const response = await apiRequest<{
                    user: UserData;
                    token: string;
                }>('/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: registerName,
                        password: registerPassword || undefined,
                        // Send base64 data instead of path - more reliable on Android
                        profile_image_base64: newImagePreview || undefined,
                    }),
                });

                // Store token in SecureStorage
                await secureStorage.set(AUTH_TOKEN_KEY, response.token);

                // Navigate to dashboard
                router.visit('/dashboard');
            } catch (error: unknown) {
                const err = error as { errors?: Record<string, string[]> };
                if (err.errors) {
                    const flatErrors: Record<string, string> = {};
                    Object.entries(err.errors).forEach(([key, msgs]) => {
                        flatErrors[key] = msgs[0];
                    });
                    setApiErrors(flatErrors);
                }
            } finally {
                setApiProcessing(false);
            }
        } else {
            // Web: Use Inertia forms
            if (nativeImagePath) {
                router.post('/register', {
                    name: registerForm.data.name,
                    password: registerForm.data.password,
                    profile_image_path: nativeImagePath,
                });
            } else if (registerForm.data.profile_image) {
                registerForm.post('/register', {
                    forceFormData: true,
                });
            } else {
                registerForm.post('/register');
            }
        }
    };

    const resetCreateForm = () => {
        setIsCreating(false);
        registerForm.reset();
        setRegisterName('');
        setRegisterPassword('');
        setNewImagePreview(null);
        setNativeImagePath(null);
        setShowImagePicker(false);
        setApiErrors({});
    };

    const resetPasswordForm = () => {
        setSelectedUser(null);
        loginForm.reset();
        setLoginPassword('');
        setApiErrors({});
    };

    // Handle Android back button to close modals instead of navigating
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            if (isCreating) {
                e.preventDefault();
                resetCreateForm();
                window.history.pushState(null, '', window.location.href);
            } else if (selectedUser) {
                e.preventDefault();
                resetPasswordForm();
                window.history.pushState(null, '', window.location.href);
            }
        };

        // Push initial state when modal/form opens
        if (isCreating || selectedUser) {
            window.history.pushState(null, '', window.location.href);
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isCreating, selectedUser]);

    // Determine processing state
    const isLoginProcessing = isNative ? apiProcessing : loginForm.processing;
    const isRegisterProcessing = isNative
        ? apiProcessing
        : registerForm.processing;

    // Determine errors
    const loginErrors = isNative
        ? apiErrors
        : {
              error: loginForm.errors.error,
              password: loginForm.errors.password,
          };
    const registerErrors = isNative
        ? apiErrors
        : {
              name: registerForm.errors.name,
              password: registerForm.errors.password,
          };

    // Password prompt modal
    if (selectedUser) {
        return (
            <>
                <Head title="პაროლის შეყვანა" />
                <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
                    <Card className="w-full max-w-sm">
                        <CardHeader className="pb-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetPasswordForm}
                                className="mb-2 -ml-2 w-fit gap-1"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                უკან
                            </Button>
                            <div className="flex flex-col items-center gap-3">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage
                                        src={
                                            selectedUser.profile_image_url ||
                                            undefined
                                        }
                                        alt={selectedUser.name}
                                    />
                                    <AvatarFallback
                                        className={`text-2xl font-bold text-white ${getAvatarColor(selectedUser.name)}`}
                                    >
                                        {getInitials(selectedUser.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <CardTitle className="text-xl">
                                    {selectedUser.name}
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={handlePasswordSubmit}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="password">პაროლი</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={
                                            isNative
                                                ? loginPassword
                                                : loginForm.data.password
                                        }
                                        onChange={(e) => {
                                            if (isNative) {
                                                setLoginPassword(
                                                    e.target.value,
                                                );
                                            } else {
                                                loginForm.setData(
                                                    'password',
                                                    e.target.value,
                                                );
                                            }
                                        }}
                                        placeholder="შეიყვანეთ პაროლი"
                                        autoFocus
                                    />
                                    {loginErrors.error && (
                                        <p className="text-sm text-destructive">
                                            {loginErrors.error}
                                        </p>
                                    )}
                                    {loginErrors.password && (
                                        <p className="text-sm text-destructive">
                                            {loginErrors.password}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isLoginProcessing}
                                    className="w-full"
                                >
                                    {isLoginProcessing
                                        ? 'იტვირთება...'
                                        : 'შესვლა'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    // Create new user form
    if (isCreating) {
        return (
            <>
                <Head title="ახალი მომხმარებელი" />
                <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
                    <Card className="w-full max-w-sm">
                        <CardHeader className="pb-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetCreateForm}
                                className="mb-2 -ml-2 w-fit gap-1"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                უკან
                            </Button>
                            <CardTitle className="text-center text-xl">
                                ახალი მომხმარებელი
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={handleCreateUser}
                                className="space-y-4"
                            >
                                {/* Profile Image */}
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleAvatarClick}
                                        className="relative"
                                    >
                                        <Avatar className="h-24 w-24">
                                            {newImagePreview ? (
                                                <AvatarImage
                                                    src={newImagePreview}
                                                    alt="Preview"
                                                />
                                            ) : null}
                                            <AvatarFallback className="bg-muted">
                                                <User className="h-10 w-10 text-muted-foreground" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                            <Camera className="h-4 w-4" />
                                        </div>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        დაამატეთ ფოტო (არასავალდებულო)
                                    </p>

                                    {/* Native Image Picker Modal */}
                                    {showImagePicker && (
                                        <div
                                            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-4"
                                            onClick={() =>
                                                setShowImagePicker(false)
                                            }
                                        >
                                            <div
                                                className="w-full max-w-sm space-y-2 rounded-t-xl bg-background p-4 pb-8"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
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
                                                    onClick={
                                                        handlePickFromGallery
                                                    }
                                                >
                                                    <ImagePlus className="h-5 w-5" />
                                                    აირჩიეთ გალერიიდან
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="mt-2 w-full"
                                                    onClick={() =>
                                                        setShowImagePicker(
                                                            false,
                                                        )
                                                    }
                                                >
                                                    გაუქმება
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="name">
                                        სახელი / მეტსახელი
                                    </Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={
                                            isNative
                                                ? registerName
                                                : registerForm.data.name
                                        }
                                        onChange={(e) => {
                                            if (isNative) {
                                                setRegisterName(e.target.value);
                                            } else {
                                                registerForm.setData(
                                                    'name',
                                                    e.target.value,
                                                );
                                            }
                                        }}
                                        placeholder="შეიყვანეთ სახელი"
                                        autoFocus
                                    />
                                    {registerErrors.name && (
                                        <p className="text-sm text-destructive">
                                            {registerErrors.name}
                                        </p>
                                    )}
                                </div>

                                {/* Password (optional) */}
                                <div className="space-y-2">
                                    <Label htmlFor="reg-password">
                                        პაროლი (არასავალდებულო)
                                    </Label>
                                    <Input
                                        id="reg-password"
                                        type="password"
                                        value={
                                            isNative
                                                ? registerPassword
                                                : registerForm.data.password
                                        }
                                        onChange={(e) => {
                                            if (isNative) {
                                                setRegisterPassword(
                                                    e.target.value,
                                                );
                                            } else {
                                                registerForm.setData(
                                                    'password',
                                                    e.target.value,
                                                );
                                            }
                                        }}
                                        placeholder="შეიყვანეთ პაროლი"
                                    />
                                    {registerErrors.password && (
                                        <p className="text-sm text-destructive">
                                            {registerErrors.password}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        პაროლი საჭიროა მხოლოდ თუ გსურთ თქვენი
                                        ანგარიშის დაცვა
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={
                                        isRegisterProcessing ||
                                        !(isNative
                                            ? registerName.trim()
                                            : registerForm.data.name.trim())
                                    }
                                    className="w-full"
                                >
                                    {isRegisterProcessing
                                        ? 'იტვირთება...'
                                        : 'დაწყება'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    // Main user selection screen
    return (
        <>
            <Head title="აირჩიეთ მომხმარებელი" />
            <div className="flex min-h-screen flex-col bg-background p-4">
                <div className="mx-auto w-full max-w-md">
                    {/* Header */}
                    <div className="mb-8 pt-8 text-center">
                        <h1 className="mb-2 text-2xl font-bold">
                            მართვის მოწმობა
                        </h1>
                        <p className="text-muted-foreground">
                            აირჩიეთ მომხმარებელი
                        </p>
                    </div>

                    {/* User Cards */}
                    {users.length > 0 && (
                        <div className="mb-6 grid grid-cols-2 gap-4">
                            {users.map((user) => (
                                <Card
                                    key={user.id}
                                    className="cursor-pointer py-4 transition-shadow hover:shadow-md active:scale-[0.98]"
                                    onClick={() => handleUserClick(user)}
                                >
                                    <CardContent className="flex flex-col items-center gap-3 p-4">
                                        <Avatar className="h-16 w-16">
                                            <AvatarImage
                                                src={
                                                    user.profile_image_url ||
                                                    undefined
                                                }
                                                alt={user.name}
                                            />
                                            <AvatarFallback
                                                className={`text-xl font-bold text-white ${getAvatarColor(user.name)}`}
                                            >
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">
                                            {user.name}
                                        </span>
                                        {user.has_password && (
                                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Add New User Button */}
                    <Card
                        className="cursor-pointer border-dashed py-6 transition-colors hover:border-primary hover:bg-accent"
                        onClick={() => setIsCreating(true)}
                    >
                        <CardContent className="flex items-center justify-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <Plus className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-medium">
                                ახალი მომხმარებელი
                            </span>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
