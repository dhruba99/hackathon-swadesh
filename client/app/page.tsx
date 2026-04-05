"use client";

import { useEffect, useRef, useState } from "react";

type WorkerEvent =
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

function createWorker(): Worker {
  return new Worker(new URL("../workers/upload.worker.ts", import.meta.url), {
    type: "module",
  });
}

function resolveUploadEndpoint(): string {
  const configuredEndpoint = process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT;

  if (typeof configuredEndpoint === "string" && configuredEndpoint.length > 0) {
    return configuredEndpoint;
  }

  return "http://localhost:3011/api/upload";
}

async function computeSha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pickSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
}

export default function Page() {
  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const chunkIndexRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<string[]>([]);
  const uploadEndpoint = resolveUploadEndpoint();

  useEffect(() => {
    const worker = createWorker();
    workerRef.current = worker;
    worker.postMessage({
      type: "configure",
      endpoint: uploadEndpoint,
    });

    worker.onmessage = (event: MessageEvent<WorkerEvent>): void => {
      const message = event.data;

      setEvents((current) => {
        const next = [...current];

        if (message.type === "stored") {
          next.unshift(`Chunk ${message.chunkIndex} stored locally as ${message.chunkId}`);
        } else if (message.type === "uploaded") {
          next.unshift(`Chunk ${message.chunkIndex} uploaded successfully`);
        } else if (message.type === "retry-scheduled") {
          next.unshift(
            `Chunk ${message.chunkIndex} retry ${message.retryCount} scheduled in ${Math.round(
              message.delayMs,
            )}ms`,
          );
        } else if (message.type === "error") {
          next.unshift(`Chunk ${message.chunkIndex} failed: ${message.message}`);
        } else if (message.type === "restored") {
          next.unshift(`Restored ${message.chunkCount} pending chunks from OPFS`);
        }

        return next.slice(0, 20);
      });
    };

    return () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      worker.onmessage = null;
      worker.terminate();
      workerRef.current = null;
    };
  }, [uploadEndpoint]);

  async function startRecording(): Promise<void> {
    if (isRecording) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Media recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMimeType();
      const recorder =
        mimeType.length > 0
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunkIndexRef.current = 0;
      sessionIdRef.current = crypto.randomUUID();

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size === 0 || !workerRef.current) {
          return;
        }

        const chunkIndex = chunkIndexRef.current;
        chunkIndexRef.current += 1;

        void (async () => {
          const checksum = await computeSha256Hex(event.data);
          workerRef.current?.postMessage({
            type: "enqueue",
            sessionId: sessionIdRef.current,
            chunkIndex,
            checksum,
            blob: event.data,
          });
        })();
      });

      recorder.addEventListener("stop", () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      });

      recorder.start(5000);
      setIsRecording(true);
      setStatus(`Recording session ${sessionIdRef.current}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recording failed";
      setStatus(message);
    }
  }

  function stopRecording(): void {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
    setStatus("Recording stopped");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem",
        background:
          "linear-gradient(180deg, #f7f4ea 0%, #e5efe7 55%, #dbe4f3 100%)",
        color: "#17212b",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: "48rem",
          margin: "0 auto",
          backgroundColor: "rgba(255,255,255,0.88)",
          borderRadius: "1.5rem",
          padding: "2rem",
          boxShadow: "0 24px 80px rgba(23,33,43,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          Fault-Tolerant Audio Upload Demo
        </h1>
        <p style={{ lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Records 5-second audio chunks, persists them in OPFS, and uploads them
          through a retry-safe worker with idempotent server handling.
        </p>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <button
            type="button"
            onClick={() => {
              void startRecording();
            }}
            disabled={isRecording}
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "0.85rem 1.25rem",
              backgroundColor: isRecording ? "#9aa8b6" : "#1b7f5a",
              color: "#ffffff",
              cursor: isRecording ? "not-allowed" : "pointer",
            }}
          >
            Start recording
          </button>
          <button
            type="button"
            onClick={stopRecording}
            disabled={!isRecording}
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "0.85rem 1.25rem",
              backgroundColor: !isRecording ? "#c2cad4" : "#b44343",
              color: "#ffffff",
              cursor: !isRecording ? "not-allowed" : "pointer",
            }}
          >
            Stop recording
          </button>
        </div>
        <p style={{ marginBottom: "1rem" }}>
          <strong>Status:</strong> {status}
        </p>
        <div
          style={{
            borderRadius: "1rem",
            padding: "1rem",
            backgroundColor: "#17212b",
            color: "#eef3f7",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Worker log</h2>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.7 }}>
            {events.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
