-- Migration: adicionar coluna cover_thumb_url para thumbnails otimizados
-- Rodar nos dois ambientes (dev e prod)

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cover_thumb_url TEXT;
