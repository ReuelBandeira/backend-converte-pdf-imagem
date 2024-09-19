import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { PdfToImageService } from './pdf-to-image.service';

@Controller('pdf')
export class PdfController {
    private readonly uploadUrl = 'http://192.168.1.74:3008/minio/upload'; // URL para onde as imagens serão enviadas

    constructor(private readonly pdfToImageService: PdfToImageService) {}

    @Post('/upload')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads/pdf', // Pasta temporária para armazenar o PDF
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
            throw new BadRequestException('Nenhum arquivo enviado');
        }

        const pdfPath = file.path;
        const outputDir = './temp'; // Diretório temporário para armazenar imagens

        try {
            // Chama o serviço para converter o PDF para imagens e enviar para a URL
            await this.pdfToImageService.convertPdfToImage(pdfPath, outputDir);

            return {
                message: 'PDF convertido e imagens enviadas com sucesso!',
            };
        } catch (error) {
            if (error instanceof InternalServerErrorException) {
                throw new InternalServerErrorException(
                    `Erro ao processar o PDF: ${error.message}`,
                );
            }
            throw new BadRequestException(
                `Erro ao processar o PDF: ${error.message}`,
            );
        }
    }
}
