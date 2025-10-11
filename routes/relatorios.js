// === routes/relatorios.js ===
const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');

// Rota para obter relatórios de uma loja
router.get('/:lojaId', async (req, res) => {
  try {
    const { lojaId } = req.params;

    // Pegar produtos
    const produtosSnap = await db.ref(`lojas/${lojaId}/produtos`).once('value');
    const produtos = produtosSnap.val() || {};

    // Pegar vendas
    const vendasSnap = await db.ref(`lojas/${lojaId}/vendas`).once('value');
    const vendas = vendasSnap.val() || {};

    // Preparar relatórios
    const entradas = Object.entries(produtos).map(([id, p]) => ({
      id,
      nome: p.nome,
      quantidade: p.quantidade || 0,
      data: p.dataAdicionado || '-'
    }));

    const vendasArray = Object.entries(vendas).map(([id, venda]) => ({
      id,
      ...venda,
      itens: venda.itens ? venda.itens.map(item => ({
        ...item,
        quantidade: parseInt(item.qtd) || 0,
        valor: parseFloat(item.preco) || 0
      })) : []
    }));

    const saidas = [];
    vendasArray.forEach(venda => {
      venda.itens.forEach(item => {
        saidas.push({
          nome: item.nome,
          quantidade: item.quantidade,
          data: venda.data ? new Date(venda.data).toLocaleString() : '-',
          observacao: venda.formaPagamento || '-'
        });
      });
    });

    res.json({ entradas, saidas });
  } catch (error) {
    console.error('Erro ao obter relatórios:', error);
    res.status(500).json({ error: 'Erro interno ao obter relatórios' });
  }
});

module.exports = router;
