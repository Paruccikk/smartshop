const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');  // <-- desestrutura aqui

router.post('/adicionar', async (req, res) => {
  try {
    const { lojaId, produto } = req.body;
    if (!lojaId || !produto) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    const ref = db.ref(`lojas/${lojaId}/produtos`);
    const novoProdutoRef = ref.push();
    await novoProdutoRef.set(produto);
    res.json({ msg: 'Produto adicionado.', id: novoProdutoRef.key });
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    res.status(500).json({ error: 'Erro interno ao adicionar produto' });
  }
});

router.get('/:lojaId', async (req, res) => {
  try {
    const { lojaId } = req.params;
    const snapshot = await db.ref(`lojas/${lojaId}/produtos`).once('value');
    res.json(snapshot.val() || {});
  } catch (error) {
    console.error('Erro ao obter produtos:', error);
    res.status(500).json({ error: 'Erro interno ao obter produtos' });
  }
});

module.exports = router;
