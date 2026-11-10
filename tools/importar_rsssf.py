#!/usr/bin/env python3
"""
Lê páginas da RSSSF (Rec.Sport.Soccer Statistics Foundation) já baixadas e extrai as campanhas
do Palmeiras na Libertadores (formato com mata-mata, a partir de 1988) e na Copa do Brasil.
Gera um JSON intermediário usado por tools/importar_campanhas.py.

Uso:
    python3 tools/importar_rsssf.py PASTA_LIB PASTA_COPA SAIDA.json [CLUBE]
      PASTA_LIB/AAAA.html  = https://www.rsssf.org/sacups/copaAA.html (até 2009) ou copaAAAA.html
      PASTA_COPA/AAAA.html = https://www.rsssf.org/tablesb/brazcupAA.html (até 2009) ou brazAAAA.html (#cb)

Convenções da RSSSF usadas aqui:
  - fase de grupos: "Mar  9: Palmeiras - Boca Juniors   6-1" (mandante primeiro);
  - ida e volta: "A [país|(UF)] ... B ... 1-0 0-2": A joga a ida em casa e os DOIS placares estão
    do ponto de vista de A (conferido nas finais da Copa do Brasil de 1996 e 1998);
  - "n/p" = jogo de volta não disputado; pênaltis aparecem como "4-3p", "[2-4 pen]", "(4-3pen)",
    "[1-3 on penalties]" ou "[ Grêmio 7-6 on pen ]".
"""
import html
import json
import re
import sys
import unicodedata

MESES = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
PAISES = {"Bra": "Brasil", "Arg": "Argentina", "Uru": "Uruguai", "Par": "Paraguai", "Chi": "Chile",
          "Col": "Colômbia", "Per": "Peru", "Ecu": "Equador", "Bol": "Bolívia", "Ven": "Venezuela", "Mex": "México"}


