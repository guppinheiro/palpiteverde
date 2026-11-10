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
  const SITE = window.SITE || { clube: "Palmeiras", sigla: "SEP", jogo: "Palpite Verde", arquivo: "palpite-verde", chave: "pv:", raiz: "" };
  const CLUBE = SITE.clube;
  const chaveSite = k => (SITE.chave || "pv:") + k.replace(/^pv:/, "");
  const armazenamento = {
    ler(k, p) { try { const v = localStorage.getItem(chaveSite(k)); return v ? JSON.parse(v) : p; } catch { return p; } },
    gravar(k, v) { try { localStorage.setItem(chaveSite(k), JSON.stringify(v)); } catch { /* sem armazenamento */ } }
  };
  const rotuloLocal = l => l === "casa" ? "Casa" : l === "neutro" ? "Neutro" : "Fora"; // finais em campo neutro
  // alguns jogos antigos não têm data na fonte: aí aparece só Casa/Fora
  const dataCurta = iso => { if (!iso) return ""; const [, m, d] = iso.split("-"); return `${d}/${m}`; };
  // cor do placar pelo resultado do Palmeiras: vitória, empate ou derrota
  const classeResultado = j => j.gp > j.gc ? " placar--vitoria" : j.gp < j.gc ? " placar--derrota" : " placar--empate";

  // ---------------- estado ----------------
  const escolha = {
    comp: armazenamento.ler("pv:camp:comp", "libertadores"),
    modo: "normal" // ao abrir o site, o modo Normal vem sempre selecionado
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
    $("lema").textContent = camp ? `Lembre quem o ${CLUBE} enfrentou em cada campanha.`
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
  // Para as chances, os jogos contra o mesmo adversário numa fase valem um só:
  // ida e volta no mata-mata, casa e fora na fase de grupos.
  // Base das chances: jogos contra o mesmo adversário numa fase contam como um só.
  // No Extremo, cada palpite revela um jogo: todo jogo conta (casa e fora nos grupos = 2, ida e volta = 2).
  function unidades(jogos, modo) {
    if (MODOS[modo]?.placar) return jogos.length;
    return new Set(jogos.map(j => `${j.fase}|${j.adv}`)).size;
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
      chances: Math.ceil(unidades(camp.jogos, escolha.modo) * MODOS[escolha.modo].fator), erros: [], fim: false, novos: new Set()
    };
    $("tela-inicio").hidden = true;
    $("tela-jogo").hidden = true;
    $("tela-campanha").hidden = false;
    $("camp-placar").hidden = !MODOS[jogo.modo].placar;
    $("camp-campo").value = ""; $("camp-gp").value = ""; $("camp-gc").value = "";
    $("camp-retorno").textContent = MODOS[jogo.modo].placar
      ? `Digite o adversário e o placar de um jogo (gols do ${CLUBE} × gols do rival). Caixa vazia vale 0.`
      : `Digite um adversário que o ${CLUBE} enfrentou nesta campanha.`;
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
    if (extremo) { gp = gp === "" ? "0" : String(Number(gp)); gc = gc === "" ? "0" : String(Number(gc)); } // vazio vale 0
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
        retorno(`${time} não enfrentou o ${CLUBE} nesta campanha.`);
      }
    } else {
      const certo = abertos.find(j => j.gp === Number(gp) && j.gc === Number(gc));
      if (certo) {
        jogo.revelados.add(certo.i); jogo.novos.add(certo.i);
        retorno(`Na mosca! ${CLUBE} ${gp} × ${gc} ${time}.`);
      } else if (abertos.length) {
        jogo.erros.push({ time, gp, gc, quase: true });
        retorno(`Time certo, placar errado: ${time} está na campanha.`);
      } else if (contra.length) {
        jogo.erros.push({ time, gp, gc });
        retorno(`Todos os jogos contra ${time} já foram descobertos.`);
      } else {
        jogo.erros.push({ time, gp, gc });
        retorno(`${time} não enfrentou o ${CLUBE} nesta campanha.`);
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
      img.src = `${SITE.raiz || ""}img/bandeiras/${slug(j.pais)}.png`;
      d.title = j.pais;
      d.append(img, j.pais === "Brasil" ? "BRA" : j.pais.slice(0, 3).toUpperCase());
    } else {
      img.src = `${SITE.raiz || ""}img/bandeiras/${j.uf}.png`;
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
    data.firstChild.textContent = rotuloLocal(j.local);
    data.append(dataCurta(j.data));
    const adv = document.createElement("span");
    adv.className = "jogo-linha__adv" + (visivel ? "" : " oculto");
    adv.textContent = visivel ? j.adv : "? ? ?";
    const placar = document.createElement("span");
    placar.className = "jogo-linha__placar" + (visivel ? classeResultado(j) : "");
    placar.textContent = visivel ? `${j.gp} × ${j.gc}` : "– × –";
    placar.title = `${CLUBE} × adversário`;
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
    const ordenados = lista.every(j => j.data) ? [...lista].sort((a, b) => a.data.localeCompare(b.data)) : lista;
    for (const j of ordenados) {
      const visivel = jogo.revelados.has(j.i) || jogo.fim;
      const linha = document.createElement("div");
      linha.className = "perna" + (jogo.revelados.has(j.i) ? " perna--certa" : visivel ? " perna--revelada" : "");
      const rot = document.createElement("span");
      rot.className = "perna__local";
      rot.innerHTML = "<b></b>";
      rot.firstChild.textContent = rotuloLocal(j.local);
      if (j.data) rot.append(" " + dataCurta(j.data));
      const placar = document.createElement("span");
      placar.className = "jogo-linha__placar" + (visivel ? classeResultado(j) : "");
      placar.textContent = visivel ? `${j.gp} × ${j.gc}` : "– × –";
      placar.title = `${CLUBE} × adversário`;
      linha.append(rot, placar);
      pernas.append(linha);
    }
    return box;
  }

  function blocoConfronto(lista, mataMata) {
    // dois jogos contra o mesmo time (ida e volta no mata-mata, casa e fora nos grupos): uma caixa só
    const idaVolta = lista.length === 2;
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
      ag.textContent = `Agregado ${gp} × ${gc}` + (pen ? ` · ${pen === "venceu" ? `${CLUBE} venceu` : `${CLUBE} perdeu`} nos pênaltis` : "");
      box.append(ag);
    } else if (mataMata && lista.length === 1 && lista[0].penaltis && todosVisiveis) {
      const ag = document.createElement("p");
      ag.className = "confronto__agregado";
      ag.textContent = `Decidido nos pênaltis · ${lista[0].penaltis === "venceu" ? `${CLUBE} venceu` : `${CLUBE} perdeu`}`;
      box.append(ag);
    }
    return box;
  }

  function renderJogo() {
    const comp = C[jogo.comp];
    // no Extremo o ano fica escondido até o fim
    const anoVisivel = MODOS[jogo.modo].placar && !jogo.fim ? "????" : jogo.ano;
    $("camp-chip").textContent = `${comp.nome} ${anoVisivel} · ${MODOS[jogo.modo].nome}`;
    $("camp-ano-titulo").textContent = anoVisivel;
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
      grade.className = "confrontos" + (fase === "Fase de grupos" ? " confrontos--grupos" : "");
      // uma caixa por adversário, na ordem do primeiro jogo; agregado só no mata-mata
      const porAdv = new Map();
      jogos.forEach(j => { if (!porAdv.has(j.adv)) porAdv.set(j.adv, []); porAdv.get(j.adv).push(j); });
      porAdv.forEach(lista => grade.append(blocoConfronto(lista, fase !== "Fase de grupos")));
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
    // o placar digitado fica: só o time é limpo para o próximo palpite
    if (!jogo.fim) { $("camp-campo").value = ""; $("camp-campo").focus(); }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(textoResultado()); retorno("Resultado copiado!"); }
    catch { retorno("Não foi possível copiar."); }
  }

  function textoResultado() {
    const comp = C[jogo.comp];
    const venceu = jogo.revelados.size === jogo.jogos.length;
    const end = window.PalpiteCard?.ENDERECO || location.href.split("?")[0];
    return `${SITE.jogo} · Campanhas\n${comp.nome} ${jogo.ano} · ${MODOS[jogo.modo].nome}\n`
      + `${venceu ? "✅" : "⚽"} ${jogo.revelados.size}/${jogo.jogos.length} jogos em ${jogo.usadas} de ${jogo.chances} chances\n`
      + `${jogo.resultado === "Campeão" ? "🏆 " : ""}${jogo.resultado}\n${end}`;
  }

  // ---------------- card do resultado ----------------
  // Imagem 1080×1350: competição, ano e modo, o placar de acertos e a campanha inteira,
  // fase por fase, com os jogos descobertos em cor e os que faltaram em contorno.
  async function desenharCardCampanha() {
    const P = window.PalpiteCard;
    const { COR, F_TITULO, F_TEXTO, retangulo, caber } = P;
    try { await Promise.all([document.fonts.load(`800 96px ${F_TITULO}`), document.fonts.load(`600 30px ${F_TEXTO}`)]); } catch { /* fonte reserva */ }
    const comp = C[jogo.comp];
    const venceu = jogo.revelados.size === jogo.jogos.length;
    const W = 1080, H = 1350, M = 56;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const VERM = COR.derrota || "#c8352e";

    ctx.fillStyle = COR.verde; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.04)";
    for (let x = 72; x < W; x += 144) ctx.fillRect(x, 0, 72, H);

    P.desenharLogo(ctx, M);
    ctx.font = `600 26px ${F_TEXTO}`; ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillText(`CAMPANHAS · MODO ${MODOS[jogo.modo].nome.toUpperCase()}`, M, 152);

    const PX = M, PY = 186, PW = W - 2 * M, PH = H - PY - 92;
    ctx.fillStyle = COR.branco; retangulo(ctx, PX, PY, PW, PH, 28); ctx.fill();
    const IX = PX + 44, IW = PW - 88;
    let y = PY + 64;

    ctx.fillStyle = COR.suave; ctx.font = `700 24px ${F_TEXTO}`;
    ctx.fillText(comp.nome.toUpperCase(), IX, y);
    y += 100;
    ctx.font = `800 120px ${F_TITULO}`; ctx.fillStyle = COR.verde;
    ctx.fillText(jogo.ano, IX, y);
    const wAno = ctx.measureText(jogo.ano + "  ").width;
    const tamR = caber(ctx, jogo.resultado.toUpperCase(), IW - wAno, 52, F_TITULO);
    ctx.font = `800 ${tamR}px ${F_TITULO}`; ctx.fillStyle = COR.tinta;
    ctx.fillText(jogo.resultado.toUpperCase(), IX + wAno, y - 8);

    y += 30;
    ctx.fillStyle = venceu ? COR.vivo : COR.longe; retangulo(ctx, IX, y, IW, 84, 18); ctx.fill();
    ctx.fillStyle = COR.branco; ctx.font = `800 50px ${F_TITULO}`;
    ctx.fillText(venceu ? `CAMPANHA COMPLETA EM ${jogo.usadas} DE ${jogo.chances}` : `${jogo.revelados.size} DE ${jogo.jogos.length} JOGOS DESCOBERTOS`, IX + 28, y + 60);
    y += 84 + 36;

    // linhas: um título por fase e uma linha por adversário
    const linhas = [];
    for (const fase of comp.fases) {
      const jogos = jogo.jogos.filter(j => j.fase === fase);
      if (!jogos.length) continue;
      linhas.push({ fase });
      const porAdv = new Map();
      jogos.forEach(j => { if (!porAdv.has(j.adv)) porAdv.set(j.adv, []); porAdv.get(j.adv).push(j); });
      porAdv.forEach((lista, adv) => linhas.push({ adv, lista }));
    }
    const rodape = PY + PH - 40;
    const nFases = linhas.filter(l => l.fase).length, nAdv = linhas.length - nFases;
    const passo = Math.max(30, Math.min(54, Math.floor((rodape - y) / (nAdv + nFases * 0.8))));
    const esc = passo / 54;
    const CH = Math.round(40 * esc), CW = Math.round(96 * esc), GAP = 10;
    for (const l of linhas) {
      if (l.fase) {
        y += Math.round(passo * 0.2);
        ctx.fillStyle = COR.suave; ctx.font = `700 ${Math.round(20 * esc + 2)}px ${F_TEXTO}`;
        ctx.fillText(l.fase.toUpperCase(), IX, y + Math.round(passo * 0.4));
        y += Math.round(passo * 0.6);
        continue;
      }
      const achou = l.lista.some(j => jogo.revelados.has(j.i));
      const cy = y + (passo - CH) / 2;
      // marcador de descoberto
      ctx.fillStyle = achou ? COR.vivo : COR.nevoa; retangulo(ctx, IX, cy + CH / 2 - 9, 18, 18, 5); ctx.fill();
      const larguraPlacar = l.lista.length * CW + (l.lista.length - 1) * GAP;
      const tamN = caber(ctx, l.adv, IW - 40 - larguraPlacar - 20, Math.round(30 * esc), F_TEXTO, 600);
      ctx.font = `600 ${tamN}px ${F_TEXTO}`; ctx.fillStyle = achou ? COR.tinta : COR.suave;
      ctx.fillText(l.adv, IX + 34, cy + CH / 2 + tamN * 0.35);
      l.lista.forEach((j, k) => {
        const x = IX + IW - larguraPlacar + k * (CW + GAP);
        const aberto = jogo.revelados.has(j.i);
        const cor = j.gp > j.gc ? COR.vivo : j.gp < j.gc ? VERM : COR.longe;
        retangulo(ctx, x, cy, CW, CH, 8);
        if (aberto) { ctx.fillStyle = cor; ctx.fill(); }
        else { ctx.strokeStyle = COR.linha; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = aberto ? COR.branco : COR.suave;
        ctx.font = `800 ${Math.round(24 * esc + 2)}px ${F_TEXTO}`; ctx.textAlign = "center";
        ctx.fillText(`${j.gp}×${j.gc}`, x + CW / 2, cy + CH / 2 + 9 * esc);
        ctx.textAlign = "left";
      });
      y += passo;
    }

    ctx.font = `500 20px ${F_TEXTO}`; ctx.fillStyle = COR.suave;
    ctx.fillText(`Placar do ${CLUBE} primeiro · cheio = descoberto · contorno = faltou`, IX, PY + PH - 26);

    ctx.font = `500 22px ${F_TEXTO}`; ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.textAlign = "center";
    ctx.fillText(`${SITE.jogo} · jogo de fã, sem ligação oficial com o clube`, W / 2, H - 38);
    ctx.textAlign = "left";
    return cv;
  }

  async function abrirCardCampanha() {
    if (!jogo || !window.PalpiteCard) return;
    const btn = $("btn-camp-card");
    btn.disabled = true;
    try {
      const cv = await desenharCardCampanha();
      await window.PalpiteCard.mostrar(cv, `${SITE.arquivo}-${slug(jogo.comp)}-${jogo.ano}-${jogo.modo}.png`, textoResultado());
    } catch (e) {
      retorno("Não foi possível criar o card.");
    } finally {
      btn.disabled = false;
    }
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
  $("btn-camp-card").addEventListener("click", abrirCardCampanha);
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
