const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ==========================================
// ⚙️ CONFIGURACIÓN MAESTRA (CRONOAPP V6.0 - FINAL)
// ==========================================
const ROOT_DIR = process.cwd();
const BACKUP_ROOT = path.join(ROOT_DIR, '_SNAPSHOTS_ROOT');

/**
 * 🗺️ MAPA DE MÓDULOS (Rutas Corregidas: apps/functions y apps/web2)
 */
const MODULES = {
    // --- 1. NIVEL MACRO ---
    'FULL': { path: '', desc: '🌎 PROYECTO COMPLETO' },

    // --- 2. INFRAESTRUCTURA (Rutas confirmadas) ---
    'FULL_BACKEND': { 
        path: path.join('apps', 'functions'), 
        desc: '⚙️  Backend (apps/functions)' 
    },
    'FULL_WEB': { 
        path: path.join('apps', 'web2'), 
        desc: '🖥️  Frontend (apps/web2)' 
    },

    // --- 3. MÓDULOS DE NEGOCIO (Frontend) ---
    // ⚠️ Asumimos estructura standard: apps/web2/pages/admin/...
    // Si tu proyecto usa 'src/pages' o 'app/admin', el script te avisará si no encuentra la carpeta.
    'FE_OPERATIONS': { 
        path: path.join('apps', 'web2', 'pages', 'admin', 'operations'), 
        desc: '🛡️  OPERACIONES (Torre de Control)' 
    },
    'FE_CRM': { 
        path: path.join('apps', 'web2', 'pages', 'admin', 'crm'), 
        desc: '🤝 CRM (Gestión Comercial)' 
    },
    'FE_SERVICES': { 
        path: path.join('apps', 'web2', 'pages', 'admin', 'services'), 
        desc: '💼 SERVICIOS (Contratos)' 
    },
    'FE_REPORTS': { 
        path: path.join('apps', 'web2', 'pages', 'admin', 'reports'), 
        desc: '📈 REPORTES (Métricas)' 
    },
    'FE_SCHEDULER': { 
        path: path.join('apps', 'web2', 'pages', 'admin', 'schedule'), 
        desc: '📅 PLANIFICADOR (Turnos)' 
    },
    'FE_EMPLOYEES': { 
        path: path.join('apps', 'web2', 'pages', 'admin', 'employees'), 
        desc: '👥 RRHH (Legajos)' 
    },
    'FE_DASHBOARD': { 
        path: path.join('apps', 'web2', 'pages', 'admin', 'dashboard'), 
        desc: '📊 DASHBOARD' 
    },
    'FE_COMPONENTS': { 
        path: path.join('apps', 'web2', 'src', 'components'), 
        desc: '🧩 COMPONENTES UI' 
    },

    // --- 4. BACKEND CORE (NestJS) ---
    'BE_SCHEDULING': { 
        path: path.join('apps', 'functions', 'src', 'scheduling'), 
        desc: '🧠 API: Motor de Turnos' 
    },
    'BE_DATA': { 
        path: path.join('apps', 'functions', 'src', 'data-management'), 
        desc: '🗄️  API: Gestión de Datos' 
    }
};

// 🛑 LISTA NEGRA (Ignorar basura)
const IGNORE_LIST = [
    'node_modules', '.next', 'out', '.git', '.firebase', 
    '_SNAPSHOTS_ROOT', '.DS_Store', 'dist', 'build', 'lib', 
    'coverage', '.turbo', '.vscode', 'package-lock.json', 'yarn.lock',
    'firebase-debug.log', 'ui-debug.log'
];

// Inicialización
if (!fs.existsSync(BACKUP_ROOT)) fs.mkdirSync(BACKUP_ROOT);

// ==========================================
// 🛠️ FUNCIONES CORE
// ==========================================

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return; 
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
        } catch (err) { /* Ignorar bloqueos */ }
    }
}

function clearDirectory(targetDir) {
    if (!fs.existsSync(targetDir)) return;
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORE_LIST.includes(entry.name) || 
            entry.name === 'snapshot.js' || 
            entry.name === 'map_structure.js' || 
            entry.name === 'verify_structure.js' || 
            entry.name === 'CONTEXTO_CRONOAPP.txt') continue;
        
        const fullPath = path.join(targetDir, entry.name);
        try {
            if (entry.isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(fullPath);
            }
        } catch (e) { console.error(`⚠️ Error al limpiar: ${entry.name}`); }
    }
}

// ==========================================
// 🚀 MOTOR DE BACKUP
// ==========================================

