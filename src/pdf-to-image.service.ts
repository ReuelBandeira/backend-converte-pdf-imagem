import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class PdfToImageService {
    private readonly uploadUrl = 'http://192.168.1.74:3008/minio/upload'; // URL para onde as imagens serão enviadas

    async convertPdfToImage(pdfPath: string, outputDir: string): Promise<void> {
        // Verifica se o diretório de saída existe, senão cria
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));

        // Executa o comando pdftoppm para converter o PDF para imagens
        const command = `pdftoppm -png ${pdfPath} ${path.join(outputDir, outputPrefix)}`;

        try {
            // Executa o comando no sistema
            child_process.execSync(command);

            // Busca as imagens geradas no diretório de saída
            const imageFiles = fs
                .readdirSync(outputDir)
                .filter(
                    (file) =>
                        file.startsWith(outputPrefix) && file.endsWith('.png'),
                )
                .map((file) => path.join(outputDir, file));

            // Envia cada imagem para o servidor
            await Promise.all(imageFiles.map((file) => this.uploadImage(file)));

            // Limpa os arquivos temporários
            this.cleanUp(pdfPath, imageFiles, outputDir);
        } catch (error) {
            throw new InternalServerErrorException(
                `Erro ao converter PDF para imagens: ${error.message}`,
            );
        }
    }

    private async uploadImage(imagePath: string): Promise<void> {
        const form = new FormData();
        form.append(
            'file',
            fs.createReadStream(imagePath),
            path.basename(imagePath),
        );

        try {
            const response = await axios.post(this.uploadUrl, form, {
                headers: {
                    ...form.getHeaders(), // Adiciona os headers necessários para o FormData
                },
            });
            console.log(`Imagem enviada com sucesso: ${imagePath}`);
        } catch (error) {
            console.error(`Erro ao enviar ${imagePath}: ${error.message}`);
            throw error; // Repassa o erro para tratamento em Promise.all
        }
    }

    private cleanUp(pdfPath: string, imageFiles: string[], outputDir: string) {
        // Remove o PDF e as imagens temporárias
        fs.unlinkSync(pdfPath);
        imageFiles.forEach((file) => fs.unlinkSync(file));
        fs.rmdirSync(outputDir, { recursive: true });
    }
}
