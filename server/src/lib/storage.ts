import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getBucket(): string {
  return requireEnv("S3_BUCKET");
}

function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  s3Client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: requireEnv("S3_ENDPOINT"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
  });

  return s3Client;
}

export function buildStorageKey(sessionId: string, chunkIndex: number): string {
  const paddedChunkIndex = chunkIndex.toString().padStart(6, "0");
  return `audio-sessions/${encodeURIComponent(sessionId)}/${paddedChunkIndex}.webm`;
}

export interface StoredChunkInfo {
  etag: string | null;
  metadataChecksum: string | null;
  contentLength: number | null;
}

export async function uploadChunkObject(input: {
  storageKey: string;
  body: Uint8Array;
  checksum: string;
  contentType: string;
}): Promise<{ etag: string | null }> {
  const response = await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: {
        checksum: input.checksum,
      },
    }),
  );

  return {
    etag: response.ETag ? response.ETag.replaceAll('"', "") : null,
  };
}

export async function headChunkObject(
  storageKey: string,
): Promise<StoredChunkInfo> {
  const response = await getS3Client().send(
    new HeadObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
    }),
  );

  return {
    etag: response.ETag ? response.ETag.replaceAll('"', "") : null,
    metadataChecksum: response.Metadata?.checksum ?? null,
    contentLength: response.ContentLength ?? null,
  };
}
