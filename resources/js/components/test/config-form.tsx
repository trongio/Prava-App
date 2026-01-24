import { InertiaFormProps } from '@inertiajs/react';
import {
    Bookmark,
    BookOpen,
    Bus,
    Car,
    Check,
    Clock,
    Motorbike,
    Plus,
    Scooter,
    Shield,
    Tractor,
    TramFront,
    Truck,
    Undo2,
} from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LicenseType, QuestionCategory } from '@/types/models';

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

const timeOptions = [
    { value: 30, label: '30წმ' },
    { value: 45, label: '45წმ' },
    { value: 60, label: '1წთ' },
    { value: 90, label: '1.5წთ' },
    { value: 120, label: '2წთ' },
];

const DEFAULTS = {
    question_count: 30,
    time_per_question: 60,
    failure_threshold: 10,
};

interface TestFormData {
    test_type: 'thematic' | 'bookmarked';
    license_type_id: number | null;
    question_count: number;
    time_per_question: number;
    failure_threshold: number;
    category_ids: number[];
    auto_advance: boolean;
}

interface ConfigFormProps {
    form: InertiaFormProps<TestFormData>;
    testType: 'thematic' | 'bookmarked';
    onTestTypeChange: (type: 'thematic' | 'bookmarked') => void;
    licenseTypes: LicenseType[];
    categories: QuestionCategory[];
    bookmarkedCount: number;
    userDefaults: {
        license_type_id: number | null;
        auto_advance: boolean;
    };
    maxAvailableQuestions: number;
    onStartTest: () => void;
    onSaveTemplate: () => void;
}

