<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LicenseType>
 */
class LicenseTypeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->lexify('??'),
            'name' => fake()->words(2, true),
            'parent_id' => null,
            'is_parent' => true,
        ];
    }

    public function child(int $parentId): static
    {
        return $this->state(fn (array $attributes) => [
            'parent_id' => $parentId,
            'is_parent' => false,
        ]);
    }
}
