#!/bin/bash
# ==============================================================================
# Legacy App Health Monitor Script v1.2
# Eseguito via systemd timer/service. NON MODIFICARE MANUALMENTE.
# ==============================================================================

LOG_FILE="/opt/app/system_health.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Avvio controlli di integrità del sistema..." >> "$LOG_FILE"

# 1. Controllo Spazio su Disco (Allarme se > 90%)
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "[$TIMESTAMP] [WARNING] Spazio disco critico: $DISK_USAGE%" >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] [INFO] Spazio disco OK: $DISK_USAGE%" >> "$LOG_FILE"
fi

# 2. Controllo Memoria RAM
MEM_TOTAL=$(free -m | awk 'NR==2 {print $2}')
MEM_USED=$(free -m | awk 'NR==2 {print $3}')
MEM_PERCENT=$(awk "BEGIN {printf \"%.2f\", $MEM_USED/$MEM_TOTAL*100}")
echo "[$TIMESTAMP] [INFO] Utilizzo RAM: $MEM_PERCENT% (${MEM_USED}MB / ${MEM_TOTAL}MB)" >> "$LOG_FILE"

# 3. Controllo Processo Node.js (Legacy API)
if pgrep -x "node" > /dev/null
then
    echo "[$TIMESTAMP] [INFO] Backend Node.js: RUNNING" >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] [ERROR] Backend Node.js: DOWN - Riavvio manuale richiesto!" >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] Fine controlli." >> "$LOG_FILE"
echo "---------------------------------------------------" >> "$LOG_FILE"