import http from '@/api/http';
import { rawDataToFileObject } from '@/api/transformers';

export interface FileObject {
    key: string;
    name: string;
    mode: string;
    modeBits: string;
    size: number;
    isFile: boolean;
    isSymlink: boolean;
    mimetype: string;
    createdAt: Date;
    modifiedAt: Date;
    isArchiveType: () => boolean;
    isEditable: () => boolean;
}

const loadDirectory = async (uuid: string, directory?: string): Promise<FileObject[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/files/list`, {
        params: { directory: directory ?? '/' },
    });

    return (data.data || []).map(rawDataToFileObject);
};

export default loadDirectory;

export interface ServerFileIndex {
    paths: string[];
    truncated: boolean;
}

export const loadServerFileIndex = async (uuid: string): Promise<ServerFileIndex> => {
    const directories = [{ path: '/', depth: 0 }];
    const paths: string[] = [];
    const maxDirectories = 120;
    const maxFiles = 1200;
    const maxPathCharacters = 58000;
    let visitedDirectories = 0;
    let pathCharacters = 0;
    let truncated = false;

    while (directories.length && visitedDirectories < maxDirectories && paths.length < maxFiles) {
        const batch = directories.splice(0, 4);
        const results = await Promise.all(
            batch.map(async ({ path, depth }) => ({ path, depth, files: await loadDirectory(uuid, path) }))
        );
        visitedDirectories += batch.length;

        for (const { path: directory, depth, files } of results) {
            for (const file of files) {
                const path = `${directory === '/' ? '' : directory}/${file.name}`;

                if (file.isFile) {
                    if (pathCharacters + path.length > maxPathCharacters || paths.length >= maxFiles) {
                        truncated = true;
                        break;
                    }

                    paths.push(path);
                    pathCharacters += path.length;
                } else if (!file.isSymlink && depth < 8) {
                    directories.push({ path, depth: depth + 1 });
                }
            }

            if (truncated) break;
        }
    }

    if (directories.length || visitedDirectories >= maxDirectories) truncated = true;

    return { paths, truncated };
};

const fileSearchStopWords = new Set([
    'a',
    'an',
    'can',
    'could',
    'file',
    'files',
    'find',
    'for',
    'in',
    'it',
    'me',
    'my',
    'open',
    'please',
    'show',
    'the',
    'to',
    'where',
    'with',
    'yo',
]);

const isCloseFileSearchWord = (query: string, word: string): boolean => {
    if (query === word || query.includes(word) || word.includes(query)) return true;
    if (Math.abs(query.length - word.length) > 1) return false;

    let queryIndex = 0;
    let wordIndex = 0;
    let edits = 0;
    while (queryIndex < query.length && wordIndex < word.length) {
        if (query[queryIndex] === word[wordIndex]) {
            queryIndex++;
            wordIndex++;
            continue;
        }

        edits++;
        if (edits > 1) return false;
        if (query.length > word.length) queryIndex++;
        else if (word.length > query.length) wordIndex++;
        else {
            queryIndex++;
            wordIndex++;
        }
    }

    return edits + (queryIndex < query.length || wordIndex < word.length ? 1 : 0) <= 1;
};

export const searchServerFiles = async (uuid: string, query: string): Promise<string[]> => {
    const terms = query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 1 && !fileSearchStopWords.has(term));
    if (!terms.length) return [];

    const looksLikeFileQuery = terms.some(
        (term) => term.includes('.') || term.length <= 4 || term === 'yml' || term === 'yaml'
    );
    if (!looksLikeFileQuery) return [];

    const directories = [{ path: '/', depth: 0 }];
    const exactMatches = new Set<string>();
    const partialMatches = new Map<string, number>();
    let visitedDirectories = 0;
    let visitedFiles = 0;
    const maxDirectories = 32;
    const maxFiles = 350;

    while (
        directories.length &&
        visitedDirectories < maxDirectories &&
        visitedFiles < maxFiles &&
        exactMatches.size < 8
    ) {
        const batch = directories.splice(0, 4);
        const results = await Promise.all(
            batch.map(async ({ path, depth }) => ({ path, depth, files: await loadDirectory(uuid, path) }))
        );
        visitedDirectories += batch.length;

        for (const { path: directory, depth, files } of results) {
            for (const file of files) {
                const path = `${directory === '/' ? '' : directory}/${file.name}`;
                if (file.isFile) {
                    visitedFiles++;
                    const words = path
                        .toLowerCase()
                        .split(/[^a-z0-9]+/)
                        .filter(Boolean);
                    const score = terms.filter((term) =>
                        words.some((word) => isCloseFileSearchWord(term, word))
                    ).length;
                    if (score === terms.length) exactMatches.add(path);
                    else if (score > 0) partialMatches.set(path, score);
                } else if (!file.isSymlink && depth < 8) {
                    directories.push({ path, depth: depth + 1 });
                }

                if (visitedFiles >= maxFiles || exactMatches.size >= 8) break;
            }

            if (visitedFiles >= maxFiles || exactMatches.size >= 8) break;
        }
    }

    if (exactMatches.size) return Array.from(exactMatches).slice(0, 8);

    return Array.from(partialMatches.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 8)
        .map(([path]) => path);
};
