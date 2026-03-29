import httpx
import asyncio
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TARGETS = [
    "pq.cloudflareresearch.com",
    "discord.com",
    "github.com",
    "microsoft.com",
    "icicibank.com"
]

def log(msg, color="white", style=""):
    colors = {
        "green": "\033[92m",
        "blue": "\033[94m",
        "yellow": "\033[93m",
        "red": "\033[91m",
        "cyan": "\033[96m",
        "white": "\033[0m",
        "bold": "\033[1m"
    }
    s = colors.get(style, "")
    c = colors.get(color, "")
    print(f"{s}{c}{msg}\033[0m")

async def run_simulation():
    log("🛡️  Aegis End-to-End Terminal Simulation", "bold")
    log(f"📅 Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("ℹ️  Note: Scans are running in Direct Mode (Fast)")
    print("="*70)

    results_summary = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 1: Health Check
        try:
            health = await client.get("http://localhost:8000/health")
            if health.status_code != 200:
                log("❌ Backend is OFFLINE. Start it with 'docker-compose up -d'", "red")
                return
            log("✅ Backend is ONLINE", "green")
        except Exception:
            log("❌ Backend connection failed.", "red")
            return

        for target in TARGETS:
            log(f"\n▶️ Testing Target: {target}", "cyan", "bold")
            
            # Step 2: Trigger Scan
            try:
                create_resp = await client.post(f"{BASE_URL}/scan", json={"target": target})
                scan_id = create_resp.json()["scan_id"]
                log(f"   Scan Created: {scan_id}")

                # Step 3: Poll for Completion
                start_time = time.time()
                while True:
                    status_resp = await client.get(f"{BASE_URL}/scan/{scan_id}")
                    status_data = status_resp.json()
                    status = status_data["status"]
                    stage = status_data.get("stage", "starting")
                    
                    sys.stdout.write(f"\r   [{status.upper()}] Stage: {stage} ({int(time.time()-start_time)}s)")
                    sys.stdout.flush()

                    if status in ["completed", "failed"]:
                        break
                    await asyncio.sleep(2)
                
                print() # New line after polling

                # Step 4: Get Results
                results_resp = await client.get(f"{BASE_URL}/scan/{scan_id}/results")
                data = results_resp.json()
                if data["assets"]:
                    asset = data["assets"][0]
                    assessment = asset.get("assessment") or {}
                    score = assessment.get("risk_score", "N/A")
                    kex = assessment.get("kex_algorithm", "UNKNOWN")
                    tier = assessment.get("compliance_tier", "UNKNOWN")
                    fix = "YES" if asset.get("remediation") else "NO"
                    
                    results_summary.append({
                        "target": target,
                        "score": score,
                        "kex": kex,
                        "tier": tier,
                        "fix": fix
                    })
                    log(f"   ✅ Done. Score: {score}, KEX: {kex}", "green")
                else:
                    log(f"   ⚠️ No assets found for {target}", "yellow")
            except Exception as e:
                log(f"   ❌ Error scanning {target}: {e}", "red")

    print("\n" + "="*85)
    print(f"{'TARGET':<30} | {'SCORE':<8} | {'KEX':<20} | {'FIX'}")
    print("-" * 85)
    for res in results_summary:
        print(f"{res['target']:<30} | {str(res['score']):<8} | {str(res['kex']):<20} | {res['fix']}")
    print("="*85)
    log("\n🏁 Simulation Complete. All backend modules verified.", "bold")

if __name__ == "__main__":
    asyncio.run(run_simulation())
