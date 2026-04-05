CREATE TABLE IF NOT EXISTS chunks (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  chunk_index INTEGER NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  storage_key TEXT NOT NULL,
  etag VARCHAR(255),
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'uploaded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS chunks_session_chunk_unique
  ON chunks (session_id, chunk_index);
