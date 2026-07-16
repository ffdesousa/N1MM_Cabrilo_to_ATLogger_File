# N1MM Cabrillo to ATLogger

Hotsite simples para converter arquivos Cabrillo gerados por N1MM ou DXLog para o formato `.atl` do ATLogger.

## Aviso

Este projeto é independente e não possui vínculo oficial com o Alfa Tango Group
ou com a plataforma ATLogger.

ATLogger e eventuais marcas relacionadas pertencem aos seus respectivos
titulares. A compatibilidade com o formato ATL não é garantida.

URL publicada:

- `https://n1mm-cabrillo-atlogger.pu9fso.chatgpt.site`

## Como usar

1. Abra `index.html` no navegador.
2. Selecione um arquivo Cabrillo ou cole o texto na area de entrada.
3. Ajuste os campos do ATLogger que nao existem no Cabrillo.
4. Clique em `Converter` e depois baixe o `.atl`.

## Estrutura

- `index.html` - pagina principal.
- `styles.css` - layout e visual.
- `converter.js` - parser e gerador do ATLogger.
- `app.js` - interacao com a interface.
- `exemplos/` - arquivos de referencia Cabrillo e ATLogger.
- `LICENSE` - licenca MIT com aviso de independencia.

## Observacoes

- O conversor foi desenhado para ser simples e funcionar sem backend.
- Os campos `Group`, `Unit`, `Activity`, `Category`, `Name` e `Prog` podem precisar de ajuste manual conforme o seu fluxo no ATLogger.
- Os arquivos de exemplo servem como base para validar a saida gerada.
