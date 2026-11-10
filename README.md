# Palpite Verde

Jogo de adivinhação: descubra o jogador do Palmeiras em até **10 palpites**.
Projeto de fã, sem ligação oficial com o clube.

## Como jogar

A cada palpite aparece uma ficha que compara o jogador escolhido com o secreto:

| Atributo   | "Perto" quando…                                        |
|------------|--------------------------------------------------------|
| Posição    | não tem "perto": acertou ou longe                      |
| Estreia    | até 5 anos de diferença                                |
| Último jogo | até 5 anos (quem ainda está no elenco conta como 2026) |
| Jogos      | até 25 jogos                                           |
| Gols       | até 10 gols                                            |
| Nascimento | outro estado da mesma região; país não tem "perto"     |

Verde = igual, verde-claro = perto, cinza = longe. O campo de nascimento mostra a bandeira do estado ou do país (imagens de domínio público do Wikimedia Commons, em `img/bandeiras/`). As setas ↑/↓ dizem se o número do jogador secreto é maior ou menor.

## Telas

- **Início**: escolhe o modo (Desafio do dia ou Treino ∞) e o nível, e mostra a situação do desafio de hoje e o recorde do treino.
- **Jogo**: a busca, as fichas de dicas e, no fim, o resultado com o **card do resultado**: uma imagem 1080×1350 com o jogador secreto, o resultado, todos os palpites com as cores das dicas, o palpite que chegou mais perto e a sequência. Ela pode ser salva para postar.

## Jogo de campanhas

Na tela inicial, a aba **Campanhas** abre o segundo jogo: escolha a **Libertadores** (da fase de grupos em diante) ou a **Copa do Brasil**, um ano (ou sorteado) e o modo. A campanha do Palmeiras aparece jogo a jogo, com fase, data, mando e uma dica de cada adversário: a bandeira do país (Libertadores) ou o estado (Copa do Brasil). Cada palpite gasta uma chance.

| Modo    | Chances            | Palpite                                                    |
|---------|--------------------|------------------------------------------------------------|
| Normal  | 2 × nº de jogos¹   | o time; revela todos os jogos contra ele                   |
| Difícil | 1,5 × nº de jogos  | o time; revela todos os jogos contra ele                   |
| Extremo | 1,5 × nº de jogos  | time + placar (SEP × RIVAL); revela um jogo por vez        |

¹ Para as chances, os jogos contra o mesmo adversário numa fase contam como um só (ida e volta no mata-mata, casa e fora na fase de grupos). No Extremo, os dois placares do confronto precisam ser acertados.

