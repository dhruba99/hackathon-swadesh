/// <reference lib="webworker" />

import { deleteChunk, listChunks, readChunk, writeChunk } from "../lib/opfs";
import { UploadQueue, type QueueItem } from "../lib/queue";
import { UploadError, uploadChunk } from "../lib/uploader";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const MAX_RETRIES = 5;
const MAX_CONCURRENCY = 3;
const DEFAULT_ENDPOINT = "/api/upload";

interface EnqueueChunkMessage {
  type: "enqueue";
  sessionId: string;
  chunkIndex: number;
  checksum: string;
  blob: Blob;
}

interface ConfigureMessage {
  type: "configure";
  endpoint: string;
}

type WorkerInboundMessage = EnqueueChunkMessage | ConfigureMessage;

type WorkerOutboundMessage =
  | {
      type: "stored";
      chunkId: string;
      chunkIndex: number;
    }
  | {
      type: "uploaded";
      chunkId: string;
      chunkIndex: number;
      duplicate: boolean;
    }
  | {
      type: "retry-scheduled";
      chunkId: string;
      chunkIndex: number;
      retryCount: number;
      delayMs: number;
    }
  | {
      type: "error";
      chunkId: string;
      chunkIndex: number;
      retryable: boolean;
      message: string;
    }
  | {
      type: "restored";
      chunkCount: number;
    };

interface ChunkDescriptor {
  id: string;
  sessionId: string;
  chunkIndex: number;
  checksum: string;
}

const queue = new UploadQueue(MAX_CONCURRENCY);
let uploadEndpoint = DEFAULT_ENDPOINT;
let scheduledTimer: number | null = null;
let restoringPromise: Promise<void> | null = null;

function postMessageToClient(message: WorkerOutboundMessage): void {
  ctx.postMessage(message);
}

function encodeChunkId(
  sessionId: string,
  chunkIndex: number,
  checksum: string,
): string {
  return `${encodeURIComponent(sessionId)}__${chunkIndex}__${checksum}.webm`;
}

function decodeChunkId(id: string): ChunkDescriptor | null {
  const withoutExtension = id.endsWith(".webm") ? id.slice(0, -5) : id;
  const segments = withoutExtension.split("__");

  if (segments.length !== 3) {
    return null;
  }

  const [encodedSessionId, rawChunkIndex, checksum] = segments;
  const chunkIndex = Number(rawChunkIndex);

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return null;
  }

  if (!/^[a-f0-9]{64}$/u.test(checksum)) {
    return null;
  }

  return {
    id,
    sessionId: decodeURIComponent(encodedSessionId),
    chunkIndex,
    checksum,
  };
}

function enqueueDescriptor(
  descriptor: ChunkDescriptor,
  retryCount?: number,
  nextAttemptAt?: number,
): QueueItem {
  return queue.upsert({
    ...descriptor,
    retryCount,
    nextAttemptAt,
  });
}

function schedulePump(delayMs: number): void {
  if (scheduledTimer !== null) {
    clearTimeout(scheduledTimer);
  }

  scheduledTimer = ctx.setTimeout(() => {
    scheduledTimer = null;
    void pumpQueue();
  }, delayMs);
}

async function restorePendingChunks(): Promise<void> {
  const chunkIds = await listChunks();
  let restoredCount = 0;

  for (const chunkId of chunkIds) {
    const descriptor = decodeChunkId(chunkId);

    if (!descriptor) {
      continue;
    }

    enqueueDescriptor(descriptor);
    restoredCount += 1;
  }

  postMessageToClient({
    type: "restored",
    chunkCount: restoredCount,
  });

  schedulePump(0);
}

async function ensureRestored(): Promise<void> {
  if (!restoringPromise) {
    restoringPromise = restorePendingChunks();
  }

  await restoringPromise;
}

async function processQueueItem(item: QueueItem): Promise<void> {
  try {
    const blob = await readChunk(item.id);
    const response = await uploadChunk({
      endpoint: uploadEndpoint,
      sessionId: item.sessionId,
      chunkIndex: item.chunkIndex,
      checksum: item.checksum,
      blob,
    });
    await deleteChunk(item.id);
    queue.markComplete(item.id);

    postMessageToClient({
      type: "uploaded",
      chunkId: item.id,
      chunkIndex: item.chunkIndex,
      duplicate: response.duplicate,
    });
  } catch (error) {
    const uploadError =
      error instanceof UploadError
        ? error
        : new UploadError(
            error instanceof Error ? error.message : "Unknown upload failure",
            true,
            null,
          );

    if (!uploadError.retryable) {
      queue.markPermanentFailure(item.id);
      postMessageToClient({
        type: "error",
        chunkId: item.id,
        chunkIndex: item.chunkIndex,
        retryable: false,
        message: uploadError.message,
      });

      const nextDelay = queue.getNextReadyDelay(Date.now());

      if (nextDelay !== null) {
        schedulePump(nextDelay);
      }

      return;
    }

    const failureState = queue.markFailure(item.id, MAX_RETRIES);

    if (failureState && failureState.shouldRetry) {
      postMessageToClient({
        type: "retry-scheduled",
        chunkId: item.id,
        chunkIndex: item.chunkIndex,
        retryCount: failureState.item.retryCount,
        delayMs: failureState.delayMs,
      });
    } else {
      postMessageToClient({
        type: "error",
        chunkId: item.id,
        chunkIndex: item.chunkIndex,
        retryable: uploadError.retryable,
        message: uploadError.message,
      });
    }
  } finally {
    const nextDelay = queue.getNextReadyDelay(Date.now());

    if (nextDelay !== null) {
      schedulePump(nextDelay);
    }
  }
}

async function pumpQueue(): Promise<void> {
  await ensureRestored();

  const readyItems = queue.acquireReady(Date.now());

  for (const item of readyItems) {
    queue.markInFlight(item.id);
    void processQueueItem(item);
  }

  if (readyItems.length === 0) {
    const nextDelay = queue.getNextReadyDelay(Date.now());

    if (nextDelay !== null) {
      schedulePump(nextDelay);
    }
  }
}

async function handleEnqueue(message: EnqueueChunkMessage): Promise<void> {
  const chunkId = encodeChunkId(
    message.sessionId,
    message.chunkIndex,
    message.checksum,
  );

  await writeChunk(chunkId, message.blob);
  enqueueDescriptor({
    id: chunkId,
    sessionId: message.sessionId,
    chunkIndex: message.chunkIndex,
    checksum: message.checksum,
  });

  postMessageToClient({
    type: "stored",
    chunkId,
    chunkIndex: message.chunkIndex,
  });

  schedulePump(0);
}

ctx.addEventListener("message", (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  if (message.type === "configure") {
    uploadEndpoint = message.endpoint;
    schedulePump(0);
    return;
  }

  if (message.type === "enqueue") {
    void handleEnqueue(message);
  }
});

void ensureRestored();