const createBackup = (description = 'auto', moduleKey = 'FULL') => {
    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const safeDesc = description.replace(/[^a-z0-9]/gi, '_');
    const folderName = `[${moduleKey}]_${timestamp}__${safeDesc}`;
    const targetDir = path.join(BACKUP_ROOT, folderName);

    console.log(`\n📦 Snapshot: ${folderName}`);

    try {
        if (moduleKey === 'FULL') {
            copyRecursive(ROOT_DIR, targetDir);
        } else {
            const mod = MODULES[moduleKey];
            if (!mod) {
                console.error(`❌ Módulo no definido: ${moduleKey}`);
                return null;
            }
            
            const srcPath = path.join(ROOT_DIR, mod.path);
            const destPath = path.join(targetDir, mod.path);
            
            if (!fs.existsSync(srcPath)) {
                console.error(`❌ Ruta no encontrada: ${srcPath}`);
                console.error(`   👉 Revisa si la carpeta existe. El backup de este módulo se omitirá.`);
                return null;
            }

            console.log(`   👉 Respaldando: ${mod.desc}`);
            copyRecursive(srcPath, destPath);

             // Copiar contexto vital
             ['package.json', 'CONTEXTO_CRONOAPP.txt'].forEach(f => {
                const fSrc = path.join(ROOT_DIR, f);
                const fDest = path.join(targetDir, f);
                if (fs.existsSync(fSrc)) fs.copyFileSync(fSrc, fDest);
            });
        }
        console.log(`✅ OK: _SNAPSHOTS_ROOT/${folderName}`);
        return targetDir;
    } catch (e) {
        console.error(`❌ Error crítico: ${e.message}`);
        return null;
    }
};

const restoreBackupInteract = (rl) => {
    const backups = fs.readdirSync(BACKUP_ROOT)
        .filter(f => fs.statSync(path.join(BACKUP_ROOT, f)).isDirectory())
        .sort().reverse();

    if (backups.length === 0) { console.log('❌ Sin snapshots.'); rl.close(); return; }

    console.log('\n📂 RESTAURAR SNAPSHOT:');
    backups.forEach((b, i) => console.log(`   [${i + 1}] ${b}`));
    console.log('   [0] Cancelar');

    rl.question('\n👉 Número: ', (answer) => {
        const idx = parseInt(answer) - 1;
        if (answer === '0' || isNaN(idx) || idx < 0 || idx >= backups.length) { rl.close(); return; }

        const selectedBackup = backups[idx];
        const sourcePath = path.join(BACKUP_ROOT, selectedBackup);
        
        let moduleKey = 'FULL';
        const match = selectedBackup.match(/^\[(.*?)\]/);
        if (match) moduleKey = match[1];
        
        const modInfo = MODULES[moduleKey];

        console.log(`\n⚠️  ALERTA: Vas a restaurar [${moduleKey}]`);
        if (moduleKey !== 'FULL' && modInfo) console.log(`   🎯 Destino: ${modInfo.path}`);
        else console.log(`   🌎 Destino: PROYECTO COMPLETO`);

        rl.question('Escribe "SI" para confirmar: ', (confirm) => {
            if (confirm.toUpperCase() === 'SI') {
                if (moduleKey === 'FULL') {
                    clearDirectory(ROOT_DIR);
                    copyRecursive(sourcePath, ROOT_DIR);
                } else if (modInfo) {
                    const targetPath = path.join(ROOT_DIR, modInfo.path);
                    const sourceModulePath = path.join(sourcePath, modInfo.path);
                    clearDirectory(targetPath);
                    copyRecursive(sourceModulePath, targetPath);
                }
                console.log('\n✅ Restauración completada.');
            }
            rl.close();
        });
    });
};

// ==========================================
// 🎮 MENÚ INTERACTIVO
// ==========================================

const args = process.argv.slice(2);
const command = args[0];

if (command === 'auto') {
    createBackup('auto_save', 'FULL');
} else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    console.log(`
    =========================================
    🛡️  CRONOAPP SNAPSHOT V6.0 (APPS)
    =========================================
    1. 🌎 FULL PROYECTO
    
    --- NEGOCIO (apps/web2) ---
    2. 🛡️  Operaciones     6. 📅 Planificador
    3. 🤝 CRM             7. 👥 RRHH
    4. 💼 Servicios       8. 📊 Dashboard
    5. 📈 Reportes
    
    --- TÉCNICO ---
    9. ⚙️  BACKEND (apps/functions)
    10. 🖥️  FRONTEND (apps/web2)
    11. 🧠 Motor Scheduling
    
    12. ♻️  RESTAURAR
    0. Salir
    =========================================
    `);

    rl.question('Opción: ', (opt) => {
        const map = {
            '1': 'FULL', '2': 'FE_OPERATIONS', '3': 'FE_CRM', '4': 'FE_SERVICES', 
            '5': 'FE_REPORTS', '6': 'FE_SCHEDULER', '7': 'FE_EMPLOYEES', '8': 'FE_DASHBOARD', 
            '9': 'FULL_BACKEND', '10': 'FULL_WEB', '11': 'BE_SCHEDULING'
        };
        if (opt === '12') restoreBackupInteract(rl);
        else if (map[opt]) {
            rl.question('Etiqueta: ', (desc) => {
                createBackup(desc || 'manual', map[opt]);
                rl.close();
            });
        } else rl.close();
    });
}