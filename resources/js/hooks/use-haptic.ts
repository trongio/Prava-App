import { useCallback, useEffect, useState } from 'react';

import { device, isMobile, secureStorage } from '#nativephp';

type HapticPattern = 'light' | 'success' | 'error';

const STORAGE_KEY = 'haptic_enabled';

interface UseHapticOptions {
    /** Override the stored preference (for settings preview) */
    forceEnabled?: boolean;
}

interface UseHapticReturn {
    /** Whether haptic feedback is enabled */
    isEnabled: boolean;
    /** Whether the device supports haptic feedback (running in NativePHP) */
    isSupported: boolean;
    /** Toggle haptic feedback on/off */
    setEnabled: (enabled: boolean) => Promise<void>;
    /** Trigger haptic feedback with a specific pattern */
    vibrate: (pattern: HapticPattern) => void;
    /** Trigger haptic for correct answer */
    vibrateCorrect: () => void;
    /** Trigger haptic for wrong answer */
    vibrateWrong: () => void;
}

// Helper to create vibration patterns by calling device.vibrate() multiple times
const vibratePattern = async (count: number, delayMs: number) => {
    for (let i = 0; i < count; i++) {
        try {
            await device.vibrate();
        } catch {
            // Silently fail
        }
        if (i < count - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};

export function useHaptic(options: UseHapticOptions = {}): UseHapticReturn {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [isNative, setIsNative] = useState(false);

    // Check for NativePHP support and load preference on mount
    useEffect(() => {
        const init = async () => {
            try {
                const native = await isMobile();
                setIsNative(native);
                setIsSupported(native); // Haptics only supported in NativePHP

                // Load stored preference
                if (native) {
                    const stored = await secureStorage.get(STORAGE_KEY);
                    setIsEnabled(stored.value === 'true');
                } else {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    setIsEnabled(stored === 'true');
                }
            } catch {
                // Not running in NativePHP
                setIsSupported(false);
                const stored = localStorage.getItem(STORAGE_KEY);
                setIsEnabled(stored === 'true');
            }
        };

        init();
    }, []);

    // Save preference
    const setEnabled = useCallback(
        async (enabled: boolean) => {
            setIsEnabled(enabled);

            try {
                if (isNative) {
                    await secureStorage.set(
                        STORAGE_KEY,
                        enabled ? 'true' : 'false',
                    );
                } else {
                    localStorage.setItem(
                        STORAGE_KEY,
                        enabled ? 'true' : 'false',
                    );
                }
            } catch {
                localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
            }

            // Give immediate feedback when enabling
            if (enabled && isSupported) {
                try {
                    await device.vibrate();
                } catch {
                    // Silently fail
                }
            }
        },
        [isNative, isSupported],
    );

    // Trigger vibration with a specific pattern
    const vibrate = useCallback(
        (pattern: HapticPattern) => {
            const shouldVibrate = options.forceEnabled ?? isEnabled;
            if (!shouldVibrate || !isSupported) return;

            try {
                switch (pattern) {
                    case 'light':
                        device.vibrate();
                        break;
                    case 'success':
                        // Single vibration for correct answer
                        device.vibrate();
                        break;
                    case 'error':
                        // Two vibrations for wrong answer
                        vibratePattern(2, 100);
                        break;
                }
            } catch {
                // Silently fail
            }
        },
        [isEnabled, isSupported, options.forceEnabled],
    );

    // Convenience methods for answer feedback
    const vibrateCorrect = useCallback(() => vibrate('success'), [vibrate]);
    const vibrateWrong = useCallback(() => vibrate('error'), [vibrate]);

    return {
        isEnabled,
        isSupported,
        setEnabled,
        vibrate,
        vibrateCorrect,
        vibrateWrong,
    };
}
