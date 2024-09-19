import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class PdfToImageService {
    private readonly uploadUrl = 'http://192.168.1.74:3008/minio/upload';
    private readonly maxConcurrentUploads = 5; // Aumente conforme necessário
    private readonly axiosTimeout = 1200000; // 20 minutos

    async convertPdfToImage(pdfPath: string, outputDir: string): Promise<void> {
        // Criação do diretório de saída se não existir
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));
        const command = `pdftoppm -png ${pdfPath} ${path.join(outputDir, outputPrefix)}`;

        try {
            child_process.execSync(command);
            const imageFiles = this.getImageFiles(outputDir, outputPrefix);
            await this.uploadImagesInBatches(imageFiles);
            this.cleanUp(pdfPath, imageFiles, outputDir);
        } catch (error) {
            throw new InternalServerErrorException(
                `Erro ao converter PDF: ${error.message}`,
            );
        }
    }

    private getImageFiles(outputDir: string, outputPrefix: string): string[] {
        return fs
            .readdirSync(outputDir)
            .filter(
                (file) =>
                    file.startsWith(outputPrefix) && file.endsWith('.png'),
            )
            .map((file) => path.join(outputDir, file))
            .sort(
                (a, b) => this.extractPageNumber(a) - this.extractPageNumber(b),
            );
    }

    private extractPageNumber(filePath: string): number {
        const fileName = path.basename(filePath);
        const match = fileName.match(/-(\d+)\.png$/);
        return match ? parseInt(match[1], 10) : 0;
    }

    private async uploadImagesInBatches(imageFiles: string[]): Promise<void> {
        await Promise.all(imageFiles.map((file) => this.uploadImage(file)));
    }

    private async uploadImage(imagePath: string): Promise<void> {
        const form = new FormData();
        form.append(
            'file',
            fs.createReadStream(imagePath),
            path.basename(imagePath),
        );

        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await axios.post(this.uploadUrl, form, {
                    headers: { ...form.getHeaders() },
                    timeout: this.axiosTimeout,
                });
                return; // Sai da função se o upload for bem-sucedido
            } catch (error) {
                console.error(
                    `Erro ao enviar ${imagePath} (tentativa ${attempt + 1}): ${error.message}`,
                );
                if (attempt === maxRetries - 1) {
                    throw error; // Lança o erro na última tentativa
                }
            }
        }
    }

    private cleanUp(pdfPath: string, imageFiles: string[], outputDir: string) {
        fs.unlinkSync(pdfPath);
        imageFiles.forEach((file) => fs.unlinkSync(file));
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
}
