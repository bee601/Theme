import React, { useEffect, useRef, useState } from 'react';
import CodeMirror from 'codemirror';
import { NavLink } from 'react-router-dom';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import Input from '@/components/elements/Input';
import { Textarea } from '@/components/elements/Input';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots, faPaperPlane, faTimes, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { FileHelperProvider, generateGeminiText, getGeminiSettings } from '@/api/server/gemini';
import { httpErrorToHuman } from '@/api/http';
import { loadServerFileIndex, searchServerFiles, ServerFileIndex } from '@/api/server/files/loadDirectory';
import { Dialog } from '@/components/elements/dialog';
import tw from 'twin.macro';
import styled, { keyframes } from 'styled-components/macro';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

interface Props {
    editorRef: React.MutableRefObject<CodeMirror.Editor | undefined>;
    filename: string;
}

interface GeminiAgentProps {
    editorRef?: React.MutableRefObject<CodeMirror.Editor | undefined>;
    filename?: string;
    fileManagerMode?: boolean;
    onOpenFile?: (path: string) => void;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    code?: string;
    filePaths?: string[];
    provider?: FileHelperProvider;
    model?: string;
    fallback?: boolean;
}

const providerLabels: Record<FileHelperProvider, string> = {
    gemini: 'Google Gemini',
    claude: 'Anthropic Claude',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    groq: 'Groq',
    deepseek: 'DeepSeek',
};

const ignoredFileSearchTerms = new Set([
    'a',
    'an',
    'file',
    'files',
    'find',
    'for',
    'in',
    'me',
    'my',
    'open',
    'please',
    'show',
    'the',
]);

const isOneCharacterApart = (left: string, right: string): boolean => {
    if (left === right || left.includes(right) || right.includes(left)) return true;
    if (Math.abs(left.length - right.length) > 1) return false;

    let leftIndex = 0;
    let rightIndex = 0;
    let edits = 0;
    while (leftIndex < left.length && rightIndex < right.length) {
        if (left[leftIndex] === right[rightIndex]) {
            leftIndex++;
            rightIndex++;
            continue;
        }

        edits++;
        if (edits > 1) return false;
        if (left.length > right.length) leftIndex++;
        else if (right.length > left.length) rightIndex++;
        else {
            leftIndex++;
            rightIndex++;
        }
    }

    return edits + (leftIndex < left.length || rightIndex < right.length ? 1 : 0) <= 1;
};

const findIndexedFiles = (paths: string[], query: string): string[] => {
    const terms = query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 1 && !ignoredFileSearchTerms.has(term));
    if (!terms.length) return [];

    const ranked = paths
        .map((path) => {
            const words = path
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter(Boolean);
            const score = terms.filter((term) => words.some((word) => isOneCharacterApart(term, word))).length;

            return { path, score };
        })
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));

    const completeMatches = ranked.filter(({ score }) => score === terms.length);
    return (completeMatches.length ? completeMatches : ranked).slice(0, 8).map(({ path }) => path);
};

const thinkingPulse = keyframes`
    0%, 80%, 100% { transform: scale(0.65); opacity: 0.45; }
    40% { transform: scale(1); opacity: 1; }
`;

const ThinkingDot = styled.span<{ delay: string }>`
    display: block;
    width: 0.3rem;
    height: 0.3rem;
    border-radius: 9999px;
    background: currentColor;
    animation: ${thinkingPulse} 1s ease-in-out infinite;
    animation-delay: ${(props) => props.delay};
`;

const hsvToRgb = (hue: number, saturation: number, value: number): [number, number, number] => {
    const chroma = value * saturation;
    const hueSection = hue / 60;
    const second = chroma * (1 - Math.abs((hueSection % 2) - 1));
    const offset = value - chroma;
    const values =
        hueSection < 1
            ? [chroma, second, 0]
            : hueSection < 2
            ? [second, chroma, 0]
            : hueSection < 3
            ? [0, chroma, second]
            : hueSection < 4
            ? [0, second, chroma]
            : hueSection < 5
            ? [second, 0, chroma]
            : [chroma, 0, second];

    return [
        Math.round((values[0] + offset) * 255),
        Math.round((values[1] + offset) * 255),
        Math.round((values[2] + offset) * 255),
    ];
};

