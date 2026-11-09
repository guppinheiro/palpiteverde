#!/usr/bin/env python3
"""
Gera js/campanhas.js: as campanhas do Palmeiras na Libertadores (da fase de grupos em diante)
e na Copa do Brasil, para o jogo "Campanhas".

Fontes (Kaggle):
  - Libertadores: ernestonlm/conmebol-libertadores-results-from-2011-to-2022 (CC0)
    arquivo libertadores-results-ds.csv
  - Copa do Brasil: ricardomattos05/jogos-do-campeonato-brasileiro (CC BY 4.0)
    arquivo Brazilian_Cup_Matches.csv

Uso:
    python3 tools/importar_campanhas.py LIBERTADORES.csv COPA_DO_BRASIL.csv [--saida js/campanhas.js]

Correções aplicadas aos dados de origem:
  - jogos duplicados são removidos (mesma data e mesmos times);
  - nomes diferentes do mesmo clube são unificados (ALIAS_*);
  - nos mata-matas, os dois jogos de um confronto ficam na fase do jogo de volta
    (a fonte às vezes marca a ida na fase anterior);
  - na Copa do Brasil, a numeração das fases antes das oitavas é corrigida nos anos em que
    a fonte está deslocada (DESLOCAMENTO_FASE_COPA).
"""
import argparse
import csv
import json
import os
import re
import time
from collections import Counter, defaultdict

# ---------------------------------------------------------------- Libertadores
FASES_LIB = {"Round of 16": "Oitavas de final", "Quarterfinal": "Quartas de final",
             "Semifinal": "Semifinal", "Final": "Final"}
ORDEM_LIB = ["Fase de grupos", "Oitavas de final", "Quartas de final", "Semifinal", "Final"]

ALIAS_LIB = {
    "Guarani FC": "Guaraní",            # 2020: a fonte usa os dois nomes para o Guaraní (PAR)
    "Atlético PR": "Athletico Paranaense",
    "Santos FC": "Santos",
    "Botafogo FR": "Botafogo",
    "Club Tijuana": "Tijuana",
    "CS Deportivo Pereira": "Deportivo Pereira",
    "FBC Melgar": "Melgar",
    "Junior FC": "Junior",
    "Godoy Cruz Antonio Tomba": "Godoy Cruz",
    "San Lorenzo de Almagro": "San Lorenzo",
    "Delfin SC": "Delfín",
}

# País de cada adversário do Palmeiras (bandeira usada como dica)
PAIS_LIB = {
    "Alianza Lima": "Peru", "Atlético Mineiro": "Brasil", "Athletico Paranaense": "Brasil",
    "Atlético Tucumán": "Argentina", "Barcelona SC": "Equador", "Boca Juniors": "Argentina",
    "Bolívar": "Bolívia", "Botafogo": "Brasil", "Deportivo Pereira": "Colômbia",
    "Cerro Porteño": "Paraguai", "Tijuana": "México", "Colo Colo": "Chile",
    "Defensa y Justicia": "Argentina", "Delfín": "Equador", "Deportivo Táchira": "Venezuela",
    "Emelec": "Equador", "Melgar": "Peru", "Flamengo": "Brasil", "Godoy Cruz": "Argentina",
    "Grêmio": "Brasil", "Guaraní": "Paraguai", "Independiente": "Argentina",
    "Independiente Petrolero": "Bolívia", "Jorge Wilstermann": "Bolívia", "Junior": "Colômbia",
    "Libertad": "Paraguai", "Liverpool": "Uruguai", "Nacional": "Uruguai", "Peñarol": "Uruguai",
    "River Plate": "Argentina", "Rosario Central": "Argentina", "San Lorenzo": "Argentina",
    "Santos": "Brasil", "Sporting Cristal": "Peru", "São Paulo": "Brasil",
    "Tigre": "Argentina", "Universidad Católica": "Chile", "Universitario de Deportes": "Peru",
}
# Mesmo nome, clube de outro país em certa edição
PAIS_LIB_EDICAO = {("River Plate", "2016"): "Uruguai"}
NOME_LIB_EDICAO = {("River Plate", "2016"): "River Plate (URU)"}

