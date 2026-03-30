import httpx
import asyncio
import time
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TARGETS = [
    "pq.cloudflareresearch.com",
    "discord.com",
    "github.com",
    "google.com",
    "microsoft.com",
    "amazon.com",
    "apple.com",
    "icicibank.com",
    "tls-v1-2.badssl.com",
    "dh2048.badssl.com"
]

# Path setup
SIM_DIR = Path(__file__).parent
RESULTS_DIR = SIM_DIR / "results"

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

async def save_asset_evidence(target_dir, asset_index, asset):
    """Save all artifacts for a specific discovered asset."""
    asset_name = f"asset_{asset_index}_{asset['port']}"
    asset_dir = target_dir / asset_name
    asset_dir.mkdir(parents=True, exist_ok=True)

    # 1. Assessment & Reason (The 'Why')
    assessment = asset.get("assessment") or {}
    (asset_dir / "risk_assessment.json").write_text(json.dumps(assessment, indent=2))

    # 2. CBOM (The Inventory)
    cbom = asset.get("cbom") or {}
    if cbom:
        (asset_dir / "cbom_cyclonedx.json").write_text(json.dumps(cbom.get("cbom_json", {}), indent=2))

    # 3. The Fix (Remediation Patch & Roadmap)
    remediation = asset.get("remediation") or {}
    if remediation:
        # Save raw HNDL Timeline data (The 'Reason')
        hndl = remediation.get("hndl_timeline")
        if hndl:
            (asset_dir / "hndl_timeline.json").write_text(json.dumps(hndl, indent=2))

        # Create the Human-Readable Report
        roadmap = remediation.get("migration_roadmap", "No roadmap generated.")
        patch = remediation.get("patch_config", "")
        
        report = f"# Aegis Remediation Report: {asset.get('hostname') or asset.get('ip_address')}\n\n"
        report += f"**Port:** {asset['port']} | **Protocol:** {asset['protocol'].upper()}\n"
        report += f"**Final Risk Score:** {assessment.get('risk_score', 'N/A')}\n"
        report += f"**Compliance Tier:** {assessment.get('compliance_tier', 'UNKNOWN')}\n\n"
        
        if hndl:
            urgency = hndl.get('urgency', 'UNKNOWN')
            report += f"## HNDL Vulnerability Reason\n"
            report += f"The asset is flagged due to high **{urgency}** urgency. "
            for entry in hndl.get('entries', []):
                report += f"Algorithm {entry['algorithm']} is predicted to be broken by year {entry['breakYear']}. "
            report += "\n\n"

        report += "## Technical Fix (Nginx/OpenSSL Patch)\n"
        report += "Apply this configuration to enable Post-Quantum Cryptography:\n"
        report += "```ini\n" + patch + "\n```\n\n"
        report += "## Phased Migration Roadmap\n"
        report += roadmap
        
        (asset_dir / "remediation_report.md").write_text(report)

    # 4. Compliance Certificate
    certificate = asset.get("certificate") or {}
    if certificate and certificate.get("certificate_pem"):
        (asset_dir / "compliance_certificate.pem").write_text(certificate["certificate_pem"])

async def run_simulation():
    log("🛡️  Aegis Final Production Benchmark (10 Targets)", "bold")
    log(f"📅 Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"📁 Evidence Root: {RESULTS_DIR}")
    print("="*85)

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

        results_summary = []

        for target in TARGETS:
            log(f"\n▶️ SCANNING: {target}", "cyan", "bold")
            try:
                # Trigger
                r = await client.post(f"{BASE_URL}/scan", json={"target": target})
                scan_id = r.json()["scan_id"]
                
                # Poll
                start_time = time.time()
                while True:
                    s_resp = await client.get(f"{BASE_URL}/scan/{scan_id}")
                    s_data = s_resp.json()
                    status = s_data["status"]
                    stage = s_data.get("stage", "starting")
                    sys.stdout.write(f"\r   [{status.upper()}] {stage} ({int(time.time()-start_time)}s)")
                    sys.stdout.flush()
                    if status in ["completed", "failed"]: break
                    await asyncio.sleep(2)
                print()

                if status == "failed":
                    log(f"   ❌ Scan failed for {target}", "red")
                    continue

                # Save Results
                res_resp = await client.get(f"{BASE_URL}/scan/{scan_id}/results")
                data = res_resp.json()
                
                if data["assets"]:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    target_dir = RESULTS_DIR / f"{target.replace('.', '_')}_{timestamp}"
                    target_dir.mkdir(parents=True, exist_ok=True)
                    
                    # We only care about the primary asset for the summary table
                    main_asset = data["assets"][0]
                    assessment = main_asset.get("assessment") or {}
                    score = assessment.get("risk_score", "N/A")
                    kex = assessment.get("kex_algorithm", "UNKNOWN")
                    tier = assessment.get("compliance_tier", "UNKNOWN")

                    for i, asset in enumerate(data["assets"]):
                        await save_asset_evidence(target_dir, i, asset)
                    
                    results_summary.append({
                        "target": target,
                        "score": score,
                        "kex": kex,
                        "tier": tier,
                        "assets": len(data["assets"])
                    })
                    log(f"   ✅ SUCCESS. {len(data['assets'])} asset(s) analyzed.", "green")
                else:
                    log(f"   ⚠️ No assets discovered.", "yellow")
            except Exception as e:
                log(f"   ❌ Error: {e}", "red")

    print("\n" + "="*100)
    print(f"{'TARGET':<30} | {'SCORE':<8} | {'ASSETS':<8} | {'KEX':<20} | {'TIER'}")
    print("-" * 100)
    for res in results_summary:
        print(f"{res['target']:<30} | {str(res['score']):<8} | {str(res['assets']):<8} | {str(res['kex']):<20} | {res['tier']}")
    print("="*100)

    log("\n🏁 Data Generation Complete. Refresh your dashboard to see the live portfolio.", "bold")

if __name__ == "__main__":
    asyncio.run(run_simulation())