const rgbToHex = (red: number, green: number, blue: number): string =>
    `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const hexToWheelPosition = (hex: string, radius: number) => {
    const channels = hex
        .slice(1)
        .match(/.{2}/g)
        ?.map((value) => parseInt(value, 16) / 255) || [0.33, 0.67, 1];
    const [red, green, blue] = channels;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const difference = maximum - minimum;
    let hue = 0;

    if (difference !== 0) {
        if (maximum === red) hue = 60 * (((green - blue) / difference) % 6);
        else if (maximum === green) hue = 60 * ((blue - red) / difference + 2);
        else hue = 60 * ((red - green) / difference + 4);
    }

    if (hue < 0) hue += 360;
    const saturation = maximum === 0 ? 0 : difference / maximum;
    const angle = (hue * Math.PI) / 180;

    return {
        x: radius + Math.cos(angle) * saturation * radius,
        y: radius + Math.sin(angle) * saturation * radius,
    };
};

const HexColorWheel = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = 224;
    const radius = size / 2;

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        const image = context.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x + 0.5 - radius;
                const dy = y + 0.5 - radius;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > radius) continue;

                let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
                if (hue < 0) hue += 360;
                const [red, green, blue] = hsvToRgb(hue, distance / radius, 1);
                const index = (y * size + x) * 4;
                image.data[index] = red;
                image.data[index + 1] = green;
                image.data[index + 2] = blue;
                image.data[index + 3] = 255;
            }
        }

        context.putImageData(image, 0, 0);
        const marker = hexToWheelPosition(value, radius);
        context.beginPath();
        context.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
        context.lineWidth = 2;
        context.strokeStyle = '#FFFFFF';
        context.stroke();
    }, [value]);

    const pickColor = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        const bounds = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(size - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * size)));
        const y = Math.max(0, Math.min(size - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * size)));
        const pixel = context.getImageData(x, y, 1, 1).data;
        if (pixel[3] > 0) onChange(rgbToHex(pixel[0], pixel[1], pixel[2]));
    };

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            aria-label={'Custom hex color wheel'}
            role={'slider'}
            tabIndex={0}
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                pickColor(event);
            }}
            onPointerMove={(event) => event.buttons > 0 && pickColor(event)}
            css={tw`h-48 w-48 rounded-full`}
            style={{ touchAction: 'none', cursor: 'crosshair' }}
        />
    );
};

const colors = [
    { code: '0', label: 'Black', hex: '#000000' },
    { code: '1', label: 'Dark blue', hex: '#0000AA' },
    { code: '2', label: 'Dark green', hex: '#00AA00' },
    { code: '3', label: 'Dark aqua', hex: '#00AAAA' },
    { code: '4', label: 'Dark red', hex: '#AA0000' },
    { code: '5', label: 'Dark purple', hex: '#AA00AA' },
    { code: '6', label: 'Gold', hex: '#FFAA00' },
    { code: '7', label: 'Gray', hex: '#AAAAAA' },
    { code: '8', label: 'Dark gray', hex: '#555555' },
    { code: '9', label: 'Blue', hex: '#5555FF' },
    { code: 'a', label: 'Green', hex: '#55FF55' },
    { code: 'b', label: 'Aqua', hex: '#55FFFF' },
    { code: 'c', label: 'Red', hex: '#FF5555' },
    { code: 'd', label: 'Light purple', hex: '#FF55FF' },
    { code: 'e', label: 'Yellow', hex: '#FFFF55' },
    { code: 'f', label: 'White', hex: '#FFFFFF' },
];

const formats = [
    { code: 'k', label: 'Obfuscated' },
    { code: 'l', label: 'Bold' },
    { code: 'm', label: 'Strikethrough' },
    { code: 'n', label: 'Underline' },
    { code: 'o', label: 'Italic' },
    { code: 'r', label: 'Reset' },
];

export const GeminiAgent = ({ editorRef, filename, fileManagerMode = false, onOpenFile }: GeminiAgentProps) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const userUuid = useStoreState((state: ApplicationStore) => state.user.data?.uuid || 'unknown');
    const historyKey = `pterodactyl:file-helper-history:${userUuid}:${uuid}`;
    const [configured, setConfigured] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState('');
    const [serverFileIndex, setServerFileIndex] = useState<ServerFileIndex>();
    const [pendingApply, setPendingApply] = useState('');
    const [provider, setProvider] = useState<FileHelperProvider>('gemini');
    const [model, setModel] = useState('gemini-3.8-flash');
    const [historyLoadedKey, setHistoryLoadedKey] = useState('');
    const [confirmClearHistory, setConfirmClearHistory] = useState(false);

    useEffect(() => {
        setHistoryLoadedKey('');
        try {
            const stored = JSON.parse(localStorage.getItem(historyKey) || '[]');
            const history = Array.isArray(stored)
                ? stored.filter(
                      (message): message is ChatMessage =>
                          message &&
                          typeof message.text === 'string' &&
                          (message.role === 'user' || message.role === 'assistant')
                  )
                : [];
            setMessages(history.slice(-60));
        } catch {
            setMessages([]);
        }
        setHistoryLoadedKey(historyKey);
    }, [historyKey]);

    useEffect(() => {
        if (historyLoadedKey !== historyKey) return;

        try {
            localStorage.setItem(historyKey, JSON.stringify(messages.slice(-60)));
        } catch (error) {
            console.warn('File Helper history could not be saved in this browser.', error);
        }
    }, [historyKey, historyLoadedKey, messages]);

    useEffect(() => {
        getGeminiSettings(uuid)
            .then((settings) => {
                setConfigured(settings.configured);
                setProvider(settings.provider);
                setModel(settings.model);
            })
            .catch((error) => setError(httpErrorToHuman(error)))
            .finally(() => setLoading(false));
    }, [uuid]);

    const askGemini = async (event: React.FormEvent) => {
        event.preventDefault();
        const request = prompt.trim();
        if (!request || sending || !configured) return;

        setMessages((current) => [...current, { role: 'user', text: request }]);
        setPrompt('');
        setSending(true);
        setError('');
        setStatus(fileManagerMode ? 'Searching server files…' : '');
        try {
            let fileIndex: ServerFileIndex | undefined;
            if (fileManagerMode) {
                const indexedMatches = serverFileIndex ? findIndexedFiles(serverFileIndex.paths, request) : [];
                const localMatches = indexedMatches.length ? indexedMatches : await searchServerFiles(uuid, request);
                if (localMatches.length) {
                    setMessages((current) => [
                        ...current,
                        {
                            role: 'assistant',
                            text: `Found ${localMatches.length} matching file${
                                localMatches.length === 1 ? '' : 's'
                            } in the server index:`,
                            filePaths: localMatches,
                        },
                    ]);
                    return;
                }

                fileIndex = serverFileIndex || (await loadServerFileIndex(uuid));
                setServerFileIndex(fileIndex);
                setStatus(`Asking ${providerLabels[provider]}…`);
            }

            const editor = editorRef?.current;
            const selection = editor?.getSelection() || '';
            const indexedPaths = fileIndex?.paths.join('\n') || '[No files found]';
            const result = await generateGeminiText(uuid, {
                prompt: request,
                file_name: fileManagerMode ? 'server file index' : filename,
                selection: selection || undefined,
                file_content: fileManagerMode || selection ? undefined : editor?.getValue(),
                file_index: fileManagerMode
                    ? `${fileIndex?.truncated ? '[Index is partial due to safe scan limits.]\n' : ''}${indexedPaths}`
                    : undefined,
            });
            const text = result.text;
            const filePaths = fileManagerMode
                ? (fileIndex?.paths || []).filter((path) => text.includes(path)).slice(0, 8)
                : undefined;
            const code = !fileManagerMode ? text.match(/```[^\n]*\n([\s\S]*?)```/)?.[1] : undefined;
            setProvider(result.provider);
            setModel(result.model);
            setMessages((current) => [
                ...current,
                {
                    role: 'assistant',
                    text,
                    code,
                    filePaths,
                    provider: result.provider,
                    model: result.model,
                    fallback: result.fallback,
                },
            ]);
        } catch (error) {
            setError(httpErrorToHuman(error));
        } finally {
            setSending(false);
            setStatus('');
        }
    };

    const insertResponse = (text: string) => {
        editorRef?.current?.replaceSelection(text);
    };

    const applyResponse = () => {
        if (!pendingApply || !editorRef?.current) return;
        editorRef.current.setValue(pendingApply);
        setPendingApply('');
    };

    return (
        <div css={tw`fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end sm:left-auto sm:right-6`}>
            <Dialog.Confirm
                open={confirmClearHistory}
                onClose={() => setConfirmClearHistory(false)}
                title={'Clear File Helper chat history?'}
                confirm={'Clear history'}
                onConfirmed={() => {
                    setMessages([]);
                    setConfirmClearHistory(false);
                }}
            >
                This removes the locally stored chat history for this server and browser user.
            </Dialog.Confirm>
            <Dialog.Confirm
                open={pendingApply !== ''}
                onClose={() => setPendingApply('')}
                title={'Replace editor contents with File Helper code?'}
                confirm={'Replace file contents'}
                onConfirmed={applyResponse}
            >
                This replaces the current editor contents. Review the result, then use Save Content to write it to the
                server.
            </Dialog.Confirm>
            {open && (
                <section
                    role={'dialog'}
                    aria-label={'File Helper chat'}
                    css={tw`mb-3 flex w-full flex-col overflow-hidden rounded-xl border border-neutral-600 bg-neutral-900 shadow-2xl sm:w-80`}
                    style={{ maxHeight: 'min(32rem, calc(100vh - 6rem))' }}
                >
                    <header css={tw`flex items-center justify-between border-b border-neutral-700 px-4 py-3`}>
                        <div>
                            <h2 css={tw`text-sm font-semibold text-neutral-100`}>File Helper</h2>
                            <p css={tw`text-xs text-neutral-400`}>
                                {providerLabels[provider]} · {model}
                            </p>
                        </div>
                        <div css={tw`flex items-center gap-1`}>
                            {!!messages.length && (
                                <button
                                    type={'button'}
                                    aria-label={'Clear File Helper chat history'}
                                    onClick={() => setConfirmClearHistory(true)}
                                    css={tw`rounded p-2 text-neutral-400 hover:bg-neutral-700 hover:text-white`}
                                >
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                </button>
                            )}
                            <button
                                type={'button'}
                                aria-label={'Close File Helper chat'}
                                onClick={() => setOpen(false)}
                                css={tw`rounded p-2 text-neutral-300 hover:bg-neutral-700 hover:text-white`}
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                    </header>
                    {!configured && !loading ? (
                        <div css={tw`p-4`}>
                            <p css={tw`mb-3 text-sm text-neutral-300`}>Connect an API key to start chatting.</p>
                            <NavLink to={`/server/${id}/ai`} css={tw`text-sm text-cyan-300 hover:text-cyan-200`}>
                                Configure this server
                            </NavLink>
                        </div>
                    ) : (
                        <>
                            <div role={'log'} aria-live={'polite'} css={tw`flex-1 space-y-3 overflow-y-auto p-3`}>
                                <p css={tw`text-xs text-neutral-500`}>
                                    {fileManagerMode
                                        ? `File search sends paths, not contents, to ${providerLabels[provider]}.`
                                        : `Selected code, or the full file when nothing is selected, is sent to ${providerLabels[provider]}.`}
                                </p>
                                <p css={tw`text-2xs text-neutral-500`}>
                                    Chat history is saved in this browser for this user and server.
                                </p>
                                {!messages.length && !loading && (
                                    <p css={tw`rounded-lg bg-neutral-800 p-3 text-sm text-neutral-300`}>
                                        Hi! Ask me about this file or your selected code.
                                    </p>
                                )}
                                {messages.map((message, index) => (
                                    <div
                                        key={`${message.role}-${index}`}
                                        css={
                                            message.role === 'user'
                                                ? tw`ml-6 whitespace-pre-wrap break-words rounded-lg bg-cyan-800 p-3 text-sm text-white`
                                                : tw`mr-3 whitespace-pre-wrap break-words rounded-lg bg-neutral-800 p-3 text-sm text-neutral-200`
                                        }
                                    >
                                        {message.text}
                                        {message.role === 'assistant' && message.model && (
                                            <p css={tw`mt-2 text-2xs text-neutral-500`}>
                                                {message.provider} · {message.model}
                                                {message.fallback ? ' · automatic fallback' : ''}
                                            </p>
                                        )}
                                        {message.role === 'assistant' &&
                                            message.filePaths?.map((path) => (
                                                <button
                                                    key={path}
                                                    type={'button'}
                                                    onClick={() => onOpenFile?.(path)}
                                                    css={tw`mt-2 block text-left text-xs text-cyan-300 hover:text-cyan-200`}
                                                >
                                                    Open {path}
                                                </button>
                                            ))}
                                        {message.role === 'assistant' && message.code && editorRef && (
                                            <div css={tw`mt-3 flex flex-wrap gap-3`}>
                                                <button
                                                    type={'button'}
                                                    onClick={() => insertResponse(message.code!)}
                                                    css={tw`text-xs text-cyan-300 hover:text-cyan-200`}
                                                >
                                                    Insert code
                                                </button>
                                                <button
                                                    type={'button'}
                                                    onClick={() => setPendingApply(message.code!)}
                                                    css={tw`text-xs text-cyan-300 hover:text-cyan-200`}
                                                >
                                                    Replace file with code…
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {sending && (
                                    <div role={'status'} css={tw`flex items-center gap-2 text-xs text-neutral-400`}>
                                        <span>{status || 'File Helper is thinking'}</span>
                                        <span css={tw`flex items-center gap-1`}>
                                            {['0ms', '140ms', '280ms'].map((delay) => (
                                                <ThinkingDot key={delay} delay={delay} />
                                            ))}
                                        </span>
                                    </div>
                                )}
                                {error && (
                                    <p role={'alert'} css={tw`text-xs text-red-300`}>
                                        {error}
                                    </p>
                                )}
                            </div>
                            <form onSubmit={(event) => void askGemini(event)} css={tw`border-t border-neutral-700 p-3`}>
                                <label htmlFor={'file-helper-prompt'} css={tw`sr-only`}>
                                    Message File Helper about the selected code or current file
                                </label>
                                <div css={tw`flex items-end gap-2`}>
                                    <Textarea
                                        id={'file-helper-prompt'}
                                        rows={2}
                                        value={prompt}
                                        onChange={(event) => setPrompt(event.currentTarget.value)}
                                        placeholder={
                                            fileManagerMode
                                                ? 'Describe the file you are looking for…'
                                                : 'Message File Helper…'
                                        }
                                        css={tw`max-h-24 min-h-0 resize-y p-2`}
                                    />
                                    <button
                                        type={'submit'}
                                        aria-label={'Send message to File Helper'}
                                        disabled={sending || loading || !configured || !prompt.trim()}
                                        css={tw`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-cyan-700 text-white disabled:opacity-50`}
                                    >
                                        <FontAwesomeIcon icon={faPaperPlane} />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </section>
            )}
            <button
                type={'button'}
                aria-label={open ? 'Close File Helper' : 'Open File Helper'}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                css={tw`flex items-center gap-2 rounded-full bg-cyan-700 px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-cyan-600`}
            >
                <FontAwesomeIcon icon={open ? faTimes : faCommentDots} />
                File Helper
            </button>
        </div>
    );
};

export default ({ editorRef, filename }: Props) => {
    const [hexColor, setHexColor] = useState('#55AAFF');
    const [wheelOpen, setWheelOpen] = useState(false);
    const validHex = /^#[0-9a-f]{6}$/i.test(hexColor);

    const insert = (value: string) => editorRef.current?.replaceSelection(value);
    const setColor = (value: string) => setHexColor(value.toUpperCase());
    const mcHex = validHex
        ? `§x${hexColor
              .slice(1)
              .split('')
              .map((digit) => `§${digit}`)
              .join('')}`
        : '';

    return (
        <div css={tw`mt-4`}>
            <Can action={'file.read-content'}>
                <GeminiAgent editorRef={editorRef} filename={filename} />
            </Can>
            <section css={tw`rounded-lg bg-neutral-800 p-4`}>
                <div css={tw`flex flex-wrap items-center gap-4 mb-4`}>
                    <h2 css={tw`text-sm font-semibold text-neutral-100`}>Minecraft color tools</h2>
                    <button
                        type={'button'}
                        onClick={() => setWheelOpen((open) => !open)}
                        css={tw`h-9 w-9 rounded border border-white border-opacity-30`}
                        style={{ backgroundColor: validHex ? hexColor : '#55AAFF' }}
                        aria-label={'Toggle custom hex color wheel'}
                        aria-expanded={wheelOpen}
                    />
                    <span css={tw`text-sm text-neutral-300`}>Hex color</span>
                    <Input
                        aria-label={'Hex color value'}
                        value={hexColor}
                        onChange={(event) => setHexColor(event.currentTarget.value)}
                        css={tw`w-32 font-mono`}
                    />
                    <button
                        type={'button'}
                        disabled={!validHex}
                        onClick={() => insert(hexColor.toUpperCase())}
                        css={tw`px-3 py-2 rounded bg-neutral-700 text-sm disabled:opacity-50`}
                    >
                        Insert hex
                    </button>
                    <button
                        type={'button'}
                        disabled={!validHex}
                        onClick={() => insert(mcHex)}
                        css={tw`px-3 py-2 rounded bg-neutral-700 text-sm disabled:opacity-50`}
                    >
                        Insert MC hex
                    </button>
                </div>
                {wheelOpen && (
                    <div css={tw`mb-4 flex flex-wrap items-center gap-4 rounded bg-neutral-900 p-4`}>
                        <HexColorWheel value={validHex ? hexColor : '#55AAFF'} onChange={setColor} />
                        <div css={tw`text-sm text-neutral-300`}>
                            <p css={tw`mb-2`}>Pick any hue and saturation.</p>
                            <p css={tw`font-mono text-lg text-neutral-100`}>
                                {validHex ? hexColor : 'Enter a valid hex code'}
                            </p>
                        </div>
                    </div>
                )}
                <p css={tw`text-xs text-neutral-400 mb-2`}>Legacy color codes (reference)</p>
                <div css={tw`grid grid-cols-8 gap-2 mb-4`}>
                    {colors.map(({ code, label, hex }) => (
                        <div
                            key={code}
                            title={`${label} (§${code})`}
                            aria-label={`${label} Minecraft color code §${code}`}
                            css={tw`flex h-9 items-center justify-center rounded border border-white border-opacity-20 font-mono text-sm text-white`}
                            style={{ backgroundColor: hex }}
                        >
                            §{code}
                        </div>
                    ))}
                </div>
                <p css={tw`text-xs text-neutral-400 mb-2`}>Formatting codes (reference)</p>
                <div css={tw`flex flex-wrap gap-2`}>
                    {formats.map(({ code, label }) => (
                        <span key={code} css={tw`px-3 py-2 rounded bg-neutral-700 text-sm text-neutral-100`}>
                            §{code} {label}
                        </span>
                    ))}
                </div>
            </section>
        </div>
    );
};
