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
ORDEM_FASES = ["Fase preliminar", "1ª fase", "2ª fase", "3ª fase", "4ª fase", "Fase de grupos",
               "Oitavas de final", "Quartas de final", "Semifinal", "Final"]

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
    "Universitario": "Universitario de Sucre",  # 2015: o boliviano (o peruano é "Universitario de Deportes")
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
    # adversários de 1994–2009 (RSSSF)
    "Cruzeiro": "Brasil", "Vélez Sarsfield": "Argentina", "El Nacional": "Equador", "Corinthians": "Brasil",
    "Olimpia": "Paraguai", "Vasco da Gama": "Brasil", "Deportivo Cali": "Colômbia", "The Strongest": "Bolívia",
    "Juventude": "Brasil", "Atlas": "México", "Universidad de Chile": "Chile", "Sport Boys": "Peru",
    "São Caetano": "Brasil", "Santo André": "Brasil", "Atlético Nacional": "Colômbia", "LDU Quito": "Equador",
    "Sport": "Brasil",
}
# adversários do Corinthians
PAIS_LIB.update({
    "Universidad Católica": "Chile", "Fénix": "Uruguai", "Racing (URU)": "Uruguai",
    "Independiente Medellín": "Colômbia", "San José": "Bolívia", "Millonarios": "Colômbia",
    "Danubio": "Uruguai", "Cobresal": "Chile", "Independiente Santa Fe": "Colômbia",
    "América": "México", "Tigres UANL": "México", "Cruz Azul": "México", "Espoli": "Equador",
    "Nacional Asunción": "Paraguai", "San José de Oruro": "Bolívia", "Santa Fe": "Colômbia",
    "Deportivo Lara": "Venezuela", "Always Ready": "Bolívia", "Argentinos Juniors": "Argentina",
})
# Mesmo nome, clube de outro país em certa edição
PAIS_LIB_EDICAO = {("River Plate", "2016"): "Uruguai"}
NOME_LIB_EDICAO = {("River Plate", "2016"): "River Plate (URU)"}
EDICAO_CLUBE = {
    "palmeiras": ({("River Plate", "2016"): "Uruguai"}, {("River Plate", "2016"): "River Plate (URU)"}),
    "corinthians": ({("Racing", "2010"): "Uruguai", ("Independiente", "2023"): "Equador"},
                    {("Racing", "2010"): "Racing (URU)", ("Independiente", "2023"): "Independiente del Valle"}),
}

# Nomes da RSSSF -> nomes usados no jogo
ALIAS_RSSSF_LIB = {"Univ. Católica": "Universidad Católica", "Univ. de Chile": "Universidad de Chile",
                   "Indep. Medellín": "Independiente Medellín", "Indep. Santa Fe": "Independiente Santa Fe",
                   "Universitario": "Universitario de Deportes", "São Paulo FC": "São Paulo", "Santo Andre": "Santo André", "LDU": "LDU Quito",
                   "Barcelona": "Barcelona SC", "CA Mineiro": "Atlético Mineiro", "Deportivo Pereira FC": "Deportivo Pereira"}
