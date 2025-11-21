import * as vscode from 'vscode';
import { scanAndFixFolder } from './commands/scanAndFix';
import { configureRules } from './commands/configure';

export const outputChannel = vscode.window.createOutputChannel("Naming Standardizer");

export function activate(context: vscode.ExtensionContext) {
    // Registrasi Command Scan & Fix
    context.subscriptions.push(
        vscode.commands.registerCommand('naming-standardizer.scanAndFixFolder', scanAndFixFolder)
    );

    // Registrasi Command Config Wizard
    context.subscriptions.push(
        vscode.commands.registerCommand('naming-standardizer.configureRules', configureRules)
    );
}

export function deactivate() {}