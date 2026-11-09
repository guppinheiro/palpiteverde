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

| Nível   | Jogadores                                        |
|---------|--------------------------------------------------|
| Fácil   | atuaram pelo clube de **2020** em diante         |
| Difícil | atuaram pelo clube de **1970** em diante         |

O critério usa o ano do último jogo (`ultimo`); quem ainda está no elenco (`ultimo: null`) entra nos dois.

## Preferência por jogadores recentes

O sorteio (do Desafio do dia e do Treino ∞) é ponderado pelo tempo desde o último jogo do jogador pelo clube:

| Último jogo        | Peso aprox. |
|--------------------|-------------|
| elenco atual       | 4,5         |
| 2020               | 3,5         |
| 2010               | 1,7         |
| 2000               | 1,0         |
| anos 1970          | 0,6         |

Assim, um jogador atual sai cerca de 7 vezes mais que um dos anos 1970. Para não repetir, os últimos sorteados (até 15, ou metade do nível) ficam bloqueados. A fórmula está na função `peso()` em `js/jogo.js`.

## Rodar localmente

É um site estático, sem build:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Para publicar, basta servir os arquivos (por exemplo, GitHub Pages apontando para a raiz do repositório).

## Editar os jogadores

Todos os dados estão em `js/jogadores.js`. **Os números atuais são aproximados**: revise jogos, gols e anos com uma fonte confiável antes de divulgar.

Ao incluir ou remover jogadores, a ordem do desafio do dia daquele nível muda a partir daquele momento. Os anos de corte dos níveis ficam em `NIVEIS`, no início de `js/jogo.js`.

## Estrutura

```
index.html          página e modais
css/estilo.css      visual (tema claro e escuro)
js/jogadores.js     base de dados
js/jogo.js          regras, sorteio diário, autocompletar, estatísticas
```
