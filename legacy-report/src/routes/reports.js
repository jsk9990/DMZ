/**
 * routes/reports.js
 * Upload e parsing XML — VULNERABILE XXE
 */

const express = require('express');
const multer  = require('multer');
const axios = require('axios'); //---> PER LE CHIAMATE HTTP
const router  = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 2 * 1024 * 1024 }
});

// ── GET /reports ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    res.render('reports', {
        title: 'Importazione Report XML',
        reportData: null,
        error: null
    });
});

// ── POST /reports/upload — VULNERABILITÀ XXE ─────────────────────────────
router.post('/upload', upload.single('reportFile'), (req, res) => {
    if (!req.file) {
        return res.render('reports', {
            title: 'Importazione Report XML',
            reportData: null,
            error: 'Nessun file selezionato.'
        });
    }

    if (!req.file.originalname.toLowerCase().endsWith('.xml')) {
        return res.render('reports', {
            title: 'Importazione Report XML',
            reportData: null,
            error: 'Formato non supportato. Caricare un file .xml'
        });
    }

    try {
        const xmlContent = req.file.buffer.toString('utf-8');

        // VULNERABILE: noent + doctype + nonet:false
        const libxmljs = require('libxmljs2');
        const doc      = libxmljs.parseXml(xmlContent, {
            noent:   true,
            doctype: true,
            nonet:   false
        });

        const get = (xpath) => doc.get(xpath)?.text() ?? null;

        const reportData = {
            title:  get('//report/title')  ?? '(senza titolo)',
            author: get('//report/author') ?? 'N/D',
            date:   get('//report/date')   ?? new Date().toLocaleDateString('it-IT'),
            body:   get('//report/body')   ?? ''
        };

        // --- INIZIO INTEGRAZIONE CYBER RANGE ---
        // Invio dei dati parsati al Legacy Data Processor interno
        try {
            // Node.js invia un normale JSON in Base64. 
            // Flask lo leggerà con yaml.load() senza problemi.
            const payloadBase64 = Buffer.from(JSON.stringify(reportData)).toString('base64');
            const filename = `xml_import_${Date.now()}.log`;

            // Usa 'await' se vuoi aspettare la risposta, altrimenti lascialo asincrono
            axios.post('http://10.10.10.20:5000/api/v1/process', {
                payload: payloadBase64,
                output_file: filename
            }, { timeout: 3000 })
            .then(() => console.log(`[+] Dati XML inviati al processore interno: ${filename}`))
            .catch(err => console.log(`[-] Processore interno non raggiungibile: ${err.message}`));
            
        } catch (backendErr) {
            console.error("Errore nell'invio al backend:", backendErr);
        }
        // --- FINE INTEGRAZIONE CYBER RANGE ---

        res.render('reports', {
            title: 'Report importato',
            reportData: reportData,
            error: null
        });

    } catch (err) {
        res.render('reports', {
            title: 'Importazione Report XML',
            reportData: null,
            error: 'Errore nel parsing: ' + err.message
        });
    }
});

module.exports = router;
