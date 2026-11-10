import React, { useContext, useEffect, useState } from 'react';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import Can from '@/components/elements/Can';
import CreateBackupButton from '@/components/server/backups/CreateBackupButton';
import FlashMessageRender from '@/components/FlashMessageRender';
import BackupRow from '@/components/server/backups/BackupRow';
import tw from 'twin.macro';
import getServerBackups, { Context as ServerBackupContext } from '@/api/swr/getServerBackups';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Pagination from '@/components/elements/Pagination';
import { Dialog } from '@/components/elements/dialog';
import deleteBackup from '@/api/server/backups/deleteBackup';
import http from '@/api/http';

type BulkAction = 'delete' | 'lock' | 'unlock';

const BackupContainer = () => {
    const { page, setPage } = useContext(ServerBackupContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const { data: backups, error, isValidating, mutate } = getServerBackups();
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [selected, setSelected] = useState<string[]>([]);
    const [acting, setActing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const backupLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.backups);

    useEffect(() => setSelected([]), [page]);

    const pageItems = backups?.items || [];
    const selectedBackups = pageItems.filter((backup) => selected.includes(backup.uuid));
    const deletableBackups = selectedBackups.filter((backup) => !backup.isLocked);
    const selectableCount = pageItems.length;

    const selectBackup = (backupUuid: string, checked: boolean) => {
        setSelected((current) =>
            checked ? [...new Set([...current, backupUuid])] : current.filter((value) => value !== backupUuid)
        );
    };

    const selectPage = (checked: boolean) => {
        setSelected(checked ? pageItems.map((backup) => backup.uuid) : []);
    };

    const performBulkAction = async (action: BulkAction) => {
        const targets = selectedBackups.filter((backup) =>
            action === 'delete' ? !backup.isLocked : action === 'lock' ? !backup.isLocked : backup.isLocked
        );
        if (!targets.length) return;

        setActing(true);
        setConfirmDelete(false);
        clearFlashes('backups');

        const completed: string[] = [];
        const errors: unknown[] = [];
        for (const backup of targets) {
            try {
                if (action === 'delete') {
                    await deleteBackup(uuid, backup.uuid);
                } else {
                    await http.post(`/api/client/servers/${uuid}/backups/${backup.uuid}/lock`);
                }
                completed.push(backup.uuid);
            } catch (error) {
                errors.push(error);
            }
        }

        setSelected((current) => current.filter((value) => !completed.includes(value)));
        await mutate();
        if (errors.length) {
            clearAndAddHttpError({ key: 'backups', error: errors[0] as Error });
        } else {
            const label = action === 'delete' ? 'deleted' : action === 'lock' ? 'locked' : 'unlocked';
            addFlash({ key: 'backups', type: 'success', message: `${completed.length} backup(s) ${label}.` });
        }
        setActing(false);
    };

    useEffect(() => {
        if (!error) {
            clearFlashes('backups');

            return;
        }

        clearAndAddHttpError({ error, key: 'backups' });
    }, [error]);

    if (!backups || (error && isValidating)) {
        return <Spinner size={'large'} centered />;
    }

    return (
        <ServerContentBlock title={'Backups'}>
            <FlashMessageRender byKey={'backups'} css={tw`mb-4`} />
            <Dialog.Confirm
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                title={'Delete selected backups'}
                confirm={'Delete'}
                onConfirmed={() => performBulkAction('delete')}
            >
                Delete {deletableBackups.length} unlocked backup(s)? Locked backups will be left untouched.
            </Dialog.Confirm>
            <Can action={'backup.delete'}>
                {selectableCount > 0 && (
                    <div css={tw`flex flex-wrap items-center gap-3 mb-4 p-3 rounded bg-neutral-800`}>
                        <label css={tw`flex items-center text-sm text-neutral-200 mr-auto`}>
                            <input
                                type={'checkbox'}
                                aria-label={'Select all backups on this page'}
                                checked={selectableCount > 0 && selected.length === selectableCount}
                                onChange={(event) => selectPage(event.currentTarget.checked)}
                                css={tw`mr-2 rounded-sm bg-neutral-600 border-neutral-500 text-primary-400 focus:ring-primary-400`}
                            />
                            {selected.length} selected on this page
                        </label>
                        <button
                            type={'button'}
                            disabled={acting || !selectedBackups.some((backup) => !backup.isLocked)}
                            onClick={() => performBulkAction('lock')}
                            css={tw`px-3 py-2 rounded bg-neutral-700 text-sm disabled:opacity-50`}
                        >
                            Lock selected
                        </button>
                        <button
                            type={'button'}
                            disabled={acting || !selectedBackups.some((backup) => backup.isLocked)}
                            onClick={() => performBulkAction('unlock')}
                            css={tw`px-3 py-2 rounded bg-neutral-700 text-sm disabled:opacity-50`}
                        >
                            Unlock selected
                        </button>
                        <button
                            type={'button'}
                            disabled={acting || !deletableBackups.length}
                            onClick={() => setConfirmDelete(true)}
                            css={tw`px-3 py-2 rounded bg-red-700 text-sm text-white disabled:opacity-50`}
                        >
                            Delete unlocked ({deletableBackups.length})
                        </button>
                    </div>
                )}
            </Can>
            <Pagination data={backups} onPageSelect={setPage}>
                {({ items }) =>
                    !items.length ? (
                        // Don't show any error messages if the server has no backups and the user cannot
                        // create additional ones for the server.
                        !backupLimit ? null : (
                            <p css={tw`text-center text-sm text-neutral-300`}>
                                {page > 1
                                    ? "Looks like we've run out of backups to show you, try going back a page."
                                    : 'It looks like there are no backups currently stored for this server.'}
                            </p>
                        )
                    ) : (
                        items.map((backup, index) => (
                            <BackupRow
                                key={backup.uuid}
                                backup={backup}
                                selected={selected.includes(backup.uuid)}
                                onSelect={selectBackup}
                                css={index > 0 ? tw`mt-2` : undefined}
                            />
                        ))
                    )
                }
            </Pagination>
            {backupLimit === 0 && (
                <p css={tw`text-center text-sm text-neutral-300`}>
                    Backups cannot be created for this server because the backup limit is set to 0.
                </p>
            )}
            <Can action={'backup.create'}>
                <div css={tw`mt-6 sm:flex items-center justify-end`}>
                    {backupLimit > 0 && backups.backupCount > 0 && (
                        <p css={tw`text-sm text-neutral-300 mb-4 sm:mr-6 sm:mb-0`}>
                            {backups.backupCount} of {backupLimit} backups have been created for this server.
                        </p>
                    )}
                    {backupLimit > 0 && backupLimit > backups.backupCount && (
                        <CreateBackupButton css={tw`w-full sm:w-auto`} />
                    )}
                </div>
            </Can>
        </ServerContentBlock>
    );
};

export default () => {
    const [page, setPage] = useState<number>(1);
    return (
        <ServerBackupContext.Provider value={{ page, setPage }}>
            <BackupContainer />
        </ServerBackupContext.Provider>
    );
};
