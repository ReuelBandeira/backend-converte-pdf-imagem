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
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Controller('pdf')
export class PdfController {
    constructor(private readonly pdfToImageService: PdfToImageService) {}

    @Post('/upload')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads/pdf', // Pasta temporária para armazenar o PDF
                filename: (req, file, cb) => {
                    const uniqueSuffix = uuidv4();
                    const filename = path
                        .parse(file.originalname)
                        .name.replace(/\s+/g, '_');
                    const extension = path.parse(file.originalname).ext;
                    cb(null, `${filename}_${uniqueSuffix}${extension}`);
                },
            }),
            fileFilter: (
                req: Request,
                file: Express.Multer.File,
                cb: (error: Error | null, acceptFile: boolean) => void,
            ) => {
                const maxSize = 5 * 1024 * 1024; // 5 MB
                if (!file.originalname.match(/\.pdf$/)) {
                    return cb(
                        new BadRequestException(
                            'Apenas arquivos PDF são permitidos',
                        ),
                        false,
                    );
                }
                if (file.size > maxSize) {
                    return cb(
                        new BadRequestException(
                            'O arquivo deve ter no máximo 5 MB',
                        ),
                        false,
                    );
                }
                cb(null, true);
            },
        }),
    )
    async uploadAndConvert(@UploadedFile() file: Express.Multer.File) {
        // Verificação do tipo MIME do arquivo
        if (file.mimetype !== 'application/pdf') {
            throw new BadRequestException(
                'O arquivo enviado não é um PDF válido',
            );
        }

        const pdfPath = file.path;
        const outputDir = './temp'; // Diretório temporário para armazenar imagens

        try {
            await this.pdfToImageService.convertPdfToImage(pdfPath, outputDir);
            return {
                message: 'PDF convertido e imagens enviadas com sucesso!',
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Erro ao processar o PDF: ${error.message}`,
            );
        }
    }
}
