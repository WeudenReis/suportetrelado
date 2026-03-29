export interface Card {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  cover_image_url?: string;
  is_completed?: boolean;
  is_archived?: boolean;
  // ...outros campos existentes...
}
