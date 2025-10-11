import { auth, signInWithEmailAndPassword } from './firebase-config.js';

const form = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

const API_URL = 'http://localhost:3001';


form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMessage.textContent = '';

  const email = e.target.email.value;
  const password = e.target.password.value;

  try {
    // 1. Autenticação com Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Obter token do Firebase
    const token = await user.getIdToken();

    // 3. Verificar conta no backend
    const res = await fetch(`${API_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });


    const data = await res.json();

    if (!res.ok) {
      errorMessage.textContent = data.error || 'Erro na verificação da conta';
      return;
    }

    // 4. Armazenar TODOS os dados necessários
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({
      email: user.email,
      uid: user.uid,
      isAdmin: data.admin || false
    }));
    localStorage.setItem('lojaId', data.lojaId || '');
    localStorage.setItem('nomeLoja', data.nomeLoja || 'Minha Loja');

    // 5. Redirecionar
    window.location.href = data.admin ? '/admin.html' : '/painel.html';

  } catch (error) {
    console.error('Erro no login:', error);
    errorMessage.textContent = error.message || 'Erro ao fazer login';
    
    // Mostrar erro detalhado para o usuário
    if (error.code === 'auth/invalid-credential') {
      errorMessage.textContent = 'E-mail ou senha incorretos';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage.textContent = 'Acesso temporariamente bloqueado. Tente novamente mais tarde.';
    }
  }
});