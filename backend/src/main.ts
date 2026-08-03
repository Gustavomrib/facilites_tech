import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser(configService.get<string>('cookieSecret')));
  const allowedOrigins = configService.get<string[]>('cors.origin') ?? [];
  app.enableCors({
    // A function (rather than a static string/array) is what makes the `cors`
    // package reflect back the exact matching request Origin — required for
    // credentials: true to work at all, since the wildcard/static-mismatch
    // response is exactly the "Access-Control-Allow-Origin ... not equal to
    // the supplied origin" browser error this was fixing — and it's also what
    // makes it set `Vary: Origin` automatically on the response.
    origin: (origin, callback) => {
      // No Origin header (curl, server-to-server, same-origin) — nothing to check.
      // A disallowed origin resolves with `false`, not an Error: CORS is a
      // browser-side enforcement (it just won't expose the response to that
      // page's JS without the header), not a server-side access check — an
      // Error here would turn every stray probe into a noisy 500.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  // Listens for SIGTERM/SIGINT and runs onModuleDestroy hooks (PrismaService
  // disconnects cleanly) before the process exits — required for Docker/orchestrators
  // that send SIGTERM on redeploy.
  app.enableShutdownHooks();

  if (configService.get<string>('nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Meu Negócio no Bolso API')
      .setDescription('API do backend de gestão para pequenos negócios')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
