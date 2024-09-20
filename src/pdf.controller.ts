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

    // Teste(filename: string): boolean {
    //     const allowedExtensions = ['pdf'];
    //     const ext = filename.split('.').pop()?.toLowerCase() || ''; // Uso do encadeamento opcional
    //     return allowedExtensions.includes(ext);
    // }

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
                console.log('teste', file.originalname);
                if (!file) {
                    return cb(
                        new BadRequestException('Nenhum arquivo foi enviado.'),
                        false,
                    );
                }
                // const sanitizedFilename = file.originalname.replace(/\s+/g, '');

                // console.log('sanitizedFilename', sanitizedFilename);
                // if (!this.Teste(sanitizedFilename)) {
                //     return cb(
                //         new BadRequestException(
                //             'Invalid file type. Only PDF files are allowed.',
                //         ),
                //         false,
                //     );
                // }

                // const maxSize = 5 * 1024 * 1024; // 5 MB
                // if (file.size > maxSize) {
                //     return cb(
                //         new BadRequestException(
                //             'O arquivo deve ter no máximo 5 MB',
                //         ),
                //         false,
                //     );
                // }

                cb(null, true);
            },
        }),
    )
    async uploadAndConvert(@UploadedFile() file: Express.Multer.File) {
        // Garantir que o arquivo não seja nulo
        if (!file) {
            throw new BadRequestException('Nenhum arquivo foi enviado.');
        }

        // console.log('TESTE', file.mimetype);

        // Verificação do tipo MIME do arquivo
        if (file.mimetype !== 'application/pdf') {
            throw new BadRequestException(
                'O arquivo enviado não é um PDF válido',
            );
        }

        const pdfPath = file.path;
        const outputDir = './temp'; // Diretório temporário para armazenar imagens

        try {
            const uploadResults =
                await this.pdfToImageService.convertPdfToImage(
                    pdfPath,
                    outputDir,
                );
            return {
                message: 'PDF convertido e imagens enviadas com sucesso!',
                results: uploadResults, // Retorna os resultados do upload
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Erro ao processar o PDF: ${error.message}`,
            );
        }
    }
}
