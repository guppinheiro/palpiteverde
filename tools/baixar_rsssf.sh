#!/usr/bin/env bash
# Baixa as páginas da RSSSF usadas por tools/importar_rsssf.py (com pausa entre pedidos).
# Uso: tools/baixar_rsssf.sh PASTA   (cria PASTA/lib e PASTA/copa)
set -euo pipefail
P="${1:?informe a pasta de destino}"; mkdir -p "$P/lib" "$P/copa"
UA="PalpiteVerdeImporter/1.0 (fan game data import; low volume)"
for a in $(seq 1988 2024); do
  if [ "$a" -lt 2010 ]; then u="sacups/copa${a:2:2}.html"; else u="sacups/copa$a.html"; fi
  [ -s "$P/lib/$a.html" ] || { curl -fsS -A "$UA" -o "$P/lib/$a.html" "https://www.rsssf.org/$u" || rm -f "$P/lib/$a.html"; sleep 2; }
done
for a in $(seq 1989 2025); do
  if [ "$a" -lt 2010 ]; then u="tablesb/brazcup${a:2:2}.html"; else u="tablesb/braz$a.html"; fi
  [ -s "$P/copa/$a.html" ] || { curl -fsS -A "$UA" -o "$P/copa/$a.html" "https://www.rsssf.org/$u" || rm -f "$P/copa/$a.html"; sleep 2; }
done
