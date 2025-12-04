const admin = require('firebase-admin');
// Asegúrate de tener tu archivo de credenciales aquí
const serviceAccount = require('./service-account.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = 'BIar6f7ILATdkucXKH9NTDUkKQG2'; // 🛑 COPIA AQUÍ EL UID DE TU USUARIO QUE FALLA

async function setAdminRole() {
  try {
    // 1. Asignar el Custom Claim 'role: admin'
    await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
    
    console.log(`✅ ÉXITO: Rol de admin asignado al usuario ${uid}`);
    console.log('⚠️ IMPORTANTE: Debes cerrar sesión y volver a entrar para que el token se actualice.');
    
    // Verificación
    const user = await admin.auth().getUser(uid);
    console.log('Claims actuales:', user.customClaims);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setAdminRole();