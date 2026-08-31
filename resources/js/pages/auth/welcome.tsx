import { Head, Link, router } from '@inertiajs/react';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';

import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';

/**
 * Landing page for the public web build.
 *
 * Routes are written as literal paths rather than Wayfinder imports on
 * purpose: /guest and Fortify's /login only exist when APP_PLATFORM=web, and
 * Wayfinder output is generated per build, so importing them would break the
 * device build where those routes are not registered.
 */
export default function Welcome() {
    const [startingGuest, setStartingGuest] = useState(false);

    const startGuestSession = () => {
        setStartingGuest(true);
        router.post('/guest', {}, { onFinish: () => setStartingGuest(false) });
    };

    return (
        <>
            <Head title="მართვის მოწმობის ტესტები" />

            <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    <AppLogoIcon className="size-14 fill-current text-foreground" />
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold">
                            მართვის მოწმობის ტესტები
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            მოემზადე თეორიულ გამოცდაზე: ოფიციალური კითხვები,
                            საგზაო ნიშნები და სრული სტატისტიკა.
                        </p>
                    </div>
                </div>

                <div className="flex w-full max-w-sm flex-col gap-3">
                    <Button asChild className="w-full" size="lg">
                        <Link href="/login">
                            <LogIn className="h-4 w-4" />
                            შესვლა
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="w-full"
                        size="lg"
                    >
                        <Link href="/register">
                            <UserPlus className="h-4 w-4" />
                            რეგისტრაცია
                        </Link>
                    </Button>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-background px-2 text-xs text-muted-foreground">
                                ან
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        className="w-full"
                        size="lg"
                        onClick={startGuestSession}
                        disabled={startingGuest}
                    >
                        {startingGuest ? 'იტვირთება...' : 'გაგრძელება სტუმრად'}
                    </Button>

                    <p className="flex items-start gap-2 px-2 text-xs text-muted-foreground">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        სტუმრის შედეგები ინახება მხოლოდ ამ ბრაუზერში და წაიშლება
                        უმოქმედობის შემდეგ. ანგარიშის შექმნით შედეგებს შეინახავ
                        სამუდამოდ.
                    </p>
                </div>
            </div>
        </>
    );
}
