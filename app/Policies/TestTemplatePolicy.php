<?php

namespace App\Policies;

use App\Models\TestTemplate;
use App\Models\User;

class TestTemplatePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, TestTemplate $testTemplate): bool
    {
        return $user->id === $testTemplate->user_id;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, TestTemplate $testTemplate): bool
    {
        return $user->id === $testTemplate->user_id;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, TestTemplate $testTemplate): bool
    {
        return $user->id === $testTemplate->user_id;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, TestTemplate $testTemplate): bool
    {
        return $user->id === $testTemplate->user_id;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, TestTemplate $testTemplate): bool
    {
        return $user->id === $testTemplate->user_id;
    }
}
