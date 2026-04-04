# Migrations — Multi-tenancy e Seguranca

## Ordem de execucao (OBRIGATORIA)

Executar **uma por uma**, na ordem, no **Supabase SQL Editor**.
Cada arquivo deve ser copiado inteiro e executado de uma vez.

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `001_organizations_departments.sql` | Cria tabelas `organizations`, `departments`, `org_members` + seed da org padrao |
| 2 | `002_add_department_id.sql` | Adiciona `department_id` em todas as tabelas de negocio e migra dados existentes |
| 3 | `003_rbac_helpers.sql` | Cria funcoes SQL de RBAC (`auth_email`, `get_user_role`, `has_permission`, etc) + tabela `role_permissions` |
| 4 | `004_rls_policies.sql` | Ativa RLS em todas as tabelas e cria policies de isolamento por departamento |
| 5 | `005_indexes.sql` | Cria indexes para performance nas colunas mais consultadas |
| 6 | `006_storage_policies.sql` | Torna o bucket `attachments` privado e configura policies de acesso autenticado |

## Antes de executar

1. **Faca backup** do banco (Supabase Dashboard > Settings > Database > Backups)
2. Execute no ambiente de **DEV/Preview** primeiro
3. Verifique se todos os usuarios existentes tem registro em `user_profiles` (a migration 001 migra automaticamente)

## Depois de executar

1. Verifique no Supabase que as tabelas `organizations`, `departments`, `org_members`, `role_permissions` foram criadas
2. Verifique que todas as tabelas de negocio tem a coluna `department_id` preenchida
3. Verifique que o RLS esta ativo em todas as tabelas (icone de cadeado no Dashboard)
4. Teste login no app — deve funcionar normalmente com o departamento padrao

## IDs padrão (referencia)

- **Org chatPro:** `00000000-0000-0000-0000-000000000001`
- **Dept Suporte Geral:** `00000000-0000-0000-0000-000000000010`

## Troubleshooting

- **"permission denied"**: Certifique-se de estar logado como owner/admin do projeto Supabase
- **"column already exists"**: A migration ja foi executada parcialmente — e seguro re-executar (usa `IF NOT EXISTS`)
- **"table not found"**: Execute as migrations na ordem correta (001 antes de 002, etc)
- **App nao carrega dados apos RLS**: Verifique que o usuario tem registro em `org_members`
