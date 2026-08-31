import { Head, useForm } from '@inertiajs/react';
import { type FormEvent } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

/** Web build only: literal paths, see auth/welcome.tsx. */
export default function ConfirmPassword() {
    const form = useForm({ password: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/user/confirm-password', {
            onFinish: () => form.reset('password'),
        });
    };

    return (
        <AuthLayout
            title="პაროლის დადასტურება"
            description="უსაფრთხოებისთვის გთხოვთ დაადასტუროთ პაროლი"
        >
            <Head title="პაროლის დადასტურება" />

            <form onSubmit={submit} className="flex flex-col gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="password">პაროლი</Label>
                    <Input
                        id="password"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        autoFocus
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                    />
                    <InputError message={form.errors.password} />
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={form.processing}
                >
                    {form.processing ? 'იტვირთება...' : 'დადასტურება'}
                </Button>
            </form>
        </AuthLayout>
    );
}
