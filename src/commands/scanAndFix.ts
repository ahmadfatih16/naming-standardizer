import * as vscode from 'vscode';
import * as path from 'path';
import * as Linter from 'naming-standardizer-engine';
import { outputChannel } from '../extension';

export async function scanAndFixFolder(folderUri: vscode.Uri) {
    if (!folderUri) {
        vscode.window.showErrorMessage('Silakan klik kanan pada folder yang valid.');
        return;
    }

    // Normalisasi Path (Solusi Windows)
    const normalize = (p: string) => p.split(path.sep).join('/');
    const rawFolderPath = folderUri.fsPath;
    const projectRoot = vscode.workspace.getWorkspaceFolder(folderUri)?.uri.fsPath || rawFolderPath;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Memindai folder...",
        cancellable: false
    }, async (progress) => {
        
        // 1. Muat Config
        const config = Linter.loadConfig(projectRoot);

        // --- LOG HEADER (Sesuai Request Opsi 2) ---
        outputChannel.show(true); // Buka panel output otomatis
        const time = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[${time}] SCAN: ${rawFolderPath}`);
        outputChannel.appendLine(`-> Aturan Aktif: File (${config.rules.fileCase}), Folder (${config.rules.folderCase})`);
        // ------------------------------------------
        
        // 2. Scan & Filter
        let allFiles = Linter.scanFiles(rawFolderPath, config.ignore);
        
        const IGNORED_NAMES = ['node_modules', 'dist', '.git', '.vscode', 'out', 'build', 'coverage'];
        allFiles = allFiles.filter(filePath => {
            const normalized = normalize(filePath);
            const segments = normalized.split('/'); 
            return !segments.some(segment => IGNORED_NAMES.includes(segment));
        });

        // 3. Linting
        const errors = Linter.lint(allFiles, config);
        const fixableErrors = errors.filter(e => e.suggestedFix && e.type === 'case-rule');

        // --- LOG ANALISIS ---
        outputChannel.appendLine(`-> Menganalisis... Ditemukan ${fixableErrors.length} pelanggaran.`);

        if (fixableErrors.length === 0) {
            vscode.window.showInformationMessage('Tidak ditemukan pelanggaran penamaan di folder ini. Aman! ✅');
            outputChannel.appendLine(`-> Status: AMAN (Sesuai standar).\n`);
            return;
        }

        // 4. UI Preview
        const items: vscode.QuickPickItem[] = fixableErrors.map(err => {
            const fileName = path.basename(err.filePath);
            return {
                label: `$(edit) ${fileName}  ➡️  ${err.suggestedFix}`, 
                description: err.filePath,
                picked: true, 
                detail: err.filePath
            };
        });

        const selectedItems = await vscode.window.showQuickPick(items, {
            placeHolder: `Ditemukan ${fixableErrors.length} pelanggaran. Pilih file (Tekan 'ESC' untuk Batal)`,
            canPickMany: true,
            ignoreFocusOut: true
        });

        // Handle Batal
        if (!selectedItems) {
            vscode.window.showInformationMessage('Operasi rename dibatalkan ❌');
            outputChannel.appendLine(`-> DIBATALKAN: User menekan ESC.\n`);
            return;
        }
        if (selectedItems.length === 0) {
            vscode.window.showInformationMessage('Tidak ada file yang dipilih.');
            outputChannel.appendLine(`-> DIBATALKAN: Tidak ada file dipilih.\n`);
            return; 
        }

        // 5. Eksekusi Rename
        const edit = new vscode.WorkspaceEdit();
        
        selectedItems.forEach(item => {
            const originalRelPath = item.detail!; 
            const errorObj = fixableErrors.find(e => e.filePath === originalRelPath);
            
            if (errorObj && errorObj.suggestedFix) {
                const absOldPath = path.join(rawFolderPath, originalRelPath);
                const absNewPath = path.join(path.dirname(absOldPath), errorObj.suggestedFix);

                edit.renameFile(
                    vscode.Uri.file(absOldPath), 
                    vscode.Uri.file(absNewPath)
                );

                // --- LOG RENAME ---
                const oldName = path.basename(absOldPath);
                const newName = path.basename(absNewPath);
                outputChannel.appendLine(`   [RENAME] ${oldName} -> ${newName}`);
            }
        });

        const success = await vscode.workspace.applyEdit(edit);
        
        if (success) {
            vscode.window.showInformationMessage(`Berhasil me-rename ${selectedItems.length} item! 🎉`);
            // --- LOG SUKSES ---
            outputChannel.appendLine(`-> SUKSES: ${selectedItems.length} file diubah.\n`);
        } else {
            vscode.window.showErrorMessage('Gagal melakukan rename massal.');
            outputChannel.appendLine(`-> GAGAL: Terjadi kesalahan sistem saat rename.\n`);
        }
    });
}