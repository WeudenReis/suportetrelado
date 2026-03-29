-- Migration V9: Padronizar campo de capa para cover_image_url
-- Renomeia a coluna cover_image para cover_image_url (se necessário)
-- Adiciona a coluna se não existir

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'cover_image_url'
  ) THEN
    ALTER TABLE tickets ADD COLUMN cover_image_url TEXT DEFAULT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'cover_image'
  ) THEN
    UPDATE tickets SET cover_image_url = cover_image WHERE cover_image_url IS NULL;
    ALTER TABLE tickets DROP COLUMN cover_image;
  END IF;
END $$;

-- Confirmar
SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'cover_image_url';