# Campeões e decisões por pênaltis (a fonte não traz pênaltis)
CAMPEAO = {"libertadores": {"2020", "2021"}, "copa": {"2012", "2015", "2020"}}
PENALTIS = {  # (competição, ano, adversário) -> "venceu" | "perdeu"
    ("libertadores", "2017", "Barcelona SC"): "perdeu",
    ("libertadores", "2022", "Atlético Mineiro"): "venceu",
    ("libertadores", "2023", "Boca Juniors"): "perdeu",
    ("copa", "2015", "Santos"): "venceu",
    ("copa", "2019", "Internacional"): "perdeu",
    ("copa", "2021", "CRB"): "perdeu",
}

# ---------------------------------------------------------------- Copa do Brasil
ALIAS_COPA = {
    "Atlético - PR": "Athletico Paranaense", "Atlético Paranaense": "Athletico Paranaense",
    "Athletico Paranaense": "Athletico Paranaense", "Atlético - MG": "Atlético Mineiro",
    "Atlético Mineiro": "Atlético Mineiro", "America - MG": "América Mineiro", "América - MG": "América Mineiro",
    "América Mineiro": "América Mineiro", "Crb": "CRB", "Asa": "ASA", "Csa": "CSA",
    "Sampaio Correa": "Sampaio Corrêa", "Botafogo - PB": "Botafogo-PB", "Botafogo - RJ": "Botafogo",
    "Atlético - GO": "Atlético Goianiense", "Atlético Goianiense": "Atlético Goianiense",
}


def limpar_copa(nome_bruto):
    """'Vitória da Conquista - BA' -> ('Vitória da Conquista', 'BA')."""
    m = re.match(r"^(.*?)\s*-\s*([A-Z]{2})\s*$", nome_bruto.strip())
    nome, uf = (m.group(1), m.group(2)) if m else (nome_bruto.strip(), None)
    nome = re.sub(r"\s*\(.*?\)\s*", " ", nome).strip()
    chave = f"{nome} - {uf}" if uf else nome
    nome = ALIAS_COPA.get(chave, ALIAS_COPA.get(nome, nome))
    return nome, uf


def data_iso(texto):
    texto = texto.strip()
    if re.match(r"\d{4}-\d{2}-\d{2}", texto):
        return texto[:10]
    d, m, a = texto.split("/")
    return f"{a}-{int(m):02d}-{int(d):02d}"


def resultado_campanha(comp, ano, jogos, ordem):
    ultima = max(jogos, key=lambda j: (ordem.index(j["fase"]), j["data"]))["fase"]
    if ano in CAMPEAO[comp]:
        return "Campeão"
    if ultima == "Final":
        return "Vice-campeão"
    if ultima.endswith("ª fase"):
        return f"Caiu na {ultima}"
    return {"Fase de grupos": "Caiu na fase de grupos",
            "Oitavas de final": "Caiu nas oitavas", "Quartas de final": "Caiu nas quartas",
            "Semifinal": "Caiu na semifinal"}[ultima]


def marcar_penaltis(comp, ano, jogos):
    for j in jogos:
        p = PENALTIS.get((comp, ano, j["adv"]))
        if p:
            j["penaltis"] = p


def unificar_fases_mata_mata(jogos):
    """Os dois jogos de um confronto ficam na fase do jogo de volta."""
    por_adv = defaultdict(list)
    for j in jogos:
        if j["fase"] != "Fase de grupos":
            por_adv[j["adv"]].append(j)
    for lista in por_adv.values():
        lista.sort(key=lambda j: j["data"])
        # pares consecutivos de datas próximas formam um confronto
        for a, b in zip(lista, lista[1:]):
            if a["fase"] != b["fase"] and abs(int(b["data"].replace("-", "")) - int(a["data"].replace("-", ""))) < 100:
                a["fase"] = b["fase"]


