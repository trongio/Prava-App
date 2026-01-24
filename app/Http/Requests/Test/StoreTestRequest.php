<?php

namespace App\Http\Requests\Test;

use Illuminate\Foundation\Http\FormRequest;

class StoreTestRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'test_type' => ['required', 'in:thematic,bookmarked'],
            'license_type_id' => ['nullable', 'exists:license_types,id'],
            'question_count' => ['required', 'integer', 'min:5', 'max:1000'],
            'time_per_question' => ['required', 'integer', 'min:30', 'max:180'],
            'failure_threshold' => ['required', 'integer', 'min:1', 'max:50'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:question_categories,id'],
            'auto_advance' => ['boolean'],
            'abandon_active' => ['boolean'],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'test_type.required' => 'Please select a test type.',
            'test_type.in' => 'Invalid test type selected.',
            'question_count.required' => 'Please specify the number of questions.',
            'question_count.min' => 'Minimum 5 questions required.',
            'question_count.max' => 'Maximum 1000 questions allowed.',
            'time_per_question.required' => 'Please specify time per question.',
            'time_per_question.min' => 'Minimum 30 seconds per question.',
            'time_per_question.max' => 'Maximum 180 seconds per question.',
            'failure_threshold.required' => 'Please specify the failure threshold.',
            'failure_threshold.min' => 'Minimum failure threshold is 1%.',
            'failure_threshold.max' => 'Maximum failure threshold is 50%.',
        ];
    }
}
