import { usePage } from '@inertiajs/react';

import { browser } from '#nativephp';
import { type SharedData } from '@/types';

/**
 * Opens a link outside the app.
 *
 * The native bridge is the only way out of the device WebView, but in a
 * browser it has no host to call and the click would silently do nothing, so
 * the web build opens a normal new tab instead.
 */
export function useOpenExternal() {
    const { platform } = usePage<SharedData>().props;

    return (url: string) => {
        if (platform === 'web') {
            window.open(url, '_blank', 'noopener,noreferrer');

            return;
        }

        void browser.open(url);
    };
}