def ler_libertadores(caminho):
    linhas = list(csv.DictReader(open(caminho, encoding="utf-8")))
    times = set()
    por_ano = defaultdict(list)
    vistos = set()
    for x in linhas:
        casa, fora = ALIAS_LIB.get(x["Home Club"], x["Home Club"]), ALIAS_LIB.get(x["Away Club"], x["Away Club"])
        times.update([casa, fora])
        if "Palmeiras" not in (casa, fora):
            continue
        ano, data = x["Edition"], data_iso(x["Date"])
        chave = (ano, data, casa, fora)
        if chave in vistos:
            continue
        vistos.add(chave)
        palmeiras_casa = casa == "Palmeiras"
        adv = fora if palmeiras_casa else casa
        fase = "Fase de grupos" if x["Round"].startswith("Group") else FASES_LIB[x["Round"]]
        gp, gc = (int(x["Home Score"]), int(x["AwayScore"])) if palmeiras_casa else (int(x["AwayScore"]), int(x["Home Score"]))
        j = {"fase": fase, "data": data, "local": "casa" if palmeiras_casa else "fora",
             "adv": NOME_LIB_EDICAO.get((adv, ano), adv), "gp": gp, "gc": gc,
             "pais": PAIS_LIB_EDICAO.get((adv, ano), PAIS_LIB.get(adv))}
        if not j["pais"]:
            raise SystemExit(f"País desconhecido para {adv} ({ano}): acrescente em PAIS_LIB")
        por_ano[ano].append(j)
    anos = {}
    for ano, jogos in sorted(por_ano.items()):
        unificar_fases_mata_mata(jogos)
        marcar_penaltis("libertadores", ano, jogos)
        jogos.sort(key=lambda j: (ORDEM_LIB.index(j["fase"]), j["data"]))
        anos[ano] = {"resultado": resultado_campanha("libertadores", ano, jogos, ORDEM_LIB), "jogos": jogos}
    times.discard("Palmeiras")
    times |= {v for v in NOME_LIB_EDICAO.values()}
    return {"nome": "Libertadores", "fases": ORDEM_LIB, "anos": anos, "times": sorted(times)}


ORDEM_COPA = ["1ª fase", "2ª fase", "3ª fase", "4ª fase", "Oitavas de final", "Quartas de final", "Semifinal", "Final"]
# A fonte numera as rodadas antes das oitavas com uma a mais que a oficial em alguns anos
# (ex.: 2015, Vitória da Conquista foi a 1ª fase e aparece como rodada 2).
DESLOCAMENTO_FASE_COPA = {"2014": 1, "2015": 1}
# Rodada final de cada edição na fonte (2021 está incompleta na fonte: a final seria a 7)
RODADA_FINAL_COPA = {"2021": 7}


def chave_nome(nome):
    import unicodedata
    n = unicodedata.normalize("NFD", nome).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[.\s]+", "", n)


def nomes_canonicos(linhas):
    """A fonte escreve o mesmo clube de vários jeitos ("ABC", "Abc", "A.b.c."): escolhe um."""
    variantes = defaultdict(Counter)
    for x in linhas:
        for bruto in (x["home_team"], x["away_team"]):
            nome, _ = limpar_copa(bruto)
            variantes[chave_nome(nome)][nome] += 1
    canon = {}
    for chave, cont in variantes.items():
        def nota(n):
            sigla = len(chave) <= 4 and " " not in n and n.replace(".", "").isupper()
            acentos = any(ord(c) > 127 for c in n)
            return (sigla, "." not in n, acentos, cont[n])
        melhor = max(cont, key=nota)
        # sigla só se a fonte já escrevia assim ("ABC", "A.b.c."); "Avaí" continua "Avaí"
        if len(chave) <= 4 and " " not in melhor and any(n.isupper() or "." in n for n in cont):
            melhor = melhor.replace(".", "").upper()
        for n in cont:
            canon[n] = melhor
    return canon


