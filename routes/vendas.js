const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');

// Middleware para validar lojaId
const validateStore = (req, res, next) => {
  if (!req.params.lojaId && !req.body.lojaId) {
    return res.status(400).json({ error: 'ID da loja não fornecido' });
  }
  next();
};

// Rota para registrar uma venda
router.post('/registrar', validateStore, async (req, res) => {
  try {
    const { lojaId, itens, formaPagamento } = req.body;
    
    // Validação dos dados
    if (!lojaId || !itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Cria referência para nova venda
    const vendaRef = db.ref(`lojas/${lojaId}/vendas`).push();
    
    // Calcula total da venda (com tratamento para valores inválidos)
    const total = itens.reduce((sum, item) => {
      const quantidade = parseInt(item.quantidade) || 0;
      const valor = parseFloat(item.valor) || 0;
      return sum + (quantidade * valor);
    }, 0);
    
    // Formata os itens para garantir estrutura consistente
    const itensFormatados = itens.map(item => ({
      codigoBarras: item.codigoBarras || null,
      nome: item.nome || `Produto ${item.codigoBarras || 'sem código'}`,
      quantidade: parseInt(item.quantidade) || 0,
      valor: parseFloat(item.valor) || 0
    }));

    // Dados da venda
    const vendaData = {
      id: vendaRef.key,
      data: new Date().toISOString(),
      itens: itensFormatados,
      total: parseFloat(total.toFixed(2)),
      formaPagamento: formaPagamento || 'Dinheiro'
    };

    // Registra a venda no Firebase
    await vendaRef.set(vendaData);

    // Atualiza estoque
    await atualizarEstoque(lojaId, itensFormatados);

    res.json({
      success: true,
      venda: vendaData,
      msg: 'Venda registrada com sucesso.'
    });

  } catch (error) {
    console.error('Erro ao registrar venda:', error);
    res.status(500).json({ 
      error: 'Erro interno ao registrar venda',
      details: error.message 
    });
  }
});

// Rota para obter vendas de uma loja com filtros
router.get('/:lojaId', validateStore, async (req, res) => {
  try {
    const { lojaId } = req.params;
    const { inicio, fim } = req.query;

    // Busca todas as vendas da loja
    const snapshot = await db.ref(`lojas/${lojaId}/vendas`).once('value');
    let vendas = snapshot.val() || {};

    // Converte para array e formata os valores
    let vendasArray = Object.entries(vendas).map(([id, venda]) => ({ 
      id, 
      ...venda,
      total: parseFloat(venda.total) || 0,
      itens: venda.itens ? venda.itens.map(item => ({
        ...item,
        quantidade: parseInt(item.quantidade) || 0,
        valor: parseFloat(item.valor) || 0
      })) : []
    }));

    // Aplica filtros de data se fornecidos
    if (inicio && fim) {
      vendasArray = vendasArray.filter(venda => {
        const dataVenda = new Date(venda.data).toISOString().split('T')[0];
        return dataVenda >= inicio && dataVenda <= fim;
      });
    }

    // Ordena por data (mais recente primeiro)
    vendasArray.sort((a, b) => new Date(b.data) - new Date(a.data));

    res.json(vendasArray);

  } catch (error) {
    console.error('Erro ao obter vendas:', error);
    res.status(500).json({ 
      error: 'Erro interno ao obter vendas',
      details: error.message 
    });
  }
});

// Rota para obter detalhes de uma venda específica
router.get('/:lojaId/:vendaId', validateStore, async (req, res) => {
  try {
    const { lojaId, vendaId } = req.params;

    const snapshot = await db.ref(`lojas/${lojaId}/vendas/${vendaId}`).once('value');
    const venda = snapshot.val();

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    // Formata os valores numéricos
    const vendaFormatada = {
      ...venda,
      id: vendaId,
      total: parseFloat(venda.total) || 0,
      itens: venda.itens ? venda.itens.map(item => ({
        ...item,
        quantidade: parseInt(item.quantidade) || 0,
        valor: parseFloat(item.valor) || 0
      })) : []
    };

    res.json(vendaFormatada);

  } catch (error) {
    console.error('Erro ao obter venda:', error);
    res.status(500).json({ 
      error: 'Erro interno ao obter venda',
      details: error.message 
    });
  }
});

// Função auxiliar para atualizar estoque
async function atualizarEstoque(lojaId, itensVendidos) {
  const prodRef = db.ref(`lojas/${lojaId}/produtos`);
  const snapshot = await prodRef.once('value');
  const produtos = snapshot.val() || {};

  const updates = {};
  
  for (const item of itensVendidos) {
    for (const produtoId in produtos) {
      if (produtos[produtoId].codigoBarras === item.codigoBarras) {
        const quantidadeVendida = parseInt(item.quantidade) || 0;
        const estoqueAtual = parseInt(produtos[produtoId].quantidade) || 0;
        const novaQtd = estoqueAtual - quantidadeVendida;
        
        if (novaQtd < 0) {
          throw new Error(`Estoque insuficiente para o produto ${produtos[produtoId].nome}`);
        }
        
        updates[`${produtoId}/quantidade`] = novaQtd;
        break;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await prodRef.update(updates);
  }
}

module.exports = router;