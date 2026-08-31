import { Head, Link, router } from '@inertiajs/react';
import { Github, Linkedin, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';

import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';

interface Author {
    name?: string;
    github?: string;
    linkedin?: string;
}

/**
 * Landing page for the public web build.
 *
 * Routes are written as literal paths rather than Wayfinder imports on
 * purpose: /guest and Fortify's /login only exist when APP_PLATFORM=web, and
 * Wayfinder output is generated per build, so importing them would break the
 * device build where those routes are not registered.
 */
export default function Welcome({
    storeUrl,
    author = {},
}: {
    storeUrl: string;
    author?: Author;
}) {
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

                {/* Android app. The QR is the point of this block on a desktop
                    screen; on a phone the visitor can just tap through, so the
                    code is hidden there rather than shrunk. */}
                <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full max-w-sm items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/50"
                >
                    <img
                        src="/play-store-qr.png"
                        alt=""
                        width={88}
                        height={88}
                        className="hidden shrink-0 rounded-md bg-white p-1 sm:block"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Android აპლიკაცია</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            ითამაშე ოფლაინაც. დააინსტალირე Google Play-დან
                            <span className="hidden sm:inline">
                                {' '}
                                ან დაასკანერე კოდი
                            </span>
                            .
                        </p>
                        <span className="mt-2 inline-block text-xs font-medium text-primary underline underline-offset-4">
                            Google Play
                        </span>
                    </div>
                </a>

                {(author.github || author.linkedin) && (
                    <footer className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                        {author.name && <span>შექმნილია: {author.name}</span>}
                        <div className="flex items-center gap-4">
                            {author.github && (
                                <a
                                    href={author.github}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                                >
                                    <Github className="h-3.5 w-3.5" />
                                    GitHub
                                </a>
                            )}
                            {author.linkedin && (
                                <a
                                    href={author.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                                >
                                    <Linkedin className="h-3.5 w-3.5" />
                                    LinkedIn
                                </a>
                            )}
                        </div>
                    </footer>
                )}
            </div>
        </>
    );
}
