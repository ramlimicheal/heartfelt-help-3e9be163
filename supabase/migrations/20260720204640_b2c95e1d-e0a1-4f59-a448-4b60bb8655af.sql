
-- Checkpoint 2: session mode-lock (forward-only, non-destructive).
-- Preserves all existing sessions and historical modes.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS mode_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_user_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lock_reason text;

-- Lock the mode on first user message. Runs BEFORE INSERT on messages.
CREATE OR REPLACE FUNCTION public.lock_session_mode_on_first_user_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess public.sessions%ROWTYPE;
BEGIN
  IF NEW.role <> 'user' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO sess FROM public.sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Owner isolation: block cross-user message insertion.
  IF sess.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'sessions: message user_id must match session owner'
      USING ERRCODE = '42501';
  END IF;

  IF sess.mode_locked_at IS NULL THEN
    UPDATE public.sessions
       SET mode_locked_at = now(),
           first_user_message_id = NEW.id,
           lock_reason = 'first_user_message'
     WHERE id = NEW.session_id
       AND mode_locked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_session_mode_on_first_user_message ON public.messages;
CREATE TRIGGER trg_lock_session_mode_on_first_user_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.lock_session_mode_on_first_user_message();

-- Once locked, the session mode is immutable.
CREATE OR REPLACE FUNCTION public.enforce_session_mode_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.mode_locked_at IS NOT NULL
     AND NEW.mode IS DISTINCT FROM OLD.mode THEN
    RAISE EXCEPTION 'sessions: mode is locked after first user message; create a new session instead'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_session_mode_immutable ON public.sessions;
CREATE TRIGGER trg_enforce_session_mode_immutable
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_session_mode_immutable();
