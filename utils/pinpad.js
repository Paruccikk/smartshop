// utils/pinpad.js
// Simulação inicial — substitua futuramente pela integração real com o SDK da Gertec

async function iniciarPagamento(valor, formaPagamento) {
  console.log(`💳 Iniciando pagamento de R$ ${valor.toFixed(2)} via ${formaPagamento}...`);

  // Aqui você integraria com a maquininha Gertec via SDK, Serial ou TCP.
  // Exemplo de fluxo real:
  // 1. Enviar comando de transação
  // 2. Aguardar resposta de "Aprovado" ou "Negado"
  // 3. Retornar o resultado para o frontend

  // Simulação de delay e aprovação
  await new Promise(resolve => setTimeout(resolve, 3000)); // simula processamento

  // Simulando resposta bem-sucedida
  return {
    status: 'aprovado',
    mensagem: 'Pagamento aprovado com sucesso na maquininha',
    autorizacao: '123456',
    nsu: '789012'
  };
}

module.exports = { iniciarPagamento };
