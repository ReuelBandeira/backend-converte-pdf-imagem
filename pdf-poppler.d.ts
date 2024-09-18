declare module 'pdf-poppler' {
    interface ConvertOptions {
        format: string;
        out_dir: string;
        out_prefix: string;
        page?: number | null;
    }

    function convert(inputFile: string, options: ConvertOptions): Promise<void>;

    export { convert };
}