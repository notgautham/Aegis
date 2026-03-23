---
name: docker-oqs
description: Expert guidance for building Docker containers with OQS-patched OpenSSL for Post-Quantum Cryptography. Use this skill when creating Dockerfiles that compile OpenSSL 3.x with the OQS provider, setting up docker-compose for multi-service projects, or troubleshooting OQS/liboqs build issues.
---

# Docker + OQS OpenSSL

You are a DevOps engineer building Docker containers that compile OpenSSL 3.x with the Open Quantum Safe (OQS) provider. This is a hard requirement for Aegis — standard pip-installed pyOpenSSL cannot negotiate PQC cipher suites.

## Dockerfile for OQS-Patched OpenSSL

```dockerfile
FROM python:3.11-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git cmake gcc g++ make ninja-build \
    libssl-dev wget autoconf libtool \
    && rm -rf /var/lib/apt/lists/*

# Build liboqs from source
WORKDIR /tmp
RUN git clone --depth 1 https://github.com/open-quantum-safe/liboqs.git && \
    cd liboqs && mkdir build && cd build && \
    cmake -GNinja -DBUILD_SHARED_LIBS=ON .. && \
    ninja && ninja install

# Build OpenSSL 3.x with OQS provider
RUN git clone --depth 1 --branch master https://github.com/open-quantum-safe/oqs-provider.git && \
    cd oqs-provider && mkdir build && cd build && \
    cmake -GNinja -Dliboqs_DIR=/usr/local .. && \
    ninja && ninja install

# Update shared library cache
RUN ldconfig

FROM python:3.11-slim

# Copy built OQS libraries
COPY --from=builder /usr/local/lib/ /usr/local/lib/
COPY --from=builder /usr/local/lib/ossl-modules/ /usr/local/lib/ossl-modules/
RUN ldconfig

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Docker Compose

```yaml
version: "3.9"
services:
  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile.oqs
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://aegis:aegis@postgres:5432/aegis
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: aegis
      POSTGRES_PASSWORD: aegis
      POSTGRES_DB: aegis
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aegis"]
      interval: 5s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  pgdata:
  qdrant_data:
```

## Verification Test

```python
# tests/infra/test_oqs.py
def test_oqs_available():
    """Verify OQS-patched OpenSSL is operational."""
    import oqs
    kems = oqs.get_enabled_kem_mechanisms()
    assert "ML-KEM-768" in kems or "Kyber768" in kems, "ML-KEM not available"

def test_ml_kem_keygen():
    """Verify ML-KEM key generation works."""
    import oqs
    kem = oqs.KeyEncapsulation("ML-KEM-768")
    public_key = kem.generate_keypair()
    assert len(public_key) > 0

def test_ml_dsa_signing():
    """Verify ML-DSA signing works."""
    import oqs
    sig = oqs.Signature("ML-DSA-65")
    public_key = sig.generate_keypair()
    message = b"test message"
    signature = sig.sign(message)
    assert sig.verify(message, signature, public_key)
```

## Rules
- **Never run PQC operations on host OS OpenSSL.** Always use the Docker container.
- The OQS build takes ~15 minutes on first run. Use multi-stage builds to cache.
- Pin `liboqs` and `oqs-provider` versions for reproducibility in production. For hackathon, `--depth 1` latest is acceptable.
- The `oqs-python` pip package must be installed inside the OQS-patched container.
- Verify with: `python -c "import oqs; print(oqs.get_enabled_kem_mechanisms())"`
