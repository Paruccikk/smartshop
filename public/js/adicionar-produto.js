import Quagga from 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';

const form = document.getElementById('formProduto');
const mensagem = document.getElementById('mensagem');
const btnScan = document.getElementById('btnScan');
const scannerContainer = document.getElementById('scanner-container');
const videoElement = document.getElementById('video');
const btnCloseScanner = document.getElementById('btnCloseScanner');
const inputCodigo = document.getElementById('codigoBarras');

btnScan.onclick = () => {
  scannerContainer.style.display = 'block';

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: videoElement,
      constraints: {
        facingMode: "environment"
      },
    },
    decoder: {
      readers: ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader"]
    },
    locate: true,
  }, function(err) {
    if (err) {
      console.error(err);
      alert('Erro ao iniciar a câmera para leitura de código.');
      scannerContainer.style.display = 'none';
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(result => {
    const code = result.codeResult.code;
    inputCodigo.value = code;
    Quagga.stop();
    scannerContainer.style.display = 'none';
  });
};

btnCloseScanner.onclick = () => {
  Quagga.stop();
  scannerContainer.style.display = 'none';
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mensagem.textContent = '';

  const lojaId = localStorage.getItem('lojaId');
  if (!lojaId) {
    mensagem.style.color = 'red';
    mensagem.textContent = 'Loja não encontrada. Por favor, faça login novamente.';
    return;
  }

  const produto = {
    nome: e.target.nome.value.trim(),
    valor: parseFloat(e.target.valor.value),
    validade: e.target.validade.value || null,
    codigoBarras: e.target.codigoBarras.value.trim() || null,
    quantidade: parseInt(e.target.quantidade.value),
    estoqueMinimo: parseInt(e.target.estoqueMinimo.value),
    lojaId
  };

  try {
    const res = await fetch('/produtos/adicionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lojaId, produto })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Erro ao adicionar produto');
    }

    mensagem.style.color = 'green';
    mensagem.textContent = 'Produto adicionado com sucesso!';
    form.reset();

  } catch (err) {
    mensagem.style.color = 'red';
    mensagem.textContent = err.message;
  }
});
