import { createIcons, icons } from 'lucide';

const API_URL = 'http://localhost:3001';

function showAlert(title: string, message: string) {
  alert(`${title}\n\n${message}`);
}

const init = () => {
  const fileInput = document.getElementById('wordFile') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const fileList = document.getElementById('fileList');
  const convertBtn = document.getElementById('convert-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const backBtn = document.getElementById('back-to-tools');

  let selectedFile: File | null = null;

  if (backBtn) {
    backBtn.addEventListener('click', () => window.location.href = '/');
  }

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
      if (files && files.length > 0) handleFileSelection(files[0]);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) handleFileSelection(files[0]);
    });
  }

  function handleFileSelection(file: File) {
    if (!file.name.match(/\.(doc|docx)$/i)) {
      showAlert('Error', 'Please select a valid Word file (.doc or .docx)');
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

    if (convertBtn) convertBtn.classList.remove('hidden');
  }

  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      if (!selectedFile) {
        showAlert('Error', 'Please select a Word file first');
        return;
      }
      await convertToPdf(selectedFile);
    });
  }

  async function convertToPdf(file: File) {
    try {
      if (progressContainer) progressContainer.classList.remove('hidden');
      updateProgress(10, 'Uploading Word file...');

      const formData = new FormData();
      formData.append('file', file);

      updateProgress(30, 'Converting to PDF.. .');

      const response = await fetch(`${API_URL}/convert/word-to-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      updateProgress(80, 'Downloading PDF...');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.(docx?)$/i, '.pdf');
      a.click();
      URL.revokeObjectURL(url);

      updateProgress(100, 'Done!');

      setTimeout(() => {
        if (progressContainer) progressContainer.classList.add('hidden');
        showAlert('Success', 'PDF created successfully!');
      }, 1000);

    } catch (error: any) {
      console.error('Error:', error);
      showAlert('Error', `Conversion failed: ${error.message}`);
      if (progressContainer) progressContainer.classList.add('hidden');
    }
  }

  function updateProgress(percent: number, text: string) {
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = text;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}