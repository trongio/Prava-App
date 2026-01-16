<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PasswordUpdateRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = [
            'password' => $this->passwordRules(),
        ];

        // Only require current password if user has one
        if ($this->user()->has_password || $this->user()->password !== null) {
            $rules['current_password'] = $this->currentPasswordRules();
        }

        return $rules;
    }
}
