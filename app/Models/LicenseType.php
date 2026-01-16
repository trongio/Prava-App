<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LicenseType extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'parent_id',
        'is_parent',
    ];

    protected function casts(): array
    {
        return [
            'is_parent' => 'boolean',
        ];
    }

    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(Question::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(LicenseType::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(LicenseType::class, 'parent_id');
    }

    /**
     * Get all parent license types (for display in UI)
     */
    public function scopeParents($query)
    {
        return $query->where('is_parent', true);
    }

    /**
     * Get display name with children (e.g., "B, B1")
     */
    public function getDisplayNameAttribute(): string
    {
        if (! $this->is_parent) {
            return $this->code;
        }

        $children = $this->children->pluck('code')->toArray();

        return implode(', ', array_merge([$this->code], $children));
    }
}
