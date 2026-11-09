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
- **Treino**: jogador aleatório, quantas vezes quiser.
- **Estatísticas**: jogos, % de vitórias, sequência e distribuição de palpites, separadas por nível e salvas no navegador (localStorage).

## Níveis

O nível vale para o Desafio do dia e para o Treino. Ele define quem pode ser sorteado e quem aparece na busca:

| Nível   | Jogadores                                        |
|---------|--------------------------------------------------|
| Fácil   | atuaram pelo clube de **2020** em diante         |
| Difícil | atuaram pelo clube de **1970** em diante         |

O critério usa o ano do último jogo (`ultimo`); quem ainda está no elenco (`ultimo: null`) entra nos dois.

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