ALIAS_RSSSF_COPA = {  # (nome, UF) -> nome; UF None = qualquer
    ("Sampaio Correa", None): "Sampaio Corrêa", ("Atlético", "PR"): "Athletico Paranaense",
    ("Atlético", "GO"): "Atlético Goianiense", ("Atletico", "MG"): "Atlético Mineiro", ("Atlético", "MG"): "Atlético Mineiro",
    ("Ceara", None): "Ceará", ("Parana", None): "Paraná", ("Flamengo", "PI"): "Flamengo-PI", ("River", "PI"): "River-PI",
    ("Botafogo", "PB"): "Botafogo-PB", ("América", "MG"): "América Mineiro", ("Operário", "MT"): "Operário-MT",
    ("Comercial", "PI"): "Comercial-PI", ("Central", None): "Central", ("Gremio", None): "Grêmio",
    ("Vasco", None): "Vasco da Gama", ("Atletico", "PR"): "Athletico Paranaense", ("Sampaio Correa", "MA"): "Sampaio Corrêa",
}
UF_COPA = {  # estado dos adversários quando a RSSSF não informa
    "Sergipe": "SE", "Paraná": "PR", "Grêmio": "RS", "Cruzeiro": "MG", "Coritiba": "PR", "Ceará": "CE",
    "Flamengo": "RJ", "Criciúma": "SC", "Vitória": "BA", "São Gabriel": "RS", "Goiás": "GO", "Santo André": "SP",
    "Ipatinga": "MG", "Central": "PE", "Sport": "PE", "Paysandu": "PA", "Uberaba": "MG", "São Paulo": "SP",
    "Fortaleza": "CE", "Sampaio Corrêa": "MA", "Avaí": "SC", "Internacional": "RS", "Fluminense": "RJ",
    "Santos": "SP", "Bahia": "BA", "Athletico Paranaense": "PR", "Atlético Mineiro": "MG", "Atlético Goianiense": "GO",
    # adversários do Corinthians
    "ABC": "RN", "Remo": "PA", "Mixto": "MT", "Goiânia": "GO", "Ponte Preta": "SP", "Americano": "RJ",
    "Brasiliense": "DF", "Ferroviário": "CE", "Cianorte": "PR", "Figueirense": "SC", "Náutico": "PE",
    "Treze": "PB", "Botafogo": "RJ", "São Caetano": "SP", "Vasco da Gama": "RJ", "Juventude": "RS",
}
# Confrontos cuja fase a página da RSSSF não deixa clara
FASE_RSSSF = {  # (também vale para tools/campanhas_extras.json)
    ("copa", "2000", "ABC"): "Oitavas de final", ("copa", "2000", "São Paulo"): "Quartas de final",
    ("copa", "2002", "ASA"): "1ª fase"}
FASE_RSSSF_COR = {("copa", "2002", "River-PI"): "1ª fase", ("copa", "2002", "Americano"): "2ª fase",
                  ("copa", "2009", "Misto"): "2ª fase", ("copa", "2009", "Athletico Paranaense"): "Oitavas de final",
                  ("copa", "2009", "Fluminense"): "Quartas de final"}

# Campeões e decisões por pênaltis (a fonte não traz pênaltis)
CAMPEAO = {"libertadores": {"1999", "2020", "2021"}, "copa": {"1998", "2012", "2015", "2020"}}
CAMPEAO_COR = {"libertadores": {"2012"}, "copa": {"1995", "2002", "2009", "2025"}}
# Clube do jogo: escolhido em main() com --clube
CLUBE = "Palmeiras"
PENALTIS = {  # (competição, ano, adversário) -> "venceu" | "perdeu"  (só para os dados do Kaggle)
    ("libertadores", "2017", "Barcelona SC"): "perdeu",
    ("libertadores", "2022", "Atlético Mineiro"): "venceu",
    ("libertadores", "2023", "Boca Juniors"): "perdeu",
    ("copa", "2015", "Santos"): "venceu",
    ("copa", "2019", "Internacional"): "perdeu",
    ("copa", "2021", "CRB"): "perdeu",
}
PENALTIS_COR = {}  # Corinthians: os pênaltis dos anos do Kaggle vêm da RSSSF (copiar_penaltis)

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
    if ultima.endswith("ª fase") or ultima == "Fase preliminar":
        return f"Caiu na {ultima.lower() if ultima == 'Fase preliminar' else ultima}"
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
        if CLUBE not in (casa, fora):
            continue
        ano, data = x["Edition"], data_iso(x["Date"])
        if x["Round"] not in FASES_LIB and not x["Round"].startswith("Group"):
            continue  # fases preliminares ficam de fora (o jogo começa na fase de grupos)
        chave = (ano, data, casa, fora)
        if chave in vistos:
            continue
        vistos.add(chave)
        palmeiras_casa = casa == CLUBE
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
    times.discard(CLUBE)
    times |= {v for v in NOME_LIB_EDICAO.values()}
    return {"nome": "Libertadores", "fases": ORDEM_LIB, "anos": anos, "times": sorted(times)}


