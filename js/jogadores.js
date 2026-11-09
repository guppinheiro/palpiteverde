/*
 * Base de jogadores do Palpite Verde.
 *
 * ATENÇÃO: os números abaixo são APROXIMADOS e foram montados como base
 * inicial. Revise jogos, gols e anos com uma fonte confiável antes de
 * divulgar o jogo.
 *
 * Campos:
 *   nome    nome usado no palpite (único)
 *   pos     "Goleiro" | "Zagueiro" | "Lateral" | "Meio-campo" | "Atacante"
 *   estreia ano da estreia pelo clube
 *   ultimo  ano do último jogo pelo clube (null = ainda no elenco)
 *   jogos   total de jogos pelo clube
 *   gols    total de gols pelo clube
 *   nasc    sigla do estado de nascimento, ou "EXT" para estrangeiros
 *   pais    (só para EXT) país de nascimento, exibido na ficha
 *   facil   true = jogador muito conhecido; entra no nível fácil e no desafio do dia
 */
window.JOGADORES = [
  { nome: "Ademir da Guia",  pos: "Meio-campo", estreia: 1961, ultimo: 1977, jogos: 901, gols: 153, nasc: "RJ", facil: true },
  { nome: "Djalma Santos",   pos: "Lateral",    estreia: 1959, ultimo: 1968, jogos: 498, gols: 10,  nasc: "SP", facil: true },
  { nome: "Julinho Botelho", pos: "Atacante",   estreia: 1958, ultimo: 1967, jogos: 272, gols: 81,  nasc: "SP", facil: false },
  { nome: "Heitor",          pos: "Atacante",   estreia: 1916, ultimo: 1931, jogos: 358, gols: 284, nasc: "SP", facil: false },
  { nome: "Leão",            pos: "Goleiro",    estreia: 1969, ultimo: 1986, jogos: 617, gols: 0,   nasc: "SP", facil: true },
  { nome: "Luís Pereira",    pos: "Zagueiro",   estreia: 1968, ultimo: 1984, jogos: 562, gols: 15,  nasc: "BA", facil: false },
  { nome: "César Maluco",    pos: "Atacante",   estreia: 1967, ultimo: 1974, jogos: 330, gols: 180, nasc: "RJ", facil: false },
  { nome: "Leivinha",        pos: "Meio-campo", estreia: 1971, ultimo: 1975, jogos: 260, gols: 105, nasc: "SP", facil: false },
  { nome: "Jorge Mendonça",  pos: "Meio-campo", estreia: 1976, ultimo: 1980, jogos: 200, gols: 100, nasc: "RJ", facil: false },
  { nome: "Evair",           pos: "Atacante",   estreia: 1991, ultimo: 1999, jogos: 245, gols: 127, nasc: "MG", facil: true },
  { nome: "César Sampaio",   pos: "Meio-campo", estreia: 1991, ultimo: 2000, jogos: 300, gols: 30,  nasc: "SP", facil: false },
  { nome: "Zinho",           pos: "Meio-campo", estreia: 1992, ultimo: 2000, jogos: 291, gols: 50,  nasc: "RJ", facil: true },
  { nome: "Edmundo",         pos: "Atacante",   estreia: 1993, ultimo: 1995, jogos: 150, gols: 70,  nasc: "RJ", facil: true },
  { nome: "Roberto Carlos",  pos: "Lateral",    estreia: 1993, ultimo: 1995, jogos: 130, gols: 9,   nasc: "SP", facil: true },
  { nome: "Antônio Carlos",  pos: "Zagueiro",   estreia: 1993, ultimo: 1996, jogos: 170, gols: 10,  nasc: "SP", facil: false },
  { nome: "Mazinho",         pos: "Meio-campo", estreia: 1993, ultimo: 1994, jogos: 80,  gols: 5,   nasc: "PB", facil: false },
  { nome: "Edílson",         pos: "Atacante",   estreia: 1993, ultimo: 1994, jogos: 100, gols: 30,  nasc: "BA", facil: false },
  { nome: "Rivaldo",         pos: "Meio-campo", estreia: 1994, ultimo: 1996, jogos: 99,  gols: 45,  nasc: "PE", facil: true },
  { nome: "Roque Júnior",    pos: "Zagueiro",   estreia: 1995, ultimo: 2000, jogos: 250, gols: 10,  nasc: "MG", facil: false },
  { nome: "Djalminha",       pos: "Meio-campo", estreia: 1996, ultimo: 1997, jogos: 80,  gols: 35,  nasc: "SP", facil: false },
  { nome: "Luizão",          pos: "Atacante",   estreia: 1996, ultimo: 1996, jogos: 50,  gols: 30,  nasc: "SP", facil: false },
  { nome: "Marcos",          pos: "Goleiro",    estreia: 1996, ultimo: 2011, jogos: 532, gols: 0,   nasc: "SP", facil: true },
  { nome: "Alex",            pos: "Meio-campo", estreia: 1997, ultimo: 2002, jogos: 242, gols: 78,  nasc: "PR", facil: true },
  { nome: "Oséas",           pos: "Atacante",   estreia: 1997, ultimo: 1999, jogos: 150, gols: 50,  nasc: "BA", facil: false },
  { nome: "Paulo Nunes",     pos: "Atacante",   estreia: 1998, ultimo: 2000, jogos: 170, gols: 60,  nasc: "GO", facil: true },
  { nome: "Arce",            pos: "Lateral",    estreia: 1998, ultimo: 2002, jogos: 260, gols: 30,  nasc: "EXT", pais: "Paraguai", facil: true },
  { nome: "Vágner Love",     pos: "Atacante",   estreia: 2004, ultimo: 2009, jogos: 100, gols: 40,  nasc: "RJ", facil: false },
  { nome: "Valdivia",        pos: "Meio-campo", estreia: 2006, ultimo: 2015, jogos: 250, gols: 40,  nasc: "EXT", pais: "Venezuela", facil: true },
  { nome: "Kleber Gladiador",pos: "Atacante",   estreia: 2007, ultimo: 2011, jogos: 150, gols: 50,  nasc: "SP", facil: false },
  { nome: "Alex Mineiro",    pos: "Atacante",   estreia: 2008, ultimo: 2009, jogos: 100, gols: 45,  nasc: "MG", facil: false },
  { nome: "Diego Souza",     pos: "Meio-campo", estreia: 2008, ultimo: 2010, jogos: 130, gols: 40,  nasc: "RJ", facil: false },
  { nome: "Marcos Assunção", pos: "Meio-campo", estreia: 2010, ultimo: 2012, jogos: 120, gols: 25,  nasc: "SP", facil: false },
  { nome: "Fernando Prass",  pos: "Goleiro",    estreia: 2013, ultimo: 2019, jogos: 280, gols: 0,   nasc: "RS", facil: true },
  { nome: "Dudu",            pos: "Atacante",   estreia: 2015, ultimo: 2024, jogos: 470, gols: 100, nasc: "GO", facil: true },
  { nome: "Gabriel Jesus",   pos: "Atacante",   estreia: 2015, ultimo: 2016, jogos: 83,  gols: 28,  nasc: "SP", facil: true },
  { nome: "Felipe Melo",     pos: "Meio-campo", estreia: 2017, ultimo: 2021, jogos: 207, gols: 10,  nasc: "RJ", facil: true },
  { nome: "Willian Bigode",  pos: "Atacante",   estreia: 2017, ultimo: 2021, jogos: 200, gols: 50,  nasc: "SP", facil: false },
  { nome: "Raphael Veiga",   pos: "Meio-campo", estreia: 2017, ultimo: null, jogos: 350, gols: 100, nasc: "SP", facil: true },
  { nome: "Mayke",           pos: "Lateral",    estreia: 2017, ultimo: 2025, jogos: 300, gols: 10,  nasc: "MG", facil: false },
  { nome: "Weverton",        pos: "Goleiro",    estreia: 2018, ultimo: null, jogos: 450, gols: 0,   nasc: "AC", facil: true },
  { nome: "Gustavo Gómez",   pos: "Zagueiro",   estreia: 2018, ultimo: null, jogos: 380, gols: 30,  nasc: "EXT", pais: "Paraguai", facil: true },
  { nome: "Marcos Rocha",    pos: "Lateral",    estreia: 2018, ultimo: 2025, jogos: 350, gols: 10,  nasc: "MG", facil: false },
  { nome: "Rony",            pos: "Atacante",   estreia: 2020, ultimo: 2025, jogos: 300, gols: 60,  nasc: "PA", facil: true },
  { nome: "Danilo",          pos: "Meio-campo", estreia: 2020, ultimo: 2023, jogos: 180, gols: 10,  nasc: "BA", facil: false },
  { nome: "Piquerez",        pos: "Lateral",    estreia: 2021, ultimo: null, jogos: 200, gols: 15,  nasc: "EXT", pais: "Uruguai", facil: false },
  { nome: "Endrick",         pos: "Atacante",   estreia: 2022, ultimo: 2024, jogos: 82,  gols: 21,  nasc: "DF", facil: true },
  { nome: "Flaco López",     pos: "Atacante",   estreia: 2023, ultimo: null, jogos: 150, gols: 50,  nasc: "EXT", pais: "Argentina", facil: false },
  { nome: "Richard Ríos",    pos: "Meio-campo", estreia: 2023, ultimo: 2025, jogos: 130, gols: 10,  nasc: "EXT", pais: "Colômbia", facil: false },
  { nome: "Estêvão",         pos: "Atacante",   estreia: 2023, ultimo: 2025, jogos: 80,  gols: 27,  nasc: "SP", facil: true },
  { nome: "Vitor Roque",     pos: "Atacante",   estreia: 2025, ultimo: null, jogos: 70,  gols: 25,  nasc: "MG", facil: false }
];
