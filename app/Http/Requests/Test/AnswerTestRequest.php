<?php

namespace App\Http\Requests\Test;

use Illuminate\Foundation\Http\FormRequest;

class AnswerTestRequest extends FormRequest
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
            'question_id' => ['required', 'integer'],
            'answer_id' => ['required', 'integer'],
            'remaining_time' => ['required', 'integer'],
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
            'question_id.required' => 'Question ID is required.',
            'answer_id.required' => 'Answer ID is required.',
            'remaining_time.required' => 'Remaining time is required.',
        ];
    }
}