ORDEM_COPA = ["Fase preliminar", "1ª fase", "2ª fase", "3ª fase", "4ª fase", "Oitavas de final", "Quartas de final", "Semifinal", "Final"]
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
        if CLUBE not in (casa, fora) or x["home_goal"] == "" or x["away_goal"] == "":
            continue
        ano, data = x["season"], data_iso(x["datetime"])
        if (ano, data, casa, fora) in vistos:
            continue
        vistos.add((ano, data, casa, fora))
        palmeiras_casa = casa == CLUBE
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
    times.pop(CLUBE, None)
    return {"nome": "Copa do Brasil", "fases": ORDEM_COPA, "anos": anos,
            "times": sorted(times), "ufs": {t: u for t, u in times.items() if u}}


def copiar_penaltis(destino, rsssf):
    """Nos anos do Kaggle (sem pênaltis), usa a marcação da RSSSF do mesmo confronto (só fora do Palmeiras,
    que tem a lista PENALTIS conferida à mão)."""
    if CLUBE == "Palmeiras":
        return
    pens = {}
    for j in rsssf:
        if j.get("penaltis"):
            pens[chave_nome(ALIAS_RSSSF_LIB.get(j["adv"], j["adv"]).split("/")[0])[:6]] = j["penaltis"]
    for j in destino:
        p = pens.get(chave_nome(j["adv"])[:6])
        if p and j["fase"] != "Fase de grupos":
            j["penaltis"] = p


def acertar_penaltis(dados):
    """Fora do Palmeiras (lista PENALTIS conferida à mão), o lado vencedor dos pênaltis sai da própria
    campanha: se o clube seguiu para outra fase (ou foi campeão), venceu; se parou ali, perdeu."""
    if CLUBE == "Palmeiras":
        return
    for comp in dados.values():
        ordem = comp["fases"]
        for camp in comp["anos"].values():
            ultima = max(ordem.index(j["fase"]) for j in camp["jogos"])
            for j in camp["jogos"]:
                if j.get("penaltis"):
                    seguiu = ordem.index(j["fase"]) < ultima or camp["resultado"] == "Campeão"
                    j["penaltis"] = "venceu" if seguiu else "perdeu"


