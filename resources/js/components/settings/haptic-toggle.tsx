import { Vibrate } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { useHaptic } from '@/hooks/use-haptic';
import { cn } from '@/lib/utils';

export function HapticToggle() {
    const { isEnabled, isSupported, setEnabled, vibrate } = useHaptic();

    if (!isSupported) {
        return null;
    }

    const handleToggle = async (checked: boolean) => {
        await setEnabled(checked);
        // Preview the haptic feedback when enabling
        if (checked) {
            setTimeout(() => vibrate('success'), 100);
        }
    };

    return (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        isEnabled
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    <Vibrate className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm font-medium">ვიბრაცია</p>
                    <p className="text-xs text-muted-foreground">
                        პასუხის შემდეგ ვიბრაციით შეტყობინება
                    </p>
                </div>
            </div>
            <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        </div>
    );
}
