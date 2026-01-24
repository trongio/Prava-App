import { Link } from '@inertiajs/react';
import { ChevronRight, Clock, Play } from 'lucide-react';

import { getLicenseTypeIcon } from '@/components/license-type-select';
import { Card, CardContent } from '@/components/ui/card';
import type { ActiveTest } from '@/types/models';

interface ActiveTestCardProps {
    activeTest: ActiveTest;
    onClick?: () => void;
    asLink?: boolean;
}

const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getTestTypeName = (type: string) => {
    const types: Record<string, string> = {
        thematic: 'თემატური',
        bookmarked: 'შენახული',
        quick: 'სწრაფი',
    };
    return types[type] || type;
};

export function ActiveTestCard({
    activeTest,
    onClick,
    asLink = true,
}: ActiveTestCardProps) {
    const content = (
        <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Play className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
                <span className="font-medium">გაგრძელება</span>
                {/* Progress and time row */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                        {activeTest.answered_count}/{activeTest.total_questions}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(activeTest.remaining_time_seconds)}
                    </span>
                </div>
                {/* Tags row - below progress */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                        {getTestTypeName(activeTest.test_type)}
                    </span>
                    <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {activeTest.license_type ? (
                            <>
                                {getLicenseTypeIcon(
                                    activeTest.license_type.code,
                                )}
                                {activeTest.license_type.code}
                                {activeTest.license_type.children &&
                                    activeTest.license_type.children.length >
                                        0 &&
                                    `, ${activeTest.license_type.children.map((c) => c.code).join(', ')}`}
                            </>
                        ) : (
                            'ყველა'
                        )}
                    </span>
                </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
    );

    return (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="p-4">
                {asLink ? (
                    <Link href={`/test/${activeTest.id}`}>{content}</Link>
                ) : (
                    <button onClick={onClick} className="w-full text-left">
                        {content}
                    </button>
                )}
            </CardContent>
        </Card>
    );
}
