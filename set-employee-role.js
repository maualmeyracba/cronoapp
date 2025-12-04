const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json'); 

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 🛑 ESTE ES EL UID QUE SAQUÉ DE TU CAPTURA DE PANTALLA
const uid = 'MBKd9pqsSPXPcxsLxyPUdC8NFCd2'; 

async function setEmployeeRole() {
  try {
    console.log(`🔍 Buscando usuario ${uid}...`);
    
    // 1. Asignar el Custom Claim en Auth (El sello en la tarjeta)
    await admin.auth().setCustomUserClaims(uid, { role: 'employee' });
    
    console.log(`✅ ÉXITO: Rol 'employee' asignado a Débora.`);
    console.log(`⚠️ IMPORTANTE: Ella debe cerrar sesión y volver a entrar.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setEmployeeRole();