<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('server_gemini_settings', function (Blueprint $table) {
            $table->string('provider', 32)->default('gemini');
            $table->string('model', 191)->default('gemini-3.8-flash');
        });
    }

    public function down(): void
    {
        Schema::table('server_gemini_settings', function (Blueprint $table) {
            $table->dropColumn(['provider', 'model']);
        });
    }
};