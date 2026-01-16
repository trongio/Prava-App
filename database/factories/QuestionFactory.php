<?php

namespace Database\Factories;

use App\Models\QuestionCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Question>
 */
class QuestionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'question_category_id' => QuestionCategory::factory(),
            'question' => fake()->sentence().'?',
            'description' => fake()->paragraph(),
            'full_description' => fake()->paragraphs(2, true),
            'image' => null,
            'image_custom' => null,
            'is_short_image' => false,
            'has_small_answers' => false,
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    public function withImage(): static
    {
        return $this->state(fn (array $attributes) => [
            'image' => 'questions/'.fake()->uuid().'.jpg',
        ]);
    }
}
