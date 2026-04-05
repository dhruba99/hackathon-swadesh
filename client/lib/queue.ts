export interface QueueItem {
  id: string;
  sessionId: string;
  chunkIndex: number;
  checksum: string;
  retryCount: number;
  nextAttemptAt: number;
}

export interface QueueFailureState {
  item: QueueItem;
  shouldRetry: boolean;
  delayMs: number;
}

export class UploadQueue {
  private readonly items = new Map<string, QueueItem>();
  private readonly inFlight = new Set<string>();

  public constructor(private readonly concurrency: number) {}

  public upsert(
    item: Omit<QueueItem, "retryCount" | "nextAttemptAt"> &
      Partial<Pick<QueueItem, "retryCount" | "nextAttemptAt">>,
  ): QueueItem {
    const existing = this.items.get(item.id);

    if (existing) {
      return existing;
    }

    const normalized: QueueItem = {
      ...item,
      retryCount: item.retryCount ?? 0,
      nextAttemptAt: item.nextAttemptAt ?? 0,
    };

    this.items.set(normalized.id, normalized);
    return normalized;
  }

  public acquireReady(now: number): QueueItem[] {
    const availableSlots = this.concurrency - this.inFlight.size;

    if (availableSlots <= 0) {
      return [];
    }

    return [...this.items.values()]
      .filter(
        (item) => !this.inFlight.has(item.id) && item.nextAttemptAt <= now,
      )
      .sort((left, right) => {
        if (left.nextAttemptAt !== right.nextAttemptAt) {
          return left.nextAttemptAt - right.nextAttemptAt;
        }

        return left.chunkIndex - right.chunkIndex;
      })
      .slice(0, availableSlots);
  }

  public markInFlight(id: string): void {
    this.inFlight.add(id);
  }

  public markComplete(id: string): void {
    this.inFlight.delete(id);
    this.items.delete(id);
  }

  public markFailure(id: string, maxRetries: number): QueueFailureState | null {
    const item = this.items.get(id);

    if (!item) {
      this.inFlight.delete(id);
      return null;
    }

    this.inFlight.delete(id);

    const nextRetryCount = item.retryCount + 1;

    if (nextRetryCount > maxRetries) {
      item.retryCount = nextRetryCount;
      this.items.delete(id);
      return {
        item: { ...item },
        shouldRetry: false,
        delayMs: 0,
      };
    }

    const jitter = Math.random();
    const delayMs = (2 ** nextRetryCount + jitter) * 1000;

    item.retryCount = nextRetryCount;
    item.nextAttemptAt = Date.now() + delayMs;

    return {
      item: { ...item },
      shouldRetry: true,
      delayMs,
    };
  }

  public markPermanentFailure(id: string): QueueItem | null {
    const item = this.items.get(id);

    this.inFlight.delete(id);

    if (!item) {
      return null;
    }

    this.items.delete(id);
    return { ...item };
  }

  public getNextReadyDelay(now: number): number | null {
    const pendingItems = [...this.items.values()].filter(
      (item) => !this.inFlight.has(item.id),
    );

    if (pendingItems.length === 0) {
      return null;
    }

    const nextAttemptAt = Math.min(
      ...pendingItems.map((item) => item.nextAttemptAt),
    );

    return Math.max(0, nextAttemptAt - now);
  }
}
