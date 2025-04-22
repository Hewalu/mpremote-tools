import * as cp from 'child_process';
import * as util from 'util';

// Promisify exec for easier async/await usage
export const exec = util.promisify(cp.exec);

export function formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) {
        return '0 Bytes';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function getStorageStatus(): Promise<string | null> {
    try {
        const { stdout, stderr } = await exec('mpremote df');

        if (stderr) {
            console.error(`mpremote df error: ${stderr}`);
            // Don't show error for "no device connected" as it's expected sometimes
            // if (!stderr.includes('no device connected')) {
            //   vscode.window.showWarningMessage(`Fehler beim Abrufen des Speicherstatus: ${stderr.split('\n')[0]}`);
            // }
            return "$(error) Device Storage: error";
        }

        const lines = stdout.trim().split('\n');

        if (lines.length < 2) {
            console.error('mpremote df output format unexpected (too few lines)');
            return "$(error) Device Storage: parse error";
        }

        let totalSize;
        let usedSize;
        let availSize;
        let usagePercent;
        // Find the line containing the filesystem data (usually starts with numbers after splitting)
        const dataLine = lines.find(line => /^\s*\d/.test(line.split(/\s+/)[1]));

        if (dataLine) {
            const parts = dataLine.trim().split(/\s+/);

            // Extract values based on typical mpremote df output
            // Indices might need adjustment if mpremote output changes
            const totalSizeStr = parts[parts.length - 4];
            const usedSizeStr = parts[parts.length - 3];
            const availSizeStr = parts[parts.length - 2];
            const usePercentStr = parts[parts.length - 1];

            if (!totalSizeStr || !usedSizeStr || !availSizeStr || !usePercentStr) {
                console.error('mpremote df output format unexpected');
                return "$(error) Device Storage: parse error";
            } else {
                totalSize = formatBytes(parseInt(totalSizeStr));
                usedSize = formatBytes(parseInt(usedSizeStr));
                availSize = formatBytes(parseInt(availSizeStr));
                usagePercent = parseInt(usePercentStr);
            }
        } else {
            console.error('mpremote df output format unexpected (cannot find data line)');
            return "$(error) Device Storage: parse error";
        }

        return `${usedSize} / ${totalSize}  available: ${availSize}  used: ${usagePercent}%`;
    } catch (error: any) {
        console.error(`Failed to execute mpremote df: ${error}`);
        return "$(error) Device Storage: failed";
    }
}
