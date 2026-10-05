// One file of kuromoji's dictionary, fetched. The files are gzip; a server may also send them with Content-Encoding:
// gzip (astro preview, vite preview), and then the browser has already unpacked them. None of the unpacked files starts
// with gzip's two magic bytes, so the bytes say which one arrived.

const isGzip = (bytes: Uint8Array): boolean => bytes[0] === 0x1f && bytes[1] === 0x8b;

const gunzip = async (bytes: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> =>
  new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();

export const unpacked = async (bytes: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> => (isGzip(bytes) ? gunzip(bytes) : bytes.buffer);

export const dictionaryBytes = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${String(response.status)} ${response.statusText}`);
  return unpacked(new Uint8Array(await response.arrayBuffer()));
};
