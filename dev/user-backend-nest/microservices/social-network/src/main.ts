import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const host = process.env.SOCIAL_NETWORK_SERVICE_HOST || '127.0.0.1';
  const port = parseInt(process.env.SOCIAL_NETWORK_SERVICE_PORT) || 3013;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [`nats://${host}:${port}`],
        queue: 'social_network_queue',
      },
      logger:
        process.env.EXTENDED_LOGS === 'true'
          ? ['error', 'warn', 'log', 'debug', 'verbose']
          : ['error', 'warn', 'log'],
    },
  );
  Logger.log(`Listening on host ${host}, port ${port}`);
  await app.listen();
}
bootstrap();
