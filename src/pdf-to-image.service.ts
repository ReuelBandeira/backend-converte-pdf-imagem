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

            // Busca as imagens geradas no diretório de saída e as ordena pela numeração
            const imageFiles = fs
                .readdirSync(outputDir)
                .filter(
                    (file) =>
                        file.startsWith(outputPrefix) && file.endsWith('.png'),
                )
                .map((file) => path.join(outputDir, file))
                .sort((a, b) => {
                    // Extrai o número da página do nome do arquivo usando regex
                    const pageA = this.extractPageNumber(a);
                    const pageB = this.extractPageNumber(b);
                    return pageA - pageB;
                });

            // Envia cada imagem para o servidor na ordem correta
            await Promise.all(imageFiles.map((file) => this.uploadImage(file)));

            // Limpa os arquivos temporários
            this.cleanUp(pdfPath, imageFiles, outputDir);
        } catch (error) {
            throw new InternalServerErrorException(
                `Erro ao converter PDF para imagens: ${error.message}`,
            );
        }
    }

    // Função para extrair o número da página do nome do arquivo
    private extractPageNumber(filePath: string): number {
        const fileName = path.basename(filePath);
        const match = fileName.match(/-(\d+)\.png$/); // Captura o número da página após um hífen e antes de ".png"
        return match ? parseInt(match[1], 10) : 0; // Retorna o número da página, ou 0 se não encontrar
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
            // console.log(`Imagem enviada com sucesso: ${imagePath}`);
        } catch (error) {
            console.error(`Erro ao enviar ${imagePath}: ${error.message}`);
            throw error; // Repassa o erro para tratamento em Promise.all
        }
    }

    private cleanUp(pdfPath: string, imageFiles: string[], outputDir: string) {
        // Remove o PDF e as imagens temporárias
        fs.unlinkSync(pdfPath);
        imageFiles.forEach((file) => fs.unlinkSync(file));
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
}
