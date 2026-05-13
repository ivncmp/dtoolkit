// --- Clients ---
export { DBrainClient, type DBrainClientOptions } from "./dbrain/index.js";
export { DProxyClient, type DProxyClientOptions } from "./dproxy/index.js";

// --- Shared ---
export { SdkError } from "./http.js";
/** @deprecated Use SdkError instead */
export { SdkError as DBrainError } from "./http.js";

// --- DBrain types ---
export type {
  ConnectResponse,
  ConversationSummary,
  ConversationWithMessages,
  Document,
  DocumentListItem,
  EntityRow,
  EntityWithFacts,
  FactRow,
  HealthResponse,
  MemorySummaryRow,
  Message,
  PendingMessages,
  SearchResult,
} from "./dbrain/index.js";

// --- DProxy types ---
export type {
  AskOptions,
  AskResponse,
  DProxyHealthResponse,
  MemorySearchResult,
  ProviderName,
  TemplateRunOptions,
} from "./dproxy/index.js";

// --- Re-exported core types ---
export type {
  AdapterResult,
  AdapterStreamEvent,
  AdapterUsage,
  InputFile,
} from "@dtoolkit/core";
export type { HistoryEntry, TemplateDefinition } from "@dtoolkit/core";
