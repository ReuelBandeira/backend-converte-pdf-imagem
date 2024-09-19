import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Remover a configuração de timeout para permitir tempo infinito
    app.getHttpServer().setTimeout(0); // 0 significa sem limite

    await app.listen(3005);
}

bootstrap();
