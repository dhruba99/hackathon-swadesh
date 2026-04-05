const CHUNKS_DIRECTORY = "audio-chunks";

async function getChunksDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(CHUNKS_DIRECTORY, { create: true });
}

export async function writeChunk(id: string, blob: Blob): Promise<void> {
  const directory = await getChunksDirectory();
  const fileHandle = await directory.getFileHandle(id, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort();
    throw error;
  }
}

export async function readChunk(id: string): Promise<Blob> {
  const directory = await getChunksDirectory();
  const fileHandle = await directory.getFileHandle(id);
  const file = await fileHandle.getFile();
  return file;
}

export async function deleteChunk(id: string): Promise<void> {
  const directory = await getChunksDirectory();
  await directory.removeEntry(id);
}

export async function listChunks(): Promise<string[]> {
  const directory = await getChunksDirectory();
  const chunkIds: string[] = [];

  for await (const [name] of directory.entries()) {
    chunkIds.push(name);
  }

  return chunkIds.sort((left, right) => left.localeCompare(right));
}
