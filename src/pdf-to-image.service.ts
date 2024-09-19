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
import * as pdf from 'pdf-parse';

@Injectable()
export class PdfToImageService {
    private readonly uploadUrl = 'http://192.168.1.74:3008/minio/upload';
    private readonly axiosTimeout = 0; // Tempo limite infinito

    async convertPdfToImage(
        pdfPath: string,
        outputDir: string,
    ): Promise<any[]> {
        const mimeType = mime.lookup(pdfPath);
        if (mimeType !== 'application/pdf') {
            throw new BadRequestException(
                'O arquivo enviado não é um PDF válido',
            );
        }

        // Ler o conteúdo do PDF e logar
        const pdfDataBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdf(pdfDataBuffer);
        console.log('Conteúdo do PDF:', pdfData.text); // Logar o conteúdo do PDF
        // Ler o conteúdo do PDF e logar

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));
        const command = `pdftoppm -png ${pdfPath} ${path.join(outputDir, outputPrefix)}`;

        try {
            child_process.execSync(command);
            const uploadResults = await this.uploadImagesFromDirectory(
                outputDir,
                outputPrefix,
            );
            this.cleanUp(pdfPath, outputDir);
            return uploadResults; // Retorna os resultados do upload
        } catch (error) {
            throw new InternalServerErrorException(
                `Erro ao converter PDF: ${error.message}`,
            );
        }
    }

    private async uploadImagesFromDirectory(
        outputDir: string,
        outputPrefix: string,
    ): Promise<any[]> {
        const files = fs
            .readdirSync(outputDir)
            .filter(
                (file) =>
                    file.startsWith(outputPrefix) && file.endsWith('.png'),
            );

        const results = [];

        for (const file of files) {
            const imagePath = path.join(outputDir, file);
            const uploadResult = await this.uploadImage(imagePath);
            results.push(uploadResult); // Adiciona o resultado do upload ao array
        }

        return results; // Retorna todos os resultados
    }

    private async uploadImage(imagePath: string): Promise<any> {
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
                const response = await axios.post(this.uploadUrl, form, {
                    headers: { ...form.getHeaders() },
                    timeout: this.axiosTimeout, // Tempo limite infinito
                });
                return response.data; // Retorna a resposta do servidor
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
