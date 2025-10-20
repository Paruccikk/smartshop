import { push, set, get, update, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
    const isAndroidApp = typeof window !== "undefined" && window.PDV && typeof window.PDV.pagar === "function";

    const registrarVenda = async (resultado) => {
      const vendaData = {
        data: new Date().toISOString(),
        itens: carrinho,
        total,
        formaPagamento,
        status: resultado.status || 'concluída',
        vendedor: usuarioLogado?.nome || usuarioLogado?.email,
        vendedorId: usuarioLogado?.uid,
        autorizacao: resultado?.autorizacao || null,
        nsu: resultado?.nsu || null
      };
      const novaVendaRef = push(ref(db, `lojas/${lojaId}/vendas`));
      await set(novaVendaRef, vendaData);

      for (const item of carrinho) {
        const produtoRef = ref(db, `lojas/${lojaId}/produtos/${item.id}`);
        const snap = await get(produtoRef);
        if (snap.exists()) {
          const produto = snap.val();
          const novaQtd = (produto.quantidade || 0) - item.quantidade;
          await update(produtoRef, { quantidade: Math.max(0, novaQtd) });
        }
      }

      toast('Pagamento aprovado! Venda concluída!');
      atualizarCarrinhoFn();
      if (typeof carregarProdutos === 'function') await carregarProdutos();
    };

    if (isAndroidApp) {
      console.log("Usando PayGo SDK via WebView");

      return new Promise((resolve) => {
        const valorCentavos = Math.round(total * 100).toString();

        window.onPagamentoConcluido = async (json) => {
          try {
            const parsed = JSON.parse(json);
            await registrarVenda(parsed);
            resolve({ ok: true, resultado: parsed });
          } catch (err) {
            toast("Erro ao processar retorno do pagamento");
            resolve({ ok: false, error: err });
          }
        };

        window.onPagamentoFalhou = () => {
          toast("Pagamento cancelado ou não autorizado.");
          resolve({ ok: false });
        };

        try {
          window.PDV.pagar(valorCentavos);
        } catch (err) {
          toast("Falha ao iniciar pagamento. Verifique a maquininha.");
          resolve({ ok: false, error: err });
        }
      });
    } else {
      // fallback modo web
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
    toast('Erro ao processar pagamento.');
    console.error(err);
    return { ok: false, error: err };
  }
}
