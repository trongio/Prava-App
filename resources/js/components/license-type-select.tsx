import {
    Bus,
    Car,
    Motorbike,
    Scooter,
    Shield,
    Tractor,
    TramFront,
    Truck,
} from 'lucide-react';
import { ReactNode } from 'react';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { LicenseType } from '@/types/models';

interface LicenseTypeSelectProps {
    value: number | null;
    onValueChange: (value: number | null) => void;
    licenseTypes: LicenseType[];
    placeholder?: string;
    emptyLabel?: string;
    showChildren?: boolean;
    triggerClassName?: string;
    size?: 'default' | 'compact';
}

const getLicenseTypeIcon = (code: string, className?: string): ReactNode => {
    const iconClass = cn('h-4 w-4 shrink-0', className);
    const upperCode = code.toUpperCase().replace(/\s/g, '');

    // AM - Moped (before A check since AM starts with A)
    if (upperCode === 'AM') {
        return <Scooter className={iconClass} />;
    }
    // A, A1 - Motorcycle
    if (upperCode.startsWith('A')) {
        return <Motorbike className={iconClass} />;
    }
    // B, B1 - Car
    if (upperCode.startsWith('B')) {
        return <Car className={iconClass} />;
    }
    // C, C1 - Truck
    if (upperCode.startsWith('C')) {
        return <Truck className={iconClass} />;
    }
    // D, D1 - Bus
    if (upperCode.startsWith('D')) {
        return <Bus className={iconClass} />;
    }
    // T, T,S - Tractor
    if (upperCode === 'T' || upperCode === 'T,S' || upperCode === 'TS') {
        return <Tractor className={iconClass} />;
    }
    // Tram
    if (upperCode === 'TRAM') {
        return <TramFront className={iconClass} />;
    }
    // Mil - Military
    if (upperCode === 'MIL') {
        return <Shield className={iconClass} />;
    }
    return <Car className={iconClass} />;
};

export { getLicenseTypeIcon };

export function LicenseTypeSelect({
    value,
    onValueChange,
    licenseTypes,
    placeholder = 'აირჩიე კატეგორია',
    emptyLabel = 'ყველა',
    showChildren = true,
    triggerClassName,
    size = 'default',
}: LicenseTypeSelectProps) {
    const selectedLicense = licenseTypes.find((lt) => lt.id === value);

    const handleChange = (v: string) => {
        onValueChange(v === 'all' || v === 'none' ? null : parseInt(v));
    };

    // Format license type display text
    const formatLicenseDisplay = (lt: LicenseType, includeIcon: boolean) => {
        const text = `${lt.code}${showChildren && lt.children && lt.children.length > 0 ? `, ${lt.children.map((c) => c.code).join(', ')}` : ''}`;

        if (includeIcon) {
            return (
                <span className="flex items-center gap-2">
                    {getLicenseTypeIcon(lt.code)}
                    <span>{text}</span>
                </span>
            );
        }
        return text;
    };

    return (
        <Select value={value?.toString() || 'all'} onValueChange={handleChange}>
            <SelectTrigger
                className={cn(
                    size === 'compact'
                        ? 'h-7 w-auto gap-1 border-0 bg-transparent p-0 text-sm text-muted-foreground shadow-none'
                        : 'h-8 w-auto min-w-[80px] text-sm',
                    triggerClassName,
                )}
            >
                {size === 'compact' && (
                    <>
                        {selectedLicense ? (
                            getLicenseTypeIcon(selectedLicense.code)
                        ) : (
                            <Car className="h-4 w-4 shrink-0" />
                        )}
                    </>
                )}
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">{emptyLabel}</SelectItem>
                {licenseTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id.toString()}>
                        {formatLicenseDisplay(lt, size !== 'compact')}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
