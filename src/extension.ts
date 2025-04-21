import * as vscode from 'vscode';
import { MpremoteContentProvider } from './mpremoteContentProvider';
import { MpremoteCommandsProvider } from './mpremoteCommandsProvider';
import { MpremoteFileSystemProvider } from './mpremoteFileSystemProvider';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {

  const mpremoteCommandsProvider = new MpremoteCommandsProvider();
  vscode.window.registerTreeDataProvider('mpremoteCommands', mpremoteCommandsProvider);

  const mpremoteFsProvider = new MpremoteFileSystemProvider();
  vscode.window.registerTreeDataProvider('mpremoteFileSystemActivityBar', mpremoteFsProvider);
  vscode.window.registerTreeDataProvider('mpremoteFileSystemExplorer', mpremoteFsProvider);

  const mpremoteContentProvider = new MpremoteContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('mpremote', mpremoteContentProvider)
  );

  registerCommands(context, mpremoteFsProvider);

  // Remove the duplicate registration from here
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('mpremote.refreshFileSystem', () => {
  //     mpremoteFsProvider.refresh();
  //   })
  // );

  // --- Status Bar Item (Example) ---
  // Consider adding a status bar item for connection status or storage
  // const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  // statusBarItem.text = "$(zap) mpremote";
  // statusBarItem.tooltip = "mpremote status";
  // statusBarItem.command = 'mpremote.showStatusMenu'; // Example command
  // context.subscriptions.push(statusBarItem);
  // statusBarItem.show();

  // --- Auto-refresh on Window Focus (Example) ---
  // Refresh the file system when the VS Code window gains focus
  // context.subscriptions.push(vscode.window.onDidChangeWindowState(e => {
  //   if (e.focused) {
  //     mpremoteFileSystemProvider.refresh();
  //   }
  // }));
}

// This method is called when your extension is deactivated
// export function deactivate() {
//   console.log('mpremote-tools extension deactivated.');
// }
