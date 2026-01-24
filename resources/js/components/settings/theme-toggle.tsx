import { Monitor, Moon, Sun } from 'lucide-react';

import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
    const { appearance, updateAppearance } = useAppearance();

    const themes: { value: Appearance; icon: typeof Sun; label: string }[] = [
        { value: 'light', icon: Sun, label: 'ნათელი' },
        { value: 'dark', icon: Moon, label: 'მუქი' },
        { value: 'system', icon: Monitor, label: 'სისტემის' },
    ];

    return (
        <div className="flex gap-2">
            {themes.map(({ value, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => updateAppearance(value)}
                    className={cn(
                        'flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl p-3 transition-all',
                        appearance === value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                    )}
                >
                    <Icon className="h-5 w-5" />
                </button>
            ))}
        </div>
    );
}
