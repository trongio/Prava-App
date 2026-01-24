import { router } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { getLicenseTypeIcon } from '@/components/license-type-select';
import { cn } from '@/lib/utils';
import type { LicenseType } from '@/types';

interface LicenseTypeSelectorProps {
    licenseTypes: LicenseType[];
    selectedId: number | null | undefined;
    userName: string;
}

export function LicenseTypeSelector({
    licenseTypes,
    selectedId,
    userName,
}: LicenseTypeSelectorProps) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSelect = (id: number) => {
        if (id === selectedId) return;

        setSaving(true);
        setSaved(false);

        router.post(
            '/settings/profile',
            {
                name: userName,
                default_license_type_id: id,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSaving(false);
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                },
                onError: () => {
                    setSaving(false);
                },
            },
        );
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">
                    კატეგორია
                </h4>
                {saving && (
                    <span className="text-xs text-muted-foreground">
                        ინახება...
                    </span>
                )}
                {saved && (
                    <span className="text-xs text-green-600">შენახულია</span>
                )}
            </div>
            <div className="grid grid-cols-4 gap-2">
                {licenseTypes.map((lt) => {
                    const isSelected = lt.id === selectedId;
                    const childCodes =
                        lt.children && lt.children.length > 0
                            ? lt.children.map((c) => c.code).join(', ')
                            : null;

                    return (
                        <button
                            key={lt.id}
                            type="button"
                            onClick={() => handleSelect(lt.id)}
                            disabled={saving}
                            className={cn(
                                'relative flex flex-col items-center justify-center gap-1 rounded-xl p-3 transition-all',
                                isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                                saving && 'opacity-50',
                            )}
                        >
                            {getLicenseTypeIcon(
                                lt.code,
                                cn(
                                    'h-5 w-5',
                                    isSelected && 'text-primary-foreground',
                                ),
                            )}
                            <span className="text-xs font-medium">
                                {lt.code}
                            </span>
                            {childCodes && (
                                <span className="text-[10px] opacity-70">
                                    {childCodes}
                                </span>
                            )}
                            {isSelected && (
                                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                                    <Check className="h-3 w-3 text-white" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
