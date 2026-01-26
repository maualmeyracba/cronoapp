const fs = require('fs');
const path = require('path');
const readline = require('readline');

// CONFIGURACIÓN GLOBAL
const ROOT_DIR = process.cwd();
const BACKUP_ROOT = path.join(ROOT_DIR, '_SNAPSHOTS_ROOT');
const IGNORE_LIST = ['node_modules', '.next', '.git', '.firebase', '_SNAPSHOTS_ROOT', '.DS_Store', 'dist', 'build', '.vscode', 'package-lock.json', 'yarn.lock'];

// Asegurar carpeta de snapshots
if (!fs.existsSync(BACKUP_ROOT)) fs.mkdirSync(BACKUP_ROOT);

// --- FUNCIONES UTILITARIAS ---

function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        if (IGNORE_LIST.includes(entry.name)) continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        try {
            if (entry.isDirectory()) {
                copyRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        } catch (err) { /* Ignorar bloqueos de archivos en uso */ }
    }
}

// Función para vaciar el directorio raíz antes de restaurar (con seguridad)
function clearRootDirectory(rootDir) {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORE_LIST.includes(entry.name) || entry.name === 'snapshot.js') continue; // No borrar al propio script ni carpetas ignoradas
        const fullPath = path.join(rootDir, entry.name);
        try {
            if (entry.isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(fullPath);
            }
        } catch (e) { console.error(`⚠️ No se pudo borrar: ${entry.name}`); }
    }
}

// --- FUNCIONES PRINCIPALES ---

// 1. BACKUP COMPLETO (MACRO)
const createFullBackup = (description = 'auto') => {
    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const safeDesc = description.replace(/[^a-z0-9]/gi, '_');
    const folderName = `FULL_BACKUP_${timestamp}__${safeDesc}`;
    const targetDir = path.join(BACKUP_ROOT, folderName);

    console.log(`📦 [MACRO] Creando Snapshot Completo: ${folderName}...`);
    try {
        copyRecursive(ROOT_DIR, targetDir);
        console.log(`✅ Backup completo guardado en: _SNAPSHOTS_ROOT/${folderName}`);
        return targetDir;
    } catch (e) {
        console.error(`❌ Error en backup completo: ${e.message}`);
        return null;
    }
};

// 2. BACKUP DE ARCHIVO ÚNICO (MICRO)
const backupSingleFile = (filePath) => {
    if (!fs.existsSync(filePath)) return false;
    const backupPath = `${filePath}.bak`;
    try {
        fs.copyFileSync(filePath, backupPath);
        console.log(`🛡️  [MICRO] Backup rápido creado: ${path.basename(backupPath)}`);
        return true;
    } catch (e) {
        console.error(`❌ No se pudo crear backup del archivo: ${e.message}`);
        return false;
    }
};

// 3. RESTAURAR ARCHIVO ÚNICO (ROLLBACK)
const restoreSingleFile = (filePath) => {
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(backupPath)) {
        console.error(`⚠️ No existe backup (.bak) para: ${path.basename(filePath)}`);
        return false;
    }
    try {
        fs.copyFileSync(backupPath, filePath);
        console.log(`♻️  [ROLLBACK] Archivo restaurado: ${path.basename(filePath)}`);
        return true;
    } catch (e) {
        console.error(`❌ Error al restaurar archivo: ${e.message}`);
        return false;
    }
};

// 4. RESTAURAR BACKUP COMPLETO (INTERACTIVO)
const restoreFullBackupInteract = (rl) => {
    // Listar backups disponibles
    const backups = fs.readdirSync(BACKUP_ROOT)
        .filter(f => fs.statSync(path.join(BACKUP_ROOT, f)).isDirectory() && f.includes('FULL_BACKUP'))
        .sort().reverse(); // Los más recientes primero

    if (backups.length === 0) {
        console.log('❌ No se encontraron backups en _SNAPSHOTS_ROOT.');
        rl.close();
        return;
    }

    console.log('\n📂 Backups Disponibles (Más recientes primero):');
    backups.forEach((b, i) => {
        console.log(`   [${i + 1}] ${b}`);
    });
    console.log('   [0] Cancelar');

    rl.question('\n👉 Elige el número del backup a restaurar: ', (answer) => {
        const idx = parseInt(answer) - 1;
        
        if (answer === '0' || isNaN(idx) || idx < 0 || idx >= backups.length) {
            console.log('❌ Operación cancelada.');
            rl.close();
            return;
        }

        const selectedBackup = backups[idx];
        const sourcePath = path.join(BACKUP_ROOT, selectedBackup);

        console.log(`\n⚠️  ATENCIÓN: Se sobrescribirá el proyecto actual con la versión: ${selectedBackup}`);
        console.log('   (Node_modules y .git se mantendrán intactos)');
        
        rl.question('¿Estás seguro? Escribe "SI" para confirmar: ', (confirm) => {
            if (confirm.toUpperCase() === 'SI') {
                console.log('\n🧹 Limpiando directorio actual...');
                clearRootDirectory(ROOT_DIR);
                
                console.log(`♻️  Restaurando desde ${selectedBackup}...`);
                copyRecursive(sourcePath, ROOT_DIR);
                
                console.log('\n✅ ¡Restauración COMPLETA exitosa!');
                console.log('   Por favor, reinicia tu servidor de desarrollo si estaba corriendo.');
            } else {
                console.log('❌ Restauración cancelada.');
            }
            rl.close();
        });
    });
};

// --- INTERFAZ DE COMANDOS ---

const args = process.argv.slice(2);
const command = args[0];
const targetArg = args[1];

if (command === 'auto') {
    createFullBackup('automatico_pre_script');
} else if (command === 'file-backup' && targetArg) {
    backupSingleFile(targetArg);
} else if (command === 'file-restore' && targetArg) {
    restoreSingleFile(targetArg);
} else {
    // MODO INTERACTIVO
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`
    =========================================
    🛡️  SNAPSHOT V3.0 - AUTO RESTORE
    =========================================
    1. 📸 Backup COMPLETO del Proyecto
    2. ♻️  Restaurar Backup COMPLETO (Automático)
    3. ❌ Salir
    =========================================
    `);

    rl.question('Elige una opción: ', (opt) => {
        if (opt === '1') {
            rl.question('Descripción (opcional): ', (desc) => { 
                createFullBackup(desc || 'manual'); 
                rl.close(); 
            });
        } else if (opt === '2') {
            restoreFullBackupInteract(rl);
        } else {
            rl.close();
        }
    });
}