-- Migration 026: create agent_conversations table for IA agent memory
CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  messages TEXT, -- JSON array of messages {role, text, timestamp}
  context TEXT,  -- optional JSON context
  last_active TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_tenant ON agent_conversations(tenant_id);

