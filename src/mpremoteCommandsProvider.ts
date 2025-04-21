import * as vscode from 'vscode';

// Renamed from MpremoteItem to MpremoteCommandItem for clarity
export class MpremoteCommandItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon
    ) {
        super(label, collapsibleState);
    }
}

// Renamed from MpremoteTreeProvider to MpremoteCommandsProvider for clarity
export class MpremoteCommandsProvider implements vscode.TreeDataProvider<MpremoteCommandItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<MpremoteCommandItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: MpremoteCommandItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<MpremoteCommandItem[]> {
        return Promise.resolve([
            new MpremoteCommandItem('Verbinden', vscode.TreeItemCollapsibleState.None, {
                command: 'mpremote.connect',
                title: 'Verbinden'
            }, new vscode.ThemeIcon('debug-start')),

            new MpremoteCommandItem('Trennen', vscode.TreeItemCollapsibleState.None, {
                command: 'mpremote.disconnect',
                title: 'Trennen'
            }, new vscode.ThemeIcon('debug-disconnect')),

            new MpremoteCommandItem('Soft Reset', vscode.TreeItemCollapsibleState.None, {
                command: 'mpremote.disconnect',
                title: 'Soft Reset'
            }, new vscode.ThemeIcon('debug-rerun')),

            new MpremoteCommandItem('Hard Reset', vscode.TreeItemCollapsibleState.None, {
                command: 'mpremote.disconnect',
                title: 'Hard Reset'
            }, new vscode.ThemeIcon('debug-restart')),

            new MpremoteCommandItem('Open Terminal', vscode.TreeItemCollapsibleState.None, {
                command: 'mpremote.disconnect',
                title: 'Open Terminal'
            }, new vscode.ThemeIcon('terminal')),

            new MpremoteCommandItem('Install Package', vscode.TreeItemCollapsibleState.None, {
                command: 'mpremote.disconnect',
                title: 'Install Package'
            }, new vscode.ThemeIcon('symbol-constructor')),

            new MpremoteCommandItem('RTC', vscode.TreeItemCollapsibleState.None, {
                command: 'mpremote.disconnect',
                title: 'RTC'
            }, new vscode.ThemeIcon('watch')),
        ]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}
