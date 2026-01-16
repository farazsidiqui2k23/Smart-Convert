import { showAlert } from '../ui.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { createIcons, icons } from 'lucide';

const init = () => {
  const fileInput = document.getElementById('htmlFile') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const fileList = document. getElementById('fileList');
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
    if (! file.name.match(/\.html? $/i) && file.type !== 'text/html') {
      showAlert('Error', 'Please select a valid HTML file (. html or .htm)');
      return;
    }

    selectedFile = file;

    if (fileList) {
      fileList.classList.remove('hidden');
      fileList.innerHTML = `
        <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div class="flex items-center gap-3">
            <i data-lucide="code" class="w-5 h-5 text-indigo-400"></i>
            <span class="text-sm">${file.name}</span>
          </div>
          <span class="text-xs text-gray-400">${(file.size / 1024).toFixed(2)} KB</span>
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
        showAlert('Error', 'Please select an HTML file first');
        return;
      }

      await convertHtmlToPdf(selectedFile);
    });
  }

  async function convertHtmlToPdf(file: File) {
    try {
      if (progressContainer) {
        progressContainer.classList. remove('hidden');
      }

      updateProgress(10, 'Reading HTML file...');

      const htmlContent = await file.text();

      updateProgress(30, 'Rendering HTML...');

      // Create temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container. style.width = '800px';
      container.innerHTML = htmlContent;
      document.body.appendChild(container);

      updateProgress(50, 'Converting to PDF...');

      // Convert HTML to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      updateProgress(70, 'Creating PDF document...');

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation:  'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal. pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      updateProgress(90, 'Saving PDF...');

      // Clean up
      document.body.removeChild(container);

      // Save PDF
      const pdfName = file.name.replace(/\.html?$/i, '.pdf');
      pdf.save(pdfName);

      updateProgress(100, 'PDF created successfully! ');

      setTimeout(() => {
        if (progressContainer) {
          progressContainer.classList.add('hidden');
        }
        showAlert('Success', `PDF created and downloaded as ${pdfName}`);
      }, 500);

    } catch (error) {
      console.error('Conversion error:', error);
      showAlert('Conversion Failed', 'An error occurred while converting HTML to PDF.  Make sure the HTML is valid.');

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