def ler_copa(caminho):
    linhas = list(csv.DictReader(open(caminho, encoding="utf-8")))
    canon = nomes_canonicos(linhas)
    final = defaultdict(int)
    for x in linhas:
        final[x["season"]] = max(final[x["season"]], int(x["round"]))
    final.update({k: v for k, v in RODADA_FINAL_COPA.items()})
    times = {}
    por_ano = defaultdict(list)
    vistos = set()
    for x in linhas:
        (casa, uf_casa), (fora, uf_fora) = limpar_copa(x["home_team"]), limpar_copa(x["away_team"])
        casa, fora = canon.get(casa, casa), canon.get(fora, fora)
        times[casa] = times.get(casa) or uf_casa
        times[fora] = times.get(fora) or uf_fora
        if "Palmeiras" not in (casa, fora) or x["home_goal"] == "" or x["away_goal"] == "":
            continue
        ano, data = x["season"], data_iso(x["datetime"])
        if (ano, data, casa, fora) in vistos:
            continue
        vistos.add((ano, data, casa, fora))
        palmeiras_casa = casa == "Palmeiras"
        adv, uf = (fora, uf_fora) if palmeiras_casa else (casa, uf_casa)
        faltam = final[ano] - int(x["round"])
        fase = (["Final", "Semifinal", "Quartas de final", "Oitavas de final"][faltam] if faltam < 4
                else f"{int(x['round']) - DESLOCAMENTO_FASE_COPA.get(ano, 0)}ª fase")
        hg, ag = int(float(x["home_goal"])), int(float(x["away_goal"]))
        gp, gc = (hg, ag) if palmeiras_casa else (ag, hg)
        por_ano[ano].append({"fase": fase, "data": data, "local": "casa" if palmeiras_casa else "fora",
                             "adv": adv, "gp": gp, "gc": gc, "uf": uf})
    anos = {}
    for ano, jogos in sorted(por_ano.items()):
        unificar_fases_mata_mata(jogos)
        marcar_penaltis("copa", ano, jogos)
        jogos.sort(key=lambda j: (ORDEM_COPA.index(j["fase"]), j["data"]))
        anos[ano] = {"resultado": resultado_campanha("copa", ano, jogos, ORDEM_COPA), "jogos": jogos}
    times.pop("Palmeiras", None)
    return {"nome": "Copa do Brasil", "fases": ORDEM_COPA, "anos": anos,
            "times": sorted(times), "ufs": {t: u for t, u in times.items() if u}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("libertadores")
    ap.add_argument("copa")
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--saida", default=os.path.join(raiz, "js", "campanhas.js"))
    args = ap.parse_args()
    dados = {"libertadores": ler_libertadores(args.libertadores), "copa": ler_copa(args.copa)}
    cab = f"""/*
 * Campanhas do Palmeiras — GERADO AUTOMATICAMENTE por tools/importar_campanhas.py em {time.strftime('%Y-%m-%d')}.
 * Fontes (Kaggle): ernestonlm/conmebol-libertadores-results-from-2011-to-2022 (CC0) e
 * ricardomattos05/jogos-do-campeonato-brasileiro (CC BY 4.0). Placares do ponto de vista do Palmeiras
 * (gp = gols do Palmeiras, gc = gols do adversário), sem pênaltis.
 */
"""
    with open(args.saida, "w", encoding="utf-8") as f:
        f.write(cab + "window.CAMPANHAS = " + json.dumps(dados, ensure_ascii=False, indent=1) + ";\n")
    for k, c in dados.items():
        print(c["nome"], {a: (len(v["jogos"]), v["resultado"]) for a, v in c["anos"].items()}, len(c["times"]), "times")


if __name__ == "__main__":
    main()
