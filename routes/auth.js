const express = require('express');
const router = express.Router();
const { db, admin } = require('../services/firebase');

// Middleware para verificar admin
const isAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userSnapshot = await db.ref(`users/${decodedToken.uid}`).once('value');
    const userData = userSnapshot.val();

    if (!userData || !userData.admin) {
      return res.status(403).json({ error: 'Acesso negado: requer privilégios de admin' });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Erro na verificação de admin:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Cadastro de usuário
router.post('/cadastro', async (req, res) => {
  try {
    const { email, password, nomeLoja } = req.body;
    if (!email || !password || !nomeLoja) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Cria usuário no Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
      disabled: false
    });

    // Salva dados adicionais no Realtime Database
    await db.ref(`users/${userRecord.uid}`).set({
      email,
      nomeLoja,
      aprovado: false,
      admin: false,
      lojaId: `loja_${userRecord.uid}`,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });

    return res.status(201).json({ 
      success: true,
      message: 'Cadastro enviado para aprovação',
      uid: userRecord.uid
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(400).json({ 
      success: false,
      error: getFriendlyError(error.code),
      details: error.message
    });
  }
});

// Verificação de login (token Firebase)
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token não fornecido' });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const snapshot = await db.ref(`users/${uid}`).once('value');
    const userData = snapshot.val();

    if (!userData) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!userData.aprovado) return res.status(403).json({ error: 'Conta pendente de aprovação' });

    return res.json({
      uid,
      lojaId: userData.lojaId,
      admin: userData.admin || false,
      nomeLoja: userData.nomeLoja
    });
  } catch (error) {
    console.error('Erro na verificação:', error);
    return res.status(401).json({ error: 'Token inválido' });
  }
});

// Listar usuários pendentes (apenas admin)
router.get('/pending', isAdmin, async (req, res) => {
  try {
    const snapshot = await db.ref('users').orderByChild('aprovado').equalTo(false).once('value');
    const users = [];
    snapshot.forEach((child) => {
      users.push({ uid: child.key, ...child.val() });
    });
    return res.json({ users });
  } catch (error) {
    console.error('Erro ao listar usuários pendentes:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// Aprovar usuário (apenas admin)
router.post('/approve/:uid', isAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    await db.ref(`users/${uid}`).update({
      aprovado: true,
      approvedAt: admin.database.ServerValue.TIMESTAMP,
      approvedBy: req.user.uid
    });
    return res.json({ message: 'Usuário aprovado com sucesso' });
  } catch (error) {
    console.error('Erro ao aprovar usuário:', error);
    return res.status(500).json({ error: 'Erro ao aprovar usuário' });
  }
});

// Redefinir senha
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email é obrigatório' });

    const resetLink = await admin.auth().generatePasswordResetLink(email);
    return res.status(200).json({ 
      success: true, 
      message: 'Link de redefinição de senha gerado com sucesso',
      resetLink 
    });
  } catch (error) {
    console.error('Erro ao enviar link de redefinição:', error);
    return res.status(400).json({ 
      success: false, 
      error: getFriendlyError(error.code),
      details: error.message
    });
  }
});

// Mapear códigos de erro para mensagens amigáveis
function getFriendlyError(code) {
  const errors = {
    'auth/email-already-exists': 'Email já cadastrado',
    'auth/invalid-email': 'Email inválido',
    'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres)',
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde',
    'auth/operation-not-allowed': 'Operação não permitida'
  };
  return errors[code] || 'Erro na operação';
}

// Retorna todas as lojas do usuário
router.get('/users/:uid/lojas', async (req, res) => {
  try {
    const { uid } = req.params;
    const snapshot = await db.ref('lojas').orderByChild('userId').equalTo(uid).once('value');
    const lojas = [];
    snapshot.forEach((child) => {
      const l = child.val();
      if (l.aprovada) {
        lojas.push({ id: child.key, nome: l.nomeLoja || 'Loja' });
      }
    });
    return res.json({ lojas });
  } catch (err) {
    console.error('Erro ao listar lojas:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});


module.exports = router;
