// --- Clients ---
export { DBrainClient, type DBrainClientOptions } from './dbrain/index.js';
export { DProxyClient, type DProxyClientOptions } from './dproxy/index.js';
export { DWorkClient, type DWorkClientOptions } from './dwork/index.js';

// --- Shared ---
export { SdkError } from './http.js';
/** @deprecated Use SdkError instead */
export { SdkError as DBrainError } from './http.js';

// --- DBrain types ---
export type {
  ApiKeyCreateResponse,
  ApiKeyListItem,
  ConnectResponse,
  ConnectionStatus,
  ConversationSummary,
  ConversationWithMessages,
  Document,
  DocumentListItem,
  EntityRow,
  EntityWithFacts,
  FactRow,
  FederatedSearchResponse,
  HealthResponse,
  MemorySummaryRow,
  Message,
  PendingMessages,
  SearchResult,
  ShareResult,
} from './dbrain/index.js';

// --- DProxy types ---
export type {
  AskOptions,
  AskResponse,
  DProxyHealthResponse,
  MemorySearchResult,
  ProviderName,
  TemplateRunOptions,
} from './dproxy/index.js';

// --- DWork types ---
export type {
  DWorkApiKeyCreateResponse,
  DWorkApiKeyListItem,
  DWorkDoc,
  DWorkHealthResponse,
  DWorkOverview,
  DWorkProject,
  DWorkProjectSummary,
  DWorkSearchResult,
  DWorkSyncResult,
  DWorkTask,
} from './dwork/index.js';

// --- Re-exported core types ---
export type { AdapterResult, AdapterStreamEvent, AdapterUsage, InputFile } from '@dtoolkit/core';
export type { HistoryEntry, TemplateDefinition } from '@dtoolkit/core';
