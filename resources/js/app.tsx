import '../css/app.css';

import { config, createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { initializeTheme } from './hooks/use-appearance';

// Cache prefetched pages for 5 minutes to improve navigation speed
config.set('prefetch.cacheFor', '5m');

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

/**
 * Caches question and sign images on both builds. The web build passes ?web=1,
 * which additionally precaches the installable-app assets and enables the
 * offline notice; see public/sw.js.
 */
function registerServiceWorker(isWeb: boolean): void {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker
        .register(isWeb ? '/sw.js?web=1' : '/sw.js')
        .catch(() => {
            // Registration failed: images just load without caching.
        });
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        registerServiceWorker(props.initialPage.props.platform === 'web');

        const root = createRoot(el);

        root.render(
            <StrictMode>
                <App {...props} />
            </StrictMode>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
