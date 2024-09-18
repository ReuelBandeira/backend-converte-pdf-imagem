// pdf.controller.ts
import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { PdfToImageService } from './pdf-to-image.service';

@Controller('pdf')
export class PdfController {
    constructor(private readonly pdfToImageService: PdfToImageService) {}

    @Post('/upload')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads/pdf', // Pasta para armazenar o PDF
                filename: (req, file, cb) => {
                    const filename = path
                        .parse(file.originalname)
                        .name.replace(/\s+/g, '_');
                    const extension = path.parse(file.originalname).ext;
                    cb(null, `${filename}${extension}`);
                },
            }),
        }),
    )
    async uploadAndConvert(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new Error('Nenhum arquivo enviado');
        }

        const pdfPath = file.path;
        const outputDir = './uploads/images'; // Pasta para armazenar as imagens

        // Chama o serviço para converter o PDF para imagem
        const images = await this.pdfToImageService.convertPdfToImage(
            pdfPath,
            outputDir,
        );

        return {
            message: 'PDF convertido com sucesso!',
            images,
        };
    }
}
