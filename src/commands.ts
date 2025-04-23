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
                lastOpenTerminal = terminalName;
            }
        }),

        vscode.commands.registerCommand('mpremote.installPackage', async () => {
            const packageName = await vscode.window.showInputBox({
                prompt: 'Paketname eingeben',
                placeHolder: 'z.B. micropython-urequests',
                ignoreFocusOut: true
            });

            if (!packageName || packageName.trim() === '') {
                return;
            }

            const trimmedPackageName = packageName.trim();

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Installiere Paket "${trimmedPackageName}"...`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Starte mpremote..." });

                    const command = `mpremote mip install ${trimmedPackageName}`;
                    const { stderr } = await exec(command);

                    progress.report({ increment: 100, message: "Abgeschlossen." });

                    if (stderr) {
                        if (stderr.includes("no device found")) {
                            const errorMessage = "Kein Gerät gefunden. Stellen Sie sicher, dass das Gerät verbunden und nicht von einem anderen Prozess verwendet wird.";
                            console.error(errorMessage);
                            vscode.window.showErrorMessage(errorMessage);
                            return; // Stop further processing
                        } else if (stderr.includes("Error:") || stderr.includes("error:")) {
                            // Treat other stderr content containing "Error" as an error
                            console.error(`mpremote mip install error for ${trimmedPackageName}: ${stderr}`);
                            vscode.window.showErrorMessage(`Fehler bei der Installation von ${trimmedPackageName}: ${stderr.split('\n')[0]}`);
                            return; // Stop further processing
                        } else {
                            // Log other stderr messages as potentially useful info/warnings
                            console.log(`mpremote mip install output (stderr) for ${trimmedPackageName}: ${stderr}`);
                            // Optionally show a less severe message for non-error stderr
                            // vscode.window.showInformationMessage(`Installation von ${trimmedPackageName} abgeschlossen (mit Hinweisen): ${stderr.split('\n')[0]}`);
                        }
                    }

                    vscode.window.showInformationMessage(`Paket "${trimmedPackageName}" erfolgreich installiert.`);

                    // Refresh file system view as new files/folders might be present in /lib
                    fileSystemProvider.refresh();
                });
            } catch (error: any) {
                if (error.stderr && error.stderr.trim().includes("no device found")) {
                    const errorMessage = "Kein Gerät gefunden oder es läuft bereits ein anderer Prozess auf dem Gerät.";
                    console.error(errorMessage);
                    vscode.window.showErrorMessage(errorMessage);
                    return;
                }

                console.error(`Failed to execute mpremote mip install for ${trimmedPackageName}:`, error);
                let errorMessage = `Fehler beim Ausführen von mpremote mip install für ${trimmedPackageName}.`;
                if (error.stderr) {
                    errorMessage += ` Details: ${error.stderr}`;
                } else if (error.message) {
                    errorMessage += ` Details: ${error.message}`;
                }
                vscode.window.showErrorMessage(errorMessage);
            }
        }),

        vscode.commands.registerCommand('mpremote.rtc', async () => {
            try {

                const { stdout, stderr } = await exec('mpremote rtc');

                if (stderr) {
                    if (stderr.includes("no device found")) {
                        const errorMessage = "Kein Gerät gefunden oder es läuft bereits ein anderer Prozess auf dem Gerät.";
                        console.error(errorMessage);
                        vscode.window.showErrorMessage(errorMessage);
                        return;
                    }
                    console.error(`mpremote rtc error: ${stderr}`);
                    vscode.window.showErrorMessage(`Fehler beim Lesen der RTC: ${stderr.split('\n')[0]}`);
                    return;
                }

                const match = stdout.trim().match(/\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d+)\)/);

                if (!match) {
                    console.error(`Could not parse RTC output: ${stdout}`);
                    vscode.window.showErrorMessage('Konnte die RTC-Ausgabe nicht verarbeiten.');
                    return;
                }

                const [, year, month, day, weekday, hour, minute, second] = match.map(Number);
                // Pad single digit numbers with leading zero
                const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
                const formattedDate = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
                // Weekday: MicroPython uses Monday=0 to Sunday=6.
                const weekdaysGerman = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
                const weekdayName = weekdaysGerman[weekday] || weekday;

                const formattedDateTime = `Gerätezeit: ${weekdayName}, ${formattedDate} ${formattedTime}`;

                const syncOption: vscode.MessageItem = { title: 'Zeit synchronisieren' };
                const noItem: vscode.MessageItem = { title: 'Abbrechen', isCloseAffordance: true };

                const choice = await vscode.window.showInformationMessage(
                    formattedDateTime,
                    { modal: true },
                    syncOption, noItem
                );

                if (choice === syncOption) {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Synchronisiere Gerätszeit...",
                        cancellable: false
                    }, async (syncProgress) => {
                        syncProgress.report({ increment: 50 });
                        try {
                            const { stderr: syncStderr } = await exec('mpremote rtc --set');
                            if (syncStderr) {
                                if (syncStderr.includes("no device found")) {
                                    const errorMessage = "Kein Gerät gefunden oder es läuft bereits ein anderer Prozess auf dem Gerät.";
                                    console.error(errorMessage);
                                    vscode.window.showErrorMessage(errorMessage);
                                    return;
                                }
                                console.error(`mpremote rtc --set error: ${syncStderr}`);
                                vscode.window.showErrorMessage(`Fehler beim Synchronisieren der RTC: ${syncStderr.split('\n')[0]}`);
                            } else {
                                syncProgress.report({ increment: 50, message: "Erfolgreich." });
                                vscode.window.showInformationMessage('Gerätszeit erfolgreich mit Systemzeit synchronisiert.');
                            }
                        } catch (syncError: any) {
                            if (syncError.stderr && syncError.stderr.trim().includes("no device found")) {
                                const errorMessage = "Kein Gerät gefunden oder es läuft bereits ein anderer Prozess auf dem Gerät.";
                                console.error(errorMessage);
                                vscode.window.showErrorMessage(errorMessage);
                                return;
                            }
                            console.error(`Failed to execute mpremote rtc --set:`, syncError);
                            let errorMessage = `Fehler beim Ausführen von mpremote rtc --set.`;
                            if (syncError.stderr) {
                                errorMessage += ` Details: ${syncError.stderr}`;
                            } else if (syncError.message) {
                                errorMessage += ` Details: ${syncError.message}`;
                            }
                            vscode.window.showErrorMessage(errorMessage);
                        }
                    });
                }
            } catch (error: any) {
                if (error.stderr && error.stderr.trim().includes("no device found")) {
                    const errorMessage = "Kein Gerät gefunden oder es läuft bereits ein anderer Prozess auf dem Gerät.";
                    console.error(errorMessage);
                    vscode.window.showErrorMessage(errorMessage);
                    return;
                }
                console.error(`Failed to execute mpremote rtc:`, error);
                let errorMessage = `Fehler beim Ausführen von mpremote rtc.`;
                if (error.stderr) {
                    errorMessage += ` Details: ${error.stderr}`;
                } else if (error.message) {
                    errorMessage += ` Details: ${error.message}`;
                }
                vscode.window.showErrorMessage(errorMessage);
            }
        }),

        vscode.commands.registerCommand('mpremote.runFile', async (item?: MpremoteFsItem) => {
            let filePath: string | undefined;

            if (item && item.path && !item.isDirectory) {
                filePath = item.path;
            } else {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const activeFilePath = editor.document.uri.path;
                    if (activeFilePath.endsWith('.py') || activeFilePath.endsWith('.mpy')) {
                        filePath = decodeURIComponent(editor.document.uri.path);

                    } else {
                        vscode.window.showWarningMessage('Aktive Datei ist keine Python-Datei. Bitte wählen Sie eine .py oder .mpy Datei aus.');
                        return;
                    }
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

            let terminal = vscode.window.terminals.find(t => t.name === lastOpenTerminal || t.name === terminalName);
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

        vscode.commands.registerCommand('mpremote.syncFileSystem', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('Kein Arbeitsbereich geöffnet.');
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri;
            const srcDirPath = vscode.Uri.joinPath(workspaceRoot, 'src');

            try {
                // Check if src directory exists
                await vscode.workspace.fs.stat(srcDirPath);

                // src directory exists, proceed with sync
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Synchronisiere 'src' Verzeichnis mit dem Gerät...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 10, message: "Starte Synchronisierung..." });

                    // Construct the PowerShell command
                    // Note: Using the full path to srcDirPath.fsPath is safer
                    const command = `Get-ChildItem -Path "${srcDirPath.fsPath}" | ForEach-Object { mpremote cp -r $_.FullName :/ }`;

                    try {
                        progress.report({ increment: 40, message: "Kopiere Dateien..." });
                        const { stderr } = await exec(command, { shell: 'powershell.exe' }); // Specify PowerShell

                        progress.report({ increment: 90, message: "Prüfe Ergebnis..." });

                        if (stderr) {
                            if (stderr.includes("no device found")) {
                                const errorMessage = "Kein Gerät gefunden oder es läuft bereits ein anderer Prozess auf dem Gerät.";
                                console.error(errorMessage);
                                vscode.window.showErrorMessage(errorMessage);
                                return;
                            } else if (stderr.includes("Error:") || stderr.includes("error:")) {
                                console.error(`mpremote sync error: ${stderr}`);
                                vscode.window.showErrorMessage(`Fehler beim Synchronisieren: ${stderr.split('\n')[0]}`);
                                return;
                            } else {
                                // Log other stderr as info/warnings
                                console.log(`mpremote sync output (stderr): ${stderr}`);
                            }
                        }

                        progress.report({ increment: 100, message: "Abgeschlossen." });
                        fileSystemProvider.refresh();

                    } catch (syncError: any) {
                        progress.report({ increment: 100, message: "Fehler." });
                        if (syncError.stderr && syncError.stderr.trim().includes("no device found")) {
                            const errorMessage = "Kein Gerät gefunden oder es läuft bereits ein anderer Prozess auf dem Gerät.";
                            console.error(errorMessage);
                            vscode.window.showErrorMessage(errorMessage);
                            return;
                        }
                        console.error(`Failed to execute sync command:`, syncError);
                        let errorMessage = `Fehler beim Ausführen des Synchronisierungsbefehls.`;
                        if (syncError.stderr) {
                            errorMessage += ` Details: ${syncError.stderr}`;
                        } else if (syncError.message) {
                            errorMessage += ` Details: ${syncError.message}`;
                        }
                        vscode.window.showErrorMessage(errorMessage);
                    }
                });

            } catch (error: any) {
                // Handle error if fs.stat fails (directory doesn't exist)
                if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                    vscode.window.showInformationMessage(`Das Verzeichnis 'src' wurde im Arbeitsbereich nicht gefunden. (${srcDirPath.fsPath})`);
                } else {
                    // Handle other potential errors during fs.stat
                    console.error("Error checking for src directory:", error);
                    vscode.window.showErrorMessage(`Fehler beim Prüfen des 'src' Verzeichnisses: ${error.message}`);
                }
            }
        }),
    );
}
