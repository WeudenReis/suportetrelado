-- ============================================================
-- Migration 019: Reações por emoji em comentários
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_reactions_single_per_user UNIQUE (comment_id, user_email),
  CONSTRAINT comment_reactions_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 16)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_department_id ON public.comment_reactions(department_id);

DROP TRIGGER IF EXISTS trg_comment_reactions_updated_at ON public.comment_reactions;
CREATE TRIGGER trg_comment_reactions_updated_at
BEFORE UPDATE ON public.comment_reactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reactions_select" ON public.comment_reactions;
CREATE POLICY "comment_reactions_select"
ON public.comment_reactions
FOR SELECT
USING (
  department_id IN (SELECT visible_department_ids())
);

DROP POLICY IF EXISTS "comment_reactions_insert" ON public.comment_reactions;
CREATE POLICY "comment_reactions_insert"
ON public.comment_reactions
FOR INSERT
WITH CHECK (
  department_id IN (SELECT visible_department_ids())
  AND user_email = auth_email()
);

DROP POLICY IF EXISTS "comment_reactions_update" ON public.comment_reactions;
CREATE POLICY "comment_reactions_update"
ON public.comment_reactions
FOR UPDATE
USING (
  department_id IN (SELECT visible_department_ids())
  AND user_email = auth_email()
)
WITH CHECK (
  department_id IN (SELECT visible_department_ids())
  AND user_email = auth_email()
);

DROP POLICY IF EXISTS "comment_reactions_delete" ON public.comment_reactions;
CREATE POLICY "comment_reactions_delete"
ON public.comment_reactions
FOR DELETE
USING (
  department_id IN (SELECT visible_department_ids())
  AND user_email = auth_email()
);
