import * as vscode from 'vscode';
import { exec, formatBytes } from './utils';

export class MpremoteFsItem extends vscode.TreeItem {
    constructor(
        public readonly label: string, // File or folder name
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isDirectory: boolean,
        public readonly path?: string, // Full path on the device
        public readonly size?: number // File size in bytes
    ) {
        super(label, collapsibleState);

        this.tooltip = this.path || this.label; // Show path in tooltip
        this.description = size !== undefined ? formatBytes(size) : undefined; // Show formatted size

        // Set icons based on type
        this.iconPath = isDirectory
            ? vscode.ThemeIcon.Folder
            : vscode.ThemeIcon.File;

        // Set context value for menu contributions in package.json
        this.contextValue = isDirectory ? 'folder' : 'file';

        // Assign resourceUri for identification and potential actions
        if (path) {
            // Ensure path starts with / for URI consistency
            const uriPath = path.startsWith('/') ? path : '/' + path;
            this.resourceUri = vscode.Uri.parse(`mpremote:${encodeURIComponent(uriPath)}`);

            // Define the command to execute when the item is clicked
            if (!isDirectory) {
                // Special handling for files in /lib - prevent opening via command
                if (!uriPath.startsWith('/lib')) {
                    this.command = {
                        command: 'vscode.open', // Built-in command to open resources
                        title: "Datei öffnen",
                        arguments: [this.resourceUri] // Pass the mpremote URI
                    };
                } else {
                    // Command to show message for lib files (defined in commands.ts)
                    this.command = {
                        command: 'mpremote.openLibFile',
                        title: "Datei öffnen (Info)",
                        arguments: []
                    };
                }
            }
        }
    }
}

export class MpremoteFileSystemProvider implements vscode.TreeDataProvider<MpremoteFsItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MpremoteFsItem | undefined | null | void> = new vscode.EventEmitter<MpremoteFsItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MpremoteFsItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        // Debounce refresh calls slightly to avoid excessive mpremote calls if triggered rapidly
        // clearTimeout(this.refreshDebounceTimer);
        // this.refreshDebounceTimer = setTimeout(() => {
        this._onDidChangeTreeData.fire();
        // }, 150); // Adjust delay as needed
    }
    // private refreshDebounceTimer: NodeJS.Timeout | undefined;

    getTreeItem(element: MpremoteFsItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MpremoteFsItem): Promise<MpremoteFsItem[]> {
        const path = element ? element.path : '/'; // Use root path if no element is provided
        let fsItems: MpremoteFsItem[] = [];

        try {
            // Ensure path is correctly formatted for the mpremote command
            const commandPath = path === '/' ? '/' : `"${path}"`; // Quote paths containing spaces
            const { stdout, stderr } = await exec(`mpremote ls ${commandPath}`);

            if (stderr) {
                // Handle common, non-critical errors silently in the log
                if (stderr.includes('No such file or directory') || stderr.includes('failed to stat')) {
                    console.log(`mpremote fs ls failed for ${path}: ${stderr.split('\n')[0]}`);
                    return []; // Return empty list, directory likely doesn't exist or is inaccessible
                } else if (stderr.includes('no device connected')) {
                    console.log(`mpremote fs ls failed: no device connected`);
                    // Optionally return a placeholder item indicating no connection
                    // return [new MpremoteFsItem("Kein Gerät verbunden", vscode.TreeItemCollapsibleState.None, false)];
                    return [];
                }
                else {
                    // Log and show unexpected errors to the user
                    console.error(`mpremote fs ls error for ${path}: ${stderr}`);
                    vscode.window.showErrorMessage(`Fehler beim Lesen von ${path}: ${stderr.split('\n')[0]}`);
                    return []; // Return empty list on error
                }
            }

            // Process the output of `mpremote ls`
            const lines = stdout.trim().split('\n');
            const fileRegex = /^\s*(\d+)\s+(.+?)(\/)?\s*$/; // Regex to parse size, name, and directory flag

            for (const line of lines) {
                const match = line.match(fileRegex);
                if (match) {
                    const size = parseInt(match[1], 10);
                    const name = match[2].trim(); // Name (file or folder)
                    const isDirectory = match[3] === '/'; // Check for trailing slash indicating directory
                    // Construct the full path for the item
                    const itemPath = path === '/' ? `/${name}` : `${path}/${name}`;

                    // Ignore potentially empty names resulting from regex issues
                    if (name) {
                        fsItems.push(new MpremoteFsItem(
                            name,
                            isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                            isDirectory,
                            itemPath,
                            isDirectory ? undefined : size // Size only for files
                        ));
                    }
                } else {
                    // Log lines that don't match the expected format (excluding mpremote's header)
                    if (!line.startsWith('ls :') && line.trim() !== '') {
                        console.warn(`Ignoring line, does not match expected format: "${line}"`);
                    }
                }
            }
        } catch (error: any) {
            if (error.stderr.trim() === "mpremote: no device found") {
                const errorMessage = "Wahrscheinlich läuft ein anderer Prozess auf dem Gerät.";
                console.error(errorMessage);
                vscode.window.showErrorMessage(errorMessage);
                return [];
            }

            console.error(`Failed to execute mpremote ls for path ${path}: ${error}`);
            let errorMessage = `Fehler beim Ausführen von mpremote ls für Pfad ${path}.`;
            if (error.stderr) {
                // Handle specific errors from stderr if caught here
                if (error.stderr.includes('No such file or directory') || error.stderr.includes('failed to stat')) {
                    console.log(`Directory not found or stat failed via catch for ${path}`);
                    return []; // Return empty list silently
                } else if (error.stderr.includes('no device connected')) {
                    console.log(`No device connected via catch for ${path}`);
                    return [];
                }
                errorMessage += ` Details: ${error.stderr.split('\n')[0]}`;
            } else if (error.message) {
                errorMessage += ` Details: ${error.message}`;
            }
            // Show error message only for unexpected issues
            if (!errorMessage.includes('No such file or directory') && !errorMessage.includes('failed to stat') && !errorMessage.includes('no device connected')) {
                vscode.window.showErrorMessage(errorMessage);
            }
            return []; // Return empty list on error
        }

        // Sort items: folders first, then files, alphabetically
        fsItems.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1; // Folders before files
            }
            return a.label.localeCompare(b.label); // Alphabetical sort
        });

        // --- Storage Status (Consider moving this to a status bar item or separate view) ---
        // Displaying storage status within the file tree might be less ideal UX.
        // A status bar item is generally preferred for this kind of information.
        // If you want to keep it here for now:
        // if (!element) { // Only add to the root level
        //   const statusText = await getStorageStatus();
        //   if (statusText) {
        //     const storageItem = new MpremoteFsItem(
        //       statusText,
        //       vscode.TreeItemCollapsibleState.None,
        //       false, // Not a directory
        //       undefined, // No device path
        //       undefined // No size
        //     );
        //     storageItem.iconPath = new vscode.ThemeIcon('database'); // Use a relevant icon
        //     storageItem.contextValue = 'storageStatus'; // Optional context value
        //     storageItem.command = { command: 'mpremote.updateStorageStatus', title: 'Speicherstatus aktualisieren' };
        //     fsItems.push(storageItem); // Add to the end of the list
        //   }
        // }
        // --- End Storage Status Section ---

        return fsItems;
    }
}
