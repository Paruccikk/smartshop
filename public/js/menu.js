// Função para logout
function logout() {
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Função para mostrar nome da loja
function loadLojaNome() {
  try {
    const lojaNome = localStorage.getItem('nomeLoja');
    const lojaEl = document.getElementById('loja-info');

    if (lojaNome) {
      if (lojaEl) lojaEl.textContent = lojaNome;
    } else {
      // Busca nome da loja pela API se não estiver salvo
      fetch('/api/loja')
        .then((res) => res.json())
        .then((data) => {
          if (data.nome) {
            localStorage.setItem('nomeLoja', data.nome);
            if (lojaEl) lojaEl.textContent = data.nome;
          } else {
            if (lojaEl) lojaEl.textContent = 'Minha Loja';
          }
        })
        .catch(() => {
          if (lojaEl) lojaEl.textContent = 'Minha Loja';
        });
    }
  } catch (e) {
    console.error('Erro ao carregar nome da loja:', e);
    const lojaEl = document.getElementById('loja-info');
    if (lojaEl) lojaEl.textContent = 'Erro';
  }
}

// Função para mostrar item admin se for admin
function checkAdmin() {
  try {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (userData?.isAdmin) {
      const adminItem = document.getElementById('admin-menu-item');
      if (adminItem) adminItem.style.display = 'block';
      document.body.classList.add('admin-mode');
    }
  } catch (e) {
    console.error('Erro ao verificar admin:', e);
  }
}

// Função que inicializa os eventos e ações do menu
function initMenu() {
  const btnToggle = document.getElementById('menu-toggle');
  const nav = document.querySelector('.header-nav');
  const body = document.body;

  if (btnToggle && nav) {
    btnToggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      body.classList.toggle('menu-open');
    });

    document.addEventListener('click', (e) => {
      if (
        !nav.contains(e.target) &&
        !btnToggle.contains(e.target) &&
        nav.classList.contains('active')
      ) {
        nav.classList.remove('active');
        body.classList.remove('menu-open');
      }
    });
  }

  loadLojaNome();
  checkAdmin();

  // Expor logout globalmente para usar no onclick do menu
  window.logout = logout;
}

// Expor initMenu para chamar depois de inserir o menu no DOM
window.initMenu = initMenu;
