// pagamento.js - integração com PayGo (Android WebView) ou endpoint Node.js (modo web)

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
 *  - carregarProdutos: função (opcional)
 *  - toast: função (opcional)
 *  - atualizarCarrinhoFn: função (opcional)
 */
export async function confirmarVenda({
  carrinho,
  total,
  formaPagamento,
  usuarioLogado,
  lojaId,
  db,
  carregarProdutos,
  toast = () => {},
  atualizarCarrinhoFn = () => {}
}) {
  try {
    // === NOVO: Detecta se está rodando dentro do app Android ===
    const isAndroidApp = typeof window !== "undefined" && window.PDV && typeof window.PDV.pagar === "function";

    // Função auxiliar para registrar venda e atualizar estoque
    const registrarVenda = async (resultado) => {
      const vendaData = {
        data: new Date().toISOString(),
        itens: carrinho,
        total,
        formaPagamento,
        status: 'concluída',
        vendedor: usuarioLogado?.nome || usuarioLogado?.email,
        vendedorId: usuarioLogado?.uid,
        autorizacao: resultado?.autorizacao || null,
        nsu: resultado?.nsu || null
      };
      const novaVendaRef = push(ref(db, `lojas/${lojaId}/vendas`));
      await set(novaVendaRef, vendaData);

      // Atualizar estoque
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
    };

    // === MODO 1: Rodando dentro do aplicativo Android com PayGo ===
    if (isAndroidApp) {
      console.log("Usando PayGo Integrado (Android)");

      return new Promise((resolve) => {
        const valorCentavos = Math.round(total * 100).toString();

        // Define callbacks globais que o Android chamará
        window.onPagamentoConcluido = async (retorno) => {
          try {
            const parsed = JSON.parse(retorno || "{}");
            await registrarVenda({
              status: 'aprovado',
              autorizacao: parsed.autorizacao,
              nsu: parsed.nsu
            });
            resolve({ ok: true, resultado: parsed });
          } catch (e) {
            console.error("Erro ao processar retorno PayGo:", e);
            toast("Erro ao processar retorno da maquininha.");
            resolve({ ok: false, error: e });
          }
        };

        window.onPagamentoFalhou = () => {
          toast("Pagamento cancelado ou não autorizado.");
          resolve({ ok: false, resultado: { status: "falhou" } });
        };

        // Chama o método Android exposto via JavaScriptInterface
        try {
          window.PDV.pagar(valorCentavos);
        } catch (err) {
          console.error("Erro ao chamar PayGo:", err);
          toast("Erro na integração PayGo. Verifique a maquininha.");
          resolve({ ok: false, error: err });
        }
      });
    }

    // === MODO 2: Rodando no navegador comum (usa o endpoint Node.js) ===
    else {
      console.log("Usando API /api/pinpad/pagar (modo web)");
      const response = await fetch('/api/pinpad/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: total, formaPagamento })
      });
      const resultado = await response.json();

      if (resultado.status === 'aprovado' || resultado.status === 'aprovado_simulado') {
        await registrarVenda(resultado);
        return { ok: true, resultado };
      } else {
        toast(`Pagamento não aprovado: ${resultado.mensagem || 'Erro desconhecido'}`);
        return { ok: false, resultado };
      }
    }
  } catch (err) {
    console.error('Erro ao processar pagamento:', err);
    toast('Erro ao processar pagamento. Verifique a maquininha.');
    return { ok: false, error: err };
  }
}
