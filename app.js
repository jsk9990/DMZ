/**
 * app.js — LegacyReportEngine v2.1.3
 * Entry point principale
 */

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');

const authRoutes       = require('./routes/auth');
const reportsRoutes    = require('./routes/reports');
const managementRoutes = require('./routes/management');

const app = express();

// ── View engine ───────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Header fuorvianti
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', 'Apache/2.2.31 (Ubuntu)');
    res.setHeader('X-Application', 'LegacyReportEngine/2.1.3');
    next();
});

// ── Rotte pubbliche ───────────────────────────────────────────────────────

// Homepage
// HINT nascosto nel sorgente HTML: commento con /management/dashboard
app.get('/', (req, res) => {
    res.render('index', { title: 'LegacyReport Dashboard' });
});

// Auth routes: /login, /api/auth/login, /.well-known/jwks.json
app.use('/', authRoutes);

// Reports routes: /reports, /reports/upload
app.use('/reports', reportsRoutes);

// Management routes: /management/dashboard (JWT protetto)
app.use('/management', managementRoutes);

// ── Error handlers ────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).send(
        '<html><body><h1>Not Found</h1><hr><address>Apache/2.2.31 (Ubuntu)</address></body></html>'
    );
});

app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(500).send('Internal Server Error');
});

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LegacyReportEngine] Avviato su http://0.0.0.0:${PORT}`);
    console.log(`[LegacyReportEngine] Ambiente: ${process.env.NODE_ENV || 'production'}`);
});
