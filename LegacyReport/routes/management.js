/**
 * routes/management.js
 * Pannello amministrazione — VULNERABILE SSTI
 * Protetto da JWT (requireAuth middleware)
 */

const express = require('express');
const ejs     = require('ejs');
const router  = express.Router();
const { requireAuth } = require('../middleware/jwtVerify');

// ── GET /management/dashboard ─────────────────────────────────────────────
router.get('/dashboard', requireAuth('admin'), (req, res) => {
    res.render('admin', {
        title:  'Management Dashboard',
        user:   req.user.user,
        output: null,
        error:  null
    });
});

// ── POST /management/dashboard/render-template — VULNERABILITÀ SSTI ──────
//
// I campi del form vengono concatenati in una stringa EJS e passati
// direttamente a ejs.render() senza alcuna sanitizzazione.
// L'utente può iniettare espressioni EJS che vengono eseguite come
// codice JavaScript lato server.
//
// PAYLOAD lettura file:
//   <%= global.process.mainModule.require('fs').readFileSync('/etc/passwd','utf8') %>
//
// PAYLOAD RCE:
//   <%= global.process.mainModule.require('child_process').execSync('id').toString() %>
//
router.post('/dashboard/render-template', requireAuth('admin'), (req, res) => {
    const { recipient, subject, template_body } = req.body;

    try {
        // VULNERABILE: concatenazione diretta prima di ejs.render()
        const templateStr = [
            `<b>Destinatario:</b> ${recipient}`,
            `<b>Oggetto:</b> ${subject}`,
            `<hr style="margin:12px 0">`,
            `Gentile cliente,`,
            ``,
            template_body,
            ``,
            `Cordiali saluti,`,
            `<i>Team LegacyReport Engine</i>`,
            `<small style="color:#6b7280">Generato il: `,
            `<%= new Date().toLocaleString('it-IT') %></small>`
        ].join('\n');

        const rendered = ejs.render(templateStr, { user: req.user.user });

        res.render('admin', {
            title:  'Management Dashboard',
            user:   req.user.user,
            output: rendered,
            error:  null
        });

    } catch (err) {
        res.render('admin', {
            title:  'Management Dashboard',
            user:   req.user.user,
            output: null,
            error:  'Errore nel rendering: ' + err.message
        });
    }
});

module.exports = router;
