import { showAlert } from '../ui.js';
import * as pdfjsLib from 'pdfjs-dist';
import { createIcons, icons } from 'lucide';

const init = () => {
  const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
  const dropZone = document. getElementById('drop-zone');
  const fileList = document.getElementById('fileList');
  const convertBtn = document.getElementById('convert-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
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
      dropZone.classList.add('border-indigo-500', 'bg-gray-700');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-indigo-500', 'bg-gray-700');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-500', 'bg-gray-700');
      const files = e.dataTransfer?.files;
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
          <span class="text-xs text-gray-400">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
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

      await convertPdfToHtml(selectedFile);
    });
  }

  async function convertPdfToHtml(file: File) {
    try {
      if (progressContainer) {
        progressContainer.classList.remove('hidden');
      }

      updateProgress(10, 'Loading PDF...');

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      updateProgress(30, `Converting ${pdf.numPages} pages to HTML...`);

      let htmlContent = `<! DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${file.name. replace('.pdf', '')}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background:  #f5f5f5;
    }
    .page {
      background: white;
      padding: 40px;
      margin-bottom: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-radius: 8px;
    }
    . page-number {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e0e0e0;
    }
    .page-content {
      line-height: 1.8;
      color: #333;
    }
  </style>
</head>
<body>
  <h1>PDF to HTML Conversion</h1>
  <p><strong>Source:</strong> ${file.name}</p>
  <p><strong>Total Pages:</strong> ${pdf.numPages}</p>
  <hr style="margin: 30px 0;">
`;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');

        htmlContent += `
  <div class="page">
    <div class="page-number">Page ${i} of ${pdf.numPages}</div>
    <div class="page-content">
      ${pageText. split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('\n      ')}
    </div>
  </div>
`;

        updateProgress(30 + (i / pdf.numPages) * 60, `Processing page ${i}/${pdf.numPages}...`);
      }

      htmlContent += `
</body>
</html>`;

      updateProgress(95, 'Creating HTML file...');

      // Download as . html file
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.pdf', '.html');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateProgress(100, 'HTML created successfully!');

      setTimeout(() => {
        if (progressContainer) {
          progressContainer.classList. add('hidden');
        }
        showAlert('Success', `HTML file created and downloaded as ${a.download}`);
      }, 500);

    } catch (error) {
      console.error('Conversion error:', error);
      showAlert('Conversion Failed', 'An error occurred while converting PDF to HTML');

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