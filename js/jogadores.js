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
 *
 * Os níveis são calculados pelo ano de saída (ultimo):
 *   Fácil   = jogou pelo clube de 2020 em diante
 *   Difícil = jogou pelo clube de 1970 em diante
 */
window.JOGADORES = [
  { nome: "Ademir da Guia",  pos: "Meio-campo", estreia: 1961, ultimo: 1977, jogos: 901, gols: 153, nasc: "RJ" },
  { nome: "Leão",            pos: "Goleiro",    estreia: 1969, ultimo: 1986, jogos: 617, gols: 0,   nasc: "SP" },
  { nome: "Luís Pereira",    pos: "Zagueiro",   estreia: 1968, ultimo: 1984, jogos: 562, gols: 15,  nasc: "BA" },
  { nome: "César Maluco",    pos: "Atacante",   estreia: 1967, ultimo: 1974, jogos: 330, gols: 180, nasc: "RJ" },
  { nome: "Leivinha",        pos: "Meio-campo", estreia: 1971, ultimo: 1975, jogos: 260, gols: 105, nasc: "SP" },
  { nome: "Jorge Mendonça",  pos: "Meio-campo", estreia: 1976, ultimo: 1980, jogos: 200, gols: 100, nasc: "RJ" },
  { nome: "Evair",           pos: "Atacante",   estreia: 1991, ultimo: 1999, jogos: 245, gols: 127, nasc: "MG" },
  { nome: "César Sampaio",   pos: "Meio-campo", estreia: 1991, ultimo: 2000, jogos: 300, gols: 30,  nasc: "SP" },
  { nome: "Zinho",           pos: "Meio-campo", estreia: 1992, ultimo: 2000, jogos: 291, gols: 50,  nasc: "RJ" },
  { nome: "Edmundo",         pos: "Atacante",   estreia: 1993, ultimo: 1995, jogos: 150, gols: 70,  nasc: "RJ" },
  { nome: "Roberto Carlos",  pos: "Lateral",    estreia: 1993, ultimo: 1995, jogos: 130, gols: 9,   nasc: "SP" },
  { nome: "Antônio Carlos",  pos: "Zagueiro",   estreia: 1993, ultimo: 1996, jogos: 170, gols: 10,  nasc: "SP" },
  { nome: "Mazinho",         pos: "Meio-campo", estreia: 1993, ultimo: 1994, jogos: 80,  gols: 5,   nasc: "PB" },
  { nome: "Edílson",         pos: "Atacante",   estreia: 1993, ultimo: 1994, jogos: 100, gols: 30,  nasc: "BA" },
  { nome: "Rivaldo",         pos: "Meio-campo", estreia: 1994, ultimo: 1996, jogos: 99,  gols: 45,  nasc: "PE" },
  { nome: "Roque Júnior",    pos: "Zagueiro",   estreia: 1995, ultimo: 2000, jogos: 250, gols: 10,  nasc: "MG" },
  { nome: "Djalminha",       pos: "Meio-campo", estreia: 1996, ultimo: 1997, jogos: 80,  gols: 35,  nasc: "SP" },
  { nome: "Luizão",          pos: "Atacante",   estreia: 1996, ultimo: 1996, jogos: 50,  gols: 30,  nasc: "SP" },
  { nome: "Marcos",          pos: "Goleiro",    estreia: 1996, ultimo: 2011, jogos: 532, gols: 0,   nasc: "SP" },
  { nome: "Alex",            pos: "Meio-campo", estreia: 1997, ultimo: 2002, jogos: 242, gols: 78,  nasc: "PR" },
  { nome: "Oséas",           pos: "Atacante",   estreia: 1997, ultimo: 1999, jogos: 150, gols: 50,  nasc: "BA" },
  { nome: "Paulo Nunes",     pos: "Atacante",   estreia: 1998, ultimo: 2000, jogos: 170, gols: 60,  nasc: "GO" },
  { nome: "Arce",            pos: "Lateral",    estreia: 1998, ultimo: 2002, jogos: 260, gols: 30,  nasc: "EXT", pais: "Paraguai" },
  { nome: "Vágner Love",     pos: "Atacante",   estreia: 2004, ultimo: 2009, jogos: 100, gols: 40,  nasc: "RJ" },
  { nome: "Valdivia",        pos: "Meio-campo", estreia: 2006, ultimo: 2015, jogos: 250, gols: 40,  nasc: "EXT", pais: "Venezuela" },
  { nome: "Kleber Gladiador",pos: "Atacante",   estreia: 2007, ultimo: 2011, jogos: 150, gols: 50,  nasc: "SP" },
  { nome: "Alex Mineiro",    pos: "Atacante",   estreia: 2008, ultimo: 2009, jogos: 100, gols: 45,  nasc: "MG" },
  { nome: "Diego Souza",     pos: "Meio-campo", estreia: 2008, ultimo: 2010, jogos: 130, gols: 40,  nasc: "RJ" },
  { nome: "Marcos Assunção", pos: "Meio-campo", estreia: 2010, ultimo: 2012, jogos: 120, gols: 25,  nasc: "SP" },
  { nome: "Fernando Prass",  pos: "Goleiro",    estreia: 2013, ultimo: 2019, jogos: 280, gols: 0,   nasc: "RS" },
  { nome: "Dudu",            pos: "Atacante",   estreia: 2015, ultimo: 2024, jogos: 470, gols: 100, nasc: "GO" },
  { nome: "Gabriel Jesus",   pos: "Atacante",   estreia: 2015, ultimo: 2016, jogos: 83,  gols: 28,  nasc: "SP" },
  { nome: "Felipe Melo",     pos: "Meio-campo", estreia: 2017, ultimo: 2021, jogos: 207, gols: 10,  nasc: "RJ" },
  { nome: "Willian Bigode",  pos: "Atacante",   estreia: 2017, ultimo: 2021, jogos: 200, gols: 50,  nasc: "SP" },
  { nome: "Raphael Veiga",   pos: "Meio-campo", estreia: 2017, ultimo: null, jogos: 350, gols: 100, nasc: "SP" },
  { nome: "Mayke",           pos: "Lateral",    estreia: 2017, ultimo: 2025, jogos: 300, gols: 10,  nasc: "MG" },
  { nome: "Weverton",        pos: "Goleiro",    estreia: 2018, ultimo: null, jogos: 450, gols: 0,   nasc: "AC" },
  { nome: "Gustavo Gómez",   pos: "Zagueiro",   estreia: 2018, ultimo: null, jogos: 380, gols: 30,  nasc: "EXT", pais: "Paraguai" },
  { nome: "Marcos Rocha",    pos: "Lateral",    estreia: 2018, ultimo: 2025, jogos: 350, gols: 10,  nasc: "MG" },
  { nome: "Rony",            pos: "Atacante",   estreia: 2020, ultimo: 2025, jogos: 300, gols: 60,  nasc: "PA" },
  { nome: "Danilo",          pos: "Meio-campo", estreia: 2020, ultimo: 2023, jogos: 180, gols: 10,  nasc: "BA" },
  { nome: "Piquerez",        pos: "Lateral",    estreia: 2021, ultimo: null, jogos: 200, gols: 15,  nasc: "EXT", pais: "Uruguai" },
  { nome: "Endrick",         pos: "Atacante",   estreia: 2022, ultimo: 2024, jogos: 82,  gols: 21,  nasc: "DF" },
  { nome: "Flaco López",     pos: "Atacante",   estreia: 2023, ultimo: null, jogos: 150, gols: 50,  nasc: "EXT", pais: "Argentina" },
  { nome: "Richard Ríos",    pos: "Meio-campo", estreia: 2023, ultimo: 2025, jogos: 130, gols: 10,  nasc: "EXT", pais: "Colômbia" },
  { nome: "Estêvão",         pos: "Atacante",   estreia: 2023, ultimo: 2025, jogos: 80,  gols: 27,  nasc: "SP" },
  { nome: "Vitor Roque",     pos: "Atacante",   estreia: 2025, ultimo: null, jogos: 70,  gols: 25,  nasc: "MG" },
  { nome: "Gustavo Scarpa",  pos: "Meio-campo", estreia: 2018, ultimo: 2022, jogos: 250, gols: 30,  nasc: "SP" },
  { nome: "Deyverson",       pos: "Atacante",   estreia: 2017, ultimo: 2021, jogos: 150, gols: 30,  nasc: "RJ" },
  { nome: "Luiz Adriano",    pos: "Atacante",   estreia: 2019, ultimo: 2021, jogos: 110, gols: 35,  nasc: "RS" },
  { nome: "Gabriel Menino",  pos: "Meio-campo", estreia: 2019, ultimo: 2024, jogos: 250, gols: 10,  nasc: "SP" },
  { nome: "Patrick de Paula",pos: "Meio-campo", estreia: 2019, ultimo: 2021, jogos: 90,  gols: 3,   nasc: "RJ" },
  { nome: "Matías Viña",     pos: "Lateral",    estreia: 2020, ultimo: 2021, jogos: 80,  gols: 3,   nasc: "EXT", pais: "Uruguai" },
  { nome: "Aníbal Moreno",   pos: "Meio-campo", estreia: 2024, ultimo: null, jogos: 90,  gols: 3,   nasc: "EXT", pais: "Argentina" },
  { nome: "Agustín Giay",    pos: "Lateral",    estreia: 2024, ultimo: null, jogos: 50,  gols: 1,   nasc: "EXT", pais: "Argentina" },
  { nome: "Facundo Torres",  pos: "Atacante",   estreia: 2025, ultimo: null, jogos: 50,  gols: 10,  nasc: "EXT", pais: "Uruguai" },
  { nome: "Andreas Pereira", pos: "Meio-campo", estreia: 2025, ultimo: null, jogos: 50,  gols: 5,   nasc: "EXT", pais: "Bélgica" },
  { nome: "Paulinho",        pos: "Atacante",   estreia: 2025, ultimo: null, jogos: 30,  gols: 8,   nasc: "RJ" }
];
