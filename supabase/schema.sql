-- Almanaque da Primeira Divisão: membros aprovados e conteúdo protegido.
-- O conteúdo (Bem-vindo a Bordo, incumbências) fica só no banco, nunca no código público.

create table if not exists public.alm_members (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  email text,
  nome text check (char_length(nome) <= 60),
  role text not null default 'militar' check (role in ('admin', 'militar')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.alm_content (
  key text primary key check (char_length(key) between 1 and 80),
  audience text not null default 'todos' check (audience in ('todos', 'admin')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.alm_members enable row level security;
alter table public.alm_content enable row level security;

create or replace function public.alm_is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.alm_members where user_id = (select auth.uid()) and approved);
$$;
create or replace function public.alm_is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.alm_members where user_id = (select auth.uid()) and approved and role = 'admin');
$$;
revoke all on function public.alm_is_member() from public, anon;
revoke all on function public.alm_is_admin() from public, anon;
grant execute on function public.alm_is_member() to authenticated;
grant execute on function public.alm_is_admin() to authenticated;

-- Membros: cada um vê o próprio cadastro; quem chega pede acesso (sempre pendente); o admin aprova.
create policy "alm ver o próprio cadastro ou admin" on public.alm_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.alm_is_admin()));
create policy "alm pedir acesso" on public.alm_members for insert to authenticated
  with check (user_id = (select auth.uid()) and approved = false and role = 'militar');
create policy "alm admin altera membros" on public.alm_members for update to authenticated
  using ((select public.alm_is_admin())) with check ((select public.alm_is_admin()));
create policy "alm admin remove membros" on public.alm_members for delete to authenticated
  using ((select public.alm_is_admin()) and user_id <> (select auth.uid()));

-- Conteúdo: membros aprovados leem o que é para todos; o admin lê e edita tudo.
create policy "alm ler conteúdo" on public.alm_content for select to authenticated
  using ((audience = 'todos' and (select public.alm_is_member())) or (select public.alm_is_admin()));
create policy "alm admin cria conteúdo" on public.alm_content for insert to authenticated
  with check ((select public.alm_is_admin()));
create policy "alm admin altera conteúdo" on public.alm_content for update to authenticated
  using ((select public.alm_is_admin())) with check ((select public.alm_is_admin()));
create policy "alm admin apaga conteúdo" on public.alm_content for delete to authenticated
  using ((select public.alm_is_admin()));

create or replace function public.alm_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end; $$;
create trigger alm_content_touch before update on public.alm_content for each row execute function public.alm_touch();

revoke all on public.alm_members, public.alm_content from anon;
grant select, insert, update, delete on public.alm_members, public.alm_content to authenticated;

-- Depois de criar sua conta no app, torne-se administrador (troque o e-mail):
-- update public.alm_members set role = 'admin', approved = true where email = 'seu@email.com';

-- Cada militar pode trocar o próprio nome de guerra sem mexer no acesso.
create or replace function public.alm_set_nome(novo text) returns void language sql security definer set search_path = '' as $$
  update public.alm_members set nome = left(trim(novo), 40) where user_id = (select auth.uid());
$$;
revoke all on function public.alm_set_nome(text) from public, anon;
grant execute on function public.alm_set_nome(text) to authenticated;
