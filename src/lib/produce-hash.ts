/**
 * djb2 hash: converts a produce name to a 7-character hex string.
 */
export function produceHash(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(7, '0').slice(-7);
}

export function produceItemUrl(name: string): string {
  return `/produce?item=${produceHash(name)}&name=${encodeURIComponent(name)}`;
}
