// pagamento.js - função que fará a chamada ao endpoint do pinpad, grava venda e atualiza estoque
// Recebe dependências via parâmetros (testável e desacoplado)

import { push, set, get, update, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/**
 * confirmarVenda(params)
 * params:
 *  - carrinho: array de items
 *  - total: number
 *  - formaPagamento: string
 *  - usuarioLogado: object {nome, uid}
 *  - lojaId: string
 *  - db: firebase database instance
 *  - carregarProdutos: função (opcional) para recarregar produtos após venda
 *  - toast: função (opcional) para feedback visual
 *  - atualizarCarrinhoFn: função (opcional) chamada para limpar UI/estado do carrinho após sucesso
 */
export async function confirmarVenda({ carrinho, total, formaPagamento, usuarioLogado, lojaId, db, carregarProdutos, toast = () => {}, atualizarCarrinhoFn = () => {} }) {
  try {
    const response = await fetch('/api/pinpad/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: total, formaPagamento })
    });
    const resultado = await response.json();

    if (resultado.status === 'aprovado' || resultado.status === 'aprovado_simulado') {
      const vendaData = {
        data: new Date().toISOString(),
        itens: carrinho,
        total,
        formaPagamento,
        status: 'concluída',
        vendedor: usuarioLogado?.nome || usuarioLogado?.email,
        vendedorId: usuarioLogado?.uid,
        autorizacao: resultado.autorizacao || null,
        nsu: resultado.nsu || null
      };
      const novaVendaRef = push(ref(db, `lojas/${lojaId}/vendas`));
      await set(novaVendaRef, vendaData);

      // atualizar estoque (sequencial)
      for (const item of carrinho) {
        const produtoRef = ref(db, `lojas/${lojaId}/produtos/${item.id}`);
        const produtoSnap = await get(produtoRef);
        if (produtoSnap.exists()) {
          const produto = produtoSnap.val();
          const novaQuantidade = (produto.quantidade || 0) - item.quantidade;
          await update(produtoRef, { quantidade: Math.max(0, novaQuantidade) });
        }
      }

      toast('Pagamento aprovado! Venda concluída com sucesso!');
      atualizarCarrinhoFn();
      if (typeof carregarProdutos === 'function') await carregarProdutos();
      return { ok: true, resultado };
    } else {
      toast(`Pagamento não aprovado: ${resultado.mensagem || 'Erro desconhecido'}`);
      return { ok: false, resultado };
    }
  } catch (err) {
    console.error('Erro ao processar pagamento:', err);
    toast('Erro ao processar pagamento. Verifique a maquininha.');
    return { ok: false, error: err };
  }
}
