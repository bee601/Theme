import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Can from '@/components/elements/Can';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import { Button } from '@/components/elements/button/index';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { deleteGeminiSettings, FileHelperProvider, getGeminiSettings, saveGeminiSettings } from '@/api/server/gemini';
import { Dialog } from '@/components/elements/dialog';

const defaultModels: Record<FileHelperProvider, string> = {
    gemini: 'gemini-3.8-flash',
    claude: 'claude-sonnet-4-5',
    openai: 'gpt-4o-mini',
    openrouter: 'openai/gpt-4o-mini',
    groq: 'llama-3.3-70b-versatile',
    deepseek: 'deepseek-chat',
};

const providers: { id: FileHelperProvider; label: string }[] = [
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'claude', label: 'Anthropic Claude' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'groq', label: 'Groq' },
    { id: 'deepseek', label: 'DeepSeek' },
];

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [configured, setConfigured] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [provider, setProvider] = useState<FileHelperProvider>('gemini');
    const [model, setModel] = useState(defaultModels.gemini);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const { addFlash, clearAndAddHttpError, clearFlashes } = useFlash();

    useEffect(() => {
        getGeminiSettings(uuid)
            .then((settings) => {
                setConfigured(settings.configured);
                setProvider(settings.provider);
                setModel(settings.model);
            })
            .catch((error) => clearAndAddHttpError({ key: 'file-helper', error }))
            .finally(() => setLoading(false));
    }, [uuid]);

    const save = async () => {
        if (!model.trim() || (!apiKey.trim() && !configured)) return;

        setSaving(true);
        clearFlashes('file-helper');
        try {
            const settings = await saveGeminiSettings(uuid, {
                provider,
                model: model.trim(),
                api_key: apiKey.trim() || undefined,
            });
            setApiKey('');
            setConfigured(settings.configured);
            setProvider(settings.provider);
            setModel(settings.model);
            addFlash({ key: 'file-helper', type: 'success', message: 'File Helper settings saved for this server.' });
        } catch (error) {
            clearAndAddHttpError({ key: 'file-helper', error });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setSaving(true);
        clearFlashes('file-helper');
        try {
            await deleteGeminiSettings(uuid);
            setConfigured(false);
            setConfirmDelete(false);
            addFlash({ key: 'file-helper', type: 'success', message: 'File Helper key removed from this server.' });
        } catch (error) {
            clearAndAddHttpError({ key: 'file-helper', error });
        } finally {
            setSaving(false);
        }
    };

    return (
        <ServerContentBlock title={'File Helper'}>
            <FlashMessageRender byKey={'file-helper'} css={tw`mb-4`} />
            <div css={tw`max-w-4xl`}>
                <Can action={'settings.rename'}>
                    <TitledGreyBox title={'File Helper Configuration'} css={tw`mb-6`}>
                        <div css={tw`grid gap-6 md:grid-cols-2`}>
                            <div>
                                <Label htmlFor={'file-helper-provider'}>Provider</Label>
                                <Select
                                    id={'file-helper-provider'}
                                    value={provider}
                                    disabled={loading || saving}
                                    onChange={(event) => {
                                        const next = event.currentTarget.value as FileHelperProvider;
                                        setProvider(next);
                                        setModel(defaultModels[next]);
                                    }}
                                >
                                    {providers.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.label}
                                        </option>
                                    ))}
                                </Select>
                                <Label htmlFor={'file-helper-model'} css={tw`mt-4`}>
                                    Model
                                </Label>
                                <Input
                                    id={'file-helper-model'}
                                    value={model}
                                    disabled={loading || saving}
                                    onChange={(event) => setModel(event.currentTarget.value)}
                                    placeholder={defaultModels[provider]}
                                />
                            </div>
                            <div>
                                <Label htmlFor={'file-helper-api-key'}>API key</Label>
                                <Input
                                    id={'file-helper-api-key'}
                                    type={'password'}
                                    autoComplete={'new-password'}
                                    value={apiKey}
                                    onChange={(event) => setApiKey(event.currentTarget.value)}
                                    placeholder={
                                        configured ? 'Leave blank to keep the saved key' : 'Paste provider API key'
                                    }
                                    css={tw`mb-3`}
                                />
                                <p css={tw`text-xs text-neutral-400`}>
                                    The key is encrypted on this panel and never returned to the browser. A 503 response
                                    triggers provider-specific model fallbacks.
                                </p>
                            </div>
                        </div>
                        <div css={tw`mt-6 flex flex-wrap items-center gap-3`}>
                            <Button
                                disabled={saving || loading || !model.trim() || (!apiKey.trim() && !configured)}
                                onClick={save}
                            >
                                {saving ? 'Saving…' : 'Save File Helper'}
                            </Button>
                            <span css={configured ? tw`text-green-400 text-sm` : tw`text-neutral-400 text-sm`}>
                                {loading ? 'Loading settings…' : configured ? 'Configured' : 'Not configured'}
                            </span>
                            {configured && (
                                <Button.Danger
                                    disabled={saving}
                                    variant={Button.Variants.Secondary}
                                    onClick={() => setConfirmDelete(true)}
                                >
                                    Remove key
                                </Button.Danger>
                            )}
                        </div>
                    </TitledGreyBox>
                </Can>
            </div>
            <Dialog.Confirm
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                title={'Remove File Helper API key'}
                confirm={'Remove key'}
                onConfirmed={remove}
            >
                File Helper will stop working for this server until another key is configured.
            </Dialog.Confirm>
        </ServerContentBlock>
    );
};
