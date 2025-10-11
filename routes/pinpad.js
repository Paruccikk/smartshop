const express = require('express');
const router = express.Router();
const { iniciarPagamento } = require('../utils/pinpad');

// POST /api/pinpad/pagar
router.post('/pagar', async (req, res) => {
  try {
    const { valor, formaPagamento } = req.body;

    if (!valor) {
      return res.status(400).json({ status: 'erro', mensagem: 'Valor não informado' });
    }

    const resultado = await iniciarPagamento(valor, formaPagamento);
    res.json(resultado);
  } catch (err) {
    console.error('❌ Erro no pagamento:', err);
    res.status(500).json({
      status: 'erro',
      mensagem: 'Falha ao processar pagamento com a maquininha'
    });
  }
});

module.exports = router;
