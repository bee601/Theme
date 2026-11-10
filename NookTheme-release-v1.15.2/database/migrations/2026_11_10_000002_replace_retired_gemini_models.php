<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('server_gemini_settings')
            ->where('provider', 'gemini')
            ->whereIn('model', ['gemini-2.5-flash', 'gemini-2.5-flash-lite'])
            ->update([
                'model' => 'gemini-3.8-flash',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
    }
};