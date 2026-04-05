export interface UploadChunkRequest {
  endpoint: string;
  sessionId: string;
  chunkIndex: number;
  checksum: string;
  blob: Blob;
}

export interface UploadChunkResponse {
  ok: true;
  duplicate: boolean;
  chunkId: string;
  storageKey: string;
  etag: string | null;
}

export class UploadError extends Error {
  public readonly retryable: boolean;
  public readonly status: number | null;

  public constructor(message: string, retryable: boolean, status: number | null) {
    super(message);
    this.name = "UploadError";
    this.retryable = retryable;
    this.status = status;
  }
}

interface UploadResponseShape {
  ok: true;
  duplicate: boolean;
  chunkId: string;
  storageKey: string;
  etag: string | null;
}

function getObjectValue(
  value: unknown,
  key: string,
): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (!(key in value)) {
    return undefined;
  }

  return Reflect.get(value, key);
}

function isUploadResponse(value: unknown): value is UploadResponseShape {
  return (
    getObjectValue(value, "ok") === true &&
    typeof getObjectValue(value, "duplicate") === "boolean" &&
    typeof getObjectValue(value, "chunkId") === "string" &&
    typeof getObjectValue(value, "storageKey") === "string" &&
    (typeof getObjectValue(value, "etag") === "string" ||
      getObjectValue(value, "etag") === null)
  );
}

export async function uploadChunk(
  request: UploadChunkRequest,
): Promise<UploadChunkResponse> {
  const formData = new FormData();
  formData.set("sessionId", request.sessionId);
  formData.set("chunkIndex", String(request.chunkIndex));
  formData.set("checksum", request.checksum);
  formData.set(
    "file",
    request.blob,
    `chunk-${request.chunkIndex.toString().padStart(6, "0")}.webm`,
  );

  let response: Response;

  try {
    response = await fetch(request.endpoint, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Network request failed";
    throw new UploadError(message, true, null);
  }

  if (!response.ok) {
    const errorMessage = await response.text();
    const retryable =
      response.status >= 500 || response.status === 408 || response.status === 429;

    throw new UploadError(
      errorMessage || `Upload failed with status ${response.status}`,
      retryable,
      response.status,
    );
  }

  const payload: unknown = await response.json();

  if (!isUploadResponse(payload)) {
    throw new UploadError("Upload response shape was invalid", true, response.status);
  }

  return payload;
}
