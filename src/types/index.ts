export interface Card {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  cover_image_url?: string;
  cover_thumb_url?: string;
  is_completed?: boolean;
  is_archived?: boolean;
  created_at?: string;
  assignee?: string | null;
  tags?: string[] | null;
  observacao?: string | null;
  attachment_count?: number;
  // ...outros campos existentes...
}
