
import { Injectable } from '@nestjs/common';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfToImageService {
    async convertPdfToImage(pdfPath: string, outputDir: string): Promise<string[]> {
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
            const images = fs.readdirSync(outputDir)
                .filter(file => file.startsWith(outputPrefix) && file.endsWith('.png'))
                .map(file => path.join(outputDir, file));

            return images;
        } catch (error) {
            throw new Error(`Erro ao converter PDF para imagens: ${error.message}`);
        }
    }
}
