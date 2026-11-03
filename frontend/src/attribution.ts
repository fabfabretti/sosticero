export type Author = { id: string | null; name: string; username: string } | string;
export function authorLabel(author?: Author, detail = false): string {
  if (!author) return 'Autore non disponibile';
  if (typeof author === 'string') return author === 'centrale' ? 'Centrale (account storico)' : author === 'succursale' ? 'Succursale (account storico)' : 'Autore non disponibile';
  return author.name + (detail && author.username ? ` (${author.username})` : '');
}