def normal(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def texto(caminho, so_copa=False):
    t = open(caminho, encoding="latin1").read()
    if so_copa:  # páginas braz20xx: só a seção da Copa do Brasil
        i = t.find('name="cb"')
        if i < 0:
            return ""
        t = t[i:]
        j = t.find("<h4", 10)
        t = t[:j] if j > 0 else t
    return html.unescape(re.sub(r"<[^>]+>", "", t))


# clube escolhido em main(): palmeiras (padrão) ou corinthians
CLUBE = "palmeiras"
# outros clubes com o mesmo nome que aparecem nas páginas
HOMONIMOS = {"corinthians": ("alagoano", "paranaense", "casuals", "prudente", "(al)", "(pr)")}


def eh_clube(nome):
    n = normal(nome)
    return CLUBE in n and not any(h in n for h in HOMONIMOS.get(CLUBE, ()))


eh_palmeiras = eh_clube  # nome antigo


# ---------------------------------------------------------------- datas
def datas_cabecalho(linha, ano):
    """'(Apr 20 & 27)', '[May 26; May 30]', '[June 14; 19]' -> [iso, iso]. Intervalos ('From Feb 14 to
    Mar 10', 'Jan 20-Feb 10', 'May 5-7; ...') não dizem a data de cada jogo e são ignorados."""
    if not re.search(r"&|;", linha) or re.search(r"from|\bto\b|\d\s*-\s*[A-Za-z]|\d-\d|/", linha, re.I):
        return []
    achados, mes = [], None
    for m in re.finditer(r"([A-Za-z]{3,9})?\.?\s*(\d{1,2})\b", linha):
        nome = (m.group(1) or "").lower()[:3]
        if nome in MESES:
            mes = MESES[nome]
        elif m.group(1):
            continue
        if mes:
            achados.append(f"{ano}-{mes:02d}-{int(m.group(2)):02d}")
    return achados if len(achados) >= 2 else []


def data_ddmm(s, ano):
    d, m = s.split("/")[:2]
    return f"{ano}-{int(m):02d}-{int(d):02d}"


# ---------------------------------------------------------------- pênaltis
def penaltis(resto, a, b):
    """Devolve (gols_a, gols_b) nos pênaltis, ou None."""
    m = re.search(r"\[\s*([^\]\d]+?)\s+(\d+)-(\d+)\s+on pen", resto)
    if m:  # "[ Grêmio 7-6 on pen ]": o time citado venceu
        x, y = int(m.group(2)), int(m.group(3))
        venc = m.group(1).strip()
        return (x, y) if normal(venc)[:5] in normal(a) else (y, x)
    m = re.search(r"(\d+)-(\d+)\s*(?:p\b|pen|on penalties)", resto)
    return (int(m.group(1)), int(m.group(2))) if m else None


# ---------------------------------------------------------------- Libertadores
CAB_LIB = re.compile(r"^\s*(group stage|first stage|first round|second round|second stage|round of 16|"
                     r"eighth[- ]finals|1/8 finals|quarter[- ]?finals|semi[- ]?finals|finals?)\b", re.I)
GRUPO = re.compile(r"^\s*group\s+\d+", re.I)
JOGO_GRUPO = re.compile(r"^\s*([A-Z][a-z]{2})\s+(\d{1,2}):\s+(.+?)\s+-\s+(.+?)\s{2,}(\d+)-(\d+)")
IDA_VOLTA_LIB = re.compile(r"^\s*(.+?)(?:\s{2,}|(?<=\))\s)([A-Z][a-z]{2})\s+(.+?)\s{2,}([A-Z][a-z]{2})\s+(\d+)-(\d+)[a-z]?(?:\s+(\d+)-(\d+)[a-z]?)?(.*)$")
NOME_CIDADE = re.compile(r"\s*\(.*?\)\s*")


def ler_lib(caminho, ano):
    linhas = texto(caminho).split("\n")
    fases, fase, datas, jogos, pais_de = [], None, [], [], {}
    for l in linhas:
        s = l.strip()
        if GRUPO.match(s) and fase not in ("grupos",):
            if "grupos" not in fases:
                fases.append("grupos")
            fase = "grupos"
            continue
        c = CAB_LIB.match(s)
        if c and len(s) < 60:
            nome = c.group(1).lower()
            if nome in ("group stage",):
                fase = "grupos"
                if "grupos" not in fases:
                    fases.append("grupos")
            elif nome in ("first stage", "first round") and "grupos" not in fases:
                fase = "pre"  # fase preliminar antes dos grupos: fica de fora
            else:
                fase = nome
                if fase not in fases:
                    fases.append(fase)
            datas = datas_cabecalho(s, ano)
            continue
        if s.startswith("(") and fase and fase != "grupos":
            d = datas_cabecalho(s, ano)
            if d:
                datas = d
            continue
        if fase == "grupos":
            m = JOGO_GRUPO.match(l)
            if m:
                a, b = NOME_CIDADE.sub(" ", m.group(3)).strip(), NOME_CIDADE.sub(" ", m.group(4)).strip()
                if eh_palmeiras(a) or eh_palmeiras(b):
                    data = f"{ano}-{MESES[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
                    ga, gb = int(m.group(5)), int(m.group(6))
                    casa = eh_palmeiras(a)
                    jogos.append({"fase": "grupos", "data": data, "local": "casa" if casa else "fora",
                                  "adv": b if casa else a, "gp": ga if casa else gb, "gc": gb if casa else ga})
        elif fase and fase != "pre":
            m = IDA_VOLTA_LIB.match(l)
            if m and m.group(2) in PAISES and m.group(4) in PAISES:
                a, b = NOME_CIDADE.sub(" ", m.group(1)).strip(), NOME_CIDADE.sub(" ", m.group(3)).strip()
                pais_de[a], pais_de[b] = PAISES[m.group(2)], PAISES[m.group(4)]
                if not (eh_palmeiras(a) or eh_palmeiras(b)):
                    continue
                pa = eh_palmeiras(a)
                adv = b if pa else a
                pernas = [(int(m.group(5)), int(m.group(6)))]
                if m.group(7) is not None:
                    pernas.append((int(m.group(7)), int(m.group(8))))
                pen = penaltis(m.group(9) or "", a, b)
                for k, (x, y) in enumerate(pernas):
                    casa_a = k == 0  # A joga a ida em casa
                    j = {"fase": fase, "data": datas[k] if len(datas) > k else None,
                         "local": "casa" if casa_a == pa else "fora", "adv": adv,
                         "gp": x if pa else y, "gc": y if pa else x}
                    if pen:
                        j["penaltis"] = "venceu" if (pen[0] > pen[1]) == pa else "perdeu"
                    jogos.append(j)
    # nomes das fases a partir do fim: última = Final, depois Semifinal, Quartas, Oitavas
    mm = [f for f in fases if f != "grupos"]
    rotulo = {"grupos": "Fase de grupos"}
    for k, f in enumerate(reversed(mm)):
        rotulo[f] = ["Final", "Semifinal", "Quartas de final", "Oitavas de final"][k] if k < 4 else f"{len(mm) - k}ª fase"
    for j in jogos:
        j["fase"] = rotulo[j["fase"]]
    for j in jogos:
        j["pais"] = pais_de.get(j["adv"])
    return jogos


# ---------------------------------------------------------------- Copa do Brasil
CAB_COPA = re.compile(r"^\s*(preliminary round|first round|first phase|second round|second phase|third round|"
                      r"third phase|fourth round|1/16 finals|1/8 finals|round of 16|quarter[- ]?finals|"
                      r"semi[- ]?finals|final)\b", re.I)
UF = r"(?:\s*\(([A-Z]{2})\)|-([A-Z]{2})\b)?"
# formato 1992–1999: "A(UF)  0-1 0-4  B(UF)  [pên.]  [datas]"
F1 = re.compile(r"^\s*(\d+ de [A-Z][a-z]+|[^\d\[]+?)" + UF + r"\s*(\d+)-(\d+)(?:\s+(\d+)-(\d+))?\s+(\d+ de [A-Z][a-z]+|[^\d\[]+?)" + UF + r"\s*(\[.*)?$")
# formato 2000–2011: "NN A (UF) - B (UF)   1-0 (dd/mm)   0-2|n/p (dd/mm)  [pên.]"
F2 = re.compile(r"^\s*(?:\d+|[A-Z])?\s+(.+?)" + UF + r"\s+(?:-|x)\s+(.+?)" + UF +
                r"\s+(\d+)-(\d+)\s*\((\d{1,2}/\d{1,2})\)\s*(?:(\d+)-(\d+)|n/p)?\s*(?:\((\d{1,2}/\d{1,2})\))?(.*)$")
# formato 2022+: um jogo por linha, mandante primeiro: "São Paulo   1-0 Palmeiras"
F3 = re.compile(r"^\s*([^\d]+?)\s+(\d+)-(\d+)\s+([^\d]+?)\s*$")


F4 = re.compile(r"^\s*(\d{2})/(\d{2})/(\d{4})\s+([^\d]+?)\s+(\d+)-(\d+)\s+([^\d]+?)\s*$")


def limpar_nome(n):
    return re.sub(r"\s+", " ", n).strip(" -")


def fase_final(fases):
    return next((f for f in reversed(fases) if f == "final"), fases[-1])


def ler_copa(caminho, ano):
    t = texto(caminho, so_copa=ano >= 2010)
    fases, fase, datas, jogos = [], None, [], []
    finais_soltas = []
    linhas = t.split("\n")
    for l in linhas:
        s = l.strip()
        c = CAB_COPA.match(s)
        if c and len(s) < 70 and "table" not in s.lower():
            nome = c.group(1).lower()
            if "1/8" in s or "round of 16" in nome:
                nome = "oitavas"
            # tabela de outra competição antes da Copa (ex.: 2001): recomeça a lista de fases
            if nome.startswith("first") and not jogos and any("preliminary" not in f for f in fases):
                fases = [f for f in fases if "preliminary" in f]
            fase = nome
            if fase not in fases:
                fases.append(fase)
            datas = datas_cabecalho(re.sub(r"from .*", "", s, flags=re.I), ano) if "/" not in s else []
            continue
        if not fase or CLUBE not in normal(l):
            continue
        # final sem linha de confronto, só os jogos com data (ex.: 1995): "14/06/1995 Corinthians 2-1 Grêmio"
        m4 = F4.match(l)
        if m4:
            if not any(j["fase"] == fase for j in jogos):
                finais_soltas.append(m4)
            continue
        m2 = F2.match(l)
        if m2:
            a, ua = limpar_nome(m2.group(1)), m2.group(2) or m2.group(3)
            b, ub = limpar_nome(m2.group(4)), m2.group(5) or m2.group(6)
            pernas = [(int(m2.group(7)), int(m2.group(8)), data_ddmm(m2.group(9), ano))]
            if m2.group(10) is not None:
                pernas.append((int(m2.group(10)), int(m2.group(11)), data_ddmm(m2.group(12), ano) if m2.group(12) else None))
            resto = m2.group(13) or ""
        else:
            m1 = F1.match(l)
            if m1:
                a, ua = limpar_nome(m1.group(1)), m1.group(2) or m1.group(3)
                b, ub = limpar_nome(m1.group(8)), m1.group(9) or m1.group(10)
                resto = m1.group(11) or ""
                d = datas_cabecalho(resto, ano) or datas
                pernas = [(int(m1.group(4)), int(m1.group(5)), d[0] if d else None)]
                if m1.group(6) is not None:
                    pernas.append((int(m1.group(6)), int(m1.group(7)), d[1] if len(d) > 1 else None))
            else:
                m3 = F3.match(l)
                if not m3 or ano < 2012:
                    continue
                a, b = limpar_nome(m3.group(1)), limpar_nome(m3.group(4))
                if not (eh_clube(a) or eh_clube(b)):
                    continue
                pa = eh_palmeiras(a)
                jogos.append({"fase": fase, "data": None, "local": "casa" if pa else "fora", "adv": b if pa else a,
                              "uf": None, "gp": int(m3.group(2)) if pa else int(m3.group(3)),
                              "gc": int(m3.group(3)) if pa else int(m3.group(2))})
                continue
        # homônimo de outro estado (ex.: "Corinthians (AL)" em 2003) não conta
        if eh_clube(a) and ua and ua != "SP":
            a = a + " (" + ua + ")"
        if eh_clube(b) and ub and ub != "SP":
            b = b + " (" + ub + ")"
        if not (eh_clube(a) or eh_clube(b)):  # homônimo (ex.: Corinthians Alagoano)
            continue
        if re.search(r"\d{2}/\d{2}/\d{4}", a):  # linhas de detalhe de final já cobertas pela linha do confronto
            continue
        pa = eh_palmeiras(a)
        adv, uf = (b, ub) if pa else (a, ua)
        pen = penaltis(resto, a, b)
        for k, (x, y, data) in enumerate(pernas):
            casa_a = k == 0
            j = {"fase": fase, "data": data, "local": "casa" if casa_a == pa else "fora", "adv": adv, "uf": uf,
                 "gp": x if pa else y, "gc": y if pa else x}
            if pen:
                j["penaltis"] = "venceu" if (pen[0] > pen[1]) == pa else "perdeu"
            jogos.append(j)
    for m4 in finais_soltas:
        a, b = limpar_nome(m4.group(4)), limpar_nome(m4.group(7))
        if not (eh_clube(a) or eh_clube(b)):
            continue
        pa = eh_clube(a)
        jogos.append({"fase": fase_final(fases), "data": f"{m4.group(3)}-{m4.group(2)}-{m4.group(1)}",
                      "local": "casa" if pa else "fora", "adv": b if pa else a, "uf": None,
                      "gp": int(m4.group(5)) if pa else int(m4.group(6)), "gc": int(m4.group(6)) if pa else int(m4.group(5))})
    rotulo = {f: "Fase preliminar" for f in fases if "preliminary" in f}
    numeradas = [f for f in fases if f not in rotulo]
    if "oitavas" in numeradas and len(numeradas) - numeradas.index("oitavas") < 4:
        # a página termina antes da final (ex.: 2000): as fases seguem a partir das oitavas
        i = numeradas.index("oitavas")
        for k, f in enumerate(numeradas):
            rotulo[f] = f"{k + 1}ª fase" if k < i else ["Oitavas de final", "Quartas de final", "Semifinal", "Final"][k - i]
    else:
        for k, f in enumerate(reversed(numeradas)):
            rotulo[f] = ["Final", "Semifinal", "Quartas de final", "Oitavas de final"][k] if k < 4 else f"{len(numeradas) - k}ª fase"
    for j in jogos:
        j["fase"] = rotulo[j["fase"]]
    return jogos


def main():
    global CLUBE
    pasta_lib, pasta_copa, saida = sys.argv[1:4]
    if len(sys.argv) > 4:  # 4º argumento opcional: clube (padrão: palmeiras)
        CLUBE = sys.argv[4].lower()
    import os
    res = {"libertadores": {}, "copa": {}}
    for arq in sorted(os.listdir(pasta_lib)):
        ano = int(arq[:4])
        if ano >= 1988:
            j = ler_lib(os.path.join(pasta_lib, arq), ano)
            if j:
                res["libertadores"][str(ano)] = j
    for arq in sorted(os.listdir(pasta_copa)):
        ano = int(arq[:4])
        j = ler_copa(os.path.join(pasta_copa, arq), ano)
        if j:
            res["copa"][str(ano)] = j
    json.dump(res, open(saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
