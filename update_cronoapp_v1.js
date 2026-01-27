/**
 * CRONOAPP - SCRIPT DE ACTUALIZACIÓN DE BASE DE DATOS (FINAL)
 * Ejecutar con: node update_cronoapp_final.js
 * * DESCRIPCIÓN:
 * 1. Conecta a Firebase 'comtroldata' usando credenciales embebidas.
 * 2. Crea la colección maestra de 'settings_laborales'.
 * 3. Carga las escalas salariales de SUVICO 2026.
 */

const admin = require('firebase-admin');

// --- 1. CREDENCIALES (Extraídas de tu documentación: service-account.json) ---
const serviceAccount = {
  "type": "service_account",
  "project_id": "comtroldata",
  "private_key_id": "542b807649adab8f5142487ad529a0522adff565",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+EARTAdAae35J\n11vk1mozAg+JRUgHjJ3n2tgcHHJToQZZdWBN090Q2nyxM3j4cdoR5BrDV9x5nhSj\nIU9QTE9Z2Sc4iFx6xac1Di8JdZpWXb7S3Y1n2EIPyeVJLiejzLYExG/ha9JV8mO9\nj0eD+UShtTHXVWhToA/6Jm2o1IZlmoWdTH9cDd8frMAYIOi8aZmpR/rP5H7RGRej\nAvRqoC9eoizbA8u0QHGzkIAvezbOgCBy55J/bVZ1N7ARitdGsnIbiK5H9Sv9QIjC\n0kz+EIdAMH6K3B8YuwtmCX53TMO8xBeGs+CTwXM86tic50WbdnTRV88uAOTEbTBC\nZPr8EiVNAgMBAAECggEAPfzeVC5Gr6RwU2f8Th3KRDmbVJN2gxPPGmPrUPvMI89k\nUT/xeWCsfIct3ONjRHBphaVGP0jEHRw8Mdo20oMY7D5hRtReiSI2vxyRpb2n6Rwp\nFP/yUxiaryiTcfMuNYOaJ+LjdHtkfeiQtC3rTrU5N55vk4IFBSUyoMzwvfwWm0Mi\nJfqmtGO0ADAUGgftkZlmd7Vh7yt3JNJRbsZW/hZFIAAsg7o8kQZ+5Frwmwo8Ntn+\nUd4QryPAtBEUgTeafdeCKzs49Yi3RdbB60CBrcCq8uHgKGPP8xoga2VIIbx+smgr\nV6rDp0GPXpEz3P5pq6LBKAQkfMd/1PMe7B0kCxPQpwKBgQD2X7befQ7JrR+HqZr0\nMnJlzOFUbZT9TOL70e0LhOK7UE5tV5PXC1am8DIx/zuMcIC80f8hnyelHHopEv4+\nvyChk4/U2NbU0ECxPqmDsFsIJJRt/Tc3/9TR8S3L7ZM7s+AezkxuEourrq5DSU1i\n2gLuee1V85oANt3+zUBnt69/BwKBgQDFfRB8MP3GDEk5Y3lm+k8o+P9iLM4V/ZFQ\ny57wq9pEZxWTbXyWefaN7aeg3wRxVpNQTK0HaT8mNppSBeI9c7S3EL5SbvkCyTUk\nVHTN8o4BnQizVwkv5+ILU8UGW6dz/JFhxw55HyiiJO9bbxWzbCQK6pioCOVHDrf7\nZafvlp7QCwKBgQCTDJXNPb8xyE7lXenKjsGQ2TQ0fCNM/DMOMkHVej8JpejpgjgP\nRgk2Im8TQE9+hzePe5dXrfKvrcuL8HYnZVRInBZg5/txkcrK/6eVnhD3Tz34WAY5\nOkz/8X9wFCCopbfDK0aa/B65Hc2NA5dYxN6zD7sEbh0gu57Mkh06ynvIyQKBgQCV\nDSI/CV7PdgBh/vDmxu6t9tgRCc31DO77MuNfs+TFkaPYJF9O1vg+AGtu4ENjIzuF\n9Ij3Ofj+Z2GrnGM3jDeNn2Z1ounvr1qbc97AfVuuXg3uBTea34FcmTnv5YcJ5Er5\nqBoFUn4BeqzornuLcof1cUAMOsKJEdPMOto32s88JwKBgBts8voUhdhCqWu7sDLB\nF6fAuzOQxKxiWB0CPn8GHNJwZgjiPB5+Hj9mZRyfsS5Bn8fmCrC8q4MTpKmpURMd\nxmXteJP63Y6z2TQz8DhfVL84/0cTxC9nkRFqYeIkz+AiHkP8aw5u95f3QbThaGiM\nQzvcb4tHgOvJh5+G4cOnOfHH\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@comtroldata.iam.gserviceaccount.com",
};

// Inicializar Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function sembrarEscalas() {
    console.log("🌱 INICIANDO CARGA DE ESCALAS (CCT SUVICO)...");

    // ESTRUCTURA MAESTRA: SUVICO CÓRDOBA
    const escalaSuvico = {
        name: "SUVICO - Córdoba (Vigente)",
        code: "suvico_cba",
        lastUpdate: new Date(),
        validFrom: "2026-01-01",
        validTo: "2026-03-31",
        
        // 1. VARIABLES GLOBALES (Costos Fijos)
        globals: {
            cargasPatronales: 29.0, // Ley + Jub + Fondo Desempleo
            art: 7.5,               // Alicuota promedio seguridad
            seguroVida: 0.65,       // Obligatorio
            sindicato: 2.0,         // Aporte solidario
            presentismo: 180000,    // Valor fijo convenio
            noRemunerativo: 0       // Si hubiera bonos decreto
        },

        // 2. CATEGORÍAS PROFESIONALES (Mix de Dotación)
        categories: [
            {
                id: "vig_gral",
                nombre: "Vigilador General",
                basico: 980000,
                viatico: 250000, 
                responsabilidad: 0
            },
            {
                id: "monitor",
                nombre: "Operador de Monitoreo",
                basico: 1150000,
                viatico: 250000,
                responsabilidad: 50000
            },
            {
                id: "jefe",
                nombre: "Jefe de Servicio",
                basico: 1350000,
                viatico: 300000,
                responsabilidad: 150000
            },
            {
                id: "drone",
                nombre: "Piloto Dron (Especial)",
                basico: 1500000,
                viatico: 300000,
                responsabilidad: 100000
            }
        ]
    };

    try {
        // Guardar la escala
        await db.collection('settings_laborales').doc('suvico_cba_2026').set(escalaSuvico);
        
        // Crear un puntero 'active' para que el cotizador sepa cuál leer
        await db.collection('settings_laborales').doc('current_cba').set({
            ref: 'suvico_cba_2026',
            updatedAt: new Date()
        });

        console.log("✅ BASE DE DATOS ACTUALIZADA CORRECTAMENTE.");
        console.log("📊 Colección: settings_laborales");
        console.log("📄 Documento: suvico_cba_2026");
        console.log("👉 Ya puedes usar el Cotizador en la Web.");
        
    } catch (error) {
        console.error("❌ Error escribiendo en Firestore:", error);
    }
}

sembrarEscalas();