import * as vscode from 'vscode';
import { MpremoteFileSystemProvider, MpremoteFsItem } from './mpremoteFileSystemProvider';
import { exec, getStorageStatus } from './utils';

const skipFileDeleteConfirmationKey = 'mpremote.skipFileDeleteConfirmation';
const skipFolderDeleteConfirmationKey = 'mpremote.skipFolderDeleteConfirmation';

export function registerCommands(context: vscode.ExtensionContext, fileSystemProvider: MpremoteFileSystemProvider) {

    let lastOpenTerminal: string | undefined = undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('mpremote.connect', () => {
            vscode.window.showInformationMessage('Verbindungsversuch gestartet... (Logik fehlt)');
            // fileSystemProvider.refresh(); // Refresh FS view after attempting connection
        }),

        vscode.commands.registerCommand('mpremote.disconnect', () => {
            vscode.window.showInformationMessage('Trennungsversuch gestartet... (Logik fehlt)');
            // fileSystemProvider.refresh();
        }),

        vscode.commands.registerCommand('mpremote.softReset', async () => {
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Führe Soft-Reset aus...",
                    cancellable: false
                }, async () => {
                    const { stderr } = await exec('mpremote soft-reset');
                    if (stderr) {
                        console.log(stderr);
                        console.error(`mpremote soft-reset error: ${stderr}`);
                        vscode.window.showErrorMessage(`Fehler beim Soft-Reset: ${stderr.split('\n')[0]}`);
                    }
                });
            } catch (error: any) {
                if (error.stderr.trim() === "mpremote: no device found") {
                    const errorMessage = "Wahrscheinlich läuft ein anderer Prozess auf dem Gerät.";
                    console.error(errorMessage);
                    vscode.window.showErrorMessage(errorMessage);
                    return;
                }

                let errorMessage = `Fehler beim Ausführen von mpremote soft-reset.`;
                if (error.stderr) {
                    errorMessage += ` Details: ${error.stderr}`;
                } else if (error.message) {
                    errorMessage += ` Details: ${error.message}`;
                }
                console.error(`Failed to execute mpremote soft-reset: ${errorMessage}`);
                vscode.window.showErrorMessage(errorMessage);
            }
        }),

        vscode.commands.registerCommand('mpremote.hardReset', async () => {
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Führe Hard-Reset aus...",
                    cancellable: false
                }, async () => {
                    const { stderr } = await exec('mpremote reset');
                    if (stderr) {
                        console.log(stderr);
                        console.error(`mpremote hard-reset error: ${stderr}`);
                        vscode.window.showErrorMessage(`Fehler beim Hard-Reset: ${stderr.split('\n')[0]}`);
                    }
                });
            } catch (error: any) {
                if (error.stderr.trim() === "mpremote: no device found") {
                    const errorMessage = "Wahrscheinlich läuft ein anderer Prozess auf dem Gerät.";
                    console.error(errorMessage);
                    vscode.window.showErrorMessage(errorMessage);
                    return;
                }

                let errorMessage = `Fehler beim Ausführen von mpremote hard-reset.`;
                if (error.stderr) {
                    errorMessage += ` Details: ${error.stderr}`;
                } else if (error.message) {
                    errorMessage += ` Details: ${error.message}`;
                }
                console.error(`Failed to execute mpremote hard-reset: ${errorMessage}`);
                vscode.window.showErrorMessage(errorMessage);
            }
        }),

        vscode.commands.registerCommand('mpremote.openTerminal', () => {
            const terminalName = `mpremote terminal`;
            let terminal = vscode.window.terminals.find(t => t.name === lastOpenTerminal || t.name === terminalName);

            if (terminal) {
                terminal.show();
            } else {
                terminal = vscode.window.createTerminal(terminalName);
                terminal.sendText(`mpremote repl`);
                terminal.show();
            }
        }),

        vscode.commands.registerCommand('mpremote.installPackage', () => {
            vscode.window.showInformationMessage('Install Package (Logik fehlt)');
        }),

        vscode.commands.registerCommand('mpremote.rtc', () => {
            vscode.window.showInformationMessage('RTC (Logik fehlt)');
        }),

        vscode.commands.registerCommand('mpremote.runFile', async (item?: MpremoteFsItem) => {
            let filePath: string | undefined;

            if (item && item.path && !item.isDirectory) {
                filePath = item.path;
            } else {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.scheme === 'mpremote') {
                    filePath = decodeURIComponent(editor.document.uri.path);
                } else {
                    vscode.window.showWarningMessage('Keine Datei zum Ausführen ausgewählt oder aktiver Editor ist keine Gerätedatei.');
                    return;
                }
            }

            if (!filePath) {
                vscode.window.showErrorMessage('Konnte die auszuführende Datei nicht bestimmen.');
                return;
            }


            const commandPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            const fileName = commandPath.split('/').pop() || 'Unbekannte Datei';
            const terminalName = `mpremote run: ${fileName}`;

            let terminal = vscode.window.terminals.find(t => t.name === terminalName);
            if (terminal) {
                terminal.show();
            } else {
                terminal = vscode.window.createTerminal(terminalName);
                terminal.sendText(`mpremote run "${commandPath}"`);
                terminal.show();
                lastOpenTerminal = terminalName;
            }
        }),

        vscode.commands.registerCommand('mpremote.deleteFileItem', async (item: MpremoteFsItem) => {
            if (!item || !item.path || item.isDirectory) {
                vscode.window.showErrorMessage('Kein gültiges Dateielement zum Löschen ausgewählt.');
                return;
            }

            const filePath = item.path;
            const fileName = item.label;

            // Check for potentially critical files
            const isRootFile = filePath === '/main.py' || filePath === '/boot.py';
            const isLibFile = filePath.startsWith('/lib/');

            const skipConfirmation = context.globalState.get<boolean>(skipFileDeleteConfirmationKey, false);
            let doDelete = false;

            // Skip confirmation only if enabled AND it's not a critical file
            if (skipConfirmation && !isRootFile && !isLibFile) {
                doDelete = true;
            } else {
                // Configure confirmation dialog
                const yesItem: vscode.MessageItem = { title: (isRootFile || isLibFile) ? 'Trotzdem löschen' : 'Ja' };
                const noItem: vscode.MessageItem = { title: 'Abbrechen', isCloseAffordance: true };
                const yesDontAskItem: vscode.MessageItem = { title: 'Ja (nicht mehr fragen)' };

                let items = [yesItem, noItem];
                // Only show "don't ask again" for non-critical files
                if (!isRootFile && !isLibFile) {
                    items = [yesItem, noItem, yesDontAskItem];
                }

                // Determine warning details
                let detailMessage: string | undefined;
                if (isRootFile) {
                    detailMessage = `"${fileName}" ist eine Systemdatei (${filePath}). Diese sollte eigentlich nie gelöscht werden.`;
                } else if (isLibFile) {
                    detailMessage = `"${fileName}" befindet sich im Bibliotheksordner (${filePath}). Das Löschen kann Abhängigkeiten anderer Skripte zerstören.`;
                }

                const choice = await vscode.window.showWarningMessage(
                    `Möchten Sie die Datei "${fileName}" wirklich löschen?`,
                    {
                        modal: true,
                        detail: detailMessage,
                    },
                    ...items
                );

                if (choice === yesItem) {
                    doDelete = true;
                } else if (choice === yesDontAskItem) {
                    doDelete = true;
                    // Update global state only if "don't ask again" was clicked
                    await context.globalState.update(skipFileDeleteConfirmationKey, true);
                }
            }

            if (doDelete) {
                try {
                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Lösche Datei "${fileName}"...`,
                        cancellable: false
                    }, async () => {
                        const commandPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
                        const { stderr } = await exec(`mpremote rm "${commandPath}"`);
                        if (stderr) {
                            console.error(`mpremote rm error for ${commandPath}: ${stderr}`);
                            vscode.window.showErrorMessage(`Fehler beim Löschen der Datei ${commandPath}: ${stderr.split('\n')[0]}`);
                        } else {
                            fileSystemProvider.refresh();
                        }
                    });
                } catch (error: any) {
                    if (error.stderr.trim() === "mpremote: no device found") {
                        const errorMessage = "Wahrscheinlich läuft ein anderer Prozess auf dem Gerät.";
                        console.error(errorMessage);
                        vscode.window.showErrorMessage(errorMessage);
                        return;
                    }

                    console.error(`Failed to execute mpremote rm for ${filePath}: ${error}`);
                    let errorMessage = `Fehler beim Ausführen von mpremote rm für ${filePath}.`;
                    if (error.stderr) {
                        errorMessage += ` Details: ${error.stderr}`;
                    } else if (error.message) {
                        errorMessage += ` Details: ${error.message}`;
                    }
                    vscode.window.showErrorMessage(errorMessage);
                }
            }
        }),

        vscode.commands.registerCommand('mpremote.deleteFolderItem', async (item: MpremoteFsItem) => {
            if (!item || !item.path || !item.isDirectory) {
                vscode.window.showErrorMessage('Kein gültiges Verzeichniselement zum Löschen ausgewählt.');
                return;
            }

            const folderPath = item.path;
            const folderName = item.label;

            // Check if it's the /lib directory itself or a subdirectory within /lib
            const isLibDirectory = folderPath === '/lib';
            const isLibSubDirectory = folderPath.startsWith('/lib/');

            const skipConfirmation = context.globalState.get<boolean>(skipFolderDeleteConfirmationKey, false);
            let doDelete = false;

            // Skip confirmation only if enabled AND it's not the /lib directory or a subdirectory
            if (skipConfirmation && !isLibDirectory && !isLibSubDirectory) {
                doDelete = true;
            } else {
                // Configure confirmation dialog
                const yesItem: vscode.MessageItem = { title: (isLibDirectory || isLibSubDirectory) ? 'Trotzdem löschen' : 'Ja' };
                const noItem: vscode.MessageItem = { title: 'Abbrechen', isCloseAffordance: true };
                const yesDontAskItem: vscode.MessageItem = { title: 'Ja (nicht mehr fragen)' };

                let items = [yesItem, noItem];
                // Only show "don't ask again" for non-lib folders
                if (!isLibDirectory && !isLibSubDirectory) {
                    items = [yesItem, noItem, yesDontAskItem];
                }

                // Determine warning details
                let detailMessage: string | undefined;
                if (isLibDirectory) {
                    detailMessage = `Sie sind dabei, das Hauptbibliotheksverzeichnis (${folderPath}) zu löschen. Dies wird wahrscheinlich Ihr Gerät unbrauchbar machen, bis die Firmware neu geflasht wird.`;
                } else if (isLibSubDirectory) {
                    detailMessage = `Sie sind dabei, ein Verzeichnis innerhalb des Bibliotheksordners (${folderPath}) zu löschen. Dies kann Abhängigkeiten anderer Skripte zerstören.`;
                }

                const choice = await vscode.window.showWarningMessage(
                    `Möchten Sie das Verzeichnis "${folderName}" und dessen gesamten Inhalt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, // Emphasize irreversibility
                    {
                        modal: true,
                        detail: detailMessage,
                    },
                    ...items
                );

                if (choice === yesItem) {
                    doDelete = true;
                } else if (choice === yesDontAskItem) {
                    doDelete = true;
                    // Update global state only if "don't ask again" was clicked
                    await context.globalState.update(skipFolderDeleteConfirmationKey, true);
                }
            }

            // Proceed with deletion if confirmed
            if (doDelete) {
                try {
                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Lösche Verzeichnis "${folderName}"...`,
                        cancellable: false
                    }, async () => {
                        const commandPath = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
                        const { stderr } = await exec(`mpremote rm -r "${commandPath}"`);

                        if (stderr) {
                            console.error(`mpremote rm -r error for ${commandPath}: ${stderr}`);
                            vscode.window.showErrorMessage(`Fehler beim Löschen des Verzeichnisses ${commandPath}: ${stderr.split('\n')[0]}`);
                        } else {
                            fileSystemProvider.refresh();
                        }
                    });
                } catch (error: any) {
                    if (error.stderr.trim() === "mpremote: no device found") {
                        const errorMessage = "Wahrscheinlich läuft ein anderer Prozess auf dem Gerät.";
                        console.error(errorMessage);
                        vscode.window.showErrorMessage(errorMessage);
                        return;
                    }
                    console.error(`Failed to execute mpremote rm -r for ${folderPath}: ${error}`);
                    let errorMessage = `Fehler beim Ausführen von mpremote rm -r für ${folderPath}.`;
                    if (error.stderr) {
                        errorMessage += ` Details: ${error.stderr}`;
                    } else if (error.message) {
                        errorMessage += ` Details: ${error.message}`;
                    }
                    vscode.window.showErrorMessage(errorMessage);
                }
            }
        }),

        vscode.commands.registerCommand('mpremote.resetDeleteConfirmations', async () => {
            await context.globalState.update(skipFileDeleteConfirmationKey, false);
            await context.globalState.update(skipFolderDeleteConfirmationKey, false);
            vscode.window.showInformationMessage('Die Einstellungen für Löschbestätigungen wurden zurückgesetzt.');
        }),

        vscode.commands.registerCommand('mpremote.openLibFile', () => {
            vscode.window.showInformationMessage('Dateien im /lib-Verzeichnis können nicht direkt über diese Erweiterung bearbeitet werden, um versehentliche Änderungen an Bibliotheken zu vermeiden. Sie können sie bei Bedarf manuell herunterladen und bearbeiten.');
        }),

        vscode.commands.registerCommand('mpremote.refreshFileSystem', () => {
            fileSystemProvider.refresh();
        }),

        vscode.commands.registerCommand('mpremote.updateStorageStatus', async () => {
            const status = await getStorageStatus();
            if (status) {
                // Update a status bar item here if you implement one
                console.log("Storage Status Updated:", status);
                // vscode.window.setStatusBarMessage(`Device Storage: ${status}`, 5000); // Example: Show in status bar briefly
            } else {
                console.log("Failed to update storage status.");
            }
            // Optionally refresh the FS view if storage is displayed there
            // fileSystemProvider.refresh();
        }),
    );
}
