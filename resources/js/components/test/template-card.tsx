import {
    Bus,
    Car,
    MoreVertical,
    Motorbike,
    Play,
    Scooter,
    Shield,
    Tractor,
    TramFront,
    Trash2,
    Truck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TestTemplate } from '@/types/models';

const getLicenseTypeIcon = (code: string) => {
    const iconClass = 'h-4 w-4 shrink-0';
    const upperCode = code.toUpperCase().replace(/\s/g, '');

    if (upperCode === 'AM') return <Scooter className={iconClass} />;
    if (upperCode.startsWith('A')) return <Motorbike className={iconClass} />;
    if (upperCode.startsWith('B')) return <Car className={iconClass} />;
    if (upperCode.startsWith('C')) return <Truck className={iconClass} />;
    if (upperCode.startsWith('D')) return <Bus className={iconClass} />;
    if (upperCode === 'T' || upperCode === 'T,S' || upperCode === 'TS')
        return <Tractor className={iconClass} />;
    if (upperCode === 'TRAM') return <TramFront className={iconClass} />;
    if (upperCode === 'MIL') return <Shield className={iconClass} />;
    return <Car className={iconClass} />;
};

interface TemplateCardProps {
    template: TestTemplate;
    onStart: (template: TestTemplate) => void;
    onLoad: (template: TestTemplate) => void;
    onEdit: (template: TestTemplate) => void;
    onDelete: (templateId: number) => void;
}

export function TemplateCard({
    template,
    onStart,
    onLoad,
    onEdit,
    onDelete,
}: TemplateCardProps) {
    return (
        <div className="flex items-center gap-2 rounded-lg border p-3">
            {/* Play button to start test directly */}
            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                onClick={() => onStart(template)}
            >
                <Play className="h-5 w-5" />
            </Button>
            <button
                onClick={() => onLoad(template)}
                className="min-w-0 flex-1 text-left"
            >
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{template.name}</p>
                    <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {template.license_type ? (
                            <>
                                {getLicenseTypeIcon(template.license_type.code)}
                                {template.license_type.code}
                            </>
                        ) : (
                            'ყველა'
                        )}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    {template.question_count} კითხვა •{' '}
                    {Math.floor(template.time_per_question / 60) > 0
                        ? `${Math.floor(template.time_per_question / 60)}წთ`
                        : `${template.time_per_question}წმ`}
                </p>
            </button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onStart(template)}>
                        <Play className="mr-2 h-4 w-4" />
                        დაწყება
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(template)}>
                        რედაქტირება
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDelete(template.id)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        წაშლა
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
