(() => {
  "use strict";

  const MAX_PALPITES = 10;
  const ANO_ATUAL = 2026; // usado para quem ainda está no elenco (ultimo: null)
  const INICIO = Date.UTC(2026, 0, 1); // dia 1 do desafio
  const FUSO = "America/Sao_Paulo";

  const REGIAO = {
    AC: "N", AP: "N", AM: "N", PA: "N", RO: "N", RR: "N", TO: "N",
    AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
    DF: "CO", GO: "CO", MT: "CO", MS: "CO",
    ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
    PR: "S", RS: "S", SC: "S",
    EXT: "EXT"
  };
  const POS_VIZINHA = { Zagueiro: "Lateral", Lateral: "Zagueiro", "Meio-campo": "Atacante", Atacante: "Meio-campo" };
  const POS_CURTA = { Goleiro: "GOL", Zagueiro: "ZAG", Lateral: "LAT", "Meio-campo": "MEI", Atacante: "ATA" };

  const JOGADORES = window.JOGADORES;
  const porNome = new Map(JOGADORES.map(j => [j.nome, j]));
  const $ = id => document.getElementById(id);

  // ---------- utilidades ----------
  const normalizar = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

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

  function embaralhar(lista, rnd) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Nível = ano mínimo em que o jogador ainda atuava pelo clube
  const NIVEIS = {
    facil:   { desde: 2020, rotulo: "fácil",   semente: 1914 },
    dificil: { desde: 1970, rotulo: "difícil", semente: 1942 }
  };
  const POOL = {};
  const ORDEM_DIARIA = {};
  for (const [nivel, cfg] of Object.entries(NIVEIS)) {
    POOL[nivel] = JOGADORES.filter(j => (j.ultimo ?? ANO_ATUAL) >= cfg.desde);
    ORDEM_DIARIA[nivel] = embaralhar(POOL[nivel].map(j => j.nome).sort(), aleatorioComSemente(cfg.semente));
  }

  function jogadorDoDia(dia, nivel) {
    const ordem = ORDEM_DIARIA[nivel];
    const n = ordem.length;
    return porNome.get(ordem[(((dia - 1) % n) + n) % n]);
  }

  // ---------- comparação ----------
  function compararNumero(chute, certo, margem) {
    if (chute === certo) return { classe: "ok", seta: "" };
    return {
      classe: Math.abs(chute - certo) <= margem ? "perto" : "longe",
      seta: certo > chute ? "↑" : "↓"
    };
  }

  function comparar(chute, certo) {
    const ult = j => j.ultimo ?? ANO_ATUAL;
    const pos = chute.pos === certo.pos ? "ok" : POS_VIZINHA[chute.pos] === certo.pos ? "perto" : "longe";
    const nasc = chute.nasc === certo.nasc && (chute.nasc !== "EXT" || chute.pais === certo.pais) ? "ok"
      : REGIAO[chute.nasc] === REGIAO[certo.nasc] ? "perto" : "longe";
    return [
      { rotulo: "Posição", valor: POS_CURTA[chute.pos], titulo: chute.pos, classe: pos, seta: "" },
      { rotulo: "Estreia", valor: chute.estreia, ...compararNumero(chute.estreia, certo.estreia, 5) },
      { rotulo: "Saída", valor: chute.ultimo ?? "Atual", ...compararNumero(ult(chute), ult(certo), 5) },
      { rotulo: "Jogos", valor: chute.jogos, ...compararNumero(chute.jogos, certo.jogos, 25) },
      { rotulo: "Gols", valor: chute.gols, ...compararNumero(chute.gols, certo.gols, 10) },
      { rotulo: "Nasceu", valor: chute.nasc === "EXT" ? chute.pais : chute.nasc, classe: nasc, seta: "" }
    ];
  }

  // ---------- estado ----------
  const nivelSalvo = armazenamento.ler("pv:nivel", "facil");
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
    if (salvo && salvo.dia === estado.dia) {
      estado.palpites = salvo.palpites.filter(n => porNome.has(n));
      estado.fim = salvo.fim;
    } else {
      estado.palpites = [];
      estado.fim = false;
    }
  }

  function novoTreino() {
    estado.modo = "treino";
    const pool = POOL[estado.nivel];
    let escolhido;
    do { escolhido = pool[Math.floor(Math.random() * pool.length)]; }
    while (pool.length > 1 && estado.secreto && escolhido === estado.secreto);
    estado.secreto = escolhido;
    estado.palpites = [];
    estado.fim = false;
  }

  function salvarDia() {
    if (estado.modo !== "dia") return;
    armazenamento.gravar(`pv:dia:${estado.nivel}`, { dia: estado.dia, palpites: estado.palpites, fim: estado.fim });
  }

  function lerStats() {
    return armazenamento.ler(`pv:stats:${estado.nivel}`, { jogos: 0, vitorias: 0, seq: 0, melhor: 0, dist: Array(MAX_PALPITES).fill(0), ultimoDiaVencido: null });
  }

  function registrarResultado(venceu) {
    if (estado.modo !== "dia") return;
    const s = lerStats();
    s.jogos++;
    if (venceu) {
      s.vitorias++;
      s.seq = s.ultimoDiaVencido === estado.dia - 1 ? s.seq + 1 : 1;
      s.melhor = Math.max(s.melhor, s.seq);
      s.dist[estado.palpites.length - 1]++;
      s.ultimoDiaVencido = estado.dia;
    } else {
      s.seq = 0;
    }
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
    topo.innerHTML = `<span class="ficha__nome"></span><span class="ficha__n">Palpite ${indice + 1} de ${MAX_PALPITES}</span>`;
    topo.firstChild.textContent = j.nome;
    const dados = document.createElement("div");
    dados.className = "ficha__dados";
    for (const d of comparar(j, estado.secreto)) {
      const c = document.createElement("div");
      c.className = `dado dado--${d.classe}`;
      if (d.titulo) c.title = d.titulo;
      const b = document.createElement("b");
      b.textContent = `${d.valor}${d.seta ? " " + d.seta : ""}`;
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
      : `Treino (${rotulo}) · ${restantes} palpite${plural} restante${plural}`;

    const campo = $("campo");
    campo.disabled = estado.fim;
    campo.placeholder = estado.fim ? "Fim de jogo" : "Digite o nome de um jogador";

    $("btn-novo").hidden = estado.modo !== "treino";
    document.querySelectorAll(".seg").forEach(x => {
      const ativo = x.dataset.nivel === estado.nivel;
      x.classList.toggle("ativo", ativo);
      x.setAttribute("aria-checked", ativo);
    });
    document.querySelectorAll(".modo").forEach(b => {
      const ativo = b.dataset.modo === estado.modo;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-selected", ativo);
    });

    const fim = $("fim");
    fim.hidden = !estado.fim;
    if (estado.fim) {
      const venceu = estado.palpites.at(-1) === estado.secreto.nome;
      $("fim-titulo").textContent = venceu ? "Golaço! ⚽" : "Não foi dessa vez";
      $("fim-texto").textContent = venceu
        ? `Você descobriu ${estado.secreto.nome} em ${estado.palpites.length} palpite${estado.palpites.length === 1 ? "" : "s"}.`
        : `O jogador era ${estado.secreto.nome}.`;
      $("btn-de-novo").hidden = estado.modo !== "treino";
      $("fim-proximo").textContent = estado.modo === "dia" ? "Novo desafio à meia-noite (horário de Brasília). Enquanto isso, vá para o Treino." : "";
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
      li.firstChild.textContent = j.nome;
      li.lastChild.textContent = j.pos;
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
    const emoji = { ok: "🟩", perto: "🟨", longe: "⬜" };
    const venceu = estado.palpites.at(-1) === estado.secreto.nome;
    const rotulo = NIVEIS[estado.nivel].rotulo;
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
      return `<div class="barra${atual}"><span>${i + 1}</span><div style="width:${Math.max(8, (100 * n) / max)}%">${n}</div></div>`;
    }).join("");
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

  document.querySelectorAll(".modo").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.modo === estado.modo) return;
    if (b.dataset.modo === "dia") carregarDia(); else novoTreino();
    renderizar();
  }));
  document.querySelectorAll(".seg").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.nivel === estado.nivel) return;
    estado.nivel = b.dataset.nivel;
    armazenamento.gravar("pv:nivel", estado.nivel);
    if (estado.modo === "dia") carregarDia(); else novoTreino();
    renderizar();
  }));
  $("btn-novo").addEventListener("click", () => { novoTreino(); renderizar(); });
  $("btn-de-novo").addEventListener("click", () => { novoTreino(); renderizar(); campo.focus(); });
  $("btn-compartilhar").addEventListener("click", compartilhar);
  $("btn-ajuda").addEventListener("click", () => $("modal-ajuda").showModal());
  $("btn-stats").addEventListener("click", () => { renderStats(); $("modal-stats").showModal(); });
  document.querySelectorAll("dialog").forEach(d => {
    d.addEventListener("click", e => { if (e.target === d || e.target.hasAttribute("data-fechar")) d.close(); });
  });

  // ---------- início ----------
  carregarDia();
  renderizar();
  if (!armazenamento.ler("pv:visitou", false)) {
    armazenamento.gravar("pv:visitou", true);
    $("modal-ajuda").showModal();
  }
})();
