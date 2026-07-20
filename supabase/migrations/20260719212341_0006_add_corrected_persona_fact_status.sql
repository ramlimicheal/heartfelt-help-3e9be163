-- 0006_add_corrected_persona_fact_status.sql
alter type public.persona_fact_status add value if not exists 'corrected';