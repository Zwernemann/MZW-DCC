/**
 * PDF Text Extraction using PDF.js
 * Extracts text content from PDF calibration certificates.
 */

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

let pdfjsLib = null;

async function loadPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    pdfjsLib = await import(PDFJS_CDN);
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    return pdfjsLib;
}

/**
 * Extract text from a PDF file.
 * @param {File} file - The PDF file object
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{text: string, pages: string[], metadata: object}>}
 */
export async function extractTextFromPdf(file, onProgress = () => {}) {
    const lib = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = lib.getDocument({ data: arrayBuffer });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pages = [];
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
        onProgress(Math.round((i / numPages) * 80));

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Build page text preserving layout structure
        const pageText = buildPageText(textContent);
        pages.push(pageText);
        fullText += `--- Seite ${i} ---\n${pageText}\n\n`;
    }

    // Get PDF metadata
    let metadata = {};
    try {
        const meta = await pdf.getMetadata();
        metadata = {
            title: meta.info?.Title || '',
            author: meta.info?.Author || '',
            subject: meta.info?.Subject || '',
            creator: meta.info?.Creator || '',
            producer: meta.info?.Producer || '',
            creationDate: meta.info?.CreationDate || '',
        };
    } catch {
        // Metadata extraction is optional
    }

    onProgress(100);

    return { text: fullText, pages, metadata, numPages };
}

/**
 * Build readable text from PDF.js text content, preserving table-like structures.
 */
function buildPageText(textContent) {
    if (!textContent.items || textContent.items.length === 0) {
        return '';
    }

    // Group items by approximate Y position (same line)
    const lineThreshold = 3; // pixels tolerance for same-line grouping
    const lines = [];
    let currentLine = [];
    let lastY = null;

    // Sort by Y position (top to bottom), then X position (left to right)
    const sortedItems = [...textContent.items]
        .filter(item => item.str && item.str.trim())
        .sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5]; // Y is inverted in PDF
            if (Math.abs(yDiff) > lineThreshold) return yDiff;
            return a.transform[4] - b.transform[4]; // X position
        });

    for (const item of sortedItems) {
        const y = item.transform[5];

        if (lastY !== null && Math.abs(y - lastY) > lineThreshold) {
            if (currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
            }
        }

        currentLine.push({
            text: item.str,
            x: item.transform[4],
            width: item.width,
        });
        lastY = y;
    }

    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    // Build text from lines, using tab separation for spaced elements
    const result = lines.map(line => {
        // Sort by X position within the line
        line.sort((a, b) => a.x - b.x);

        let lineText = '';
        let prevEnd = 0;

        for (const item of line) {
            const gap = item.x - prevEnd;
            if (prevEnd > 0 && gap > 30) {
                lineText += '\t';
            } else if (prevEnd > 0 && gap > 5) {
                lineText += ' ';
            }
            lineText += item.text;
            prevEnd = item.x + item.width;
        }

        return lineText;
    });

    return result.join('\n');
}