def juntar_rsssf(dados, caminho):
    """Acrescenta as edições que só existem na RSSSF (as do Kaggle têm prioridade)."""
    rs = json.load(open(caminho, encoding="utf-8"))
    fonte = "RSSSF" if "_fonte" not in rs else rs["_fonte"]
    for comp, ordem in (("libertadores", ORDEM_LIB), ("copa", ORDEM_COPA)):
        destino = dados[comp]
        for ano, jogos in rs.get(comp, {}).items():
            if ano in destino["anos"] and rs.get("_substitui"):
                del destino["anos"][ano]  # fonte mais completa para esta edição
            if ano in destino["anos"]:
                copiar_penaltis(destino["anos"][ano]["jogos"], jogos)
                continue
            if comp == "libertadores" and int(ano) < 1988:
                continue
            if comp == "libertadores" and CLUBE != "Palmeiras" and not any(j["fase"] == "grupos" or j["fase"] == "Fase de grupos" for j in jogos):
                continue  # só o mata-mata na fonte: campanha incompleta
            novos = []
            for j in jogos:
                j = dict(j)
                if comp == "libertadores":
                    j["adv"] = ALIAS_RSSSF_LIB.get(j["adv"], j["adv"])
                    j["pais"] = PAIS_LIB_EDICAO.get((j["adv"], ano)) or j.get("pais") or PAIS_LIB.get(j["adv"])
                    j["adv"] = NOME_LIB_EDICAO.get((j["adv"], ano), j["adv"])
                    if not j["pais"]:
                        raise SystemExit(f"País desconhecido: {j['adv']} ({ano})")
                    j.pop("uf", None)
                else:
                    uf = j.get("uf")
                    m = re.match(r"^(.*)/([A-Z]{2})$", j["adv"])
                    if m:  # formato 2022+: "Atlético/GO"
                        j["adv"], uf = m.group(1), m.group(2)
                        j["adv"] = {"Athletico": "Athletico Paranaense"}.get(j["adv"], j["adv"])
                    j["adv"] = ALIAS_RSSSF_COPA.get((j["adv"], uf), ALIAS_RSSSF_COPA.get((j["adv"], None), j["adv"]))
                    j["uf"] = uf or UF_COPA.get(j["adv"]) or destino.get("ufs", {}).get(j["adv"])
                    if not j["uf"]:
                        raise SystemExit(f"Estado desconhecido: {j['adv']} ({ano})")
                    j.pop("pais", None)
                j["fase"] = FASE_RSSSF.get((comp, ano, j["adv"]), j["fase"])
                if not j.get("data"):
                    j["data"] = None
                novos.append(j)
            # pênaltis marcados num jogo valem para o confronto todo
            for j in novos:
                if j.get("penaltis"):
                    for k in novos:
                        if k["adv"] == j["adv"] and k["fase"] == j["fase"]:
                            k["penaltis"] = j["penaltis"]
            # ordem: fase, depois data (sem data, mantém a ordem da fonte: ida antes da volta)
            novos = [dict(j, _k=k) for k, j in enumerate(novos)]
            novos.sort(key=lambda j: (ordem.index(j["fase"]), j["data"] or "", j["_k"]))
            for j in novos:
                j.pop("_k")
            destino["anos"][ano] = {"resultado": resultado_campanha(comp, ano, novos, ordem), "jogos": novos,
                                    "fonte": fonte}
            for j in novos:
                if j["adv"] not in destino["times"]:
                    destino["times"].append(j["adv"])
                if comp == "copa":
                    destino.setdefault("ufs", {})[j["adv"]] = j["uf"]
        destino["anos"] = dict(sorted(destino["anos"].items()))
        destino["times"] = sorted(set(destino["times"]))
        usadas = {j["fase"] for a in destino["anos"].values() for j in a["jogos"]}
        destino["fases"] = [f for f in ORDEM_FASES if f in usadas]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("libertadores")
    ap.add_argument("copa")
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--clube", default="palmeiras", choices=["palmeiras", "corinthians"])
    ap.add_argument("--saida", default=None)
    ap.add_argument("--rsssf", help="JSON gerado por tools/importar_rsssf.py (edições mais antigas e recentes)")
    args = ap.parse_args()
    global CLUBE, CAMPEAO, PENALTIS, PAIS_LIB_EDICAO, NOME_LIB_EDICAO
    pasta = "" if args.clube == "palmeiras" else args.clube
    if args.clube == "corinthians":
        CLUBE, CAMPEAO, PENALTIS = "Corinthians", CAMPEAO_COR, PENALTIS_COR
        FASE_RSSSF.clear(); FASE_RSSSF.update(FASE_RSSSF_COR)
    PAIS_LIB_EDICAO, NOME_LIB_EDICAO = EDICAO_CLUBE[args.clube]
    args.saida = args.saida or os.path.join(raiz, pasta, "js", "campanhas.js")
    dados = {"libertadores": ler_libertadores(args.libertadores), "copa": ler_copa(args.copa)}
    if args.rsssf:
        juntar_rsssf(dados, args.rsssf)
    # campanhas acrescentadas à mão a partir de outras fontes (ex.: 2025, ainda fora da RSSSF)
    extras = os.path.join(raiz, "tools", pasta, "campanhas_extras.json")
    if os.path.exists(extras):
        juntar_rsssf(dados, extras)
    acertar_penaltis(dados)
    cab = f"""/*
 * Campanhas do {CLUBE} — GERADO AUTOMATICAMENTE por tools/importar_campanhas.py em {time.strftime('%Y-%m-%d')}.
 * Fontes: Kaggle ernestonlm/conmebol-libertadores-results-from-2011-to-2022 (CC0) e
 * ricardomattos05/jogos-do-campeonato-brasileiro (CC BY 4.0); edições sem dados no Kaggle: RSSSF
 * (www.rsssf.org, com crédito à RSSSF e aos autores). Placares do ponto de vista do {CLUBE}
 * (gp = gols do {CLUBE}, gc = gols do adversário), sem pênaltis.
 */
"""
    with open(args.saida, "w", encoding="utf-8") as f:
        f.write(cab + "window.CAMPANHAS = " + json.dumps(dados, ensure_ascii=False, indent=1) + ";\n")
    for k, c in dados.items():
        print(c["nome"], {a: (len(v["jogos"]), v["resultado"]) for a, v in c["anos"].items()}, len(c["times"]), "times")


if __name__ == "__main__":
    main()
