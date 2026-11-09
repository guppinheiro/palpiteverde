(() => {
  "use strict";
  // Jogo "Campanhas": descobrir os adversários do Palmeiras numa edição da
  // Libertadores (da fase de grupos em diante) ou da Copa do Brasil.

  const C = window.CAMPANHAS;
  if (!C) return;
  const $ = id => document.getElementById(id);

  const MODOS = {
    normal:  { nome: "Normal",  fator: 2,   placar: false },
    dificil: { nome: "Difícil", fator: 1.5, placar: false },
    extremo: { nome: "Extremo", fator: 1.5, placar: true }
  };
  const UF_NOME = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
    ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
    MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
    RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia",
    RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins"
  };

  const normalizar = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const slug = s => normalizar(s).replace(/ /g, "-");
  const armazenamento = {
    ler(k, p) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : p; } catch { return p; } },
    gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
  };
  const dataCurta = iso => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
  // cor do placar pelo resultado do Palmeiras: vitória, empate ou derrota
  const classeResultado = j => j.gp > j.gc ? " placar--vitoria" : j.gp < j.gc ? " placar--derrota" : " placar--empate";

  // ---------------- estado ----------------
  const escolha = {
    comp: armazenamento.ler("pv:camp:comp", "libertadores"),
    modo: armazenamento.ler("pv:camp:modo", "normal")
  };
  if (!C[escolha.comp]) escolha.comp = "libertadores";
  if (!MODOS[escolha.modo]) escolha.modo = "normal";

  let jogo = null; // { comp, ano, modo, jogos, revelados:Set, chances, usadas, erros:[], fim, novos:Set }

  // ---------------- tela inicial: abas e painel ----------------
  function mostrarAba(qual) {
    const camp = qual === "campanhas";
    $("aba-craque").setAttribute("aria-selected", !camp);
    $("aba-campanhas").setAttribute("aria-selected", camp);
    $("painel-craque").hidden = camp;
    $("painel-campanhas").hidden = !camp;
    $("lema").textContent = camp ? "Lembre quem o Palmeiras enfrentou em cada campanha."
      : "Descubra o craque secreto em até 10 palpites.";
    armazenamento.gravar("pv:aba", qual);
    if (camp) renderPainel();
  }

  function renderPainel() {
    document.querySelectorAll(".camp-comp").forEach(b => b.setAttribute("aria-checked", b.dataset.comp === escolha.comp));
    document.querySelectorAll(".camp-modo").forEach(b => b.setAttribute("aria-checked", b.dataset.modo === escolha.modo));
    document.querySelectorAll("[data-anos]").forEach(el => {
      const anos = Object.keys(C[el.dataset.anos].anos);
      el.textContent = `${anos.length} edições: ${anos[0]}–${anos.at(-1)}`;
    });
  }

  // ---------------- partida ----------------
  // Para as chances, um confronto de mata-mata (ida e volta) vale um jogo;
  // na fase de grupos, cada jogo vale um.
  function unidades(jogos) {
    const grupos = jogos.filter(j => j.fase === "Fase de grupos").length;
    const confrontos = new Set(jogos.filter(j => j.fase !== "Fase de grupos").map(j => `${j.fase}|${j.adv}`)).size;
    return grupos + confrontos;
  }

  function comecar() {
    // ano sorteado a cada partida, sem repetir o da partida anterior
    const anos = Object.keys(C[escolha.comp].anos);
    const opcoes = anos.length > 1 ? anos.filter(a => !(jogo && jogo.comp === escolha.comp && jogo.ano === a)) : anos;
    const ano = opcoes[Math.floor(Math.random() * opcoes.length)];
    const camp = C[escolha.comp].anos[ano];
    armazenamento.gravar("pv:camp:comp", escolha.comp);
    armazenamento.gravar("pv:camp:modo", escolha.modo);
    jogo = {
      comp: escolha.comp, ano, modo: escolha.modo, jogos: camp.jogos.map((j, i) => ({ ...j, i })),
      resultado: camp.resultado, revelados: new Set(), usadas: 0,
      chances: Math.ceil(unidades(camp.jogos) * MODOS[escolha.modo].fator), erros: [], fim: false, novos: new Set()
    };
    $("tela-inicio").hidden = true;
    $("tela-jogo").hidden = true;
    $("tela-campanha").hidden = false;
    $("camp-placar").hidden = !MODOS[jogo.modo].placar;
    $("camp-campo").value = ""; $("camp-gp").value = ""; $("camp-gc").value = "";
    $("camp-retorno").textContent = MODOS[jogo.modo].placar
      ? "Digite o adversário e o placar de um jogo (gols do Palmeiras × gols do rival)."
      : "Digite um adversário que o Palmeiras enfrentou nesta campanha.";
    renderJogo();
    window.scrollTo(0, 0);
    $("camp-campo").focus();
  }

  function voltar() {
    $("tela-campanha").hidden = true;
    $("tela-inicio").hidden = false;
    mostrarAba("campanhas");
    window.scrollTo(0, 0);
  }

  function chutar(nome, gp, gc) {
    if (!jogo || jogo.fim) return;
    const extremo = MODOS[jogo.modo].placar;
    const times = C[jogo.comp].times;
    const time = times.find(t => normalizar(t) === normalizar(nome));
    if (!time) return retorno("Escolha um time da lista.");
    if (extremo && (gp === "" || gc === "")) return retorno("Preencha o placar: gols do Palmeiras (SEP) e do rival.");
    const contra = jogo.jogos.filter(j => j.adv === time);
    const abertos = contra.filter(j => !jogo.revelados.has(j.i));
    if (contra.length && !abertos.length && !extremo) return retorno(`${time} já foi descoberto.`);
    if (jogo.erros.some(e => e.time === time && (!extremo || (e.gp === gp && e.gc === gc)))) return retorno("Você já tentou esse palpite.");

    jogo.usadas++;
    jogo.novos = new Set();
    if (!extremo) {
      if (abertos.length) {
        abertos.forEach(j => { jogo.revelados.add(j.i); jogo.novos.add(j.i); });
        retorno(`Isso! ${abertos.length === 1 ? "1 jogo" : `${abertos.length} jogos`} contra ${time}.`);
      } else {
        jogo.erros.push({ time });
        retorno(`${time} não enfrentou o Palmeiras nesta campanha.`);
      }
    } else {
      const certo = abertos.find(j => j.gp === Number(gp) && j.gc === Number(gc));
      if (certo) {
        jogo.revelados.add(certo.i); jogo.novos.add(certo.i);
        retorno(`Na mosca! Palmeiras ${gp} × ${gc} ${time}.`);
      } else if (abertos.length) {
        jogo.erros.push({ time, gp, gc, quase: true });
        retorno(`Time certo, placar errado: ${time} está na campanha.`);
      } else if (contra.length) {
        jogo.erros.push({ time, gp, gc });
        retorno(`Todos os jogos contra ${time} já foram descobertos.`);
      } else {
        jogo.erros.push({ time, gp, gc });
        retorno(`${time} não enfrentou o Palmeiras nesta campanha.`);
      }
    }
    const venceu = jogo.revelados.size === jogo.jogos.length;
    if (venceu || jogo.usadas >= jogo.chances) encerrar(venceu);
    renderJogo();
  }

  function encerrar(venceu) {
    jogo.fim = true;
    const chave = `pv:camp:${jogo.comp}:${jogo.ano}:${jogo.modo}`;
    const antes = armazenamento.ler(chave, null);
    const acertos = jogo.revelados.size;
    if (!antes || acertos > antes.acertos || (venceu && !antes.venceu)) {
      armazenamento.gravar(chave, { acertos, total: jogo.jogos.length, venceu, chances: jogo.usadas });
    }
  }

  let temporizador;
  function retorno(texto) {
    $("camp-retorno").textContent = texto;
    clearTimeout(temporizador);
  }

  // ---------------- desenho da campanha ----------------
  function dica(j) {
    const d = document.createElement("span");
    d.className = "dica";
    const img = document.createElement("img");
    img.alt = "";
    if (jogo.comp === "libertadores") {
      img.src = `img/bandeiras/${slug(j.pais)}.png`;
      d.title = j.pais;
      d.append(img, j.pais === "Brasil" ? "BRA" : j.pais.slice(0, 3).toUpperCase());
    } else {
      img.src = `img/bandeiras/${j.uf}.png`;
      d.title = UF_NOME[j.uf] || j.uf;
      d.append(img, j.uf || "?");
    }
    img.addEventListener("error", () => img.remove());
    return d;
  }

  function linhaJogo(j) {
    const visivel = jogo.revelados.has(j.i) || jogo.fim;
    const el = document.createElement("div");
    el.className = "jogo-linha" + (jogo.revelados.has(j.i) ? " jogo-linha--certo" : visivel ? " jogo-linha--revelado" : "")
      + (jogo.novos.has(j.i) ? " jogo-linha--novo" : "");
    const data = document.createElement("span");
    data.className = "jogo-linha__data";
    data.innerHTML = `<b></b>`;
    data.firstChild.textContent = j.local === "casa" ? "Casa" : "Fora";
    data.append(dataCurta(j.data));
    const adv = document.createElement("span");
    adv.className = "jogo-linha__adv" + (visivel ? "" : " oculto");
    adv.textContent = visivel ? j.adv : "? ? ?";
    const placar = document.createElement("span");
    placar.className = "jogo-linha__placar" + (visivel ? classeResultado(j) : "");
    placar.textContent = visivel ? `${j.gp} × ${j.gc}` : "– × –";
    placar.title = "Palmeiras × adversário";
    el.append(data, dica(j), adv, placar);
    return el;
  }

  // Confronto de ida e volta: uma caixa só, com o adversário uma vez e as linhas Casa e Fora
  function caixaIdaVolta(lista) {
    const box = document.createElement("div");
    const algumVisivel = lista.some(j => jogo.revelados.has(j.i) || jogo.fim);
    const todosCertos = lista.every(j => jogo.revelados.has(j.i));
    box.className = "confronto confronto--iv" + (todosCertos ? " confronto--certo" : "")
      + (lista.some(j => jogo.novos.has(j.i)) ? " jogo-linha--novo" : "");
    const topo = document.createElement("div");
    topo.className = "confronto__topo";
    const adv = document.createElement("span");
    adv.className = "jogo-linha__adv" + (algumVisivel ? "" : " oculto");
    adv.textContent = algumVisivel ? lista[0].adv : "? ? ?";
    topo.append(dica(lista[0]), adv);
    const pernas = document.createElement("div");
    pernas.className = "pernas";
    box.append(topo, pernas);
    for (const j of [...lista].sort((a, b) => a.data.localeCompare(b.data))) {
      const visivel = jogo.revelados.has(j.i) || jogo.fim;
      const linha = document.createElement("div");
      linha.className = "perna" + (jogo.revelados.has(j.i) ? " perna--certa" : visivel ? " perna--revelada" : "");
      const rot = document.createElement("span");
      rot.className = "perna__local";
      rot.innerHTML = "<b></b>";
      rot.firstChild.textContent = j.local === "casa" ? "Casa" : "Fora";
      rot.append(" " + dataCurta(j.data));
      const placar = document.createElement("span");
      placar.className = "jogo-linha__placar" + (visivel ? classeResultado(j) : "");
      placar.textContent = visivel ? `${j.gp} × ${j.gc}` : "– × –";
      placar.title = "Palmeiras × adversário";
      linha.append(rot, placar);
      pernas.append(linha);
    }
    return box;
  }

  function blocoConfronto(lista, mataMata) {
    const idaVolta = mataMata && lista.length === 2;
    const box = idaVolta ? caixaIdaVolta(lista) : document.createElement("div");
    if (!idaVolta) {
      box.className = "confronto";
      lista.forEach(j => box.append(linhaJogo(j)));
    }
    const todosVisiveis = lista.every(j => jogo.revelados.has(j.i) || jogo.fim);
    if (mataMata && lista.length > 1 && todosVisiveis) {
      const gp = lista.reduce((s, j) => s + j.gp, 0), gc = lista.reduce((s, j) => s + j.gc, 0);
      const pen = lista[0].penaltis;
      const ag = document.createElement("p");
      ag.className = "confronto__agregado";
      ag.textContent = `Agregado ${gp} × ${gc}` + (pen ? ` · ${pen === "venceu" ? "Palmeiras venceu" : "Palmeiras perdeu"} nos pênaltis` : "");
      box.append(ag);
    } else if (mataMata && lista.length === 1 && lista[0].penaltis && todosVisiveis) {
      const ag = document.createElement("p");
      ag.className = "confronto__agregado";
      ag.textContent = `Decidido nos pênaltis · ${lista[0].penaltis === "venceu" ? "Palmeiras venceu" : "Palmeiras perdeu"}`;
      box.append(ag);
    }
    return box;
  }

  function renderJogo() {
    const comp = C[jogo.comp];
    $("camp-chip").textContent = `${comp.nome} ${jogo.ano} · ${MODOS[jogo.modo].nome}`;
    $("camp-ano-titulo").textContent = jogo.ano;
    $("camp-comp-titulo").textContent = `${comp.nome} · modo ${MODOS[jogo.modo].nome.toLowerCase()}`;
    $("camp-acertos").textContent = `${jogo.revelados.size}/${jogo.jogos.length}`;
    $("camp-chances").textContent = jogo.chances - jogo.usadas;
    $("camp-total").textContent = jogo.jogos.length;

    const chave = $("camp-chave");
    chave.replaceChildren();
    for (const fase of comp.fases) {
      const jogos = jogo.jogos.filter(j => j.fase === fase);
      if (!jogos.length) continue;
      const sec = document.createElement("section");
      sec.className = "fase";
      const tit = document.createElement("div");
      tit.className = "fase__titulo";
      tit.innerHTML = "<h3></h3><small></small>";
      tit.firstChild.textContent = fase;
      tit.lastChild.textContent = `${jogos.length} jogo${jogos.length === 1 ? "" : "s"}`;
      const grade = document.createElement("div");
      grade.className = "confrontos";
      if (fase === "Fase de grupos") {
        grade.append(blocoConfronto(jogos, false));
      } else {
        const porAdv = new Map();
        jogos.forEach(j => { if (!porAdv.has(j.adv)) porAdv.set(j.adv, []); porAdv.get(j.adv).push(j); });
        porAdv.forEach(lista => grade.append(blocoConfronto(lista, true)));
      }
      sec.append(tit, grade);
      chave.append(sec);
    }

    $("camp-erros").replaceChildren(...jogo.erros.map(e => {
      const s = document.createElement("span");
      s.textContent = e.gp !== undefined ? `${e.time} ${e.gp}×${e.gc}` : e.time;
      if (e.quase) s.className = "quase";
      return s;
    }));

    const campo = $("camp-campo");
    campo.disabled = jogo.fim; $("btn-chutar").disabled = jogo.fim;
    $("camp-gp").disabled = jogo.fim; $("camp-gc").disabled = jogo.fim;
    const fim = $("camp-fim");
    fim.hidden = !jogo.fim;
    if (jogo.fim) {
      const venceu = jogo.revelados.size === jogo.jogos.length;
      $("camp-fim-selo").textContent = `${comp.nome} ${jogo.ano} · ${jogo.resultado}`;
      $("camp-fim-titulo").textContent = venceu ? "Campanha completa!" : "Acabaram as chances";
      $("camp-fim-texto").textContent = venceu
        ? `Você descobriu os ${jogo.jogos.length} jogos usando ${jogo.usadas} de ${jogo.chances} chances.`
        : `Você descobriu ${jogo.revelados.size} de ${jogo.jogos.length} jogos. Os que faltavam aparecem em cinza.`;
    }
    fecharSugestoes();
  }

  // ---------------- sugestões ----------------
  let sugestoes = [], selecionada = -1;
  function atualizarSugestoes() {
    const termo = normalizar($("camp-campo").value);
    const ul = $("camp-sugestoes");
    if (!termo || !jogo) return fecharSugestoes();
    const descobertos = new Set(jogo.jogos.filter(j => jogo.revelados.has(j.i)).map(j => j.adv));
    const extremo = MODOS[jogo.modo].placar;
    sugestoes = C[jogo.comp].times
      .filter(t => extremo || (!descobertos.has(t) && !jogo.erros.some(e => e.time === t)))
      .map(t => ({ t, p: normalizar(t).indexOf(termo) }))
      .filter(x => x.p >= 0)
      .sort((a, b) => a.p - b.p || a.t.localeCompare(b.t, "pt"))
      .slice(0, 8).map(x => x.t);
    selecionada = sugestoes.length ? 0 : -1;
    const ufs = C[jogo.comp].ufs || {};
    ul.replaceChildren(...sugestoes.map((t, i) => {
      const li = document.createElement("li");
      li.id = `csug-${i}`; li.setAttribute("role", "option"); li.setAttribute("aria-selected", i === selecionada);
      li.innerHTML = "<span></span><small></small>";
      li.firstChild.textContent = t;
      li.lastChild.textContent = ufs[t] || "";
      li.addEventListener("mousedown", e => { e.preventDefault(); escolher(i); });
      return li;
    }));
    if (!sugestoes.length) { const li = document.createElement("li"); li.textContent = "Nenhum time encontrado"; ul.append(li); }
    ul.hidden = false;
    $("camp-campo").setAttribute("aria-expanded", "true");
  }
  function fecharSugestoes() { $("camp-sugestoes").hidden = true; $("camp-campo").setAttribute("aria-expanded", "false"); sugestoes = []; selecionada = -1; }
  function marcar(i) {
    selecionada = i;
    $("camp-sugestoes").querySelectorAll("li[role=option]").forEach((li, k) => li.setAttribute("aria-selected", k === i));
  }
  function escolher(i) {
    const t = sugestoes[i];
    if (!t) return;
    $("camp-campo").value = t;
    fecharSugestoes();
    if (MODOS[jogo.modo].placar) { $("camp-gp").focus(); return; }
    enviar();
  }
  function enviar() {
    const nome = $("camp-campo").value;
    const gp = $("camp-gp").value.trim(), gc = $("camp-gc").value.trim();
    chutar(nome, gp, gc);
    if (!jogo.fim) { $("camp-campo").value = ""; $("camp-gp").value = ""; $("camp-gc").value = ""; $("camp-campo").focus(); }
  }

  async function copiar() {
    const comp = C[jogo.comp];
    const venceu = jogo.revelados.size === jogo.jogos.length;
    const texto = `Palpite Verde · Campanhas\n${comp.nome} ${jogo.ano} · ${MODOS[jogo.modo].nome}\n`
      + `${venceu ? "✅" : "⚽"} ${jogo.revelados.size}/${jogo.jogos.length} jogos em ${jogo.usadas} de ${jogo.chances} chances\n`
      + `${jogo.resultado === "Campeão" ? "🏆 " : ""}${jogo.resultado}`;
    try { await navigator.clipboard.writeText(texto); retorno("Resultado copiado!"); }
    catch { retorno("Não foi possível copiar."); }
  }

  // ---------------- eventos ----------------
  $("aba-craque").addEventListener("click", () => mostrarAba("craque"));
  $("aba-campanhas").addEventListener("click", () => mostrarAba("campanhas"));
  document.querySelectorAll(".camp-comp").forEach(b => b.addEventListener("click", () => { escolha.comp = b.dataset.comp; renderPainel(); }));
  document.querySelectorAll(".camp-modo").forEach(b => b.addEventListener("click", () => { escolha.modo = b.dataset.modo; renderPainel(); }));
  $("btn-jogar-camp").addEventListener("click", comecar);
  $("btn-camp-inicio").addEventListener("click", voltar);
  $("btn-camp-outro").addEventListener("click", voltar);
  $("btn-camp-copiar").addEventListener("click", copiar);
  $("btn-ajuda-camp").addEventListener("click", () => $("modal-ajuda-camp").showModal());
  $("btn-ajuda-camp-inicio").addEventListener("click", () => $("modal-ajuda-camp").showModal());
  $("form-camp").addEventListener("submit", e => {
    e.preventDefault();
    if (selecionada >= 0 && !$("camp-sugestoes").hidden) return escolher(selecionada);
    enviar();
  });
  const campo = $("camp-campo");
  campo.addEventListener("input", atualizarSugestoes);
  campo.addEventListener("blur", () => setTimeout(fecharSugestoes, 100));
  campo.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && sugestoes.length) { e.preventDefault(); marcar((selecionada + 1) % sugestoes.length); }
    else if (e.key === "ArrowUp" && sugestoes.length) { e.preventDefault(); marcar((selecionada - 1 + sugestoes.length) % sugestoes.length); }
    else if (e.key === "Escape") fecharSugestoes();
  });
  // a tela do outro jogo também volta para cá com o botão Início dela
  $("btn-inicio").addEventListener("click", () => { if (armazenamento.ler("pv:aba", "craque") === "campanhas") mostrarAba("campanhas"); });

  if (armazenamento.ler("pv:aba", "craque") === "campanhas") mostrarAba("campanhas");
})();
