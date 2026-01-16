<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    use HasFactory;

    protected $fillable = [
        'question_category_id',
        'question',
        'description',
        'full_description',
        'image',
        'image_custom',
        'is_short_image',
        'has_small_answers',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_short_image' => 'boolean',
            'has_small_answers' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function questionCategory(): BelongsTo
    {
        return $this->belongsTo(QuestionCategory::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }

    public function licenseTypes(): BelongsToMany
    {
        return $this->belongsToMany(LicenseType::class);
    }

    public function signs(): BelongsToMany
    {
        return $this->belongsToMany(Sign::class);
    }

    public function userProgress(): HasMany
    {
        return $this->hasMany(UserQuestionProgress::class);
    }
}
