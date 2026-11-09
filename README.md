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

- **Desafio do dia**: o mesmo jogador para todos, trocado à meia-noite de Brasília. Sorteado entre os jogadores com `facil: true`.
- **Treino**: jogador aleatório, quantas vezes quiser. No nível fácil só aparecem os mais conhecidos; no difícil, todos.
- **Estatísticas**: jogos, % de vitórias, sequência e distribuição de palpites, salvas no navegador (localStorage).

## Rodar localmente

É um site estático, sem build:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Para publicar, basta servir os arquivos (por exemplo, GitHub Pages apontando para a raiz do repositório).

## Editar os jogadores

Todos os dados estão em `js/jogadores.js`. **Os números atuais são aproximados**: revise jogos, gols e anos com uma fonte confiável antes de divulgar.

Ao incluir ou remover jogadores com `facil: true`, a ordem do desafio do dia muda a partir daquele momento.

## Estrutura

```
index.html          página e modais
css/estilo.css      visual (tema claro e escuro)
js/jogadores.js     base de dados
js/jogo.js          regras, sorteio diário, autocompletar, estatísticas
```
