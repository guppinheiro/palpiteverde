// Configuração do Palpite Alvinegro (Corinthians). Os scripts do jogo são os mesmos
// do Palpite Verde (../js/jogo.js e ../js/campanhas-jogo.js); só muda o que está aqui.
window.SITE = {
  jogo: "Palpite Alvinegro", logo: ["PALPITE", "ALVINEGRO"], clube: "Corinthians", sigla: "COR",
  arquivo: "palpite-alvinegro", chave: "pa:", raiz: "../",
  endereco: "https://guppinheiro.github.io/palpiteverde/corinthians/",
  inicio: [2026, 11, 10], // desafio #1 = 10/11/2026
  sementes: { facil: 1910, dificil: 1977, lendas: 1954 },
  redefinicoes: {}, fixados: {},
  // cores do card (canvas): preto principal, branco secundário
  cor: {
    verde: "#111111", verdeFundo: "#000000", vivo: "#111111", claro: "#d4d4d4", longe: "#8c8c8c",
    tinta: "#111111", suave: "#5f5f5f", linha: "#dadada", nevoa: "#f2f2f2", derrota: "#c8352e"
  }
};
