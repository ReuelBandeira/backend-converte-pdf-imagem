import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Aumentar o timeout do servidor HTTP para 15 minutos
    app.getHttpServer().setTimeout(900000); // 15 minutos

    await app.listen(3005);
}

bootstrap();
