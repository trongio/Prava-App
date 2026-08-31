import axios from 'axios';
import { Star } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useOpenExternal } from '@/hooks/use-open-external';

interface Props {
    storeUrl: string;
}

/**
 * Invitation to rate the app, shown once on the results screen after a passed
 * test.
 *
 * Either action retires it for good, so the user is only ever asked this once
 * unless they walk away without answering. Anyone who dismissed it and later
 * changes their mind can still rate from the settings sheet.
 *
 * Rating goes through the native Play in-app review overlay where the build
 * supports it, and falls back to the store listing where it does not. Neither
 * path can tell whether a review was actually left: Play does not report that,
 * so nothing here depends on it.
 */
export function ReviewPrompt({ storeUrl }: Props) {
    const [isOpen, setIsOpen] = useState(true);
    const openExternal = useOpenExternal();

    const retire = useCallback(() => {
        setIsOpen(false);

        // Fire and forget. The dialog is already closed, and the worst case for
        // a failed write is that it returns once after the cooldown, not never.
        void axios.post('/review-prompt/dismiss').catch(() => {});
    }, []);

    const handleRate = useCallback(async () => {
        setIsOpen(false);

        // Prefer the native Play overlay, which keeps the user in the app. It is
        // absent on unpatched builds and in the browser during development, and
        // the server says so, so fall back to the store listing.
        try {
            const { data } = await axios.post('/review-prompt/rate');

            if (!data?.native) {
                openExternal(data?.store_url ?? storeUrl);
            }
        } catch {
            openExternal(storeUrl);
        }
    }, [openExternal, storeUrl]);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    retire();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
                        <Star className="h-6 w-6 text-amber-500" />
                    </div>
                    <DialogTitle className="text-center">
                        მოგწონთ აპლიკაცია?
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        შეაფასეთ Google Play-ზე და დაგვეხმარეთ გაუმჯობესებაში
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:justify-center">
                    <Button variant="outline" onClick={retire}>
                        არა, გმადლობთ
                    </Button>
                    <Button onClick={handleRate} className="gap-2">
                        <Star className="h-4 w-4" />
                        შეფასება
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
