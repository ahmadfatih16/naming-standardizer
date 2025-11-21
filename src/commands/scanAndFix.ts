import * as vscode from 'vscode';
import * as path from 'path';
import * as Linter from 'naming-standardizer-engine';

export async function scanAndFixFolder(folderUri: vscode.Uri) {
    if (!folderUri) {
        vscode.window.showErrorMessage('Silakan klik kanan pada folder yang valid.');
        return;
    }

    // 1. Normalisasi Path
    const normalize = (p: string) => p.split(path.sep).join('/');
    
    const rawFolderPath = folderUri.fsPath;
    const projectRoot = vscode.workspace.getWorkspaceFolder(folderUri)?.uri.fsPath || rawFolderPath;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Memindai folder...",
        cancellable: false
    }, async (progress) => {
        
        const config = Linter.loadConfig(projectRoot);
        let allFiles = Linter.scanFiles(rawFolderPath, config.ignore);

        // --- 2. FILTER LEBIH KETAT (SEGMENT CHECK) ---
        const IGNORED_NAMES = ['node_modules', 'dist', '.git', '.vscode', 'out', 'build', 'coverage'];

        allFiles = allFiles.filter(filePath => {
            const normalized = normalize(filePath);
            const segments = normalized.split('/'); 
            const hasIgnoredFolder = segments.some(segment => IGNORED_NAMES.includes(segment));
            return !hasIgnoredFolder;
        });
        // ----------------------------------------------

        const errors = Linter.lint(allFiles, config);
        const fixableErrors = errors.filter(e => e.suggestedFix && e.type === 'case-rule');

        if (fixableErrors.length === 0) {
            vscode.window.showInformationMessage('Tidak ditemukan pelanggaran penamaan di folder ini. Aman! ✅');
            return;
        }

        // UI Preview
        const items: vscode.QuickPickItem[] = fixableErrors.map(err => {
            const fileName = path.basename(err.filePath);
            return {
                label: `$(edit) ${fileName}  ➡️  ${err.suggestedFix}`, 
                description: err.filePath,
                picked: true, 
                detail: err.filePath
            };
        });

        // --- PERUBAHAN DI SINI: Instruksi Cancel ---
        const selectedItems = await vscode.window.showQuickPick(items, {
            // Kita tambahkan instruksi jelas di sini
            placeHolder: `Ditemukan ${fixableErrors.length} pelanggaran. Pilih file (Tekan 'ESC' untuk Batal)`,
            canPickMany: true,
            ignoreFocusOut: true
        });

        // --- PERUBAHAN DI SINI: Logika Batal ---
        
        // 1. Jika user menekan ESC atau klik di luar (hasilnya undefined)
        if (!selectedItems) {
            vscode.window.showInformationMessage('Operasi rename dibatalkan ❌');
            return;
        }

        // 2. Jika user uncheck semua item lalu tekan OK
        if (selectedItems.length === 0) {
            vscode.window.showInformationMessage('Tidak ada file yang dipilih untuk diubah.');
            return; 
        }

        // Eksekusi Rename
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
            }
        });

        const success = await vscode.workspace.applyEdit(edit);
        
        if (success) {
            vscode.window.showInformationMessage(`Berhasil me-rename ${selectedItems.length} item! 🎉`);
        } else {
            vscode.window.showErrorMessage('Gagal melakukan rename massal.');
        }
    });
}