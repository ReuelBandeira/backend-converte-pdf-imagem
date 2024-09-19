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
                    // Gera um UUID para garantir que o nome do arquivo seja único
                    const uniqueSuffix = uuidv4();
                    const filename = path
                        .parse(file.originalname)
                        .name.replace(/\s+/g, '_');
                    const extension = path.parse(file.originalname).ext;
                    // Cria o nome do arquivo com o UUID anexado
                    cb(null, `${filename}_${uniqueSuffix}${extension}`);
                },
            }),
            fileFilter: (
                req: Request,
                file: Express.Multer.File,
                cb: (error: Error | null, acceptFile: boolean) => void,
            ) => {
                // Verifica a extensão do arquivo
                if (!file.originalname.match(/\.(pdf)$/)) {
                    return cb(
                        new BadRequestException(
                            'Apenas arquivos PDF são permitidos',
                        ),
                        false,
                    );
                }
                cb(null, true);
            },
        }),
    )
    async uploadAndConvert(@UploadedFile() file: Express.Multer.File) {
        // Verifica se o arquivo foi enviado
        if (!file) {
            throw new BadRequestException('Nenhum arquivo PDF enviado');
        }

        // Verifica se o arquivo é um PDF
        if (!file.originalname.match(/\.(pdf)$/)) {
            throw new BadRequestException('O arquivo enviado não é um PDF');
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