export function ConfigForm({
    form,
    testType,
    onTestTypeChange,
    licenseTypes,
    categories,
    bookmarkedCount,
    userDefaults,
    maxAvailableQuestions,
    onStartTest,
    onSaveTemplate,
}: ConfigFormProps) {
    // Calculate allowed mistakes based on question count and threshold
    const allowedMistakes = useMemo(() => {
        return Math.floor(
            form.data.question_count * (form.data.failure_threshold / 100),
        );
    }, [form.data.question_count, form.data.failure_threshold]);

    // Total time estimate
    const totalTimeMinutes = useMemo(() => {
        return Math.ceil(
            (form.data.question_count * form.data.time_per_question) / 60,
        );
    }, [form.data.question_count, form.data.time_per_question]);

    return (
        <div className="space-y-6">
            {/* Test Type Tabs */}
            <Tabs
                value={testType}
                onValueChange={(v) =>
                    onTestTypeChange(v as 'thematic' | 'bookmarked')
                }
            >
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="thematic" className="gap-2">
                        <BookOpen className="h-4 w-4" />
                        თემატური
                    </TabsTrigger>
                    <TabsTrigger value="bookmarked" className="gap-2">
                        <Bookmark className="h-4 w-4" />
                        შენახული
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="thematic" className="space-y-6">
                    {/* License Type */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>კატეგორია</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                    form.setData(
                                        'license_type_id',
                                        userDefaults.license_type_id,
                                    )
                                }
                                disabled={
                                    form.data.license_type_id ===
                                    userDefaults.license_type_id
                                }
                                title="ნაგულისხმევზე დაბრუნება"
                            >
                                <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <Select
                            value={form.data.license_type_id?.toString() || 'all'}
                            onValueChange={(v) =>
                                form.setData(
                                    'license_type_id',
                                    v === 'all' ? null : parseInt(v),
                                )
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="ყველა კატეგორია" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ყველა კატეგორია</SelectItem>
                                {licenseTypes.map((lt) => (
                                    <SelectItem
                                        key={lt.id}
                                        value={lt.id.toString()}
                                    >
                                        <span className="flex items-center gap-2">
                                            {getLicenseTypeIcon(lt.code)}
                                            <span>
                                                {lt.code}
                                                {lt.children &&
                                                    lt.children.length > 0 &&
                                                    `, ${lt.children.map((c) => c.code).join(', ')}`}
                                            </span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Categories Multi-select */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>თემები</Label>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        form.setData(
                                            'category_ids',
                                            categories.map((c) => c.id),
                                        )
                                    }
                                    className="text-xs text-primary hover:underline"
                                >
                                    ყველა
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    /
                                </span>
                                <button
                                    type="button"
                                    onClick={() => form.setData('category_ids', [])}
                                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                >
                                    გასუფთავება
                                </button>
                            </div>
                        </div>
                        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                        const newCategories =
                                            form.data.category_ids.includes(cat.id)
                                                ? form.data.category_ids.filter(
                                                      (id) => id !== cat.id,
                                                  )
                                                : [
                                                      ...form.data.category_ids,
                                                      cat.id,
                                                  ];
                                        form.setData('category_ids', newCategories);
                                    }}
                                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                                        form.data.category_ids.includes(cat.id)
                                            ? 'bg-primary/10 text-primary'
                                            : 'hover:bg-accent'
                                    }`}
                                >
                                    <div
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                                            form.data.category_ids.includes(cat.id)
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-input'
                                        }`}
                                    >
                                        {form.data.category_ids.includes(
                                            cat.id,
                                        ) && <Check className="h-3 w-3" />}
                                    </div>
                                    <span className="flex-1 truncate">
                                        {cat.name}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {cat.questions_count}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {form.data.category_ids.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                არჩეულია: {form.data.category_ids.length} თემა{' '}
                                {' • '}
                                {categories
                                    .filter((c) =>
                                        form.data.category_ids.includes(c.id),
                                    )
                                    .reduce(
                                        (sum, c) =>
                                            sum + (c.questions_count ?? 0),
                                        0,
                                    )}{' '}
                                კითხვა
                            </p>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="bookmarked">
                    <div className="rounded-lg border border-dashed p-4 text-center">
                        <Bookmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">შენახული კითხვები</p>
                        <p className="text-xs text-muted-foreground">
                            {bookmarkedCount > 0
                                ? `თქვენ გაქვთ ${bookmarkedCount} შენახული კითხვა`
                                : 'თქვენ ჯერ არ გაქვთ შენახული კითხვები'}
                        </p>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Question Count */}
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm leading-relaxed">
                        კითხვების რაოდენობა
                    </Label>
                    <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs font-medium">
                            {form.data.question_count}/{maxAvailableQuestions}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                                form.setData(
                                    'question_count',
                                    Math.min(
                                        DEFAULTS.question_count,
                                        maxAvailableQuestions,
                                    ),
                                )
                            }
                            disabled={
                                form.data.question_count ===
                                Math.min(
                                    DEFAULTS.question_count,
                                    maxAvailableQuestions,
                                )
                            }
                            title="ნაგულისხმევზე დაბრუნება"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <Slider
                    value={[form.data.question_count]}
                    onValueChange={([v]) => form.setData('question_count', v)}
                    min={1}
                    max={Math.max(1, maxAvailableQuestions)}
                    step={1}
                    disabled={maxAvailableQuestions < 1}
                />
                {maxAvailableQuestions < 1 && (
                    <p className="text-xs text-destructive">
                        არასაკმარისი კითხვები ({maxAvailableQuestions})
                    </p>
                )}
            </div>

            {/* Time per Question */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-sm leading-relaxed">
                        დრო კითხვაზე
                    </Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                            form.setData(
                                'time_per_question',
                                DEFAULTS.time_per_question,
                            )
                        }
                        disabled={
                            form.data.time_per_question ===
                            DEFAULTS.time_per_question
                        }
                        title="ნაგულისხმევზე დაბრუნება"
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
                <Select
                    value={form.data.time_per_question.toString()}
                    onValueChange={(v) =>
                        form.setData('time_per_question', parseInt(v))
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {timeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value.toString()}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Allowed Mistakes - Slider based */}
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm leading-relaxed">
                        დასაშვები შეცდომები
                    </Label>
                    <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs font-medium">
                            {allowedMistakes} ({form.data.failure_threshold}%)
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                                form.setData(
                                    'failure_threshold',
                                    DEFAULTS.failure_threshold,
                                )
                            }
                            disabled={
                                form.data.failure_threshold ===
                                DEFAULTS.failure_threshold
                            }
                            title="ნაგულისხმევზე დაბრუნება"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <Slider
                    value={[form.data.failure_threshold]}
                    onValueChange={([v]) => form.setData('failure_threshold', v)}
                    min={5}
                    max={30}
                    step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>მკაცრი (5%)</span>
                    <span>რბილი (30%)</span>
                </div>
            </div>

            {/* Auto-advance Toggle */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-sm leading-relaxed">ავტო-გადასვლა</Label>
                    <p className="text-xs text-muted-foreground">
                        პასუხის შემდეგ ავტომატურად გადავა შემდეგ კითხვაზე
                    </p>
                </div>
                <Switch
                    checked={form.data.auto_advance}
                    onCheckedChange={(v) => form.setData('auto_advance', v)}
                />
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>სავარაუდო დრო:</span>
                </div>
                <span className="text-sm font-medium">~{totalTimeMinutes} წუთი</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button
                    variant="outline"
                    className="order-2 w-full sm:order-1 sm:w-auto sm:shrink-0"
                    onClick={onSaveTemplate}
                >
                    <Plus className="h-4 w-4" />
                    შაბლონად
                </Button>
                <Button
                    className="order-1 min-w-0 flex-1 sm:order-2"
                    onClick={onStartTest}
                    disabled={
                        form.processing ||
                        (testType === 'bookmarked' && bookmarkedCount === 0) ||
                        maxAvailableQuestions < 1
                    }
                >
                    <span className="truncate">ტესტის დაწყება</span>
                </Button>
            </div>
        </div>
    );
}
