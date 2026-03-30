export interface Card {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  cover_image_url?: string;
  is_completed?: boolean;
  is_archived?: boolean;
  created_at?: string;
  assignee?: string | null;
  tags?: string[] | null;
  // ...outros campos existentes...
}
