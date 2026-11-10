import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faFileArchive, faFileImport, faFolder } from '@fortawesome/free-solid-svg-icons';
import { encodePathSegments } from '@/helpers';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import React, { memo, useState } from 'react';
import { FileObject } from '@/api/server/files/loadDirectory';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { ServerContext } from '@/state/server';
import { NavLink, useRouteMatch } from 'react-router-dom';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import { usePermissions } from '@/plugins/usePermissions';
import { join } from 'pathe';
import { bytesToString } from '@/lib/formatters';
import styles from './style.module.css';

const Clickable: React.FC<{ file: FileObject }> = memo(({ file, children }) => {
    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const match = useRouteMatch();

    return (file.isFile && (!file.isEditable() || !canReadContents)) || (!file.isFile && !canRead) ? (
        <div className={styles.details}>{children}</div>
    ) : (
        <NavLink
            className={styles.details}
            to={`${match.url}${file.isFile ? '/edit' : ''}#${encodePathSegments(join(directory, file.name))}`}
        >
            {children}
        </NavLink>
    );
}, isEqual);

interface Props {
    file: FileObject;
    onMoveItem: (name: string, targetDirectory: string) => void;
}

const FileObjectRow = ({ file, onMoveItem }: Props) => {
    const [canUpdate] = usePermissions(['file.update']);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    return (
        <div
            className={`${styles.file_row} ${isDropTarget ? styles.file_row_drop_target : ''}`}
            key={file.name}
            draggable={canUpdate}
            onDragStart={(event) => {
                if (canUpdate) {
                    event.dataTransfer.setData('application/x-pterodactyl-item', file.name);
                    if (!file.isFile) {
                        event.dataTransfer.setData('application/x-pterodactyl-folder', file.name);
                    }
                    event.dataTransfer.effectAllowed = 'move';
                }
            }}
            onDragOver={(event) => {
                if (!file.isFile && canUpdate) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setIsDropTarget(true);
                }
            }}
            onDragLeave={() => setIsDropTarget(false)}
            onDrop={(event) => {
                setIsDropTarget(false);
                if (file.isFile || !canUpdate) return;

                const name =
                    event.dataTransfer.getData('application/x-pterodactyl-item') ||
                    event.dataTransfer.getData('application/x-pterodactyl-folder');
                if (name) {
                    event.preventDefault();
                    event.stopPropagation();
                    onMoveItem(name, join(directory, file.name));
                }
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent(`pterodactyl:files:ctx:${file.key}`, { detail: e.clientX }));
            }}
        >
            <SelectFileCheckbox name={file.name} />
            <Clickable file={file}>
                <div css={tw`flex-none text-neutral-400 ml-6 mr-4 text-lg pl-3`}>
                    {file.isFile ? (
                        <FontAwesomeIcon
                            icon={file.isSymlink ? faFileImport : file.isArchiveType() ? faFileArchive : faFileAlt}
                        />
                    ) : (
                        <FontAwesomeIcon icon={faFolder} />
                    )}
                </div>
                <div css={tw`flex-1 truncate`}>{file.name}</div>
                {file.isFile && <div css={tw`w-1/6 text-right mr-4 hidden sm:block`}>{bytesToString(file.size)}</div>}
                <div css={tw`w-1/5 text-right mr-4 hidden md:block`} title={file.modifiedAt.toString()}>
                    {Math.abs(differenceInHours(file.modifiedAt, new Date())) > 48
                        ? format(file.modifiedAt, 'MMM do, yyyy h:mma')
                        : formatDistanceToNow(file.modifiedAt, { addSuffix: true })}
                </div>
            </Clickable>
            <FileDropdownMenu file={file} />
        </div>
    );
};

export default memo(FileObjectRow, (prevProps, nextProps) => {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const { isArchiveType, isEditable, ...prevFile } = prevProps.file;
    const { isArchiveType: nextIsArchiveType, isEditable: nextIsEditable, ...nextFile } = nextProps.file;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    return prevProps.onMoveItem === nextProps.onMoveItem && isEqual(prevFile, nextFile);
});
