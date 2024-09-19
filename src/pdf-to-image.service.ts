import {
    Injectable,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as FormData from 'form-data';
import * as mime from 'mime-types';

@Injectable()
export class PdfToImageService {
    private readonly uploadUrl = 'http://192.168.1.74:3008/minio/upload';
    private readonly axiosTimeout = 0; // Tempo limite infinito

    async convertPdfToImage(pdfPath: string, outputDir: string): Promise<void> {
        const mimeType = mime.lookup(pdfPath);
        if (mimeType !== 'application/pdf') {
            throw new BadRequestException(
                'O arquivo enviado não é um PDF válido',
            );
        }

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));
        const command = `pdftoppm -png ${pdfPath} ${path.join(outputDir, outputPrefix)}`;

        try {
            child_process.execSync(command);
            await this.uploadImagesFromDirectory(outputDir, outputPrefix);
            this.cleanUp(pdfPath, outputDir);
        } catch (error) {
            throw new InternalServerErrorException(
                `Erro ao converter PDF: ${error.message}`,
            );
        }
    }

    private async uploadImagesFromDirectory(
        outputDir: string,
        outputPrefix: string,
    ): Promise<void> {
        const files = fs
            .readdirSync(outputDir)
            .filter(
                (file) =>
                    file.startsWith(outputPrefix) && file.endsWith('.png'),
            );

        for (const file of files) {
            const imagePath = path.join(outputDir, file);
            await this.uploadImage(imagePath);
        }
    }

    private async uploadImage(imagePath: string): Promise<void> {
        const mimeType = mime.lookup(imagePath);
        if (mimeType !== 'image/png') {
            throw new BadRequestException(
                `O arquivo ${imagePath} não é uma imagem PNG válida`,
            );
        }

        const form = new FormData();
        form.append('file', fs.createReadStream(imagePath), {
            filename: path.basename(imagePath),
            contentType: mimeType,
        });

        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await axios.post(this.uploadUrl, form, {
                    headers: { ...form.getHeaders() },
                    timeout: this.axiosTimeout, // Tempo limite infinito
                });
                return;
            } catch (error) {
                console.error(
                    `Erro ao enviar ${imagePath} (tentativa ${attempt + 1}): ${error.message}`,
                );
                if (attempt === maxRetries - 1) {
                    throw error;
                }
            }
        }
    }

    private cleanUp(pdfPath: string, outputDir: string) {
        fs.unlinkSync(pdfPath);
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
}
