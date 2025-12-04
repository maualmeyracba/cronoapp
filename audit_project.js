const fs = require('fs');
const path = require('path');

// Configuración: Qué carpetas ignorar para no llenar el archivo de basura
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  '.next',
  '.firebase',
  'out',
  'lib',
  'dist',
  '.vscode',
  'coverage'
];

// Configuración: Qué extensiones de archivo nos interesan
const INCLUDE_EXTS = [
  '.ts',
  '.tsx',
  '.js',
  '.json',
  '.rules', // Para firestore.rules
  '.md'     // Para README
];

// Archivos específicos a ignorar (porque son muy largos y no aportan lógica)
const IGNORE_FILES = [
  'package-lock.json',
  'audit_project.js' // No nos auto-escaneamos
];

const OUTPUT_FILE = 'AUDITORIA_COMPLETA.txt';
const ROOT_DIR = process.cwd();

let fileCount = 0;
let contentBuffer = '';

function scanDirectory(currentPath) {
  const items = fs.readdirSync(currentPath);

  // Primero mostramos la estructura de carpetas
  items.forEach(item => {
    const fullPath = path.join(currentPath, item);
    const stat = fs.statSync(fullPath);
    const relativePath = path.relative(ROOT_DIR, fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(item)) {
        scanDirectory(fullPath);
      }
    } else {
      const ext = path.extname(item);
      if (INCLUDE_EXTS.includes(ext) && !IGNORE_FILES.includes(item)) {
        readFileContent(fullPath, relativePath);
      }
    }
  });
}

function readFileContent(fullPath, relativePath) {
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Formato separador claro para que la IA lo entienda
    contentBuffer += '\n' + '='.repeat(80) + '\n';
    contentBuffer += `FILE: ${relativePath}\n`;
    contentBuffer += '='.repeat(80) + '\n';
    contentBuffer += content + '\n';
    
    console.log(`✅ Leído: ${relativePath}`);
    fileCount++;
  } catch (error) {
    console.error(`❌ Error leyendo ${relativePath}:`, error.message);
  }
}

console.log('🔍 Iniciando auditoría de código...');
console.log(`📂 Directorio raíz: ${ROOT_DIR}`);

// Escribir cabecera
contentBuffer += `AUDITORÍA DE PROYECTO CONTROL DATA\n`;
contentBuffer += `Fecha: ${new Date().toISOString()}\n`;
contentBuffer += `----------------------------------------\n\n`;

// Iniciar escaneo
scanDirectory(ROOT_DIR);

// Guardar resultado
fs.writeFileSync(OUTPUT_FILE, contentBuffer);

console.log('\n' + '-'.repeat(50));
console.log(`🎉 Auditoría completada.`);
console.log(`📄 Archivos procesados: ${fileCount}`);
console.log(`💾 Resultado guardado en: ${OUTPUT_FILE}`);
console.log(`👉 Por favor, sube el archivo "${OUTPUT_FILE}" al chat.`);
console.log('-'.repeat(50));