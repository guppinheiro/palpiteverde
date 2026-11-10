#!/usr/bin/env python3
"""
Importa os jogadores do Palmeiras da Wikipédia em português e gera js/jogadores.js.

Fontes: Categoria:Futebolistas da Sociedade Esportiva Palmeiras (API pública da
Wikipédia) mais a lista do Wikidata (todos com passagem pelo clube e artigo em
português). Para cada jogador, lê a ficha (infobox) e soma as passagens pelo
Palmeiras: anos, jogos e gols. Também lê posição e local de nascimento.

Uso:
    python3 tools/importar_wikipedia.py [--cache DIR] [--saida js/jogadores.js]

A API limita o número de requisições: o script vai devagar, pede 50 páginas por
vez e guarda as respostas em cache. Se for interrompido, é só rodar de novo.

Observação: os números são os das fichas da Wikipédia, que podem estar
desatualizados ou incompletos. Jogadores sem jogos pelo Palmeiras na ficha
ficam de fora (o jogo precisa desses números).
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

API = "https://pt.wikipedia.org/w/api.php"
CATEGORIA = "Categoria:Futebolistas da Sociedade Esportiva Palmeiras"
USER_AGENT = "PalpiteVerdeImporter/1.0 (fan game data import; low volume)"
ANO_ATUAL = 2026

# Corte das lendas: antes de 1970 só entram jogadores com bastante história no clube
ANO_LENDAS = 1970
JOGOS_MIN_LENDA = 100

ESTADOS = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA", "Ceará": "CE",
    "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA", "Mato Grosso do Sul": "MS",
    "Mato Grosso": "MT", "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
    "Pernambuco": "PE", "Piauí": "PI", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS",
    "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "Sergipe": "SE", "Tocantins": "TO",
    "São Paulo": "SP", "Rio de Janeiro": "RJ", "Distrito Federal": "DF", "Guanabara": "RJ",
}
CAPITAIS = {
    "Rio de Janeiro": "RJ", "São Paulo": "SP", "Belo Horizonte": "MG", "Salvador": "BA", "Recife": "PE",
    "Porto Alegre": "RS", "Curitiba": "PR", "Fortaleza": "CE", "Belém": "PA", "Goiânia": "GO",
    "Manaus": "AM", "Brasília": "DF", "Florianópolis": "SC", "Vitória": "ES", "Natal": "RN",
    "João Pessoa": "PB", "Maceió": "AL", "Aracaju": "SE", "Teresina": "PI", "São Luís": "MA",
    "Campo Grande": "MS", "Cuiabá": "MT", "Porto Velho": "RO", "Rio Branco": "AC", "Macapá": "AP",
    "Boa Vista": "RR", "Palmas": "TO", "Niterói": "RJ", "Santos": "SP", "Campinas": "SP",
}
PAISES_PT = {
    "Argentina", "Uruguai", "Paraguai", "Chile", "Colômbia", "Peru", "Equador", "Bolívia", "Venezuela",
    "Portugal", "Itália", "Espanha", "França", "Alemanha", "Bélgica", "Japão", "Estados Unidos",
    "México", "Angola", "Moçambique", "Cabo Verde", "Nigéria", "Gana", "Camarões", "Costa do Marfim",
    "Holanda", "Países Baixos", "Inglaterra", "Croácia", "Sérvia", "Iugoslávia", "Suíça", "Áustria",
    "Polônia", "Rússia", "Ucrânia", "China", "Coreia do Sul", "Austrália", "Canadá", "Honduras",
    "Costa Rica", "Panamá", "Haiti", "Cuba", "Senegal", "Marrocos", "Egito", "Grécia", "Turquia",
}


# ---------------------------------------------------------------- rede / cache
def requisitar(url, cache_dir, chave, dados_post=None, cabecalhos=None, pausa=5):
    arq = os.path.join(cache_dir, hashlib.sha1(chave.encode()).hexdigest() + ".json")
    if os.path.exists(arq):
        with open(arq, encoding="utf-8") as f:
            return json.load(f)
    espera = 5
    for _ in range(20):
        try:
            req = urllib.request.Request(url, data=dados_post,
                                         headers={"User-Agent": USER_AGENT, **(cabecalhos or {})})
            with urllib.request.urlopen(req, timeout=120) as r:
                dados = json.loads(r.read().decode("utf-8"))
            if isinstance(dados, dict) and dados.get("error", {}).get("code") == "maxlag":
                raise urllib.error.HTTPError(url, 503, "maxlag", None, None)
            with open(arq, "w", encoding="utf-8") as f:
                json.dump(dados, f, ensure_ascii=False)
            time.sleep(pausa)  # gentileza com a API
            return dados
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
            print(f"  aviso: {e}; nova tentativa em {espera}s", file=sys.stderr)
            time.sleep(espera)
            espera = min(espera * 2, 300)
    raise SystemExit("A API não respondeu. Tente de novo mais tarde.")


def baixar(params, cache_dir):
    params = {**params, "format": "json", "formatversion": "2", "maxlag": "5"}
    # a chave do cache é a mesma de versões anteriores do script
    chave = json.dumps(params, sort_keys=True)
    arq_antigo = os.path.join(cache_dir, hashlib.sha1(chave.encode()).hexdigest() + ".json")
    return requisitar(API + "?" + urllib.parse.urlencode(params), cache_dir, chave) if not os.path.exists(arq_antigo) \
        else json.load(open(arq_antigo, encoding="utf-8"))


# subcategorias com jogadores do time masculino (a do feminino fica de fora)
SUBCATEGORIAS = ["Categoria:Goleiros da Sociedade Esportiva Palmeiras"]


def listar_categoria(cache_dir):
    titulos = []
    for cat in [CATEGORIA] + SUBCATEGORIAS:
        cont = {}
        while True:
            d = baixar({"action": "query", "list": "categorymembers", "cmtitle": cat,
                        "cmlimit": "500", "cmnamespace": "0", **cont}, cache_dir)
            titulos += [m["title"] for m in d["query"]["categorymembers"] if m["title"] not in titulos]
            if "continue" not in d:
                break
            cont = {"cmcontinue": d["continue"]["cmcontinue"]}
    return titulos


WIKIDATA = "https://query.wikidata.org/sparql"
PALMEIRAS_WD = "Q80964"
CONSULTA_WD = """
SELECT ?p ?pLabel ?artigo ?ini ?fim ?jogos ?gols ?posLabel ?ufLabel ?paisLabel ?dn WHERE {
  ?p p:P54 ?st . ?st ps:P54 wd:%s .
  OPTIONAL { ?artigo schema:about ?p ; schema:isPartOf <https://pt.wikipedia.org/> . }
  OPTIONAL { ?st pq:P580 ?ini } OPTIONAL { ?st pq:P582 ?fim }
  OPTIONAL { ?st pq:P1350 ?jogos } OPTIONAL { ?st pq:P1351 ?gols }
  OPTIONAL { ?p wdt:P413 ?pos }
  OPTIONAL { ?p wdt:P569 ?dn }
  OPTIONAL { ?p wdt:P19 ?nasc . OPTIONAL { ?nasc wdt:P17 ?pais }
             OPTIONAL { ?nasc wdt:P131* ?uf . ?uf wdt:P31 wd:Q485258 } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
}""" % PALMEIRAS_WD


def consultar_wikidata(cache_dir):
    """A categoria da Wikipédia não tem todo mundo (ex.: Weverton, Prass, Leão).
    O Wikidata lista, numa consulta só, todos com passagem pelo Palmeiras e artigo
    em português. Também serve de reserva quando a ficha não tem um dado."""
    corpo = urllib.parse.urlencode({"query": CONSULTA_WD}).encode()
    d = requisitar(WIKIDATA, cache_dir, "wikidata:" + CONSULTA_WD, dados_post=corpo,
                   cabecalhos={"Accept": "application/sparql-results+json"}, pausa=1)
    g = lambda r, k: r.get(k, {}).get("value")
    info, sem_artigo = {}, {}
    for r in d["results"]["bindings"]:
        qid = g(r, "p").rsplit("/", 1)[1]
        if g(r, "artigo"):
            titulo = urllib.parse.unquote(g(r, "artigo").rsplit("/wiki/", 1)[1]).replace("_", " ")
            i = info.setdefault(titulo, {"passagens": {}, "pos": None, "uf": None, "pais": None, "nasceu": None})
        else:
            i = sem_artigo.setdefault(qid, {"passagens": {}, "pos": None, "uf": None, "pais": None, "nasceu": None,
                                            "nome": g(r, "pLabel"), "qid": qid})
        chave = (g(r, "ini"), g(r, "fim"))
        i["passagens"][chave] = (g(r, "jogos"), g(r, "gols"))
        i["pos"] = i["pos"] or g(r, "posLabel")
        i["uf"] = i["uf"] or g(r, "ufLabel")
        i["pais"] = i["pais"] or g(r, "paisLabel")
        dn = g(r, "dn")
        if dn and not i["nasceu"] and re.match(r"\d{4}", dn):
            i["nasceu"] = int(dn[:4])
    return info, sem_artigo


def apelidos_wikidata(qids, cache_dir):
    """Nome completo é difícil de adivinhar: pega os apelidos (rótulos alternativos)."""
    if not qids:
        return {}
    consulta = """SELECT ?p ?apelido WHERE { VALUES ?p { %s }
      ?p skos:altLabel ?apelido . FILTER(lang(?apelido) = "pt" || lang(?apelido) = "en") }""" % " ".join(
        "wd:" + q for q in sorted(qids))
    corpo = urllib.parse.urlencode({"query": consulta}).encode()
    d = requisitar(WIKIDATA, cache_dir, "wikidata:" + consulta, dados_post=corpo,
                   cabecalhos={"Accept": "application/sparql-results+json"}, pausa=1)
    res = {}
    for r in d["results"]["bindings"]:
        res.setdefault(r["p"]["value"].rsplit("/", 1)[1], set()).add(r["apelido"]["value"])
    return res


def jogador_so_wikidata(wd, apelidos):
    """Jogador sem artigo em português: monta tudo com os dados do Wikidata."""
    ps, pos, nasc, pais = reserva_wikidata(wd)
    com_numeros = [p for p in ps if p[2]]
    if not com_numeros or not pos or not wd["nome"] or re.fullmatch(r"Q\d+", wd["nome"]):
        return None
    nome = wd["nome"]
    # apelido curto (até 2 palavras) costuma ser como o jogador é conhecido
    curtos = sorted((a for a in apelidos if len(a.split()) <= 2 and len(a) < len(nome)), key=len)
    if curtos and len(nome.split()) > 2:
        nome = curtos[0]
    j = {"nome": nome, "pos": pos, "estreia": min(p[0] for p in ps),
         "ultimo": None if any(p[1] is None for p in ps) else max(p[1] for p in ps),
         "jogos": sum(p[2] for p in com_numeros), "gols": sum(p[3] or 0 for p in com_numeros),
         "nasc": nasc, "wd": wd["qid"]}
    if wd.get("nasceu"):
        j["nasceu"] = wd["nasceu"]
    if pais:
        j["pais"] = pais
    fim = j["ultimo"] or ANO_ATUAL
    if fim < ANO_LENDAS and j["jogos"] < JOGOS_MIN_LENDA:
        return None
    return j


def resolver_buscas(consultas, cache_dir):
    """Linhas "?nome" em paginas_extras.txt: busca artigos de futebolista com esse nome."""
    titulos = set()
    for q in consultas:
        d = baixar({"action": "query", "list": "search", "srlimit": "10", "srprop": "", "srnamespace": "0",
                    "srsearch": f'{q} Palmeiras hastemplate:"Info/Futebol"'}, cache_dir)
        achados = [r["title"] for r in d["query"]["search"]]
        print(f"  busca {q!r}: {achados[:5]}", file=sys.stderr)
        titulos |= set(achados)
    return titulos


def reserva_wikidata(wd):
    """Converte o registro do Wikidata nos campos do jogo (quando faltam na ficha)."""
    ano = lambda v: int(v[:4]) if v and v[:4].isdigit() else None
    ps = []
    for (ini, fim), (jogos, gols) in wd["passagens"].items():
        a, b = ano(ini), ano(fim)
        if a or b:
            ps.append((a or b, b, int(float(jogos)) if jogos else None, int(float(gols)) if gols else None))
    pos = posicao_texto(wd["pos"] or "")
    if wd["pais"] and wd["pais"] != "Brasil":
        nasc, pais = "EXT", wd["pais"]
    else:
        nasc, pais = ESTADOS.get(wd["uf"] or ""), None
    return ps, pos, nasc, pais


def baixar_textos(titulos, cache_dir):
    textos = {}
    for i in range(0, len(titulos), 50):
        lote = titulos[i:i + 50]
        print(f"  páginas {i + 1}–{i + len(lote)} de {len(titulos)}", file=sys.stderr)
        d = baixar({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                    "redirects": "1", "titles": "|".join(lote)}, cache_dir)
        for p in d["query"]["pages"]:
            if "revisions" in p:
                textos[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
    return textos


# ---------------------------------------------------------------- análise da ficha
def extrair_infobox(texto):
    i = texto.find("{{Info/")
    if i < 0:
        return None
    nivel, j = 0, i
    while j < len(texto):
        if texto.startswith("{{", j):
            nivel += 1; j += 2; continue
        if texto.startswith("}}", j):
            nivel -= 1; j += 2
            if nivel == 0:
                break
            continue
        j += 1
    corpo = texto[i + 2:j - 2]
    campos, nivel, atual = {}, 0, []
    partes = []
    k = 0
    # divide por "|" no nível 0 (fora de {{ }} e [[ ]])
    while k < len(corpo):
        dois = corpo[k:k + 2]
        if dois in ("{{", "[["):
            nivel += 1; atual.append(dois); k += 2; continue
        if dois in ("}}", "]]"):
            nivel -= 1; atual.append(dois); k += 2; continue
        if corpo[k] == "|" and nivel == 0:
            partes.append("".join(atual)); atual = []; k += 1; continue
        atual.append(corpo[k]); k += 1
    partes.append("".join(atual))
    for p in partes[1:]:
        if "=" in p:
            c, v = p.split("=", 1)
            campos[c.strip().lower()] = v.strip()
    return campos


def limpar(v):
    v = re.sub(r"<ref[^>]*/>", "", v)
    v = re.sub(r"<ref[^>]*>.*?</ref>", "", v, flags=re.S)
    v = re.sub(r"<!--.*?-->", "", v, flags=re.S)
    v = re.sub(r"\{\{0\|[^}]*\}\}", "", v)
    return v


def texto_visivel(v):
    v = limpar(v)
    v = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", v)
    v = re.sub(r"\{\{[^{}]*\}\}", "", v)
    v = re.sub(r"<[^>]+>", " ", v)
    return re.sub(r"\s+", " ", v.replace("''", "")).strip()


def eh_palmeiras(clube):
    c = limpar(clube)
    if re.search(r"Palmeiras\s*(B|Sub|II)\b|sub-\d|Palmeiras B\b", c, re.I):
        return False
    if re.search(r"\{\{\s*Futebol Palmeiras\s*\}\}|\[\[\s*((Sociedade Esportiva|SE|S\.\s?E\.)\s*)?Palmeiras\s*[|\]]", c):
        return True
    # texto simples, sem link nem modelo: "Palmeiras" ou "S.E. Palmeiras"
    return bool(re.fullmatch(r"\s*((Sociedade Esportiva|SE|S\.\s?E\.)\s*)?Palmeiras\s*", texto_visivel(c)))


def anos(v):
    v = texto_visivel(v)
    nums = [int(x) for x in re.findall(r"\b(18\d\d|19\d\d|20\d\d)\b", v)]
    if not nums:
        return None
    aberto = bool(re.search(r"[–—-]\s*(presente)?\s*$", v)) and len(nums) == 1
    return min(nums), (None if aberto else max(nums))


def numero(v):
    v = texto_visivel(v).replace(".", "")
    m = re.search(r"([−–-]\s*)?(\d+)", v)
    if not m:
        return None
    # goleiros: a Wikipédia lista gols sofridos como número negativo
    return 0 if m.group(1) else int(m.group(2))


def passagens(campos):
    """Lista de (ano_ini, ano_fim|None, jogos, gols) no Palmeiras."""
    res = []
    # formato numerado: ano1/clube1/jogos1/gols1
    for chave, clube in campos.items():
        m = re.fullmatch(r"clube(\d+)", chave)
        if not m or not eh_palmeiras(clube):
            continue
        n = m.group(1)
        a = anos(campos.get(f"ano{n}", ""))
        j = numero(campos.get(f"jogos{n}", ""))
        g = numero(campos.get(f"gols{n}", campos.get(f"golos{n}", "")))
        if a:
            res.append((a[0], a[1], j, g))
    # formato em lista: ano / clubes / jogos(golos) separados por <br>
    if "clubes" in campos and ("ano" in campos or "anos" in campos):
        sep = re.compile(r"<\s*/?\s*br\s*/?\s*>", re.I)
        clubes = sep.split(campos["clubes"])
        anos_l = sep.split(campos.get("ano", campos.get("anos", "")))
        jg = sep.split(next((campos[k] for k in ("jogos(golos)", "jogos(gols)", "jogos (golos)", "jogos (gols)")
                             if k in campos), ""))
        for i, clube in enumerate(clubes):
            if not eh_palmeiras(clube) or i >= len(anos_l):
                continue
            a = anos(anos_l[i])
            j = g = None
            if i < len(jg):
                t = texto_visivel(jg[i])
                m = (re.search(r"(\d+)\s*\(\s*([−–-]?)\s*(\d+)\s*\)", t)
                     or re.fullmatch(r"\s*(\d+)\s+([−–-]?)\s*(\d+)\s*", t))
                if m:
                    j, g = int(m.group(1)), (0 if m.group(2) else int(m.group(3)))
            if a:
                res.append((a[0], a[1], j, g))
    return res


def posicao_texto(t):
    t = normal(t)
    regras = [
        ("Goleiro", ["goleiro", "guarda-redes", "arqueiro"]),
        ("Lateral", ["lateral", "ala", "defesa lateral"]),
        ("Zagueiro", ["zagueiro", "defensor", "beque", "zaga", "defesa central", "libero", "central"]),
        ("Meio-campo", ["volante", "meio", "meia", "medio", "armador", "centrocampista"]),
        ("Atacante", ["atacante", "centroavante", "ponta", "avancado", "extremo", "ponteiro", "centro-avante"]),
    ]
    melhor = None
    for pos, chaves in regras:
        for c in chaves:
            m = re.search(rf"\b{re.escape(c)}", t)
            if m and (melhor is None or m.start() < melhor[0]):
                melhor = (m.start(), pos)
    return melhor[1] if melhor else None


def posicao(campos):
    return posicao_texto(texto_visivel(campos.get("posição", campos.get("posicao", ""))))


def posicao_no_texto(texto):
    """Quando a ficha não diz a posição, procura na abertura do artigo ("que atuava como zagueiro")."""
    ini = texto.find("{{Info/")
    trecho = texto_visivel(texto[ini:ini + 12000] if ini >= 0 else texto[:12000])
    m = re.search(r"\b(?:atua|atuava|jogava|joga)\s+(?:como|de|na posição de)\s+(.{0,60})", trecho)
    return posicao_texto(m.group(1)) if m else None


def normal(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def nascimento(campos):
    chaves = [k for k in campos if ("natal" in k or "nascimento" in k or k == "local") and "data" not in k]
    bruto = limpar(", ".join(campos[k] for k in chaves if campos[k].strip()))
    vis = texto_visivel(bruto)
    if not vis:
        return None, None
    # Rio de Janeiro antes de 1960 aparece como "Distrito Federal (1891–1960)"
    if "1891" in bruto or "Guanabara" in vis:
        return "RJ", None
    for nome, uf in sorted(ESTADOS.items(), key=lambda x: -len(x[0])):
        if re.search(rf"\[\[{re.escape(nome)} \(estado\)", bruto):
            return uf, None
    partes = [p.strip() for p in vis.split(",")]
    pais = partes[-1] if len(partes) > 1 else None
    if pais and pais != "Brasil" and pais in PAISES_PT:
        return "EXT", pais
    for p in partes[1:]:
        if p in ESTADOS:
            return ESTADOS[p], None
    if partes[0] in CAPITAIS:
        return CAPITAIS[partes[0]], None
    # sigla do estado: "Itaporanga (SP)", "Magalhães Barata, PA", "Santo Antônio da Platina-PR"
    m = re.search(r"(?:\(|,\s*|-|\s)(" + "|".join(sorted(set(ESTADOS.values()))) + r")\)?\s*(?:,\s*Brasil)?\s*$", vis)
    if m:
        return m.group(1), None
    for p in partes:
        if p in PAISES_PT:
            return "EXT", p
    return None, None


def nome_curto(campos, titulo):
    n = texto_visivel(campos.get("nome", "")) or re.sub(r"\s*\(.*\)$", "", titulo)
    return n.strip()


def ano_nascimento(campos):
    """Ano de nascimento da ficha: {{dni|3|4|1942}}, {{dnibr|...}}, {{Data de nascimento e idade|1995|6|19}}…"""
    for chave, valor in campos.items():
        if "nasc" not in chave or ("data" not in chave and "nascimento" != chave.split("_")[0]):
            continue
        m = re.search(r"\{\{\s*(?:dni|dnibr|nowrap\|\{\{dni|data de nascimento[^|]*|birth date[^|]*)\|([^}]*)", valor, re.I)
        anos = re.findall(r"\b(18[89]\d|19\d\d|20[0-2]\d)\b", m.group(1) if m else valor)
        if anos:
            return int(anos[0])
    return None


def jogador(titulo, texto, wd=None):
    campos = extrair_infobox(texto) or {}
    ps_wd, pos_wd, nasc_wd, pais_wd = reserva_wikidata(wd) if wd else ([], None, None, None)
    if not campos and not ps_wd:
        return None, "sem ficha"
    ps = passagens(campos)
    if not [p for p in ps if p[2] is not None] and [p for p in ps_wd if p[2] is not None]:
        ps = ps_wd  # a ficha não tem os números, o Wikidata tem
    if not ps:
        return None, "Palmeiras não aparece na ficha"
    # passagens sem números na ficha não entram na soma (só as que têm)
    com_numeros = [p for p in ps if p[2] is not None]
    if not com_numeros:
        return None, "sem jogos pelo Palmeiras na ficha"
    pos = posicao(campos) or posicao_no_texto(texto) or pos_wd
    if not pos:
        return None, "posição não reconhecida"
    nasc, pais = nascimento(campos)  # None = desconhecido; o jogo mostra "?"
    if not nasc and nasc_wd:
        nasc, pais = nasc_wd, pais_wd
    ultimo = None if any(p[1] is None for p in ps) else max(p[1] for p in ps)
    j = {
        "nome": nome_curto(campos, titulo),
        "pos": pos,
        "estreia": min(p[0] for p in ps),
        "ultimo": ultimo,
        "jogos": sum(p[2] for p in com_numeros),
        "gols": sum(p[3] or 0 for p in com_numeros),
        "nasc": nasc,
        "wiki": titulo,
    }
    nasceu = ano_nascimento(campos) or (wd or {}).get("nasceu")
    if nasceu:
        j["nasceu"] = nasceu
    if pais:
        j["pais"] = pais
    if j["jogos"] <= 0 and j["ultimo"] is not None:  # do elenco atual entra mesmo sem ter jogado
        return None, "0 jogos"
    fim = j["ultimo"] or ANO_ATUAL
    if fim < ANO_LENDAS and j["jogos"] < JOGOS_MIN_LENDA:
        return None, f"antes de {ANO_LENDAS} com menos de {JOGOS_MIN_LENDA} jogos"
    return j, None


# ---------------------------------------------------------------- saída
def escrever(jogadores, saida):
    # nomes repetidos: "nome" ganha o ano de estreia (identificador único) e "exibe" guarda o
    # nome como aparece no jogo; quem diferencia é a posição e o ano de nascimento ao lado
    contagem = {}
    for j in jogadores:
        contagem[j["nome"]] = contagem.get(j["nome"], 0) + 1
    for j in jogadores:
        if contagem[j["nome"]] > 1:
            j["exibe"] = j["nome"]
            j["nome"] = f'{j["nome"]} ({j["estreia"]})'
    vistos = set()
    unicos = []
    for j in sorted(jogadores, key=lambda x: (x["nome"], -x["jogos"])):
        if j["nome"] not in vistos:
            vistos.add(j["nome"]); unicos.append(j)
    linhas = [json.dumps(j, ensure_ascii=False) for j in unicos]
    cabecalho = f"""/*
 * Base de jogadores do Palpite Verde — GERADA AUTOMATICAMENTE.
 * Fonte: fichas da Wikipédia em português ({CATEGORIA}).
 * Gerada por tools/importar_wikipedia.py em {time.strftime('%Y-%m-%d')}. Não edite à mão:
 * para corrigir um jogador, use tools/correcoes.json e rode o importador de novo.
 *
 * Campos: nome, pos, estreia, ultimo (null = ainda no clube), jogos, gols,
 * nasc (UF ou "EXT"), pais (estrangeiros), wiki (página de origem).
 */
"""
    with open(saida, "w", encoding="utf-8") as f:
        f.write(cabecalho + "window.JOGADORES = [\n  " + ",\n  ".join(linhas) + "\n];\n")
    return unicos


def main():
    ap = argparse.ArgumentParser()
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--cache", default=os.path.join(raiz, ".cache-wikipedia"))
    ap.add_argument("--saida", default=os.path.join(raiz, "js", "jogadores.js"))
    ap.add_argument("--relatorio", default=None, help="arquivo JSON com os descartados e o motivo")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    print("Listando a categoria…", file=sys.stderr)
    titulos = listar_categoria(args.cache)
    print(f"{len(titulos)} páginas na categoria", file=sys.stderr)
    print("Consultando o Wikidata…", file=sys.stderr)
    wikidata, sem_artigo = consultar_wikidata(args.cache)
    manuais, buscas = set(), []
    arq_extras = os.path.join(raiz, "tools", "paginas_extras.txt")
    if os.path.exists(arq_extras):
        with open(arq_extras, encoding="utf-8") as f:
            for l in f:
                l = l.strip()
                if l.startswith("?"):
                    buscas.append(l[1:].strip())
                elif l and not l.startswith("#"):
                    manuais.add(l)
    manuais |= resolver_buscas(buscas, args.cache)
    extras = sorted((set(wikidata) | manuais) - set(titulos))
    print(f"{len(wikidata)} jogadores no Wikidata; {len(extras)} fora da categoria", file=sys.stderr)
    # categoria primeiro, extras depois: os lotes da categoria continuam batendo com o cache
    textos = baixar_textos(titulos, args.cache)
    textos.update(baixar_textos(extras, args.cache))

    correcoes_arq = os.path.join(raiz, "tools", "correcoes.json")
    correcoes = {}
    if os.path.exists(correcoes_arq):
        with open(correcoes_arq, encoding="utf-8") as f:
            correcoes = json.load(f)

    jogadores, descartes = [], {}
    for titulo, texto in textos.items():
        j, motivo = jogador(titulo, texto, wikidata.get(titulo))
        if titulo in correcoes:
            c = correcoes[titulo]
            if c is None:
                continue
            j = {**(j or {"wiki": titulo}), **c}
            motivo = None if all(k in j for k in ("nome", "pos", "estreia", "jogos", "gols", "nasc")) else motivo
            if motivo:
                j = None
        if j:
            jogadores.append(j)
        else:
            descartes[titulo] = motivo

    # quem só existe no Wikidata (sem artigo em português)
    apelidos = apelidos_wikidata(list(sem_artigo), args.cache)
    so_wd = [j for j in (jogador_so_wikidata(wd, apelidos.get(q, set())) for q, wd in sem_artigo.items()) if j]
    # Evita duplicar quem já entrou pela Wikipédia (o item do Wikidata nem sempre está ligado ao
    # artigo): mesmo nome com estreia a até 1 ano, ou mesmos anos/jogos/gols com 20+ jogos.
    def ja_existe(w):
        for j in jogadores:
            if normal(j["nome"]) == normal(w["nome"]) and abs(j["estreia"] - w["estreia"]) <= 1:
                return True
            if w["jogos"] >= 20 and (j["estreia"], j["jogos"], j["gols"]) == (w["estreia"], w["jogos"], w["gols"]):
                return True
        return False
    duplicados = [w["nome"] for w in so_wd if ja_existe(w)]
    so_wd = [w for w in so_wd if not ja_existe(w)]
    if duplicados:
        print(f"duplicados do Wikidata descartados: {', '.join(duplicados)}", file=sys.stderr)
    print(f"{len(so_wd)} jogadores só do Wikidata (sem artigo em português)", file=sys.stderr)
    jogadores += so_wd

    # jogadores de outras fontes (tools/jogadores_extras.json), se o nome ainda não existir
    arq = os.path.join(raiz, "tools", "jogadores_extras.json")
    if os.path.exists(arq):
        with open(arq, encoding="utf-8") as f:
            extras_manuais = json.load(f).get("jogadores", [])
        existentes = {normal(j["nome"]) for j in jogadores}
        novos = [{k: v for k, v in j.items() if k != "fonte"} for j in extras_manuais
                 if normal(j["nome"]) not in existentes]
        print(f"{len(novos)} jogadores de tools/jogadores_extras.json", file=sys.stderr)
        jogadores += novos
    unicos = escrever(jogadores, args.saida)

    motivos = {}
    for m in descartes.values():
        motivos[m] = motivos.get(m, 0) + 1
    print(f"\n{len(unicos)} jogadores gravados em {args.saida}", file=sys.stderr)
    for m, n in sorted(motivos.items(), key=lambda x: -x[1]):
        print(f"  descartados — {m}: {n}", file=sys.stderr)
    if args.relatorio:
        with open(args.relatorio, "w", encoding="utf-8") as f:
            json.dump(descartes, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
