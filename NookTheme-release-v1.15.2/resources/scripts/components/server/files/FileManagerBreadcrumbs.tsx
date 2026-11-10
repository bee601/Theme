import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { NavLink, useLocation } from 'react-router-dom';
import { encodePathSegments, hashToPath } from '@/helpers';
import tw from 'twin.macro';

interface Props {
    renderLeft?: JSX.Element;
    withinFileEditor?: boolean;
    isNewFile?: boolean;
    onMoveItem?: (name: string, targetDirectory: string) => void;
}

export default ({ renderLeft, withinFileEditor, isNewFile, onMoveItem }: Props) => {
    const [file, setFile] = useState<string | null>(null);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { hash } = useLocation();

    useEffect(() => {
        const path = hashToPath(hash);

        if (withinFileEditor && !isNewFile) {
            const name = path.split('/').pop() || null;
            setFile(name);
        }
    }, [withinFileEditor, isNewFile, hash]);

    const breadcrumbs = (): { name: string; path?: string }[] =>
        directory
            .split('/')
            .filter((directory) => !!directory)
            .map((directory, index, dirs) => {
                if (!withinFileEditor && index === dirs.length - 1) {
                    return { name: directory };
                }

                return { name: directory, path: `/${dirs.slice(0, index + 1).join('/')}` };
            });

    const getDraggedName = (event: React.DragEvent<HTMLAnchorElement>) =>
        event.dataTransfer.getData('application/x-pterodactyl-item') ||
        event.dataTransfer.getData('application/x-pterodactyl-folder');

    const handleDragOver = (event: React.DragEvent<HTMLAnchorElement>) => {
        if (!onMoveItem) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (targetDirectory: string) => (event: React.DragEvent<HTMLAnchorElement>) => {
        const name = getDraggedName(event);
        if (!name || !onMoveItem) return;

        event.preventDefault();
        event.stopPropagation();
        onMoveItem(name, targetDirectory);
    };

    return (
        <div css={tw`flex flex-grow-0 items-center text-sm text-neutral-500 overflow-x-hidden`}>
            {renderLeft || <div css={tw`w-12`} />}/<span css={tw`px-1 text-neutral-300`}>home</span>/
            <NavLink
                to={`/server/${id}/files`}
                onDragOver={handleDragOver}
                onDrop={handleDrop('/')}
                css={tw`px-1 text-neutral-200 no-underline hover:text-neutral-100`}
            >
                container
            </NavLink>
            /
            {breadcrumbs().map((crumb, index) =>
                crumb.path ? (
                    <React.Fragment key={index}>
                        <NavLink
                            to={`/server/${id}/files#${encodePathSegments(crumb.path)}`}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop(crumb.path)}
                            css={tw`px-1 text-neutral-200 no-underline hover:text-neutral-100`}
                        >
                            {crumb.name}
                        </NavLink>
                        /
                    </React.Fragment>
                ) : (
                    <span key={index} css={tw`px-1 text-neutral-300`}>
                        {crumb.name}
                    </span>
                )
            )}
            {file && (
                <React.Fragment>
                    <span css={tw`px-1 text-neutral-300`}>{file}</span>
                </React.Fragment>
            )}
        </div>
    );
};
