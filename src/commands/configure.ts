import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Opsi Case yang tersedia (Sesuai Engine Fase 2)
const CASE_OPTIONS = ['kebab-case', 'PascalCase', 'camelCase', 'snake_case'];

export async function configureRules() {
    // 1. Tentukan di mana config akan disimpan (Root Workspace)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Silakan buka folder proyek terlebih dahulu.');
        return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const configPath = path.join(rootPath, '.naminglintrc.json');

    // 2. Pertanyaan 1: Aturan FILE
    const fileCase = await vscode.window.showQuickPick(CASE_OPTIONS, {
        placeHolder: 'Pilih aturan penamaan untuk FILE (contoh: login-button.js)',
        ignoreFocusOut: true
    });
    if (!fileCase) return; // User batal

    // 3. Pertanyaan 2: Aturan FOLDER
    const folderCase = await vscode.window.showQuickPick(CASE_OPTIONS, {
        placeHolder: 'Pilih aturan penamaan untuk FOLDER (contoh: MyComponents)',
        ignoreFocusOut: true
    });
    if (!folderCase) return; // User batal

    // 4. Buat Objek Config
    const configData = {
        rules: {
            fileCase: fileCase,
            folderCase: folderCase
        },
        // Kita kasih default ignore yang aman
        ignore: [
            "node_modules/**",
            "dist/**",
            ".git/**",
            ".vscode/**",
            "package.json",
            "package-lock.json",
            "tsconfig.json"
        ]
    };

    // 5. Tulis ke File .naminglintrc.json
    try {
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
        
        vscode.window.showInformationMessage(
            `Konfigurasi berhasil disimpan! File: ${fileCase}, Folder: ${folderCase}`
        );
        
        // Opsional: Buka file config yang baru dibuat agar user lihat
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc);

    } catch (err: any) {
        vscode.window.showErrorMessage(`Gagal menyimpan konfigurasi: ${err.message}`);
    }
}