Os dados estão em `js/campanhas.js`, gerado por `tools/importar_campanhas.py` a partir de dois conjuntos do Kaggle: [ernestonlm/conmebol-libertadores-results-from-2011-to-2022](https://www.kaggle.com/datasets/ernestonlm/conmebol-libertadores-results-from-2011-to-2022) (CC0) e [ricardomattos05/jogos-do-campeonato-brasileiro](https://www.kaggle.com/datasets/ricardomattos05/jogos-do-campeonato-brasileiro) (CC BY 4.0). As edições que faltam no Kaggle vêm da [RSSSF](https://www.rsssf.org) (crédito à RSSSF e aos autores): `tools/baixar_rsssf.sh` baixa as páginas e `tools/importar_rsssf.py` extrai os jogos do Palmeiras; depois, `tools/importar_campanhas.py ... --rsssf arquivo.json` junta tudo. As campanhas de 2025, que ainda não estão na RSSSF, ficam em `tools/campanhas_extras.json` (fonte: artigo "2025 SE Palmeiras season" da Wikipédia em inglês). Cobertura: Libertadores 1994–2025 (só a partir do formato com mata-mata, de 1988) e Copa do Brasil 1992–2025, nas edições disputadas pelo Palmeiras. Alguns jogos antigos não têm data na fonte. O importador remove jogos duplicados, unifica nomes de clubes, corrige a fase dos jogos de ida e marca decisões por pênaltis (que a fonte não traz). Na Copa do Brasil, a numeração das fases antes das oitavas é corrigida nos anos em que a fonte está deslocada (2014 e 2015).

## Modos

- **Desafio do dia**: o mesmo jogador para todos, trocado à meia-noite de Brasília. O desafio #1 foi em 9/11/2026. Há um desafio diário para cada nível.
- **Treino ∞ (infinito)**: um jogador atrás do outro, sem fim. Acertou ou errou, aperte Enter (ou "Próximo jogador") e vem o próximo. Dá para **pular** um jogador, mas isso zera a sequência. O placar mostra acertos, sequência atual e recorde, por nível, e continua de onde parou mesmo recarregando a página.
- **Estatísticas**: jogos, % de vitórias, sequência e distribuição de palpites, separadas por nível e salvas no navegador (localStorage).

## Níveis

O nível vale para o Desafio do dia e para o Treino. Ele define quem pode ser sorteado e quem aparece na busca:

| Nível   | Quem vale                                   | Quem costuma ser sorteado                   |
|---------|---------------------------------------------|---------------------------------------------|
| Fácil   | atuou pelo clube de **1970** em diante      | 95% das vezes, alguém de **2010** em diante |
| Normal  | atuou pelo clube de **1970** em diante      | 75% das vezes, alguém de **2000** em diante |
| Lendas  | **todas as épocas**, inclusive antes de 1970 | qualquer época                              |

O critério usa o ano do último jogo (`ultimo`); quem ainda está no elenco (`ultimo: null`) entra nos dois.

## Preferência por jogadores recentes

O sorteio (do Desafio do dia e do Treino ∞) é ponderado por **época** e por **história no clube**. Jogadores com menos de 10 jogos valem como palpite, mas não são sorteados.

Época (tempo desde o último jogo pelo clube):

| Último jogo        | Peso aprox. |
|--------------------|-------------|
| elenco atual       | 4,5         |
| 2020               | 3,5         |
| 2010               | 1,7         |
| 2000               | 1,0         |
| anos 1970          | 0,6         |

Assim, um jogador atual sai cerca de 7 vezes mais que um dos anos 1970. Esse peso é multiplicado pela história no clube: 200 jogos ou mais = 1; 50 jogos = 0,5; 10 jogos ≈ 0,22. Para não repetir, os últimos sorteados (até 15, ou metade do nível) ficam bloqueados. A fórmula está na função `peso()` em `js/jogo.js`.

## Redefinir o desafio do dia

Para trocar, de forma extraordinária, o jogador de um dia (em todos os níveis), acrescente o número do desafio em `REDEFINICOES`, no `js/jogo.js` (ex.: `{ 1: 1 }`; use 2 para redefinir de novo no mesmo dia). O sorteio desse dia passa a usar outra semente, evita o jogador anterior, e o progresso salvo da versão antiga é descartado. Quem já tinha jogado naquele dia joga de novo sem perder nem ganhar sequência.

Se a base de jogadores mudar no meio de um dia, o sorteio daquele dia pode trocar de jogador. Para evitar, fixe o jogador do dia em `FIXADOS`, no `js/jogo.js` (número do desafio → nível → nome).

## Rodar localmente

É um site estático, sem build:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Publicação (GitHub Pages)

O workflow `.github/workflows/pages.yml` publica o site a cada push (só `index.html`, `css/`, `js/` e `img/`). Para ligar, uma única vez: no GitHub, **Settings → Pages → Build and deployment → Source: GitHub Actions**. O endereço fica `https://guppinheiro.github.io/palpiteverde/`. Em repositório privado, o GitHub Pages exige plano pago; a alternativa gratuita é conectar o repositório ao Netlify ou ao Cloudflare Pages (sem comando de build, pasta raiz).

## De onde vêm os jogadores

`js/jogadores.js` é **gerado automaticamente** a partir das fichas da Wikipédia em português. A lista de jogadores junta três fontes:

1. a categoria *Futebolistas da Sociedade Esportiva Palmeiras*;
2. o **Wikidata** (uma consulta só traz todos com passagem pelo clube e artigo em português, inclusive quem falta na categoria, como Prass e Leão); ele também cobre posição, nascimento e jogos quando a ficha não tem;
3. `tools/paginas_extras.txt`, para incluir páginas à mão (ex.: Weverton).
4. `tools/jogadores_extras.json`, para jogadores sem artigo nem registro no Wikidata, com a fonte de cada um (ex.: Naves, tirado do conjunto Sofascore/Transfermarkt do Kaggle). Só entram se o nome ainda não existir na base.

```bash
python3 tools/importar_wikipedia.py
```

O script soma todas as passagens de cada jogador pelo Palmeiras (anos, jogos e gols) e lê a posição e o local de nascimento. A API da Wikipédia limita as requisições, então ele vai devagar e guarda as respostas em `.cache-wikipedia/`: se for interrompido, é só rodar de novo.

Regras da importação:
- jogadores sem jogos pelo Palmeiras na ficha ficam de fora (o jogo precisa desses números);
- antes de 1970, só entram jogadores com 100 jogos ou mais pelo clube (as "lendas");
- se a ficha não informar o local de nascimento, o jogo mostra "?" nesse campo.

Limites: só entram jogadores que têm artigo na Wikipédia, e os números são os das fichas, que podem estar desatualizados.

### Corrigir um jogador

Não edite `js/jogadores.js` à mão (ele é sobrescrito). Use `tools/correcoes.json`, com o título da página na Wikipédia como chave:

```json
{
  "Marcos Roberto Silveira Reis": { "jogos": 532 },
  "Título de uma página para excluir": null
}
```

Depois, rode o importador de novo (com o cache, leva segundos).

Ao incluir ou remover jogadores, a ordem do desafio do dia daquele nível muda a partir daquele momento. Os anos de corte dos níveis ficam em `NIVEIS`, no início de `js/jogo.js`.

## Estrutura

```
index.html          página e modais
css/estilo.css      visual (tema claro e escuro)
js/jogadores.js     base de dados
js/jogo.js          regras, sorteio diário, autocompletar, estatísticas
```
