import { showAlert } from '../ui.js';
import * as pdfjsLib from 'pdfjs-dist';
import { createIcons, icons } from 'lucide';

const init = () => {
  const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const fileList = document.getElementById('fileList');
  const convertBtn = document.getElementById('convert-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document. getElementById('progress-text');
  const backBtn = document.getElementById('back-to-tools');

  let selectedFile: File | null = null;

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  // Drag & Drop
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList. add('border-indigo-500', 'bg-gray-700');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-indigo-500', 'bg-gray-700');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-500', 'bg-gray-700');
      const files = e.dataTransfer?. files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
    });
  }

  function handleFileSelection(file: File) {
    if (file.type !== 'application/pdf') {
      showAlert('Error', 'Please select a valid PDF file');
      return;
    }

    selectedFile = file;

    if (fileList) {
      fileList.classList.remove('hidden');
      fileList.innerHTML = `
        <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div class="flex items-center gap-3">
            <i data-lucide="file-text" class="w-5 h-5 text-indigo-400"></i>
            <span class="text-sm">${file.name}</span>
          </div>
          <span class="text-xs text-gray-400">${(file. size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      `;
      createIcons({ icons });
    }

    if (convertBtn) {
      convertBtn.classList.remove('hidden');
    }
  }

  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      if (!selectedFile) {
        showAlert('Error', 'Please select a PDF file first');
        return;
      }

      await extractTextFromPdf(selectedFile);
    });
  }

  async function extractTextFromPdf(file: File) {
    try {
      if (progressContainer) {
        progressContainer.classList. remove('hidden');
      }

      updateProgress(10, 'Loading PDF.. .');

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib. getDocument({ data: arrayBuffer }).promise;

      updateProgress(30, `Extracting text from ${pdf.numPages} pages...`);

      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- Page ${i} ---\n\n${pageText}\n`;

        updateProgress(30 + (i / pdf.numPages) * 60, `Processing page ${i}/${pdf.numPages}...`);
      }

      updateProgress(95, 'Creating text file...');

      // Download as . txt file
      const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.pdf', '.txt');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateProgress(100, 'Text extracted successfully!');

      setTimeout(() => {
        if (progressContainer) {
          progressContainer.classList.add('hidden');
        }
        showAlert('Success', `Text extracted from ${pdf.numPages} pages and downloaded as ${a.download}`);
      }, 500);

    } catch (error) {
      console.error('Extraction error:', error);
      showAlert('Extraction Failed', 'An error occurred while extracting text from PDF');

      if (progressContainer) {
        progressContainer.classList.add('hidden');
      }
    }
  }

  function updateProgress(percent: number, text: string) {
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    if (progressText) {
      progressText.textContent = text;
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}