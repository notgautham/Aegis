import subprocess
import json
import os
import sys

def call_cloud_api(url, headers, payload, method="POST"):
    """
    Run a cloud API call in a separate process with a clean environment 
    to bypass OQS-patched OpenSSL restrictions.
    """
    # Create a small script to execute the request
    script = f"""
import httpx
import json
import sys

try:
    with httpx.Client(timeout=30.0) as client:
        r = client.request(
            "{method}",
            "{url}",
            headers={json.dumps(headers)},
            json={json.dumps(payload)}
        )
        r.raise_for_status()
        print(json.dumps(r.json()))
except Exception as e:
    print(f"ERROR:{{e}}", file=sys.stderr)
    sys.exit(1)
"""
    
    # Clean environment: remove PQC specific variables
    env = os.environ.copy()
    env.pop("OPENSSL_CONF", None)
    env.pop("LD_LIBRARY_PATH", None)
    
    # Run the script
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        env=env
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Cloud API Subprocess Failed: {result.stderr}")
    
    return json.loads(result.stdout)
