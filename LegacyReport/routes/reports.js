/**
 * routes/reports.js
 * Upload e parsing XML — VULNERABILE XXE
 */

const express = require('express');
const multer  = require('multer');
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

        res.render('reports', {
            title: 'Report importato',
            reportData: {
                title:  get('//report/title')  ?? '(senza titolo)',
                author: get('//report/author') ?? 'N/D',
                date:   get('//report/date')   ?? new Date().toLocaleDateString('it-IT'),
                body:   get('//report/body')   ?? ''
            },
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
