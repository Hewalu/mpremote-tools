import * as vscode from 'vscode';
import { exec } from './utils';

export class MpremoteContentProvider implements vscode.TextDocumentContentProvider {

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const filePath = decodeURIComponent(uri.path);
        // Handle root or invalid paths gracefully
        if (!filePath || filePath === '/') {
            return '// Cannot display content for root directory.';
        }

        try {
            // Ensure path starts with / for mpremote, but handle potential double slashes if already present
            const commandPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
            const { stdout, stderr } = await exec(`mpremote cat "${commandPath}"`);

            if (stderr) {
                console.error(`mpremote fs cat error for ${commandPath}: ${stderr}`);
                // Show specific error message, but avoid flooding with notifications
                vscode.window.showErrorMessage(`Fehler beim Lesen der Datei ${commandPath}: ${stderr.split('\n')[0]}`);
                return `// Error reading file: ${stderr}`;
            }

            // Normalize line endings
            return stdout.replace(/\r/g, ''); // Return the file content
        } catch (error: any) {
            if (error.stderr.trim() === "mpremote: no device found") {
                const errorMessage = "Wahrscheinlich läuft ein anderer Prozess auf dem Gerät.";
                console.error(errorMessage);
                vscode.window.showErrorMessage(errorMessage);
                return `// Failed to fetch content: ${error.message || error}`;
            }

            console.error(`Failed to execute mpremote fs cat for ${filePath}: ${error}`);
            let errorMessage = `Fehler beim Ausführen von mpremote fs cat für ${filePath}.`;
            if (error.stderr) {
                errorMessage += ` Details: ${error.stderr}`;
            } else if (error.message) {
                errorMessage += ` Details: ${error.message}`;
            }
            vscode.window.showErrorMessage(errorMessage);
            return `// Failed to fetch content: ${error.message || error}`;
        }
    }
}
