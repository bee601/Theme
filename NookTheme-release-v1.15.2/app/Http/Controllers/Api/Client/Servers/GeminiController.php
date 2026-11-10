<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Pterodactyl\Models\Permission;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Validation\Rule;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class GeminiController extends ClientApiController
{
    private const TABLE = 'server_gemini_settings';
    private const PROVIDERS = [
        'gemini' => 'https://generativelanguage.googleapis.com',
        'claude' => 'https://api.anthropic.com',
        'openai' => 'https://api.openai.com',
        'openrouter' => 'https://openrouter.ai',
        'groq' => 'https://api.groq.com',
        'deepseek' => 'https://api.deepseek.com',
    ];
    private const MODEL_FALLBACKS = [
        'gemini' => ['gemini-3.5-flash-lite'],
        'claude' => ['claude-haiku-4-5'],
        'openai' => ['gpt-4.1-mini', 'gpt-4o-mini'],
        'openrouter' => ['google/gemini-3.5-flash-lite', 'openai/gpt-4o-mini'],
        'groq' => ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
        'deepseek' => ['deepseek-chat', 'deepseek-reasoner'],
    ];

    public function show(Request $request, Server $server): JsonResponse
    {
        if (
            !$request->user()->can(Permission::ACTION_FILE_READ, $server)
            && !$request->user()->can(Permission::ACTION_FILE_READ_CONTENT, $server)
            && !$request->user()->can(Permission::ACTION_SETTINGS_RENAME, $server)
        ) {
            throw new AuthorizationException();
        }

        $setting = DB::table(self::TABLE)->where('server_id', $server->id)->first();

        return new JsonResponse([
            'configured' => !is_null($setting),
            'provider' => $setting->provider ?? 'gemini',
            'model' => $setting->model ?? 'gemini-3.8-flash',
        ]);
    }

    public function store(Request $request, Server $server): JsonResponse
    {
        $this->authorizeSettingsManagement($request, $server);
        $validated = $request->validate([
            'api_key' => ['nullable', 'string', 'max:2048'],
            'provider' => ['required', 'string', Rule::in(array_keys(self::PROVIDERS))],
            'model' => ['required', 'string', 'max:191'],
        ]);

        $existing = DB::table(self::TABLE)->where('server_id', $server->id)->first();
        $apiKey = trim($validated['api_key'] ?? '');
        if ($apiKey === '' && !$existing) {
            return new JsonResponse(['error' => 'An API key is required to configure File Helper.'], 422);
        }

        DB::table(self::TABLE)->updateOrInsert(
            ['server_id' => $server->id],
            [
                'api_key' => $apiKey === '' ? $existing->api_key : Crypt::encryptString($apiKey),
                'provider' => $validated['provider'],
                'model' => trim($validated['model']),
                'created_at' => $existing->created_at ?? now(),
                'updated_at' => now(),
            ]
        );

        return new JsonResponse([
            'configured' => true,
            'provider' => $validated['provider'],
            'model' => trim($validated['model']),
        ]);
    }

    public function delete(Request $request, Server $server): JsonResponse
    {
        $this->authorizeSettingsManagement($request, $server);
        DB::table(self::TABLE)->where('server_id', $server->id)->delete();

        return new JsonResponse([], JsonResponse::HTTP_NO_CONTENT);
    }

    public function generate(Request $request, Server $server): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:4000'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'file_content' => ['nullable', 'string', 'max:100000'],
            'selection' => ['nullable', 'string', 'max:100000'],
            'file_index' => ['nullable', 'string', 'max:60000'],
        ]);

        $fileIndex = trim($validated['file_index'] ?? '');
        if ($fileIndex !== '') {
            if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
                throw new AuthorizationException();
            }
        } else {
            $this->authorizeFileAccess($request, $server);
        }

        $setting = DB::table(self::TABLE)->where('server_id', $server->id)->first();
        if (!$setting) {
            return new JsonResponse(['error' => 'Configure a File Helper API key for this server first.'], 409);
        }

        $provider = $setting->provider ?? 'gemini';
        if (!array_key_exists($provider, self::PROVIDERS)) {
            return new JsonResponse(['error' => 'The configured File Helper provider is not supported.'], 409);
        }

        if ($fileIndex !== '') {
            $contents = sprintf(
                "You are File Helper for a Pterodactyl server. Use only the candidate paths supplied below. Never invent or modify a path. Give a concise answer and list exact matching paths on separate lines so the panel can make them clickable.\n\nUser request:\n%s\n\nCandidate file paths (root-relative):\n%s",
                $validated['prompt'],
                $fileIndex
            );
        } else {
            $context = $validated['selection'] ?? $validated['file_content'] ?? '';
            $fileContext = $context === '' ? '' : sprintf(
                "\n\nFile: %s\n```\n%s\n```",
                $validated['file_name'] ?? 'current file',
                $context
            );
            $contents = sprintf(
                "You are File Helper, a coding assistant inside a Pterodactyl server file editor. Return a concise, directly usable answer. When providing code changes, include a complete replacement in a fenced code block.\n\nUser request:\n%s%s",
                $validated['prompt'],
                $fileContext
            );
        }

        $apiKey = Crypt::decryptString($setting->api_key);
        $models = array_values(array_unique(array_merge(
            [$setting->model ?: $this->defaultModel($provider)],
            self::MODEL_FALLBACKS[$provider]
        )));

        try {
            foreach ($models as $index => $model) {
                $response = $this->sendToProvider($provider, $model, $apiKey, $contents);
                if ($response->status() === 503 && isset($models[$index + 1])) {
                    continue;
                }

                if (!$response->successful()) {
                    return $this->providerError($provider, $response);
                }

                $text = $this->responseText($provider, $response);
                if (!is_string($text) || trim($text) === '') {
                    return new JsonResponse(['error' => $provider . ' returned no text for this request.'], 502);
                }

                if ($model !== $setting->model) {
                    DB::table(self::TABLE)->where('server_id', $server->id)->update([
                        'model' => $model,
                        'updated_at' => now(),
                    ]);
                }

                return new JsonResponse([
                    'text' => $text,
                    'provider' => $provider,
                    'model' => $model,
                    'fallback' => $model !== $setting->model,
                ]);
            }
        } catch (ConnectionException) {
            return new JsonResponse(['error' => $provider . ' could not be reached. Please try again.'], 502);
        }

        return new JsonResponse(['error' => $provider . ' is temporarily unavailable on the selected models.'], 503);
    }

    private function defaultModel(string $provider): string
    {
        return match ($provider) {
            'claude' => 'claude-sonnet-4-5',
            'openai' => 'gpt-4o-mini',
            'openrouter' => 'openai/gpt-4o-mini',
            'groq' => 'llama-3.3-70b-versatile',
            'deepseek' => 'deepseek-chat',
            default => 'gemini-3.8-flash',
        };
    }

    private function sendToProvider(string $provider, string $model, string $apiKey, string $contents): Response
    {
        if ($provider === 'gemini') {
            return Http::timeout(90)
                ->acceptJson()
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->post(self::PROVIDERS[$provider] . '/v1beta/interactions', [
                    'model' => $model,
                    'input' => $contents,
                ]);
        }

        if ($provider === 'claude') {
            return Http::timeout(90)
                ->acceptJson()
                ->withHeaders([
                    'x-api-key' => $apiKey,
                    'anthropic-version' => '2023-06-01',
                ])
                ->post(self::PROVIDERS[$provider] . '/v1/messages', [
                    'model' => $model,
                    'max_tokens' => 4096,
                    'messages' => [['role' => 'user', 'content' => $contents]],
                    'temperature' => 0.2,
                ]);
        }

        $path = $provider === 'openai' ? '/v1/chat/completions' : '/openai/v1/chat/completions';
        if ($provider === 'openrouter') {
            $path = '/api/v1/chat/completions';
        } elseif ($provider === 'deepseek') {
            $path = '/chat/completions';
        }

        $request = Http::timeout(90)
            ->acceptJson()
            ->withToken($apiKey);

        if ($provider === 'openrouter') {
            $request = $request->withHeaders([
                'HTTP-Referer' => config('app.url'),
                'X-Title' => config('app.name'),
            ]);
        }

        return $request->post(self::PROVIDERS[$provider] . $path, [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => $contents]],
            'temperature' => 0.2,
        ]);
    }

    private function responseText(string $provider, Response $response): ?string
    {
        if ($provider === 'gemini') {
            foreach (['output_text', 'interaction.output_text'] as $path) {
                $text = $response->json($path);
                if (is_string($text) && trim($text) !== '') {
                    return $text;
                }
            }

            $outputs = $response->json('outputs', $response->json('interaction.outputs', []));
            $text = implode("\n", $this->extractInteractionText($outputs));

            return trim($text) === '' ? null : $text;
        }

        if ($provider === 'claude') {
            return collect($response->json('content', []))
                ->where('type', 'text')
                ->pluck('text')
                ->filter()
                ->implode("\n");
        }

        $content = $response->json('choices.0.message.content');
        if (is_array($content)) {
            return collect($content)->pluck('text')->filter()->implode("\n");
        }

        return is_string($content) ? $content : null;
    }

    private function extractInteractionText(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $type = $value['type'] ?? null;
        if (
            isset($value['text'])
            && is_string($value['text'])
            && (is_null($type) || in_array($type, ['text', 'output_text'], true))
        ) {
            return [$value['text']];
        }

        $texts = [];
        foreach ($value as $child) {
            if (is_array($child)) {
                $texts = array_merge($texts, $this->extractInteractionText($child));
            }
        }

        return $texts;
    }

    private function providerError(string $provider, Response $response): JsonResponse
    {
        $detail = $response->json('error.message') ?? $response->json('error') ?? 'No details returned.';
        if (is_array($detail)) {
            $detail = json_encode($detail);
        }

        return new JsonResponse([
            'error' => sprintf('%s API returned HTTP %d: %s', $provider, $response->status(), mb_substr((string) $detail, 0, 500)),
        ], 502);
    }

    private function authorizeFileAccess(Request $request, Server $server): void
    {
        if (!$request->user()->can(Permission::ACTION_FILE_READ_CONTENT, $server)) {
            throw new AuthorizationException();
        }
    }

    private function authorizeSettingsManagement(Request $request, Server $server): void
    {
        if (!$request->user()->can(Permission::ACTION_SETTINGS_RENAME, $server)) {
            throw new AuthorizationException();
        }
    }
}