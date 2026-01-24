import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Bookmark,
    BookOpen,
    Bus,
    Car,
    Check,
    Clock,
    MoreVertical,
    Motorbike,
    Play,
    Plus,
    Scooter,
    Shield,
    Tractor,
    TramFront,
    Trash2,
    Truck,
    Undo2,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ActiveTestCard } from '@/components/active-test-card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import MobileLayout from '@/layouts/mobile-layout';
import type {
    ActiveTest,
    LicenseType,
    QuestionCategory,
    TestTemplate,
} from '@/types/models';

interface Props {
    templates: TestTemplate[];
    activeTest: ActiveTest | null;
    licenseTypes: LicenseType[];
    categories: QuestionCategory[];
    bookmarkedCount: number;
    userDefaults: {
        license_type_id: number | null;
        auto_advance: boolean;
    };
    prefilled: {
        license_type: number | null;
        categories: number[];
        sign_id: number | null;
        from_questions: boolean;
    };
}

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

// Default values for test configuration
const DEFAULTS = {
    question_count: 30,
    time_per_question: 60,
    failure_threshold: 10,
};

export default function TestIndex({
    templates,
    activeTest,
    licenseTypes,
    categories,
    bookmarkedCount,
    userDefaults,
    prefilled,
}: Props) {
    const [testType, setTestType] = useState<'thematic' | 'bookmarked'>(
        'thematic',
    );
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<TestTemplate | null>(
        null,
    );
    const [templateName, setTemplateName] = useState('');
    const [showAbandonDialog, setShowAbandonDialog] = useState(false);
    const [pendingAction, setPendingAction] = useState<
        'quick' | 'custom' | 'template' | null
    >(null);
    const [pendingTemplate, setPendingTemplate] = useState<TestTemplate | null>(
        null,
    );

    // Form for test creation
    const form = useForm({
        test_type: 'thematic' as 'thematic' | 'bookmarked',
        license_type_id: prefilled.license_type || userDefaults.license_type_id,
        question_count: 30,
        time_per_question: 60,
        failure_threshold: 10,
        category_ids: prefilled.categories || ([] as number[]),
        auto_advance: userDefaults.auto_advance ?? true,
    });

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

    // Max available questions based on test type and selected categories
    const maxAvailableQuestions = useMemo(() => {
        if (testType === 'bookmarked') {
            return bookmarkedCount;
        }
        // Thematic: use selected categories or all categories
        if (form.data.category_ids.length > 0) {
            return categories
                .filter((c) => form.data.category_ids.includes(c.id))
                .reduce((sum, c) => sum + (c.questions_count ?? 0), 0);
        }
        // No categories selected - use total of all categories
        return categories.reduce((sum, c) => sum + (c.questions_count ?? 0), 0);
    }, [testType, form.data.category_ids, categories, bookmarkedCount]);

    // Auto-adjust question count when max changes
    useEffect(() => {
        if (
            maxAvailableQuestions > 0 &&
            form.data.question_count > maxAvailableQuestions
        ) {
            form.setData('question_count', Math.max(1, maxAvailableQuestions));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Only react to maxAvailableQuestions; form would cause infinite loop
    }, [maxAvailableQuestions]);

    const handleQuickTest = () => {
        if (activeTest) {
            setPendingAction('quick');
            setShowAbandonDialog(true);
            return;
        }
        router.post('/test/quick');
    };

    const handleStartTest = () => {
        if (activeTest) {
            setPendingAction('custom');
            setShowAbandonDialog(true);
            return;
        }
        // Set the test type before posting
        form.setData('test_type', testType);
        form.post('/test');
    };

    const handleConfirmAbandon = () => {
        setShowAbandonDialog(false);
        if (pendingAction === 'quick') {
            router.post('/test/quick', { abandon_active: true });
        } else if (pendingAction === 'custom') {
            form.transform((data) => ({
                ...data,
                test_type: testType,
                abandon_active: true,
            }));
            form.post('/test');
        } else if (pendingAction === 'template' && pendingTemplate) {
            router.post('/test', {
                test_type: 'thematic',
                license_type_id: pendingTemplate.license_type_id,
                question_count: pendingTemplate.question_count,
                time_per_question: pendingTemplate.time_per_question,
                failure_threshold: pendingTemplate.failure_threshold,
                category_ids: pendingTemplate.category_ids || [],
                auto_advance: userDefaults.auto_advance ?? true,
                abandon_active: true,
            });
        }
        setPendingAction(null);
        setPendingTemplate(null);
    };

    const handleCancelAbandon = () => {
        setShowAbandonDialog(false);
        setPendingAction(null);
        setPendingTemplate(null);
        // Navigate to the active test to continue it
        if (activeTest) {
            router.get(`/test/${activeTest.id}`);
        }
    };

    const handleResumeTest = () => {
        if (activeTest) {
            router.get(`/test/${activeTest.id}`);
        }
    };

    const handleLoadTemplate = (template: TestTemplate) => {
        form.setData({
            test_type: 'thematic',
            license_type_id: template.license_type_id,
            question_count: template.question_count,
            time_per_question: template.time_per_question,
            failure_threshold: template.failure_threshold,
            category_ids: template.category_ids || [],
            auto_advance: userDefaults.auto_advance ?? true,
        });
        setTestType('thematic');
    };

    const handleStartFromTemplate = (template: TestTemplate) => {
        if (activeTest) {
            setPendingAction('template');
            setPendingTemplate(template);
            setShowAbandonDialog(true);
            return;
        }
        // Start test directly with template settings
        router.post('/test', {
            test_type: 'thematic',
            license_type_id: template.license_type_id,
            question_count: template.question_count,
            time_per_question: template.time_per_question,
            failure_threshold: template.failure_threshold,
            category_ids: template.category_ids || [],
            auto_advance: userDefaults.auto_advance ?? true,
        });
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return;

        const payload = {
            name: templateName,
            license_type_id: form.data.license_type_id,
            question_count: form.data.question_count,
            time_per_question: form.data.time_per_question,
            failure_threshold: form.data.failure_threshold,
            category_ids: form.data.category_ids,
        };

        if (editingTemplate) {
            await fetch(`/templates/${editingTemplate.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } else {
            await fetch('/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }

        setShowTemplateDialog(false);
        setTemplateName('');
        setEditingTemplate(null);
        router.reload();
    };

    const handleDeleteTemplate = async (templateId: number) => {
        if (!confirm('დარწმუნებული ხართ, რომ გსურთ შაბლონის წაშლა?')) return;

        await fetch(`/templates/${templateId}`, { method: 'DELETE' });
        router.reload();
    };

    return (
        <MobileLayout>
            <Head title="ტესტი" />
            <div className="flex flex-col gap-4 p-4">
                {/* Quick Test Button */}
                <Button
                    size="lg"
                    className="w-full gap-2"
                    onClick={handleQuickTest}
                >
                    <Zap className="h-5 w-5" />
                    სწრაფი ტესტი
                </Button>

                {/* Continue Section - Active test */}
                {activeTest && (
                    <ActiveTestCard
                        activeTest={activeTest}
                        onClick={handleResumeTest}
                        asLink={false}
                    />
                )}

                {/* Templates Section */}
                {templates.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                                თქვენი შაბლონები
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="flex items-center gap-2 rounded-lg border p-3"
                                >
                                    {/* Play button to start test directly */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                                        onClick={() =>
                                            handleStartFromTemplate(template)
                                        }
                                    >
                                        <Play className="h-5 w-5" />
                                    </Button>
                                    <button
                                        onClick={() =>
                                            handleLoadTemplate(template)
                                        }
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-medium">
                                                {template.name}
                                            </p>
                                            <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                {template.license_type ? (
                                                    <>
                                                        {getLicenseTypeIcon(
                                                            template
                                                                .license_type
                                                                .code,
                                                        )}
                                                        {
                                                            template
                                                                .license_type
                                                                .code
                                                        }
                                                    </>
                                                ) : (
                                                    'ყველა'
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {template.question_count} კითხვა •{' '}
                                            {Math.floor(
                                                template.time_per_question / 60,
                                            ) > 0
                                                ? `${Math.floor(template.time_per_question / 60)}წთ`
                                                : `${template.time_per_question}წმ`}
                                        </p>
                                    </button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    handleStartFromTemplate(
                                                        template,
                                                    )
                                                }
                                            >
                                                <Play className="mr-2 h-4 w-4" />
                                                დაწყება
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setEditingTemplate(
                                                        template,
                                                    );
                                                    setTemplateName(
                                                        template.name,
                                                    );
                                                    handleLoadTemplate(
                                                        template,
                                                    );
                                                    setShowTemplateDialog(true);
                                                }}
                                            >
                                                რედაქტირება
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() =>
                                                    handleDeleteTemplate(
                                                        template.id,
                                                    )
                                                }
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                წაშლა
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Create New Test */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                            ახალი ტესტის შექმნა
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Test Type Tabs */}
                        <Tabs
                            value={testType}
                            onValueChange={(v) =>
                                setTestType(v as 'thematic' | 'bookmarked')
                            }
                        >
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="thematic" className="gap-2">
                                    <BookOpen className="h-4 w-4" />
                                    თემატური
                                </TabsTrigger>
                                <TabsTrigger
                                    value="bookmarked"
                                    className="gap-2"
                                >
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
                                        value={
                                            form.data.license_type_id?.toString() ||
                                            'all'
                                        }
                                        onValueChange={(v) =>
                                            form.setData(
                                                'license_type_id',
                                                v === 'all'
                                                    ? null
                                                    : parseInt(v),
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="ყველა კატეგორია" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                ყველა კატეგორია
                                            </SelectItem>
                                            {licenseTypes.map((lt) => (
                                                <SelectItem
                                                    key={lt.id}
                                                    value={lt.id.toString()}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        {getLicenseTypeIcon(
                                                            lt.code,
                                                        )}
                                                        <span>
                                                            {lt.code}
                                                            {lt.children &&
                                                                lt.children
                                                                    .length > 0 &&
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
                                                        categories.map(
                                                            (c) => c.id,
                                                        ),
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
                                                onClick={() =>
                                                    form.setData(
                                                        'category_ids',
                                                        [],
                                                    )
                                                }
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
                                                        form.data.category_ids.includes(
                                                            cat.id,
                                                        )
                                                            ? form.data.category_ids.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      cat.id,
                                                              )
                                                            : [
                                                                  ...form.data
                                                                      .category_ids,
                                                                  cat.id,
                                                              ];
                                                    form.setData(
                                                        'category_ids',
                                                        newCategories,
                                                    );
                                                }}
                                                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                                                    form.data.category_ids.includes(
                                                        cat.id,
                                                    )
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'hover:bg-accent'
                                                }`}
                                            >
                                                <div
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                                                        form.data.category_ids.includes(
                                                            cat.id,
                                                        )
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-input'
                                                    }`}
                                                >
                                                    {form.data.category_ids.includes(
                                                        cat.id,
                                                    ) && (
                                                        <Check className="h-3 w-3" />
                                                    )}
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
                                            არჩეულია:{' '}
                                            {form.data.category_ids.length} თემა
                                            {' • '}
                                            {categories
                                                .filter((c) =>
                                                    form.data.category_ids.includes(
                                                        c.id,
                                                    ),
                                                )
                                                .reduce(
                                                    (sum, c) =>
                                                        sum +
                                                        (c.questions_count ?? 0),
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
                                    <p className="text-sm font-medium">
                                        შენახული კითხვები
                                    </p>
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
                                        {form.data.question_count}/
                                        {maxAvailableQuestions}
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
                                onValueChange={([v]) =>
                                    form.setData('question_count', v)
                                }
                                min={1}
                                max={Math.max(1, maxAvailableQuestions)}
                                step={1}
                                disabled={maxAvailableQuestions < 1}
                            />
                            {maxAvailableQuestions < 1 && (
                                <p className="text-xs text-destructive">
                                    არასაკმარისი კითხვები (
                                    {maxAvailableQuestions})
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
                                    form.setData(
                                        'time_per_question',
                                        parseInt(v),
                                    )
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map((opt) => (
                                        <SelectItem
                                            key={opt.value}
                                            value={opt.value.toString()}
                                        >
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
                                        {allowedMistakes} (
                                        {form.data.failure_threshold}%)
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
                                onValueChange={([v]) =>
                                    form.setData('failure_threshold', v)
                                }
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
                                <Label className="text-sm leading-relaxed">
                                    ავტო-გადასვლა
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    პასუხის შემდეგ ავტომატურად გადავა შემდეგ
                                    კითხვაზე
                                </p>
                            </div>
                            <Switch
                                checked={form.data.auto_advance}
                                onCheckedChange={(v) =>
                                    form.setData('auto_advance', v)
                                }
                            />
                        </div>

                        {/* Summary */}
                        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>სავარაუდო დრო:</span>
                            </div>
                            <span className="text-sm font-medium">
                                ~{totalTimeMinutes} წუთი
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                            <Button
                                variant="outline"
                                className="order-2 w-full sm:order-1 sm:w-auto sm:shrink-0"
                                onClick={() => {
                                    setEditingTemplate(null);
                                    setTemplateName('');
                                    setShowTemplateDialog(true);
                                }}
                            >
                                <Plus className="h-4 w-4" />
                                შაბლონად
                            </Button>
                            <Button
                                className="order-1 min-w-0 flex-1 sm:order-2"
                                onClick={handleStartTest}
                                disabled={
                                    form.processing ||
                                    (testType === 'bookmarked' &&
                                        bookmarkedCount === 0) ||
                                    maxAvailableQuestions < 1
                                }
                            >
                                <Play className="h-4 w-4 shrink-0" />
                                <span className="truncate">ტესტის დაწყება</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Template Save Dialog */}
            <Dialog
                open={showTemplateDialog}
                onOpenChange={setShowTemplateDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingTemplate
                                ? 'შაბლონის რედაქტირება'
                                : 'შაბლონის შენახვა'}
                        </DialogTitle>
                        <DialogDescription>
                            შეინახეთ მიმდინარე პარამეტრები შაბლონად
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="templateName">სახელი</Label>
                            <Input
                                id="templateName"
                                value={templateName}
                                onChange={(e) =>
                                    setTemplateName(e.target.value)
                                }
                                placeholder="მაგ: B კატეგორია - სრული"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowTemplateDialog(false)}
                        >
                            გაუქმება
                        </Button>
                        <Button
                            onClick={handleSaveTemplate}
                            disabled={!templateName.trim()}
                        >
                            შენახვა
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Abandon Active Test Confirmation Dialog */}
            <AlertDialog
                open={showAbandonDialog}
                onOpenChange={setShowAbandonDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <AlertDialogTitle className="text-center">
                            აქტიური ტესტი დაიკარგება
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            თქვენ გაქვთ დაწყებული ტესტი (
                            {activeTest?.answered_count}/
                            {activeTest?.total_questions} პასუხი გაცემული).
                            ახალი ტესტის დაწყება გამოიწვევს მიმდინარე ტესტის
                            გაუქმებას.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel
                            onClick={handleCancelAbandon}
                            className="w-full sm:w-auto"
                        >
                            გაგრძელება
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAbandon}
                            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                        >
                            ახლის დაწყება
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </MobileLayout>
    );
}
