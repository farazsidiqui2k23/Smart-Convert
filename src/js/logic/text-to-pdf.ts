import { showAlert } from '../ui.js';
import { jsPDF } from 'jspdf';
import { createIcons, icons } from 'lucide';

const init = () => {
  const fileInput = document.getElementById('textFile') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
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
      dropZone. classList.remove('border-indigo-500', 'bg-gray-700');
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
      const files = (e. target as HTMLInputElement).files;
      if (files && files. length > 0) {
        handleFileSelection(files[0]);
      }
    });
  }

  function handleFileSelection(file: File) {
    if (! file.name.match(/\. txt$/i) && file.type !== 'text/plain') {
      showAlert('Error', 'Please select a valid text file (. txt)');
      return;
    }

    selectedFile = file;

    if (fileList) {
      fileList.classList. remove('hidden');
      fileList.innerHTML = `
        <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div class="flex items-center gap-3">
            <i data-lucide="file-text" class="w-5 h-5 text-indigo-400"></i>
            <span class="text-sm">${file.name}</span>
          </div>
          <span class="text-xs text-gray-400">${(file.size / 1024).toFixed(2)} KB</span>
        </div>
      `;
      createIcons({ icons });
    }

    if (convertBtn) {
      convertBtn.classList. remove('hidden');
    }
  }

  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      if (!selectedFile) {
        showAlert('Error', 'Please select a text file first');
        return;
      }

      await convertTextToPdf(selectedFile);
    });
  }

  async function convertTextToPdf(file: File) {
    try {
      if (progressContainer) {
        progressContainer. classList.remove('hidden');
      }

      updateProgress(10, 'Reading text file...');

      const text = await file.text();

      updateProgress(40, 'Creating PDF...');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize. getWidth();
      const pageHeight = doc.internal.pageSize. getHeight();
      const margin = 20;
      const maxLineWidth = pageWidth - margin * 2;
      const lineHeight = 7;
      const fontSize = 12;

      doc.setFontSize(fontSize);

      updateProgress(60, 'Formatting content...');

      // Split text into lines
      const lines = doc.splitTextToSize(text, maxLineWidth);
      let y = margin;

      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines[i], margin, y);
        y += lineHeight;

        // Update progress
        if (i % 50 === 0) {
          updateProgress(60 + (i / lines.length) * 30, `Processing line ${i}/${lines.length}...`);
        }
      }

      updateProgress(95, 'Saving PDF...');

      // Save PDF
      const pdfName = file.name.replace(/\. txt$/i, '.pdf');
      doc.save(pdfName);

      updateProgress(100, 'PDF created successfully!');

      setTimeout(() => {
        if (progressContainer) {
          progressContainer. classList.add('hidden');
        }
        showAlert('Success', `PDF created and downloaded as ${pdfName}`);
      }, 500);

    } catch (error) {
      console.error('Conversion error:', error);
      showAlert('Conversion Failed', 'An error occurred while converting text to PDF');

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