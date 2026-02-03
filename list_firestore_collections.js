#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULTS = {
  format: 'json',
  counts: true,
  sample: 0,
  includeSubcollections: false,
  maxDocs: 25,
  maxSubcollectionParents: 5,
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const [key, inlineValue] = raw.split('=');
    const normalizedKey = key.replace(/^--/, '');
    const next = argv[i + 1];
    const value = inlineValue !== undefined
      ? inlineValue
      : (next && !next.startsWith('--') ? (i += 1, next) : true);
    args[normalizedKey] = value;
  }
  return args;
}

function printUsage() {
  const msg = `
Uso:
  node list_firestore_collections.js [opciones]

Opciones:
  --service-account <path>   Ruta al JSON del service account.
  --project-id <id>          ID del proyecto Firebase.
  --format <json|text>       Formato de salida (default: json).
  --output <path>            Guardar salida en archivo.
  --no-counts               No calcular conteos de documentos.
  --sample <n>               Numero de documentos a muestrear por coleccion.
  --include-subcollections   Descubrir subcolecciones (escanea docs).
  --max-docs <n>             Docs maximos a escanear por coleccion (default: 25).
  --max-subcollection-parents <n>  Limite de docs por subcoleccion (default: 5).
  --help                     Mostrar ayuda.

Ejemplos:
  node list_firestore_collections.js --service-account ./service-account.json
  node list_firestore_collections.js --sample 3 --include-subcollections
  node list_firestore_collections.js --format text --no-counts
`;
  console.log(msg.trim());
}

function toInt(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __ref: value.path };
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = serializeValue(value[key]);
    });
    return out;
  }
  return value;
}

async function inspectCollection(collectionRef, options) {
  const info = {
    id: collectionRef.id,
    path: collectionRef.path,
  };

  if (options.counts) {
    try {
      const countSnap = await collectionRef.count().get();
      info.docCount = countSnap.data().count;
    } catch (err) {
      info.docCount = null;
      info.countError = err.message;
    }
  }

  if (options.sample > 0) {
    const sampleSnap = await collectionRef.limit(options.sample).get();
    info.sampleDocs = sampleSnap.docs.map((doc) => ({
      id: doc.id,
      data: serializeValue(doc.data()),
    }));
  }

  if (options.includeSubcollections) {
    const docsSnap = await collectionRef.limit(options.maxDocs).get();
    const subcollections = new Map();

    for (const doc of docsSnap.docs) {
      const subRefs = await doc.ref.listCollections();
      for (const sub of subRefs) {
        if (!subcollections.has(sub.id)) {
          subcollections.set(sub.id, {
            id: sub.id,
            paths: [],
            parentDocIds: [],
          });
        }
        const entry = subcollections.get(sub.id);
        if (entry.paths.length < options.maxSubcollectionParents) {
          entry.paths.push(sub.path);
        }
        if (entry.parentDocIds.length < options.maxSubcollectionParents) {
          entry.parentDocIds.push(doc.id);
        }
      }
    }

    info.subcollections = Array.from(subcollections.values());
    info.subcollectionScan = {
      scannedDocs: docsSnap.size,
      maxDocs: options.maxDocs,
    };
  }

  return info;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const options = {
    format: (args.format || DEFAULTS.format).toLowerCase(),
    counts: args['no-counts'] ? false : DEFAULTS.counts,
    sample: toInt(args.sample, DEFAULTS.sample),
    includeSubcollections: Boolean(args['include-subcollections'] || DEFAULTS.includeSubcollections),
    maxDocs: toInt(args['max-docs'], DEFAULTS.maxDocs),
    maxSubcollectionParents: toInt(args['max-subcollection-parents'], DEFAULTS.maxSubcollectionParents),
  };

  const serviceAccountPath = args['service-account']
    || process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const projectId = args['project-id'] || process.env.FIREBASE_PROJECT_ID;

  let credential;
  let resolvedProjectId = projectId || null;

  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account no encontrado: ${resolvedPath}`);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
    if (!resolvedProjectId && serviceAccount.project_id) {
      resolvedProjectId = serviceAccount.project_id;
    }
  } else {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: resolvedProjectId || undefined,
  });

  const db = admin.firestore();
  const collections = await db.listCollections();

  const result = {
    projectId: resolvedProjectId || null,
    generatedAt: new Date().toISOString(),
    options,
    collections: [],
  };

  for (const colRef of collections) {
    const info = await inspectCollection(colRef, options);
    result.collections.push(info);
  }

  if (options.format === 'text') {
    const lines = [];
    lines.push(`Proyecto: ${result.projectId || 'desconocido'}`);
    lines.push(`Colecciones: ${result.collections.length}`);
    result.collections.forEach((col) => {
      const countLabel = options.counts ? ` (${col.docCount ?? 'n/a'} docs)` : '';
      lines.push(`- ${col.path}${countLabel}`);
      if (col.subcollections && col.subcollections.length > 0) {
        col.subcollections.forEach((sub) => {
          lines.push(`  - ${sub.id} (ejemplos: ${sub.paths.join(', ')})`);
        });
      }
    });
    outputResult(lines.join('\n'), args.output);
    return;
  }

  outputResult(JSON.stringify(result, null, 2), args.output);
}

function outputResult(content, outputPath) {
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.writeFileSync(resolved, content, 'utf8');
    console.log(`Salida guardada en ${resolved}`);
    return;
  }
  console.log(content);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
