export function formatTimestamp(iat: number): string {
  return new Date(iat * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}
