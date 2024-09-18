import { Module } from '@nestjs/common';

import { PdfToImageService } from './pdf-to-image.service';
import { PdfController } from './pdf.controller';

@Module({
  imports: [
    // MulterModule.register({ // Configurações globais para upload se necessário
    //   dest: './uploads/pdf',
    // }),
  ],
  controllers: [PdfController],
  providers: [PdfToImageService],
})
export class AppModule { }
