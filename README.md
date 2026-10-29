# Almanaque da Primeira Divisão

Incumbências da divisão e o guia **Bem-vindo a Bordo** para militares recém-chegados, em um app instalável no celular que funciona sem internet.

## O que o app faz

- **Bem-vindo a Bordo:** módulos de estudo para quem acabou de embarcar. O primeiro é **Controle de Avarias** (ramais e sensores do CCM, armários do CAv, recursos do armário 1.3, equipamentos portáteis, turmas, investigador e o passo a passo do investigador para marcar).
- **Incumbências (só o encarregado):** cada local da divisão com seus itens e medidas (comprimento, espessura, carga, tinta…), editáveis pelo celular, com busca e percentual preenchido.
- **Equipe:** quem cria conta fica aguardando; o encarregado libera ou remove o acesso.
- **Sem internet:** depois do primeiro login o conteúdo fica no aparelho; edições feitas offline são enviadas quando a conexão volta. Ao sair da conta, o conteúdo é apagado do aparelho.

## Onde fica o conteúdo

Nenhum conteúdo da divisão está neste repositório. Tudo fica no Supabase, protegido por RLS:

- `alm_members`: quem tem conta, se está liberado e se é encarregado.
- `alm_content`: documentos JSON (`bemvindo` para todos os liberados, `incumbencias` só para o encarregado).

## Estrutura

- `index.html`: o app inteiro.
- `manifest.webmanifest`, `sw.js`, `icons/`: instalação e modo offline.
- `vendor/supabase.js`: cliente do Supabase (v2.45.4).
- `supabase/schema.sql`: tabelas, funções e políticas de acesso.
