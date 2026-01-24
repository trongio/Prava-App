import { Head, router } from '@inertiajs/react';
import { Car, Check } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LicenseType } from '@/types/models';

interface Props {
    licenseTypes: LicenseType[];
}

const getLicenseIcon = (code: string) => {
    // Simple icon mapping based on license code
    switch (code) {
        case 'A':
        case 'A1':
        case 'A2':
        case 'AM':
            return '🏍️';
        case 'B':
        case 'B1':
        case 'BE':
            return '🚗';
        case 'C':
        case 'C1':
        case 'CE':
        case 'C1E':
            return '🚛';
        case 'D':
        case 'D1':
        case 'DE':
        case 'D1E':
            return '🚌';
        case 'T':
        case 'S':
            return '🚜';
        default:
            return '🚗';
    }
};

const getLicenseDescription = (code: string) => {
    const descriptions: Record<string, string> = {
        A: 'მოტოციკლი',
        B: 'მსუბუქი ავტომობილი',
        C: 'სატვირთო ავტომობილი',
        D: 'ავტობუსი',
        T: 'ტრაქტორი',
        S: 'სპეციალური ტექნიკა',
    };
    return descriptions[code] || '';
};

export default function LicenseSelection({ licenseTypes }: Props) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSelect = (id: number) => {
        setSelectedId(id);
    };

    const handleContinue = () => {
        if (!selectedId) return;

        setIsSubmitting(true);
        router.post(
            '/onboarding/license',
            { license_type_id: selectedId },
            {
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Head title="აირჩიეთ კატეგორია" />

            {/* Header */}
            <div
                className="flex flex-col items-center gap-2 px-6 py-8 text-center"
                style={{ paddingTop: 'calc(var(--inset-top) + 2rem)' }}
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Car className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">
                    აირჩიეთ მართვის მოწმობის კატეგორია
                </h1>
                <p className="text-sm text-muted-foreground">
                    ეს იქნება თქვენი ნაგულისხმევი კატეგორია ტესტებისთვის.
                    შეგიძლიათ შეცვალოთ მოგვიანებით პარამეტრებში.
                </p>
            </div>

            {/* License Types Grid */}
            <div className="flex-1 px-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                    {licenseTypes.map((license) => {
                        const isSelected = selectedId === license.id;
                        const childCodes =
                            license.children
                                ?.map((c) => c.code)
                                .join(', ') ?? '';

                        return (
                            <Card
                                key={license.id}
                                className={cn(
                                    'cursor-pointer transition-all',
                                    isSelected
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                                        : 'hover:border-primary/50',
                                )}
                                onClick={() => handleSelect(license.id)}
                            >
                                <CardContent className="relative flex flex-col items-center gap-2 p-4">
                                    {/* Selection indicator */}
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                                            <Check className="h-3 w-3" />
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <span className="text-4xl">
                                        {getLicenseIcon(license.code)}
                                    </span>

                                    {/* Code */}
                                    <div className="text-center">
                                        <div className="text-xl font-bold">
                                            {license.code}
                                        </div>
                                        {childCodes && (
                                            <div className="text-xs text-muted-foreground">
                                                + {childCodes}
                                            </div>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <div className="text-xs text-muted-foreground">
                                        {getLicenseDescription(license.code)}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Continue Button */}
            <div
                className="sticky bottom-0 border-t bg-background p-4"
                style={{ paddingBottom: 'calc(var(--inset-bottom) + 1rem)' }}
            >
                <Button
                    className="w-full"
                    size="lg"
                    disabled={!selectedId || isSubmitting}
                    onClick={handleContinue}
                >
                    {isSubmitting ? 'მიმდინარეობს...' : 'გაგრძელება'}
                </Button>
            </div>
        </div>
    );
}
