/** Server configuration from environment variables (see README / .env.example). */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  /** SQLite file; ':memory:' for tests */
  databasePath: process.env.DATABASE_PATH ?? './asta-legends.db',
  /** comma separated list of allowed origins, '*' for dev */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  /** public base URL used in invite links */
  publicUrl: process.env.PUBLIC_URL ?? 'astalegends://join',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
  /** the AI generator is enabled when credentials are available to the Anthropic SDK */
  aiEnabled: process.env.AI_ENABLED !== 'false',
  expoPushEnabled: process.env.EXPO_PUSH_ENABLED !== 'false',
  /** how long an idle league host stays in memory */
  hostIdleMs: Number(process.env.HOST_IDLE_MS ?? 30 * 60 * 1000),
};

export type ServerConfig = typeof config;
