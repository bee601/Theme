import http from '@/api/http';

export interface GeminiSettings {
    configured: boolean;
    provider: FileHelperProvider;
    model: string;
}

export type FileHelperProvider = 'gemini' | 'claude' | 'openai' | 'openrouter' | 'groq' | 'deepseek';

export interface FileHelperConfiguration {
    provider: FileHelperProvider;
    model: string;
    api_key?: string;
}

export interface GeminiGenerateRequest {
    prompt: string;
    file_name?: string;
    file_content?: string;
    selection?: string;
    file_index?: string;
}

export const getGeminiSettings = async (uuid: string): Promise<GeminiSettings> => {
    const { data } = await http.get<GeminiSettings>(`/api/client/servers/${uuid}/ai/settings`);

    return data;
};

export const saveGeminiSettings = async (
    uuid: string,
    configuration: FileHelperConfiguration
): Promise<GeminiSettings> => {
    const { data } = await http.put<GeminiSettings>(`/api/client/servers/${uuid}/ai/settings`, configuration);

    return data;
};

export const deleteGeminiSettings = async (uuid: string): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/ai/settings`);
};

export interface GeminiGeneration {
    text: string;
    provider: FileHelperProvider;
    model: string;
    fallback: boolean;
}

export const generateGeminiText = async (uuid: string, request: GeminiGenerateRequest): Promise<GeminiGeneration> => {
    const { data } = await http.post<GeminiGeneration>(`/api/client/servers/${uuid}/ai/generate`, request, {
        timeout: 100000,
    });

    return data;
};
