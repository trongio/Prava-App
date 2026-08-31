import { Head, Link, useForm } from '@inertiajs/react';
import { type FormEvent } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

/**
 * Fortify sign-in for the web build. Literal paths, not Wayfinder imports:
 * these routes only exist when APP_PLATFORM=web (see auth/welcome.tsx).
 */
export default function Login({
    canResetPassword = true,
    canRegister = true,
    status,
}: {
    canResetPassword?: boolean;
    canRegister?: boolean;
    status?: string;
}) {
    const form = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/login', { onFinish: () => form.reset('password') });
    };

    return (
        <AuthLayout title="შესვლა" description="შეიყვანე ელფოსტა და პაროლი">
            <Head title="შესვლა" />

            {status && (
                <div className="text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="flex flex-col gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="email">ელფოსტა</Label>
                    <Input
                        id="email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                    />
                    <InputError message={form.errors.email} />
                </div>

                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">პაროლი</Label>
                        {canResetPassword && (
                            <Link
                                href="/forgot-password"
                                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                            >
                                დაგავიწყდა პაროლი?
                            </Link>
                        )}
                    </div>
                    <Input
                        id="password"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                    />
                    <InputError message={form.errors.password} />
                </div>

                <div className="flex items-center gap-3">
                    <Checkbox
                        id="remember"
                        checked={form.data.remember}
                        onCheckedChange={(checked) =>
                            form.setData('remember', checked === true)
                        }
                    />
                    <Label htmlFor="remember" className="font-normal">
                        დამახსოვრება
                    </Label>
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={form.processing}
                >
                    {form.processing ? 'იტვირთება...' : 'შესვლა'}
                </Button>
            </form>

            {canRegister && (
                <p className="text-center text-sm text-muted-foreground">
                    არ გაქვს ანგარიში?{' '}
                    <Link
                        href="/register"
                        className="underline underline-offset-4"
                    >
                        რეგისტრაცია
                    </Link>
                </p>
            )}
        </AuthLayout>
    );
}
