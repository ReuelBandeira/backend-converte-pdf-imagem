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
    private readonly searchString = 'INSTRUÇÃO DE TRABALHO';
    private readonly exclusionString = 'Histórico de Registros de Alterações';

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

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));
        const totalPages = this.getPdfPageCount(pdfPath);
        const uploadResults = [];

        const normalizedSearchString = this.normalizeString(this.searchString);
        const normalizedExclusionString = this.normalizeString(
            this.exclusionString,
        );

        for (let page = 1; page <= totalPages; page++) {
            const pageText = this.extractPageText(pdfPath, page);
            const normalizedPageText = this.normalizeString(pageText);

            // Verifica se a página contém a string de exclusão
            if (normalizedPageText.includes(normalizedExclusionString)) {
                console.log(
                    `Página ${page} excluída por conter: "${this.exclusionString}"`,
                );
                continue; // Pula para a próxima página
            }

            // Verifica se a página contém a string de inclusão
            if (normalizedPageText.includes(normalizedSearchString)) {
                const command = `pdftoppm -png -f ${page} -l ${page} ${pdfPath} ${path.join(outputDir, outputPrefix)}`;
                try {
                    child_process.execSync(command);
                    const imagePath = path.join(
                        outputDir,
                        `${outputPrefix}-${page}.png`,
                    );
                    const uploadResult = await this.uploadImage(imagePath);
                    uploadResults.push(uploadResult);
                } catch (error) {
                    console.error(
                        `Erro ao converter página ${page}: ${error.message}`,
                    );
                }
            }
        }

        this.cleanUp(pdfPath, outputDir);
        return uploadResults; // Retorna os resultados do upload
    }

    private getPdfPageCount(pdfPath: string): number {
        const command = `pdfinfo ${pdfPath} | grep Pages | awk '{print $2}'`;
        return parseInt(child_process.execSync(command).toString().trim(), 10);
    }

    private extractPageText(pdfPath: string, page: number): string {
        const command = `pdftotext -f ${page} -l ${page} ${pdfPath} -`;
        return child_process.execSync(command).toString();
    }

    private normalizeString(input: string): string {
        return input
            .normalize('NFD') // Normaliza para decompor acentuações
            .replace(/[\u0300-\u036f]/g, '') // Remove acentuações
            .replace(/\s+/g, '') // Remove espaços em branco
            .toLowerCase(); // Converte para minúsculas
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
                    timeout: this.axiosTimeout,
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
