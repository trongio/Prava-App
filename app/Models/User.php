<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * The model's default attribute values.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'test_auto_advance' => true,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'profile_image',
        'has_password',
        'question_filter_preferences',
        'default_license_type_id',
        'test_auto_advance',
        'is_guest',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = [
        'profile_image_url',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'has_password' => 'boolean',
            'is_guest' => 'boolean',
            'question_filter_preferences' => 'array',
            'test_auto_advance' => 'boolean',
            'review_prompt_dismissed_at' => 'datetime',
            'review_prompt_last_shown_at' => 'datetime',
        ];
    }

    /**
     * Real, named accounts. Guests are throwaway web sessions and must never
     * be listed anywhere a visitor can see or sign into them.
     *
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopeSelectable(Builder $query): Builder
    {
        return $query->where('is_guest', false);
    }

    public function getProfileImageUrlAttribute(): ?string
    {
        if ($this->profile_image) {
            return asset('storage/'.$this->profile_image);
        }

        return null;
    }

    public function questionProgress(): HasMany
    {
        return $this->hasMany(UserQuestionProgress::class);
    }

    public function testTemplates(): HasMany
    {
        return $this->hasMany(TestTemplate::class);
    }

    public function testResults(): HasMany
    {
        return $this->hasMany(TestResult::class);
    }

    public function statistic(): HasOne
    {
        return $this->hasOne(UserStatistic::class);
    }

    public function bookmarkedQuestions(): HasMany
    {
        return $this->hasMany(UserQuestionProgress::class)->where('is_bookmarked', true);
    }

    public function defaultLicenseType(): BelongsTo
    {
        return $this->belongsTo(LicenseType::class, 'default_license_type_id');
    }

    public function inProgressTests(): HasMany
    {
        return $this->hasMany(TestResult::class)->inProgress();
    }
}
