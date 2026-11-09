# Palpite Verde

Jogo de adivinhação: descubra o jogador do Palmeiras em até **10 palpites**.
Projeto de fã, sem ligação oficial com o clube.

## Como jogar

A cada palpite aparece uma ficha que compara o jogador escolhido com o secreto:

| Atributo   | "Perto" quando…                                   |
|------------|---------------------------------------------------|
| Posição    | zagueiro ↔ lateral, meio-campo ↔ atacante         |
| Estreia    | até 5 anos de diferença                           |
| Saída      | até 5 anos (quem ainda está no elenco conta como 2026) |
| Jogos      | até 25 jogos                                      |
| Gols       | até 10 gols                                       |
| Nascimento | mesma região do Brasil, ou os dois estrangeiros   |

Verde = igual, amarelo = perto, cinza = longe. As setas ↑/↓ dizem se o número do jogador secreto é maior ou menor.

## Modos

- **Desafio do dia**: o mesmo jogador para todos, trocado à meia-noite de Brasília. Há um desafio diário para cada nível.
- **Treino ∞ (infinito)**: um jogador atrás do outro, sem fim. Acertou ou errou, aperte Enter (ou "Próximo jogador") e vem o próximo. Dá para **pular** um jogador, mas isso zera a sequência. O placar mostra acertos, sequência atual e recorde, por nível, e continua de onde parou mesmo recarregando a página.
- **Estatísticas**: jogos, % de vitórias, sequência e distribuição de palpites, separadas por nível e salvas no navegador (localStorage).

## Níveis

O nível vale para o Desafio do dia e para o Treino. Ele define quem pode ser sorteado e quem aparece na busca:

| Nível   | Jogadores                                                     |
|---------|---------------------------------------------------------------|
| Fácil   | atuaram pelo clube de **2020** em diante                      |
| Difícil | atuaram pelo clube de **1970** em diante                      |
| Lendas  | **todas as épocas**, incluindo os grandes nomes antes de 1970 |

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

## Rodar localmente

É um site estático, sem build:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Para publicar, basta servir os arquivos (por exemplo, GitHub Pages apontando para a raiz do repositório).

## De onde vêm os jogadores

`js/jogadores.js` é **gerado automaticamente** a partir das fichas da Wikipédia em português. A lista de jogadores junta três fontes:

1. a categoria *Futebolistas da Sociedade Esportiva Palmeiras*;
2. o **Wikidata** (uma consulta só traz todos com passagem pelo clube e artigo em português, inclusive quem falta na categoria, como Prass e Leão); ele também cobre posição, nascimento e jogos quando a ficha não tem;
3. `tools/paginas_extras.txt`, para incluir páginas à mão (ex.: Weverton).

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
