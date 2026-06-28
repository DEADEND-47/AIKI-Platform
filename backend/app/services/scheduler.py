import asyncio
import os
import json
import uuid
import httpx
from app.services.db_service import db_service
from app.services.compliance_engine import run_compliance_scan_task

ALERT_WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL", "")

async def send_compliance_alert(scan_id: str, summary: dict):
    if not ALERT_WEBHOOK_URL:
        print("[SCHEDULER] ALERT_WEBHOOK_URL not configured. Skipping warning alert broadcast.")
        return
        
    payload = {
        "text": f"🚨 *AIKI Compliance Alert* 🚨\nScheduled compliance audit completed successfully.\n*Scan ID:* `{scan_id}`\n*Total requirements checked:* {summary.get('total_requirements_checked', 0)}\n*Compliant:* {summary.get('compliant', 0)}\n*Gaps found:* {summary.get('gaps_found', 0)} (*Critical:* {summary.get('critical_gaps', 0)})",
        "attachments": [
            {
                "color": "#F85149" if summary.get("critical_gaps", 0) > 0 else "#D29922",
                "fields": [
                    {
                        "title": "Critical Violations",
                        "value": str(summary.get("critical_gaps", 0)),
                        "short": True
                    },
                    {
                        "title": "Total Gaps",
                        "value": str(summary.get("gaps_found", 0)),
                        "short": True
                    }
                ]
            }
        ]
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(ALERT_WEBHOOK_URL, json=payload)
            print(f"[SCHEDULER] Alert sent successfully. Status: {res.status_code}")
    except Exception as e:
        print(f"[SCHEDULER] Failed to send alert webhook: {e}")

async def scheduled_scan_loop():
    print("[SCHEDULER] Background scheduled scan loop initialized.")
    # Wait 60 seconds after system boot before kicking off first scan
    await asyncio.sleep(60)
    while True:
        try:
            print("[SCHEDULER] Running daily scheduled compliance audit...")
            regs = ["OISD-118", "Factory Act"]
            scan_id = str(uuid.uuid4())
            
            db_service.execute_write(
                """
                INSERT INTO compliance_scans (scan_id, status, regulations, results)
                VALUES (%s, %s, %s, %s)
                """,
                (scan_id, "queued", ",".join(regs), None)
            )
            
            # Execute scan
            await run_compliance_scan_task(scan_id, regs)
            
            # Retrieve summary
            rows = db_service.execute_read("SELECT results FROM compliance_scans WHERE scan_id = %s", (scan_id,))
            if rows and rows[0]["results"]:
                results = json.loads(rows[0]["results"])
                summary = results.get("summary", {})
                if summary.get("gaps_found", 0) > 0:
                    await send_compliance_alert(scan_id, summary)
        except Exception as e:
            print(f"[SCHEDULER] Exception during scheduled scan: {e}")
            
        # Repeat every 24 hours
        await asyncio.sleep(86400)

def start_scheduler():
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(scheduled_scan_loop())
    except RuntimeError:
        # In case there is no running event loop yet (e.g. CLI imports)
        pass
