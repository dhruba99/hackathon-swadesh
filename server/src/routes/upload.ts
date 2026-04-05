import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { checksumMatches, isValidSha256Hex, sha256Hex } from "../lib/checksum";
import { db } from "../lib/db";
import { buildStorageKey, headChunkObject, uploadChunkObject } from "../lib/storage";
import { chunks, type ChunkRecord } from "../schema/chunks";

function badRequestResponse(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function buildChunkId(sessionId: string, chunkIndex: number): string {
  return `${sessionId}:${chunkIndex}`;
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "23505"
  );
}

async function findChunkRecord(
  sessionId: string,
  chunkIndex: number,
): Promise<ChunkRecord | undefined> {
  const [record] = await db
    .select()
    .from(chunks)
    .where(
      and(eq(chunks.sessionId, sessionId), eq(chunks.chunkIndex, chunkIndex)),
    )
    .limit(1);

  return record;
}

export const uploadRoute = new Hono();

uploadRoute.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const sessionId = formData.get("sessionId");
  const chunkIndexValue = formData.get("chunkIndex");
  const checksum = formData.get("checksum");
  const file = formData.get("file");

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return badRequestResponse("sessionId is required");
  }

  if (typeof chunkIndexValue !== "string") {
    return badRequestResponse("chunkIndex is required");
  }

  const chunkIndex = Number(chunkIndexValue);

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return badRequestResponse("chunkIndex must be a non-negative integer");
  }

  if (typeof checksum !== "string" || !isValidSha256Hex(checksum)) {
    return badRequestResponse("checksum must be a SHA-256 hex string");
  }

  if (!(file instanceof File)) {
    return badRequestResponse("file must be provided");
  }

  const body = new Uint8Array(await file.arrayBuffer());
  const calculatedChecksum = await sha256Hex(body);

  if (!checksumMatches(calculatedChecksum, checksum)) {
    return badRequestResponse("checksum mismatch");
  }

  const chunkId = buildChunkId(sessionId, chunkIndex);
  const storageKey = buildStorageKey(sessionId, chunkIndex);
  let existingRecord: ChunkRecord | undefined;

  try {
    await db.insert(chunks).values({
      id: chunkId,
      sessionId,
      chunkIndex,
      checksum,
      storageKey,
      etag: null,
      status: "pending",
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    existingRecord = await findChunkRecord(sessionId, chunkIndex);

    if (!existingRecord) {
      throw error;
    }

    if (!checksumMatches(existingRecord.checksum, checksum)) {
      return badRequestResponse(
        "chunk already exists with a different checksum",
        409,
      );
    }

    if (existingRecord.status === "uploaded") {
      return c.json({
        ok: true,
        duplicate: true,
        chunkId,
        storageKey: existingRecord.storageKey,
        etag: existingRecord.etag,
      });
    }
  }

  const uploadResult = await uploadChunkObject({
    storageKey,
    body,
    checksum,
    contentType: file.type || "application/octet-stream",
  });

  const storedObject = await headChunkObject(storageKey);

  if (!storedObject.metadataChecksum) {
    throw new Error("Stored object metadata checksum is missing");
  }

  if (!checksumMatches(storedObject.metadataChecksum, checksum)) {
    throw new Error("Stored object checksum metadata does not match request");
  }

  if (storedObject.contentLength !== body.byteLength) {
    throw new Error("Stored object length does not match request body");
  }

  const finalEtag = storedObject.etag ?? uploadResult.etag;

  await db
    .update(chunks)
    .set({
      checksum,
      storageKey,
      etag: finalEtag,
      status: "uploaded",
    })
    .where(eq(chunks.id, chunkId));

  return c.json({
    ok: true,
    duplicate: false,
    chunkId,
    storageKey,
    etag: finalEtag,
  });
});
