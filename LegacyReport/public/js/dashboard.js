/**
 * dashboard.js — LegacyReportEngine Frontend Utilities
 * Build: 2.1.3 | Last modified: 2024-01-15
 */

// ──────────────────────────────────────────────────────────────────────────
// DEVELOPER NOTE (to be removed before production push):
// Management panel endpoint: /management/dashboard
// Auth: Bearer JWT token in Authorization header
// Token validation endpoint: /.well-known/jwks.json
// ──────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Clock in system bar
    const clockEl = document.getElementById('sys-clock');
    if (clockEl) {
        const updateClock = () => {
            clockEl.textContent = new Date().toLocaleTimeString('it-IT', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    // Uptime counter (fake, cosmetic)
    const uptimeEl = document.getElementById('sys-uptime');
    if (uptimeEl) {
        let seconds = 432187;
        const formatUptime = (s) => {
            const d = Math.floor(s / 86400);
            const h = Math.floor((s % 86400) / 3600);
            const m = Math.floor((s % 3600) / 60);
            return `UP ${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        };
        uptimeEl.textContent = formatUptime(seconds);
        setInterval(() => {
            seconds++;
            uptimeEl.textContent = formatUptime(seconds);
        }, 1000);
    }

    // Upload zone drag & drop
    const uploadZone = document.querySelector('.upload-zone');
    if (uploadZone) {
        ['dragenter', 'dragover'].forEach(evt => {
            uploadZone.addEventListener(evt, (e) => {
                e.preventDefault();
                uploadZone.classList.add('drag-over');
            });
        });
        ['dragleave', 'drop'].forEach(evt => {
            uploadZone.addEventListener(evt, () => {
                uploadZone.classList.remove('drag-over');
            });
        });

        const fileInput = uploadZone.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.addEventListener('change', () => {
                const name = fileInput.files[0]?.name;
                const label = uploadZone.querySelector('.upload-label');
                if (label && name) label.textContent = name;
            });
        }
    }

    // Copy token to clipboard
    const copyBtns = document.querySelectorAll('[data-copy]');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.copy);
            if (!target) return;
            navigator.clipboard.writeText(target.textContent.trim()).then(() => {
                const orig = btn.textContent;
                btn.textContent = 'COPIATO';
                btn.style.color = 'var(--accent-green)';
                setTimeout(() => {
                    btn.textContent = orig;
                    btn.style.color = '';
                }, 1500);
            });
        });
    });

    // Animate stat values on load
    document.querySelectorAll('.stat-value[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        let current = 0;
        const step  = Math.ceil(target / 40);
        const timer = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current.toLocaleString('it-IT');
            if (current >= target) clearInterval(timer);
        }, 30);
    });

    // Active nav link
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        if (link.getAttribute('href') === window.location.pathname) {
            link.classList.add('active');
        }
    });

});
