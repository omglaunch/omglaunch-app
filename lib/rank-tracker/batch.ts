/** Split an array into fixed-size chunks for DataForSEO bulk limits. */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}
