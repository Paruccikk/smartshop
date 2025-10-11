const admin = require('firebase-admin');
const serviceAccount = require('../credencial.json');

// Inicializa apenas se não existir
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://iatech-aca5f-default-rtdb.firebaseio.com"
  });
}

// Exporta os serviços necessários
module.exports = {
  db: admin.database(),
  auth: admin.auth(),
  admin // Para casos onde precisa do admin completo
};