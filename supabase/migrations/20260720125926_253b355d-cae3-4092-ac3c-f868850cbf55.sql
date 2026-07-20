-- Allow owners to update their own persona_facts (status transitions, corrections)
grant update on public.persona_facts to authenticated;
create policy persona_facts_owner_update on public.persona_facts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Allow owners to insert their own confirmations (required for sensitive-fact acceptance)
grant insert on public.persona_fact_confirmations to authenticated;
create policy pfc_owner_insert on public.persona_fact_confirmations
  for insert to authenticated
  with check (auth.uid() = confirmed_by);