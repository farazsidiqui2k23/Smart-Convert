const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');

const execAsync = promisify(exec);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir);

// Cloudmersive API Setup
const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
const Apikey = defaultClient.authentications['Apikey'];
Apikey.apiKey = 'c10274b6-96de-4eda-90d6-d88c25d7a341'; // ← API KEY YAHAN PASTE KARO

// LibreOffice path
const LIBREOFFICE_PATHS = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
];

let LIBREOFFICE_PATH = null;
for (const p of LIBREOFFICE_PATHS) {
  if (fs.existsSync(p)) {
    LIBREOFFICE_PATH = p;
    break;
  }
}

if (LIBREOFFICE_PATH) {
  console.log('✅ LibreOffice found:', LIBREOFFICE_PATH);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/\s+/g, '_');
    cb(null, Date.now() + '-' + sanitized);
  }
});
const upload = multer({ storage });

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    libreoffice:  LIBREOFFICE_PATH ?  true : false,
    cloudAPI:  Apikey.apiKey !== 'YOUR_API_KEY_HERE'
  });
});

// LibreOffice conversion (Word/Excel to PDF)
async function convertFile(inputPath, outputFormat) {
  if (!LIBREOFFICE_PATH) throw new Error('LibreOffice not installed');

  const outputDir = path.dirname(inputPath);
  const cmd = `"${LIBREOFFICE_PATH}" --headless --convert-to ${outputFormat} --outdir "${outputDir}" "${inputPath}"`;
  
  console.log('Converting:', path.basename(inputPath), '->', outputFormat);
  
  await execAsync(cmd, { timeout: 60000 });
  
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const convertedFile = path.join(outputDir, `${baseName}.${outputFormat}`);
  
  if (!fs.existsSync(convertedFile)) {
    throw new Error('Conversion failed');
  }
  
  return convertedFile;
}

// Word to PDF (LibreOffice)
app.post('/convert/word-to-pdf', upload.single('file'), async (req, res) => {
  let inputPath, outputPath;
  
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    inputPath = req.file.path;
    outputPath = await convertFile(inputPath, 'pdf');
    
    res.download(outputPath, path.basename(outputPath), () => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Conversion failed', details: error.message });
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
});

// Excel to PDF (LibreOffice)
app.post('/convert/excel-to-pdf', upload.single('file'), async (req, res) => {
  let inputPath, outputPath;
  
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    inputPath = req.file.path;
    outputPath = await convertFile(inputPath, 'pdf');
    
    res.download(outputPath, path.basename(outputPath), () => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Conversion failed', details: error.message });
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
});

// PDF to Word (Cloud API)
app.post('/convert/pdf-to-word', upload.single('file'), async (req, res) => {
  let inputPath;
  
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    inputPath = req.file.path;
    console.log('PDF to Word (Cloud):', path.basename(inputPath));
    
    const inputFile = fs.readFileSync(inputPath);
    const apiInstance = new CloudmersiveConvertApiClient.ConvertDocumentApi();
    
    apiInstance.convertDocumentPdfToDocx(inputFile, (error, data, response) => {
      if (error) {
        console.error('Cloud API Error:', error);
        res.status(500).json({ error: 'Conversion failed', details: error.message });
      } else {
        const outputFileName = path.basename(inputPath).replace('.pdf', '.docx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        res.send(Buffer.from(data));
        console.log('✅ PDF to Word successful');
      }
      
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

// PDF to Excel (Cloud API)
app.post('/convert/pdf-to-excel', upload.single('file'), async (req, res) => {
  let inputPath;
  
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    inputPath = req.file.path;
    console.log('PDF to Excel (Cloud):', path.basename(inputPath));
    
    const inputFile = fs.readFileSync(inputPath);
    const apiInstance = new CloudmersiveConvertApiClient.ConvertDocumentApi();
    
    apiInstance.convertDocumentPdfToXlsx(inputFile, (error, data, response) => {
      if (error) {
        console.error('Cloud API Error:', error);
        res.status(500).json({ error: 'Conversion failed', details: error.message });
      } else {
        const outputFileName = path.basename(inputPath).replace('.pdf', '.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
        res.send(Buffer.from(data));
        console.log('✅ PDF to Excel successful');
      }
      
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});