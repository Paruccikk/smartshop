// resetar.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// 🔧 Configure com os dados do seu Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCF2xMRCG8GhGYdMFncB_hPaUHApM7fpRc",
  authDomain: "iatech-aca5f.firebaseapp.com",
  databaseURL: "https://iatech-aca5f-default-rtdb.firebaseio.com",
  projectId: "iatech-aca5f",
  storageBucket: "iatech-aca5f.appspot.com",
  messagingSenderId: "70231377744",
  appId: "1:70231377744:web:61b45200fe2cad738c8e55"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Evento do botão
document.addEventListener("DOMContentLoaded", () => {
  const btnResetar = document.getElementById("btnResetar");
  const emailInput = document.getElementById("email");
  const msg = document.getElementById("msg");

  btnResetar.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    msg.textContent = "";

    if (!email) {
      msg.style.color = "red";
      msg.textContent = "Por favor, informe seu e-mail.";
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      msg.style.color = "green";
      msg.textContent = "✅ Um link de redefinição foi enviado para o seu e-mail.";
      emailInput.value = "";
    } catch (error) {
      console.error(error);
      msg.style.color = "red";
      switch (error.code) {
        case "auth/user-not-found":
          msg.textContent = "❌ E-mail não cadastrado.";
          break;
        case "auth/invalid-email":
          msg.textContent = "❌ E-mail inválido.";
          break;
        case "auth/missing-email":
          msg.textContent = "❌ Digite seu e-mail.";
          break;
        default:
          msg.textContent = "❌ Erro ao enviar o e-mail. Tente novamente.";
      }
    }
  });
});
