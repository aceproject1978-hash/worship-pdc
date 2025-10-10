const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

const ADMIN_UPLOAD_KEY = process.env.ADMIN_UPLOAD_KEY || 'demo-key';
const GOFILE_ENDPOINT = process.env.GOFILE_ENDPOINT || 'https://store1.gofile.io/uploadFile';
const ALLOW_ORIGINS = process.env.ALLOW_ORIGINS ? process.env.ALLOW_ORIGINS.split(',') : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    if (ALLOW_ORIGINS.includes('*') || !origin || ALLOW_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.get('/health', (req, res) => {
  res.send('ok');
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (req.header('X-Admin-Key') !== ADMIN_UPLOAD_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, req.file.originalname);

    const gofileRes = await axios.post(GOFILE_ENDPOINT, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const data = gofileRes.data;
    if (data.status !== 'ok') {
      return res.status(502).json({ error: 'GoFile upload failed', detail: data });
    }

    const fileURL = data.data.downloadPage;
    const fileURLDirect = data.data.directLink || fileURL;

    res.json({
      fileName: req.file.originalname,
      fileURL,
      fileURLDirect
    });
  } catch (err) {
    res.status(502).json({ error: 'Upload or GoFile error', detail: err.message });
  }
});

// Proxy endpoint (opcional, útil para móviles)
app.get('/pdf', async (req, res) => {
  const url = req.query.u;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const pdfRes = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Allow-Origin', '*');
    pdfRes.data.pipe(res);
  } catch (err) {
    res.status(502).send('PDF proxy error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Upload server running on port', PORT);
});