import * as vscode from 'vscode';
import * as path from 'path';
import * as Linter from 'naming-standardizer-engine'; 
import { scanAndFixFolder } from './commands/scanAndFix';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('Naming Standardizer aktif!');

    // 1. Buat Koleksi Diagnostik (Wadah Error)
    diagnosticCollection = vscode.languages.createDiagnosticCollection('naming-standardizer');
    context.subscriptions.push(diagnosticCollection);

    // 2. Pasang "Mata-mata" (Event Listeners)
    // Cek saat file dibuka
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(checkFile)
    );
    // Cek saat file disimpan
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(checkFile)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('naming-standardizer.scanAndFixFolder', scanAndFixFolder)
    );

    // 3. Cek file yang sedang aktif sekarang
    if (vscode.window.activeTextEditor) {
        checkFile(vscode.window.activeTextEditor.document);
    }
}

export function deactivate() {}

function checkFile(document: vscode.TextDocument) {
    // A. Validasi Dasar: Hanya cek file fisik di dalam workspace
    if (document.uri.scheme !== 'file') {
        return;
    }
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        return;
    }

    // B. Persiapkan Path
    const projectRoot = workspaceFolder.uri.fsPath;
    const absFilePath = document.uri.fsPath;
    const relativePath = path.relative(projectRoot, absFilePath);

    // C. Panggil ENGINE (Fase 2)
    try {
        // 1. Muat config (otomatis cari .naminglintrc.json atau pakai default)
        const config = Linter.loadConfig(projectRoot);
        
        // 2. Jalankan Linting hanya untuk file ini
        const errors = Linter.lint([relativePath], config);

        // D. Konversi Error Engine -> Diagnostik VSCode
        const diagnostics: vscode.Diagnostic[] = [];

        errors.forEach(linterError => {
            // Tandai karakter pertama (karena nama file berlaku untuk seluruh file)
            const range = new vscode.Range(0, 0, 0, 1); 
            
            const diagnostic = new vscode.Diagnostic(
                range, 
                `${linterError.message}`, // Pesan error
                vscode.DiagnosticSeverity.Warning // Tampilkan sebagai Peringatan (Kuning)
            );
            
            diagnostic.source = 'Naming Standardizer';
            
            // Simpan tipe error dan saran perbaikan untuk fitur Quick Fix nanti
            diagnostic.code = {
                value: linterError.type, // 'case-rule' atau 'case-conflict'
                target: vscode.Uri.parse(linterError.suggestedFix || '') 
            }; 

            diagnostics.push(diagnostic);
        });

        // E. Tampilkan Error di Editor
        diagnosticCollection.set(document.uri, diagnostics);

    } catch (err) {
        console.error('Gagal menjalankan linter:', err);
    }
}