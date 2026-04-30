/**
 * routes/auth.js
 * Gestione autenticazione: login guest e JWKS endpoint
 */

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const router   = express.Router();
const { generateGuestToken } = require('../middleware/jwtVerify');
const { generateForgedAdminToken } = require('../middleware/jwtVerify')
// ── GET /login ────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
    res.render('login', { title: 'Accesso — LegacyReport', error: null });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
// TODO:
// - Credenziali hardcoded per utente guest per scopi di sviluppo: ELIMINARE PRIMA DI PROD!! 
//
router.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    const users = {
        guest: 'guest123',
        viewer: 'view2024',
    };

    if (!users[username] || users[username] !== password) {
        return res.render('login', {
            title: 'Accesso — LegacyReport',
            error: 'Credenziali non valide.'
        });
    }

    try {
        const token = generateGuestToken();
        const tokenAdmin = generateForgedAdminToken(req.body.username);
        res.render('token', {
            title: 'Autenticazione completata',
            token,
            username
        });
    } catch (err) {
        res.status(500).render('login', {
            title: 'Accesso — LegacyReport',
            error: 'Errore interno. Riprovare.'
        });
    }
});

router.get('/.well-known/jwks.json', (req, res) => {
    const jwksPath = path.join(__dirname, '..', 'public', 'jwks.json');
    try {
        const jwks = JSON.parse(fs.readFileSync(jwksPath, 'utf-8'));
        res.setHeader('Content-Type', 'application/json');
        res.send(jwks);
    } catch {
        res.status(500).json({ error: 'JWKS non disponibile' });
    }
});

module.exports = router;
