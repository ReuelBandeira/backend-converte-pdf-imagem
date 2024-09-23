import { Injectable, BadRequestException } from '@nestjs/common';
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

        const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));
        const totalPages = this.getPdfPageCount(pdfPath);
        const uploadResults = [];

        const normalizedSearchString = this.normalizeString(this.searchString);
        const normalizedExclusionString = this.normalizeString(
            this.exclusionString,
        );

        const sopsFinded = [];

        for (let page = 1; page <= totalPages; page++) {
            const pageText = this.extractPageText(pdfPath, page);
            const normalizedPageText = this.normalizeString(pageText);

            if (normalizedPageText.includes(normalizedExclusionString))
                continue;

            if (normalizedPageText.includes(normalizedSearchString))
                sopsFinded.push(page);
        }
        console.log(...sopsFinded);
        await Promise.all(
            sopsFinded.map(async (page) => {
                try {
                    const pngBuffer = await this.convertPageToPngBuffer(
                        pdfPath,
                        page,
                    );
                    const uploadResult = await this.uploadImageBuffer(
                        pngBuffer,
                        `${outputPrefix}-${page}.png`,
                    );
                    uploadResults.push(uploadResult);
                } catch (error) {
                    console.error(
                        `Erro ao converter ou fazer upload da página ${page}: ${error.message}`,
                    );
                }
            }),
        );

        this.cleanUp(pdfPath, outputDir);
        return uploadResults; // Retorna os resultados do upload
    }

    async convertPageToPngBuffer(
        pdfPath: string,
        page: number,
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const command = `pdftoppm -png -f ${page} -l ${page} ${pdfPath}`;
            const args = command.split(' ');

            const process = child_process.spawn(args[0], args.slice(1));

            let buffer = [];

            process.stdout.on('data', (data) => {
                buffer.push(data); // Coleta os dados da imagem em um buffer
            });

            process.stderr.on('data', (data) => {
                console.error(`Erro na conversão da página ${page}: ${data}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(Buffer.concat(buffer)); // Junta os dados em um buffer único
                } else {
                    reject(
                        new Error(
                            `Processo de conversão finalizado com código: ${code}`,
                        ),
                    );
                }
            });
        });
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
            .replace(/\s+/g, '') // Remove espaços em branco
            .toLowerCase(); // Converte para minúsculas
    }

    private async uploadImageBuffer(
        pngBuffer: Buffer,
        filename: string,
    ): Promise<any> {
        const form = new FormData();
        form.append('file', pngBuffer, { filename, contentType: 'image/png' });

        try {
            const maxRetries = 3;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const response = await axios.post(this.uploadUrl, form, {
                        headers: { ...form.getHeaders() },
                        timeout: this.axiosTimeout,
                    });
                    return response.data;
                } catch (error) {
                    if (attempt === maxRetries - 1) throw error;
                }
            }
        } catch (error) {
            console.error(
                `Erro ao fazer upload da imagem ${filename}: ${error.message}`,
            );
            throw error;
        }
    }

    private cleanUp(pdfPath: string, outputDir: string) {
        fs.unlinkSync(pdfPath);
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
}
