import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?worker';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import JSZip from 'jszip';

// Use Vite's native worker support to avoid CORS issues with CDNs
pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsWorker();

const plainTextExtensions = [
  'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'log', 'yaml', 'yml', 
  'ini', 'cfg', 'conf', 'rtf', 'tsv', 'js', 'ts', 'py', 'java', 'c', 
  'cpp', 'cs', 'go', 'rs', 'sql'
];

export async function parseFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();

  return new Promise(async (resolve, reject) => {
    try {
      if (plainTextExtensions.includes(extension)) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read text file.'));
        reader.readAsText(file);
        
      } else if (['html', 'htm'].includes(extension)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(e.target.result, 'text/html');
          resolve(doc.body.textContent || doc.body.innerText || '');
        };
        reader.onerror = () => reject(new Error('Failed to read HTML file.'));
        reader.readAsText(file);

      } else if (['xlsx', 'xls'].includes(extension)) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let fullText = '';
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          fullText += `--- Sheet: ${sheetName} ---\n${csv}\n`;
        });
        resolve(fullText);

      } else if (extension === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map(item => item.str);
          fullText += pageStrings.join(' ') + '\n';
        }
        resolve(fullText);
        
      } else if (['docx'].includes(extension)) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value);
        
      } else if (['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(extension)) {
        try {
          const result = await Tesseract.recognize(file, 'eng+chi_sim');
          resolve(result.data.text);
        } catch (err) {
          reject(new Error('OCR extraction failed.'));
        }

      } else if (extension === 'epub') {
        try {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(file);
          let fullText = '';
          const htmlFiles = Object.values(loadedZip.files).filter(f => !f.dir && f.name.match(/\.(html|htm|xhtml)$/i));
          
          // Sort files by name to approximate chapter order (e.g. 01.xhtml, 02.xhtml)
          htmlFiles.sort((a, b) => a.name.localeCompare(b.name));

          const parser = new DOMParser();
          for (const f of htmlFiles) {
            const content = await f.async('string');
            const doc = parser.parseFromString(content, 'text/html');
            fullText += (doc.body?.textContent || doc.body?.innerText || '') + '\n\n';
            if (fullText.length > 400000) break; // Optimization: Stop parsing early if limit reached
          }
          resolve(fullText.slice(0, 400000));
        } catch (err) {
          reject(new Error('Failed to parse EPUB file.'));
        }

      } else {
        // Universal Binary Extractor Fallback (e.g. for .doc, .pages)
        // Truncate to first 400KB to prevent UI thread freezing on heavy regex
        const slice = file.size > 400000 ? file.slice(0, 400000) : file;
        const arrayBuffer = await slice.arrayBuffer();
        
        // Old binary files like .doc store text in either UTF-16LE or ANSI (e.g., GB18030 for Chinese)
        const text16 = new TextDecoder('utf-16le').decode(arrayBuffer);
        const text8 = new TextDecoder('gb18030').decode(arrayBuffer); // GB18030 is backward compatible with ASCII/UTF-8
        
        const cleanRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g;
        const clean16 = text16.replace(cleanRegex, ' ').replace(/\s{2,}/g, ' ').trim();
        const clean8 = text8.replace(cleanRegex, ' ').replace(/\s{2,}/g, ' ').trim();
        
        // Heuristic: Count valid alphanumeric and Chinese characters to see which decoding was correct
        const countValid = (str) => {
          const match = str.match(/[\u4e00-\u9fa5a-zA-Z0-9]/g);
          return match ? match.length : 0;
        };

        const score16 = countValid(clean16);
        const score8 = countValid(clean8);
        
        // Select the decoded text with the most readable characters
        resolve((score16 > score8 ? clean16 : clean8).slice(0, 400000));
      }
    } catch (error) {
      reject(error);
    }
  }).then(text => {
    // Global safety limit: Max 400,000 characters to prevent Vercel Payload Too Large and LLM Context errors
    return text && text.length > 400000 ? text.slice(0, 400000) + '\n\n[...TEXT TRUNCATED: Reached 400,000 character maximum limit...]' : text;
  });
}
