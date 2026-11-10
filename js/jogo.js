(() => {
  "use strict";

  const MAX_PALPITES = 10;
  const ANO_ATUAL = 2026; // usado para quem ainda está no elenco (ultimo: null)
  const INICIO = Date.UTC(2026, 10, 9); // desafio #1 = 9 de novembro de 2026 (horário de Brasília)
  const FUSO = "America/Sao_Paulo";

  const REGIAO = {
    AC: "N", AP: "N", AM: "N", PA: "N", RO: "N", RR: "N", TO: "N",
    AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
    DF: "CO", GO: "CO", MT: "CO", MS: "CO",
    ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
    PR: "S", RS: "S", SC: "S",
    EXT: "EXT"
  };
  const UF_NOME = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
    ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
    MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
    RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia",
    RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins"
  };

  const JOGADORES = window.JOGADORES;
  const porNome = new Map(JOGADORES.map(j => [j.nome, j]));
  const $ = id => document.getElementById(id);

  // ---------- utilidades ----------
  const normalizar = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const ultimoAno = j => j.ultimo ?? ANO_ATUAL;

  // Bandeira do estado (UF) ou do país de nascimento; null quando a fonte não informa
  function bandeira(j) {
    if (!j.nasc) return null;
    const arq = j.nasc === "EXT" ? normalizar(j.pais || "").replace(/ /g, "-") : j.nasc;
    return arq ? `img/bandeiras/${arq}.png` : null;
  }
  // nome como aparece no jogo (homônimos têm "nome" único com o ano de estreia e "exibe" sem ele)
  const exibir = j => j.exibe || j.nome;
  const detalhes = j => j.nasceu ? `${j.pos} · ${j.nasceu}` : j.pos;
  const localNascimento = j => !j.nasc ? "?" : j.nasc === "EXT" ? j.pais : j.nasc;
  const localNascimentoExtenso = j => !j.nasc ? "local desconhecido" : j.nasc === "EXT" ? j.pais : UF_NOME[j.nasc] || j.nasc;

  const armazenamento = {
    ler(chave, padrao) {
      try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; }
      catch { return padrao; }
    },
    gravar(chave, valor) {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: segue sem salvar */ }
    }
  };

  function numeroDoDia(data = new Date()) {
    const [a, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(data).split("-").map(Number);
    return Math.floor((Date.UTC(a, m - 1, d) - INICIO) / 86400000) + 1;
  }

  function aleatorioComSemente(semente) {
    return () => {
      semente |= 0; semente = (semente + 0x6d2b79f5) | 0;
      let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Nível = ano mínimo em que o jogador ainda atuava pelo clube
  // desde: quem pode ser palpite e sorteado (último jogo a partir desse ano).
  // recorte/chance: no sorteio, "chance" das vezes sai alguém com último jogo a partir de "recorte".
  const NIVEIS = {
    // jogos: quanto o número de jogos pelo clube pesa no sorteio (expoente; teto de "tetoJogos")
    facil:   { desde: 1970, recorte: 2010, chance: 0.95, jogos: 0.9,   tetoJogos: 300, rotulo: "fácil",  nome: "Fácil",  semente: 1914 },
    dificil: { desde: 1970, recorte: 2000, chance: 0.75, jogos: 1.3, tetoJogos: 300, rotulo: "normal", nome: "Normal", semente: 1942 },
    lendas:  { desde: 0,                                 jogos: 0.5, tetoJogos: 200, rotulo: "lendas", nome: "Lendas", semente: 1951 }
  };
  // Quem tem poucos jogos pelo clube vale como palpite, mas não é sorteado
  const JOGOS_MIN_SORTEIO = 10;
  const POOL = {};
  const SORTEAVEIS = {};
  for (const [nivel, cfg] of Object.entries(NIVEIS)) {
    POOL[nivel] = JOGADORES.filter(j => (j.ultimo ?? ANO_ATUAL) >= cfg.desde)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
    SORTEAVEIS[nivel] = POOL[nivel].filter(j => j.jogos >= JOGOS_MIN_SORTEIO);
  }

  // Peso no sorteio = época × história no clube.
  // Época: o peso cai com o tempo desde o último jogo pelo clube. Elenco
  // atual ≈ 4,5; 2020 ≈ 3,5; 2010 ≈ 1,7; 2000 ≈ 1,0; anos 1970 ≈ 0,6.
  // História: (jogos / teto) elevado ao expoente do nível. Fácil (^0,9) e Normal (^1,3) dão
  // muito mais chance a quem jogou mais; Lendas (raiz) é mais equilibrado.
  function peso(j, nivel = "lendas") {
    const cfg = NIVEIS[nivel];
    const anos = ANO_ATUAL - (j.ultimo ?? ANO_ATUAL);
    const epoca = 0.5 + 4 * Math.exp(-anos / 12);
    const historia = Math.pow(Math.min(j.jogos, cfg.tetoJogos) / cfg.tetoJogos, cfg.jogos);
    return epoca * historia;
  }

  function sortearPonderado(lista, rnd, nivel) {
    const total = lista.reduce((s, j) => s + peso(j, nivel), 0);
    let r = rnd() * total;
    for (const j of lista) {
      r -= peso(j, nivel);
      if (r < 0) return j;
    }
    return lista[lista.length - 1];
  }

  // Sorteio do nível: primeiro escolhe a faixa de época (recentes ou antigos, pela chance do
  // nível), depois sorteia dentro dela com o peso de época e história.
  function sortearNivel(lista, rnd, nivel) {
    const cfg = NIVEIS[nivel];
    if (!cfg.recorte) return sortearPonderado(lista, rnd, nivel);
    const recentes = lista.filter(j => (j.ultimo ?? ANO_ATUAL) >= cfg.recorte);
    const antigos = lista.filter(j => (j.ultimo ?? ANO_ATUAL) < cfg.recorte);
    const faixa = rnd() < cfg.chance ? recentes : antigos;
    return sortearPonderado(faixa.length ? faixa : lista, rnd, nivel);
  }

  // Quantos sorteios recentes ficam bloqueados para não repetir jogador
  const semRepetir = pool => Math.min(15, Math.floor(pool.length / 2));

  // Desafio do dia: sorteio ponderado e determinístico (o mesmo para todos),
  // calculado dia a dia desde o dia 1 para não repetir jogadores recentes.
  const SORTEIOS_DIARIOS = { facil: [], dificil: [], lendas: [] };

  // Redefinições extraordinárias do desafio do dia: número do desafio → quantas vezes foi
  // redefinido. Nesses dias o sorteio usa outra semente e evita o jogador que tinha saído,
  // e o progresso salvo da versão anterior é descartado. Vale para todos os níveis.
  // O #1 foi redefinido para não repetir jogadores do período de testes.
  const REDEFINICOES = { 1: 2 }; // #1 redefinido 2x: testes e novas regras de sorteio dos níveis
  const versaoDoDia = dia => REDEFINICOES[dia] || 0;

  // Jogadores do dia fixados: quando a base muda no meio de um dia, o sorteio daquele dia
  // poderia trocar de jogador; aqui ele fica como estava. (número do desafio → nível → nome)
  const FIXADOS = { 1: { facil: "Ramires", dificil: "Carlos Gamarra", lendas: "Estêvão" } };
  function jogadorDoDia(dia, nivel) {
    const pool = SORTEAVEIS[nivel];
    const lista = SORTEIOS_DIARIOS[nivel];
    const bloqueio = semRepetir(pool);
    const alvo = Math.max(1, dia);
    while (lista.length < alvo) {
      const d = lista.length + 1;
      const recentes = new Set(lista.slice(-bloqueio));
      const candidatos = pool.filter(j => !recentes.has(j));
      let escolhido = sortearNivel(candidatos, aleatorioComSemente(NIVEIS[nivel].semente * 100003 + d), nivel);
      for (let v = 1; v <= versaoDoDia(d); v++) {
        const outros = candidatos.filter(j => j !== escolhido);
        escolhido = sortearNivel(outros.length ? outros : candidatos, aleatorioComSemente(NIVEIS[nivel].semente * 100003 + d + v * 7919), nivel);
      }
      const fixo = FIXADOS[d] && porNome.get(FIXADOS[d][nivel]);
      lista.push(fixo || escolhido);
    }
    return lista[alvo - 1];
  }

  // ---------- comparação ----------
  function compararNumero(chute, certo, margem) {
    if (chute === certo) return { classe: "ok", seta: "" };
    return {
      classe: Math.abs(chute - certo) <= margem ? "perto" : "longe",
      seta: certo > chute ? "↑" : "↓"
    };
  }

  // Posição e país não têm "perto": ou acertou, ou longe. Só estados brasileiros
  // da mesma região contam como perto.
  function compararNascimento(chute, certo) {
    if (!chute.nasc || !certo.nasc) return "sem"; // a fonte não informa
    if (chute.nasc === "EXT" || certo.nasc === "EXT") {
      return chute.nasc === certo.nasc && chute.pais === certo.pais ? "ok" : "longe";
    }
    if (chute.nasc === certo.nasc) return "ok";
    return REGIAO[chute.nasc] === REGIAO[certo.nasc] ? "perto" : "longe";
  }

  function comparar(chute, certo) {
    return [
      { rotulo: "Posição", valor: chute.pos, classe: chute.pos === certo.pos ? "ok" : "longe", seta: "" },
      { rotulo: "Estreia", valor: chute.estreia, ...compararNumero(chute.estreia, certo.estreia, 5) },
      { rotulo: "Último jogo", valor: ultimoAno(chute), ...compararNumero(ultimoAno(chute), ultimoAno(certo), 5) },
      { rotulo: "Jogos", valor: chute.jogos, ...compararNumero(chute.jogos, certo.jogos, 25) },
      { rotulo: "Gols", valor: chute.gols, ...compararNumero(chute.gols, certo.gols, 10) },
      { rotulo: "Nasceu", valor: localNascimento(chute), titulo: localNascimentoExtenso(chute), bandeira: bandeira(chute),
        classe: compararNascimento(chute, certo), seta: "" }
    ];
  }

  // ---------- estado ----------
  const nivelSalvo = "dificil"; // ao abrir o site, o nível Normal vem sempre selecionado
  const estado = {
    modo: "dia",
    nivel: NIVEIS[nivelSalvo] ? nivelSalvo : "facil",
    secreto: null,
    palpites: [],
    fim: false,
    dia: numeroDoDia()
  };

  function carregarDia() {
    estado.modo = "dia";
    estado.dia = numeroDoDia();
    estado.secreto = jogadorDoDia(estado.dia, estado.nivel);
    const salvo = armazenamento.ler(`pv:dia:${estado.nivel}`, null);
    if (salvo && salvo.dia === estado.dia && (salvo.versao || 0) === versaoDoDia(estado.dia)) {
      estado.palpites = salvo.palpites.filter(n => porNome.has(n));
      estado.fim = salvo.fim;
    } else {
      estado.palpites = [];
      estado.fim = false;
    }
  }

  // ---------- treino infinito ----------
  // Uma rodada atrás da outra, sem fim. Fica salvo por nível, então a
  // sequência continua mesmo recarregando a página.
  const treinoVazio = () => ({ secreto: null, palpites: [], fim: false, jogados: 0, acertos: 0, seq: 0, recorde: 0, recentes: [] });
  let treino = treinoVazio();

  function salvarTreino() {
    armazenamento.gravar(`pv:treino:${estado.nivel}`, {
      ...treino, secreto: estado.secreto?.nome ?? null, palpites: estado.palpites, fim: estado.fim
    });
  }

  function proximoTreino() {
    const pool = SORTEAVEIS[estado.nivel];
    const recentes = new Set(treino.recentes.slice(-semRepetir(pool)));
    const escolhido = sortearNivel(pool.filter(j => !recentes.has(j.nome)), Math.random, estado.nivel);
    treino.recentes = [...treino.recentes, escolhido.nome].slice(-15);
    estado.secreto = escolhido;
    estado.palpites = [];
    estado.fim = false;
    salvarTreino();
  }

  function carregarTreino() {
    estado.modo = "treino";
    const salvo = armazenamento.ler(`pv:treino:${estado.nivel}`, null);
    treino = { ...treinoVazio(), ...(salvo || {}) };
    const secreto = salvo && porNome.get(salvo.secreto);
    if (secreto && POOL[estado.nivel].includes(secreto)) {
      estado.secreto = secreto;
      estado.palpites = (salvo.palpites || []).filter(n => porNome.has(n));
      estado.fim = !!salvo.fim;
    } else {
      proximoTreino();
    }
  }

  function encerrarRodadaTreino(acertou) {
    treino.jogados++;
    if (acertou) {
      treino.acertos++;
      treino.seq++;
      treino.recorde = Math.max(treino.recorde, treino.seq);
    } else {
      treino.seq = 0;
    }
  }

  function pularTreino() {
    if (estado.modo !== "treino" || estado.fim) return;
    estado.fim = true;
    estado.pulou = true;
    encerrarRodadaTreino(false);
    salvarTreino();
    renderizar();
  }

  function avancarTreino() {
    estado.pulou = false;
    proximoTreino();
    renderizar();
    $("campo").focus();
  }

  function salvarDia() {
    if (estado.modo === "treino") return salvarTreino();
    armazenamento.gravar(`pv:dia:${estado.nivel}`, { dia: estado.dia, versao: versaoDoDia(estado.dia), palpites: estado.palpites, fim: estado.fim });
  }

  function lerStats() {
    return armazenamento.ler(`pv:stats:${estado.nivel}`, { jogos: 0, vitorias: 0, seq: 0, melhor: 0, dist: Array(MAX_PALPITES).fill(0), ultimoDiaVencido: null });
  }

  function registrarResultado(venceu) {
    if (estado.modo === "treino") return encerrarRodadaTreino(venceu);
    const s = lerStats();
    // Desafio redefinido e já jogado hoje na versão anterior: conta a partida,
    // mas não mexe na sequência (nem para cima, nem para zerar).
    const repeteDia = s.ultimoDiaJogado === estado.dia || s.ultimoDiaVencido === estado.dia;
    s.jogos++;
    if (venceu) {
      s.vitorias++;
      if (!repeteDia) s.seq = s.ultimoDiaVencido === estado.dia - 1 ? s.seq + 1 : 1;
      s.melhor = Math.max(s.melhor, s.seq);
      s.dist[estado.palpites.length - 1]++;
      if (!repeteDia || s.ultimoDiaVencido !== estado.dia) s.ultimoDiaVencido = estado.dia;
    } else if (!repeteDia) {
      s.seq = 0;
    }
    s.ultimoDiaJogado = estado.dia;
    armazenamento.gravar(`pv:stats:${estado.nivel}`, s);
  }

  // ---------- jogar ----------
  function palpitar(nome) {
    if (estado.fim) return;
    const j = porNome.get(nome);
    if (!j || !POOL[estado.nivel].includes(j)) return avisar("Escolha um jogador da lista");
    if (estado.palpites.includes(nome)) return avisar("Você já tentou esse jogador");
    estado.palpites.push(nome);
    const acertou = j === estado.secreto;
    if (acertou || estado.palpites.length >= MAX_PALPITES) {
      estado.fim = true;
      registrarResultado(acertou);
    }
    salvarDia();
    renderizar();
  }

  // ---------- interface ----------
  function renderFicha(nome, indice) {
    const j = porNome.get(nome);
    const acerto = j === estado.secreto;
    const el = document.createElement("article");
    el.className = "ficha" + (acerto ? " ficha--acerto" : "");
    const topo = document.createElement("div");
    topo.className = "ficha__topo";
    topo.innerHTML = `<span class="ficha__quem"><span class="ficha__nome"></span><small class="ficha__det"></small></span><span class="ficha__n">Palpite ${indice + 1} de ${MAX_PALPITES}</span>`;
    topo.querySelector(".ficha__nome").textContent = exibir(j);
    topo.querySelector(".ficha__det").textContent = detalhes(j);
    const dados = document.createElement("div");
    dados.className = "ficha__dados";
    for (const d of comparar(j, estado.secreto)) {
      const c = document.createElement("div");
      c.className = `dado dado--${d.classe}`;
      if (d.titulo) c.title = d.titulo;
      const b = document.createElement("b");
      if (d.bandeira) {
        const img = document.createElement("img");
        img.src = d.bandeira; img.alt = ""; img.loading = "lazy";
        img.addEventListener("error", () => img.remove());
        b.append(img);
      }
      b.append(`${d.valor}${d.seta ? " " + d.seta : ""}`);
      const s = document.createElement("small");
      s.textContent = d.rotulo;
      c.append(b, s);
      dados.append(c);
    }
    el.append(topo, dados);
    return el;
  }

  function renderizar() {
    const lista = $("palpites");
    lista.replaceChildren(...estado.palpites.map(renderFicha));

    const restantes = MAX_PALPITES - estado.palpites.length;
    const plural = restantes === 1 ? "" : "s";
    const rotulo = NIVEIS[estado.nivel].rotulo;
    $("status").textContent = estado.fim ? ""
      : estado.modo === "dia" ? `Desafio #${estado.dia} (${rotulo}) · ${restantes} palpite${plural} restante${plural}`
      : `Treino infinito (${rotulo}) · jogador ${treino.jogados + 1} · ${restantes} palpite${plural} restante${plural}`;

    const emTreino = estado.modo === "treino";
    const campo = $("campo");
    campo.disabled = estado.fim;
    campo.placeholder = !estado.fim ? "Digite o nome de um jogador"
      : emTreino ? "Aperte Enter para o próximo" : "Fim de jogo";

    $("btn-novo").hidden = !emTreino || estado.fim;
    $("placar").hidden = !emTreino;
    if (emTreino) {
      $("placar-acertos").textContent = `${treino.acertos}/${treino.jogados}`;
      $("placar-seq").textContent = treino.seq;
      $("placar-recorde").textContent = treino.recorde;
    }
    $("chip-modo").textContent = `${emTreino ? "Treino ∞" : `Desafio #${estado.dia}`} · ${NIVEIS[estado.nivel].nome}`;

    const fim = $("fim");
    fim.hidden = !estado.fim;
    if (estado.fim) {
      const venceu = estado.palpites.at(-1) === estado.secreto.nome;
      $("fim-selo").textContent = venceu ? `Acertou em ${estado.palpites.length} de ${MAX_PALPITES}` : estado.pulou ? "Jogador pulado" : "Palpites esgotados";
      $("fim-titulo").textContent = venceu ? "Golaço!" : estado.pulou ? "Pulou!" : "Não foi dessa vez";
      $("fim-texto").textContent = venceu
        ? `Você descobriu ${exibir(estado.secreto)} em ${estado.palpites.length} palpite${estado.palpites.length === 1 ? "" : "s"}.`
        : `O jogador era ${exibir(estado.secreto)} (${detalhes(estado.secreto)}).`;
      const wiki = $("fim-wiki");
      const { wiki: artigo, wd } = estado.secreto;
      wiki.hidden = !artigo && !wd;
      if (artigo) {
        wiki.href = "https://pt.wikipedia.org/wiki/" + encodeURIComponent(artigo.replace(/ /g, "_"));
        wiki.textContent = "Ver o jogador na Wikipédia ↗";
      } else if (wd) {
        wiki.href = "https://www.wikidata.org/wiki/" + wd;
        wiki.textContent = "Ver o jogador no Wikidata ↗";
      }
      $("btn-de-novo").hidden = !emTreino;
      $("fim-proximo").textContent = emTreino
        ? (venceu ? `Sequência de ${treino.seq}${treino.seq === treino.recorde && treino.seq > 1 ? " — novo recorde!" : ""}` : "Sequência zerada. Bora de novo!")
        : "Novo desafio à meia-noite (horário de Brasília). Enquanto isso, jogue o Treino ∞.";
    }
    fecharSugestoes();
  }

  // sugestões / autocompletar
  let sugestoes = [];
  let selecionada = -1;

  function atualizarSugestoes() {
    const termo = normalizar($("campo").value);
    const ul = $("sugestoes");
    if (!termo) return fecharSugestoes();
    sugestoes = POOL[estado.nivel]
      .filter(j => !estado.palpites.includes(j.nome))
      .map(j => ({ j, pos: normalizar(j.nome).indexOf(termo) }))
      .filter(x => x.pos >= 0)
      .sort((a, b) => a.pos - b.pos || a.j.nome.localeCompare(b.j.nome, "pt"))
      .slice(0, 8)
      .map(x => x.j);
    selecionada = sugestoes.length ? 0 : -1;
    ul.replaceChildren(...sugestoes.map((j, i) => {
      const li = document.createElement("li");
      li.id = `sug-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === selecionada);
      li.innerHTML = "<span></span><small></small>";
      li.firstChild.textContent = exibir(j);
      li.lastChild.textContent = detalhes(j);
      li.addEventListener("mousedown", e => { e.preventDefault(); escolher(i); });
      return li;
    }));
    if (!sugestoes.length) {
      const li = document.createElement("li");
      li.textContent = "Nenhum jogador encontrado";
      li.style.cursor = "default";
      ul.append(li);
    }
    ul.hidden = false;
    $("campo").setAttribute("aria-expanded", "true");
    $("campo").setAttribute("aria-activedescendant", selecionada >= 0 ? `sug-${selecionada}` : "");
  }

  function marcar(i) {
    selecionada = i;
    $("sugestoes").querySelectorAll("li[role=option]").forEach((li, k) => li.setAttribute("aria-selected", k === i));
    $("campo").setAttribute("aria-activedescendant", `sug-${i}`);
    document.getElementById(`sug-${i}`)?.scrollIntoView({ block: "nearest" });
  }

  function fecharSugestoes() {
    $("sugestoes").hidden = true;
    $("campo").setAttribute("aria-expanded", "false");
    sugestoes = [];
    selecionada = -1;
  }

  function escolher(i) {
    const j = sugestoes[i];
    if (!j) return;
    $("campo").value = "";
    fecharSugestoes();
    palpitar(j.nome);
    if (!estado.fim) $("campo").focus();
  }

  let temporizadorAviso;
  function avisar(texto) {
    const a = $("aviso");
    a.textContent = texto;
    a.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { a.hidden = true; }, 1800);
  }

  function textoCompartilhar() {
    const emoji = { ok: "🟩", perto: "🟦", longe: "⬜", sem: "⬛" };
    const venceu = estado.palpites.at(-1) === estado.secreto.nome;
    const rotulo = NIVEIS[estado.nivel].rotulo;
    if (estado.modo === "treino") {
      return `Palpite Verde · treino infinito (${rotulo})\n⚽ ${treino.acertos} acertos em ${treino.jogados} jogadores\n🔥 Recorde de sequência: ${treino.recorde}\n${location.href.split("?")[0]}`;
    }
    const placar = `${venceu ? estado.palpites.length : "X"}/${MAX_PALPITES}`;
    const titulo = estado.modo === "dia"
      ? `Palpite Verde #${estado.dia} (${rotulo}) ${placar}`
      : `Palpite Verde (treino ${rotulo}) ${placar}`;
    const linhas = estado.palpites.map(n => comparar(porNome.get(n), estado.secreto).map(d => emoji[d.classe]).join(""));
    return `${titulo}\n${linhas.join("\n")}\n${location.href.split("?")[0]}`;
  }

  async function compartilhar() {
    const texto = textoCompartilhar();
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(texto); avisar("Resultado copiado!"); }
    catch { avisar("Não foi possível copiar"); }
  }

  function renderStats() {
    const s = lerStats();
    $("stats-sub").textContent = `Desafio do dia · nível ${NIVEIS[estado.nivel].rotulo}`;
    const pct = s.jogos ? Math.round((100 * s.vitorias) / s.jogos) : 0;
    $("numeros").innerHTML = [
      [s.jogos, "Jogos"], [pct + "%", "Vitórias"], [s.seq, "Sequência"], [s.melhor, "Melhor seq."]
    ].map(([v, r]) => `<div><b>${v}</b><small>${r}</small></div>`).join("");
    const max = Math.max(1, ...s.dist);
    const venceuHoje = estado.modo === "dia" && estado.fim && estado.palpites.at(-1) === estado.secreto.nome;
    $("barras").innerHTML = s.dist.map((n, i) => {
      const atual = venceuHoje && estado.palpites.length === i + 1 ? " atual" : "";
      return `<div class="dist-linha${atual}"><span>${i + 1}</span><div style="width:${Math.max(8, (100 * n) / max)}%">${n}</div></div>`;
    }).join("");
  }

  // ---------- card de exportação ----------
  // Imagem 1080×1350 com o jogador secreto, o resultado, cada palpite (com as cores
  // das dicas), o palpite que chegou mais perto e a sequência.
  const COR = {
    verde: "#006437", verdeFundo: "#00552f", vivo: "#1f9e55", claro: "#b9ecc6", longe: "#7d8a83",
    branco: "#ffffff", tinta: "#0f2a1c", suave: "#5e7367", linha: "#d9e4dc", nevoa: "#eef5f0"
  };
  const COR_CLASSE = { ok: COR.vivo, perto: COR.claro, longe: COR.longe, sem: COR.nevoa };
  const F_TITULO = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const F_TEXTO = 'Inter, system-ui, sans-serif';

  function carregarImagem(src) {
    return new Promise(res => {
      if (!src) return res(null);
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  function retangulo(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function caber(ctx, texto, larguraMax, tamanho, fonte, peso = 800) {
    let t = tamanho;
    do { ctx.font = `${peso} ${t}px ${fonte}`; t -= 2; } while (ctx.measureText(texto).width > larguraMax && t > 20);
    return t + 2;
  }

  function resumoResultado() {
    const venceu = estado.palpites.at(-1) === estado.secreto.nome;
    const n = estado.palpites.length;
    const fichas = estado.palpites.map(nome => ({ nome, dados: comparar(porNome.get(nome), estado.secreto) }));
    // palpite errado que acertou mais dicas (empate: o que teve mais "perto")
    const errados = fichas.filter(f => f.nome !== estado.secreto.nome);
    const pontos = f => f.dados.filter(d => d.classe === "ok").length * 10 + f.dados.filter(d => d.classe === "perto").length;
    const maisPerto = errados.length ? errados.reduce((a, b) => (pontos(b) > pontos(a) ? b : a)) : null;
    const seq = estado.modo === "treino" ? { atual: treino.seq, recorde: treino.recorde } : (() => { const st = lerStats(); return { atual: st.seq, recorde: st.melhor }; })();
    return { venceu, n, fichas, maisPerto, seq };
  }

  async function desenharCard() {
    try { await Promise.all([document.fonts.load(`800 96px ${F_TITULO}`), document.fonts.load(`600 30px ${F_TEXTO}`)]); } catch { /* usa a fonte reserva */ }
    const W = 1080, H = 1350, M = 56;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const r = resumoResultado();
    const j = estado.secreto;
    const imgs = new Map(await Promise.all(
      [j, ...r.fichas.map(f => porNome.get(f.nome))].map(async p => [p.nome, await carregarImagem(bandeira(p))])
    ));

    // fundo verde com faixas de gramado
    ctx.fillStyle = COR.verde; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.04)";
    for (let x = 72; x < W; x += 144) ctx.fillRect(x, 0, 72, H);

    // cabeçalho: logo e contexto
    ctx.textBaseline = "alphabetic";
    ctx.font = `800 64px ${F_TITULO}`; ctx.fillStyle = COR.branco;
    ctx.fillText("PALPITE", M, 104);
    const wP = ctx.measureText("PALPITE ").width;
    const wV = ctx.measureText("VERDE").width;
    retangulo(ctx, M + wP - 6, 52, wV + 20, 66, 8); ctx.fill();
    ctx.fillStyle = COR.verde; ctx.fillText("VERDE", M + wP + 4, 104);
    const data = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO }).format(new Date());
    const contexto = estado.modo === "treino" ? `TREINO ∞ · ${NIVEIS[estado.nivel].nome.toUpperCase()}`
      : `DESAFIO #${estado.dia} · ${NIVEIS[estado.nivel].nome.toUpperCase()} · ${data}`;
    ctx.font = `600 26px ${F_TEXTO}`; ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillText(contexto, M, 152);

    // painel branco
    const PX = M, PY = 186, PW = W - 2 * M, PH = H - PY - 92;
    ctx.fillStyle = COR.branco; retangulo(ctx, PX, PY, PW, PH, 28); ctx.fill();
    const IX = PX + 44, IW = PW - 88;
    let y = PY + 64;

    // jogador secreto
    ctx.fillStyle = COR.suave; ctx.font = `700 24px ${F_TEXTO}`;
    ctx.fillText("O CRAQUE ERA", IX, y);
    y += 92;
    const tam = caber(ctx, exibir(j).toUpperCase(), IW, 104, F_TITULO);
    ctx.font = `800 ${tam}px ${F_TITULO}`; ctx.fillStyle = COR.verde;
    ctx.fillText(exibir(j).toUpperCase(), IX, y);
    y += 52;
    let x = IX;
    const bj = imgs.get(j.nome);
    if (bj) { const h = 30, w = Math.round(bj.width * h / bj.height); ctx.drawImage(bj, x, y - 25, w, h); ctx.strokeStyle = COR.linha; ctx.lineWidth = 1; ctx.strokeRect(x, y - 25, w, h); x += w + 14; }
    ctx.font = `600 28px ${F_TEXTO}`; ctx.fillStyle = COR.tinta;
    const anos = j.estreia === ultimoAno(j) ? `${j.estreia}` : `${j.estreia}–${ultimoAno(j)}`;
    ctx.fillText(`${j.pos} · ${localNascimentoExtenso(j)} · ${anos}`, x, y);
    y += 44;
    ctx.font = `500 26px ${F_TEXTO}`; ctx.fillStyle = COR.suave;
    ctx.fillText(`${j.jogos} jogos e ${j.gols} gols pelo Palmeiras`, IX, y);

    // faixa do resultado
    y += 34;
    ctx.fillStyle = r.venceu ? COR.vivo : COR.longe; retangulo(ctx, IX, y, IW, 84, 18); ctx.fill();
    ctx.fillStyle = COR.branco; ctx.font = `800 52px ${F_TITULO}`;
    const titulo = r.venceu ? `ACERTEI EM ${r.n} DE ${MAX_PALPITES}` : estado.pulou ? "PULEI ESSE" : `NÃO ACERTEI EM ${MAX_PALPITES}`;
    ctx.fillText(titulo, IX + 28, y + 60);
    y += 84 + 40;

    // palpites, do primeiro ao último
    ctx.fillStyle = COR.suave; ctx.font = `700 22px ${F_TEXTO}`;
    ctx.fillText("PALPITES", IX, y);
    const rotulos = ["POS", "EST", "ÚLT", "JOG", "GOL", "NAS"];
    const Q = 40, G = 8, larguraQ = 6 * Q + 5 * G, QX = IX + IW - larguraQ;
    ctx.font = `700 16px ${F_TEXTO}`; ctx.textAlign = "center";
    rotulos.forEach((t, i) => ctx.fillText(t, QX + i * (Q + G) + Q / 2, y));
    ctx.textAlign = "left";
    y += 16;
    const linhaH = Math.min(56, Math.floor((PY + PH - 150 - y) / Math.max(1, r.fichas.length)));
    r.fichas.forEach((f, i) => {
      const cy = y + i * linhaH;
      ctx.fillStyle = COR.suave; ctx.font = `700 24px ${F_TEXTO}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), IX, cy + Q - 10);
      const tamN = caber(ctx, exibir(porNome.get(f.nome)), QX - IX - 70, 30, F_TEXTO, 600);
      ctx.font = `600 ${tamN}px ${F_TEXTO}`; ctx.fillStyle = f.nome === j.nome ? COR.vivo : COR.tinta;
      ctx.fillText(exibir(porNome.get(f.nome)), IX + 52, cy + Q - 10);
      f.dados.forEach((d, k) => {
        const qx = QX + k * (Q + G);
        ctx.fillStyle = COR_CLASSE[d.classe]; retangulo(ctx, qx, cy, Q, Q, 8); ctx.fill();
        if (d.classe === "sem") { ctx.strokeStyle = COR.linha; ctx.lineWidth = 2; ctx.stroke(); }
        if (d.seta) {
          ctx.fillStyle = d.classe === "perto" ? COR.tinta : COR.branco; ctx.font = `800 24px ${F_TEXTO}`; ctx.textAlign = "center";
          ctx.fillText(d.seta, qx + Q / 2, cy + Q / 2 + 9); ctx.textAlign = "left";
        }
      });
    });

    // rodapé do painel: quem chegou mais perto e a sequência
    const by = PY + PH - 92;
    ctx.strokeStyle = COR.linha; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(IX, by); ctx.lineTo(IX + IW, by); ctx.stroke();
    ctx.font = `700 20px ${F_TEXTO}`; ctx.fillStyle = COR.suave;
    ctx.fillText(r.maisPerto ? "QUASE LÁ" : "DE PRIMEIRA", IX, by + 38);
    ctx.fillText(estado.modo === "treino" ? "SEQUÊNCIA / RECORDE" : "SEQUÊNCIA NO DESAFIO", IX + IW / 2 + 20, by + 38);
    ctx.font = `600 26px ${F_TEXTO}`; ctx.fillStyle = COR.tinta;
    const acertosPerto = r.maisPerto ? r.maisPerto.dados.filter(d => d.classe === "ok").length : 0;
    ctx.fillText(r.maisPerto ? `${exibir(porNome.get(r.maisPerto.nome))} (${acertosPerto} de 6 dicas)` : "Acertou no primeiro chute", IX, by + 72);
    ctx.fillText(`${r.seq.atual} atual · recorde ${r.seq.recorde}`, IX + IW / 2 + 20, by + 72);

    // assinatura
    ctx.font = `500 22px ${F_TEXTO}`; ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.textAlign = "center";
    ctx.fillText("Palpite Verde · jogo de fã, sem ligação oficial com o clube", W / 2, H - 38);
    ctx.textAlign = "left";
    return cv;
  }

  let cardAtual = null;
  async function abrirCard() {
    const btn = $("btn-card");
    btn.disabled = true;
    try {
      const cv = await desenharCard();
      cardAtual = await new Promise(res => cv.toBlob(res, "image/png"));
      $("card-img").src = cv.toDataURL("image/png");
      $("modal-card").showModal();
    } catch (e) {
      avisar("Não foi possível criar o card");
    } finally {
      btn.disabled = false;
    }
  }

  async function salvarCard() {
    if (!cardAtual) return;
    const nome = estado.modo === "treino"
      ? `palpite-verde-treino-${normalizar(estado.secreto.nome).replace(/[^a-z0-9]+/g, "-")}.png`
      : `palpite-verde-desafio-${estado.dia}-${estado.nivel}.png`;
    // Dentro do claude.ai, o arquivo é entregue pelo próprio site (o visitante confirma).
    const downloads = window.claude?.use ? await window.claude.use("downloads").catch(() => null) : null;
    if (downloads) {
      try { await downloads.save({ filename: nome, data: cardAtual }); avisar("Imagem salva"); }
      catch (e) { if (e?.code !== "declined") avisar("Não deu para salvar aqui. Toque e segure a imagem para salvar."); }
      return;
    }
    const url = URL.createObjectURL(cardAtual);
    const a = document.createElement("a");
    a.href = url; a.download = nome; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------- eventos ----------
  const campo = $("campo");
  campo.addEventListener("input", atualizarSugestoes);
  campo.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && sugestoes.length) { e.preventDefault(); marcar((selecionada + 1) % sugestoes.length); }
    else if (e.key === "ArrowUp" && sugestoes.length) { e.preventDefault(); marcar((selecionada - 1 + sugestoes.length) % sugestoes.length); }
    else if (e.key === "Escape") fecharSugestoes();
  });
  campo.addEventListener("blur", () => setTimeout(fecharSugestoes, 100));
  $("form-palpite").addEventListener("submit", e => {
    e.preventDefault();
    if (selecionada >= 0) return escolher(selecionada);
    const exato = JOGADORES.find(j => normalizar(j.nome) === normalizar(campo.value));
    if (exato) { campo.value = ""; palpitar(exato.nome); }
    else if (campo.value.trim()) avisar("Escolha um jogador da lista");
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && !$("tela-jogo").hidden && estado.modo === "treino" && estado.fim && !document.querySelector("dialog[open]")
        && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      avancarTreino();
    }
  });
  // ---------- tela inicial ----------
  const escolha = {
    modo: armazenamento.ler("pv:modo", "dia") === "treino" ? "treino" : "dia",
    nivel: estado.nivel
  };

  function renderInicio() {
    document.querySelectorAll(".opcao").forEach(b => b.setAttribute("aria-checked", b.dataset.modo === escolha.modo));
    document.querySelectorAll(".nivel").forEach(b => b.setAttribute("aria-checked", b.dataset.nivel === escolha.nivel));
    document.querySelectorAll("[data-qtd]").forEach(el => { el.textContent = `${POOL[el.dataset.qtd].length} jogadores`; });
    // situação do desafio de hoje e do treino no nível escolhido
    const dia = numeroDoDia();
    const salvo = armazenamento.ler(`pv:dia:${escolha.nivel}`, null);
    const hoje = salvo && salvo.dia === dia && (salvo.versao || 0) === versaoDoDia(dia) ? salvo : null;
    const renovado = salvo && salvo.dia === dia && (salvo.versao || 0) !== versaoDoDia(dia);
    $("op-dia-status").textContent = !hoje || !hoje.palpites.length
      ? (renovado ? `Desafio #${dia} renovado: jogador novo hoje!` : `Desafio #${dia} esperando por você`)
      : !hoje.fim ? `Em andamento: ${hoje.palpites.length} palpite${hoje.palpites.length === 1 ? "" : "s"}`
      : hoje.palpites.at(-1) === jogadorDoDia(dia, escolha.nivel).nome ? `Feito hoje: acertou em ${hoje.palpites.length}`
      : "Feito hoje: não acertou";
    const t = armazenamento.ler(`pv:treino:${escolha.nivel}`, null);
    $("op-treino-status").textContent = t && t.recorde ? `Seu recorde: ${t.recorde} seguidos` : "Comece uma sequência";
  }

  function mostrarInicio() {
    renderInicio();
    $("tela-jogo").hidden = true;
    $("tela-inicio").hidden = false;
    window.scrollTo(0, 0);
  }

  function comecar() {
    estado.nivel = escolha.nivel;
    estado.pulou = false;
    armazenamento.gravar("pv:nivel", escolha.nivel);
    armazenamento.gravar("pv:modo", escolha.modo);
    if (escolha.modo === "dia") carregarDia(); else carregarTreino();
    renderizar();
    $("tela-inicio").hidden = true;
    $("tela-jogo").hidden = false;
    window.scrollTo(0, 0);
    if (!estado.fim) $("campo").focus();
  }

  document.querySelectorAll(".opcao").forEach(b => b.addEventListener("click", () => { escolha.modo = b.dataset.modo; renderInicio(); }));
  document.querySelectorAll(".nivel").forEach(b => b.addEventListener("click", () => { escolha.nivel = b.dataset.nivel; renderInicio(); }));
  document.querySelectorAll(".opcao, .nivel").forEach(b => b.addEventListener("dblclick", comecar));
  $("btn-jogar").addEventListener("click", comecar);
  $("btn-inicio").addEventListener("click", mostrarInicio);
  $("btn-ajuda-inicio").addEventListener("click", () => $("modal-ajuda").showModal());
  $("btn-stats-inicio").addEventListener("click", () => { estado.nivel = escolha.nivel; renderStats(); $("modal-stats").showModal(); });
  $("btn-novo").addEventListener("click", pularTreino);
  $("btn-de-novo").addEventListener("click", avancarTreino);
  $("btn-compartilhar").addEventListener("click", compartilhar);
  $("btn-card").addEventListener("click", abrirCard);
  $("btn-salvar-card").addEventListener("click", salvarCard);
  $("btn-copiar-card").addEventListener("click", compartilhar);
  $("btn-ajuda").addEventListener("click", () => $("modal-ajuda").showModal());
  $("btn-stats").addEventListener("click", () => { renderStats(); $("modal-stats").showModal(); });
  document.querySelectorAll("[data-fontes]").forEach(b => b.addEventListener("click", () => $("modal-fontes").showModal()));
  document.querySelectorAll("dialog").forEach(d => {
    d.addEventListener("click", e => { if (e.target === d || e.target.hasAttribute("data-fechar")) d.close(); });
  });

  // ---------- início ----------
  // A contagem dos desafios recomeçou em 9/11/2026 (#1). Dados salvos com a numeração
  // antiga confundiriam o progresso e a sequência: limpa o progresso do dia e as datas
  // de referência, mantendo os totais de jogos e vitórias.
  if (armazenamento.ler("pv:epoca", 1) < 2) {
    for (const nivel of Object.keys(NIVEIS)) {
      try { localStorage.removeItem(`pv:dia:${nivel}`); } catch { /* sem armazenamento */ }
      const st = armazenamento.ler(`pv:stats:${nivel}`, null);
      if (st) {
        delete st.ultimoDiaVencido; delete st.ultimoDiaJogado; st.seq = 0;
        armazenamento.gravar(`pv:stats:${nivel}`, st);
      }
    }
    armazenamento.gravar("pv:epoca", 2);
  }
  mostrarInicio();
})();
