<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_gemini_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('server_id')->unique();
            $table->text('api_key');
            $table->timestamps();
            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_gemini_settings');
    }
};