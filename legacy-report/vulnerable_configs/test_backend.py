import requests
import pickle
import base64

print("[DEBUG] Inizio test di comunicazione con il Legacy Processor interno...")

mock_report = {"report_id": 9942, "user": "system_admin", "action": "generate_stats"}
serialized_data = pickle.dumps(mock_report)
encoded_payload = base64.b64encode(serialized_data).decode('utf-8')

print(f"[DEBUG] Payload generato (Base64): {encoded_payload[:30]}...")

url = "http://10.0.0.5:5000/api/v1/process_data"
try:
    response = requests.post(url, data={"payload": encoded_payload}, timeout=3)
    print(f"[OK] Risposta dal server: {response.text}")
except Exception as e:
    print(f"[ERRORE] Impossibile contattare 10.0.0.5. Il demone Flask è attivo?")
