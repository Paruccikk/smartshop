import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, set, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const cadastroForm = document.getElementById('cadastroForm');
const mensagemCadastro = document.getElementById('mensagemCadastro');
const btnCadastrar = document.getElementById('btnCadastrar');

cadastroForm.onsubmit = async (e) => {
  e.preventDefault();
  btnCadastrar.disabled = true;
  mensagemCadastro.textContent = '';
  mensagemCadastro.classList.remove('error');

  const email = e.target.email.value.trim();
  const senha = e.target.senha.value;
  const nomeLoja = e.target.nomeLoja.value.trim();

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    const db = getDatabase();
    await set(ref(db, 'users/' + user.uid), {
      email,
      nomeLoja,
      aprovado: false,
      admin: false,
      lojaId: `loja_${user.uid}`,
      createdAt: serverTimestamp()
    });

    mensagemCadastro.textContent = "Usuário cadastrado com sucesso! Aguarde aprovação.";
    cadastroForm.reset();

  } catch (error) {
    mensagemCadastro.textContent = "Erro ao cadastrar: " + (error.message || error);
    mensagemCadastro.classList.add('error');
    console.error("Erro ao cadastrar:", error);
  } finally {
    btnCadastrar.disabled = false;
  }
};
