import { jsPDF } from 'jspdf';

// Simple alert function
function showAlert(title:  string, message: string) {
  alert(`${title}\n\n${message}`);
}

const init = () => {
  console.log('Text to PDF converter initialized');

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone') as HTMLElement;
  const fileList = document.getElementById('file-list') as HTMLElement;
  const convertBtn = document.getElementById('convert-button') as HTMLButtonElement;
  const progressContainer = document.getElementById('progress-container') as HTMLElement;
  const progressBar = document.getElementById('progress-bar') as HTMLElement;
  const progressText = document.getElementById('progress-text') as HTMLElement;
  const backBtn = document.getElementById('back-to-tools') as HTMLElement;

  let selectedFile: File | null = null;

  // Back button
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  // Drag and drop handlers
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

  // File input handler
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
    });
  }

  function handleFileSelection(file: File) {
    console.log('File selected:', file.name, file.type);

    // Check if it's a text file
    const isTextFile = file.name.toLowerCase().endsWith('.txt') || 
                       file.type === 'text/plain' || 
                       file.type === '';

    if (! isTextFile) {
      showAlert('Error', 'Please select a valid .txt file');
      return;
    }

    selectedFile = file;

    // Show file info
    if (fileList) {
      fileList.classList.remove('hidden');
      fileList.innerHTML = `
        <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div class="flex items-center gap-3">
            <span class="text-sm">📄 ${file.name}</span>
          </div>
          <span class="text-xs text-gray-400">${(file.size / 1024).toFixed(2)} KB</span>
        </div>
      `;
    }

    // Show convert button
    if (convertBtn) {
      convertBtn.classList.remove('hidden');
    }
  }

  // Convert button click
  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      console.log('Convert button clicked');
      
      if (!selectedFile) {
        showAlert('Error', 'Please select a text file first');
        return;
      }

      await convertTextToPDF(selectedFile);
    });
  }

  async function convertTextToPDF(file: File) {
    try {
      console.log('Starting conversion...');

      // Show progress
      if (progressContainer) progressContainer.classList.remove('hidden');
      updateProgress(10, 'Reading text file...');

      // Read file content
      const text = await file.text();
      console.log('Text read, length:', text.length);

      if (! text || text.trim().length === 0) {
        showAlert('Error', 'The text file is empty');
        if (progressContainer) progressContainer.classList.add('hidden');
        return;
      }

      updateProgress(30, 'Creating PDF...');

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      console.log('PDF document created');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - (margin * 2);
      const lineHeight = 7;

      pdf.setFontSize(11);
      pdf.setFont('helvetica');

      updateProgress(50, 'Adding text to PDF...');

      // Split text into lines
      const lines = text.split('\n');
      let y = margin;
      let pageNumber = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Wrap long lines
        const wrappedLines = pdf.splitTextToSize(line || ' ', maxWidth);
        
        for (const wrappedLine of wrappedLines) {
          // Check if we need a new page
          if (y + lineHeight > pageHeight - margin) {
            pdf.addPage();
            y = margin;
            pageNumber++;
            console.log('Added new page:', pageNumber);
          }

          pdf.text(wrappedLine, margin, y);
          y += lineHeight;
        }

        // Update progress
        if (i % 50 === 0) {
          const progress = 50 + ((i / lines.length) * 40);
          updateProgress(progress, `Processing... Page ${pageNumber}`);
        }
      }

      updateProgress(95, 'Saving PDF...');

      // Generate filename
      const pdfFileName = file.name.replace(/\.txt$/i, '') + '.pdf';
      console.log('Saving PDF as:', pdfFileName);

      // ✅ PROPER PDF DOWNLOAD
      const pdfBlob = pdf.output('blob');
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = pdfFileName;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);

      updateProgress(100, 'Done!');

      setTimeout(() => {
        if (progressContainer) progressContainer.classList.add('hidden');
        showAlert('Success', `PDF created successfully!\n\nPages: ${pageNumber}\nFile: ${pdfFileName}`);
      }, 1000);

    } catch (error:  any) {
      console.error('Conversion error:', error);
      showAlert('Error', `Failed to convert:  ${error.message}`);
      if (progressContainer) progressContainer.classList.add('hidden');
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

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}