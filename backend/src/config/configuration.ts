export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cors: {
    // Comma-separated allowlist so local dev survives Vite picking a fallback
    // port (5173 taken -> 5174, etc.) without a restart-and-edit-.env cycle.
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  cookieSecret: process.env.COOKIE_SECRET,
});
