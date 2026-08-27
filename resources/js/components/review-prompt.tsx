import axios from 'axios';
import { Star, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { browser } from '#nativephp';
import { Button } from '@/components/ui/button';

interface Props {
    storeUrl: string;
}

/**
 * Invitation to rate the app, shown inline on the results screen after a
 * passed test.
 *
 * Deliberately not a dialog: the Android back press is swallowed by the
 * WebView history before `popstate` fires, so a modal here would take two
 * presses to close. An inline card is dismissed with one tap and never fights
 * the back button.
 *
 * Either action retires the prompt for good, so the user is only ever asked
 * this once unless they walk away without answering.
 */
export function ReviewPrompt({ storeUrl }: Props) {
    const [isVisible, setIsVisible] = useState(true);

    const retire = useCallback(() => {
        setIsVisible(false);

        // Fire and forget. The card is already gone from this screen, and the
        // worst case for a failed write is that it returns once after the
        // cooldown rather than never.
        void axios.post('/review-prompt/dismiss').catch(() => {});
    }, []);

    const handleRate = useCallback(() => {
        retire();
        browser.open(storeUrl);
    }, [retire, storeUrl]);

    if (!isVisible) {
        return null;
    }

    return (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-lg border bg-card p-4">
            <Star className="h-5 w-5 shrink-0 text-amber-500" />

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">მოგწონთ აპლიკაცია?</p>
                <p className="text-xs text-muted-foreground">
                    შეაფასეთ Google Play-ზე
                </p>
            </div>

            <Button size="sm" onClick={handleRate}>
                შეფასება
            </Button>

            <button
                type="button"
                onClick={retire}
                aria-label="აღარ მაჩვენო"
                className="-mr-1 shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/50"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
