"""
End-to-end cross-phase validation from discovery-style input through certificate issuance.
"""

from __future__ import annotations

import uuid

import pytest
from qdrant_client import QdrantClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.analysis.cert_analyzer import CertificateAnalyzer
from backend.analysis.cipher_parser import parse_tls12_cipher_suite
from backend.analysis.risk_scorer import calculate_risk_score
from backend.cbom.cyclonedx_mapper import AssetCbomBundle, CycloneDxMapper
from backend.cert import CertificateRequest, CertificateSigner, get_extension_payload, load_certificate
from backend.compliance import ComplianceInput, RulesEngine
from backend.core.config import Settings, get_settings
from backend.discovery.cert_extractor import CertificateExtractor
from backend.discovery.types import TLSProbeResult
from backend.intelligence.rag_orchestrator import RagOrchestrator
from backend.intelligence.retrieval import RetrievalService, create_embedding_provider
from backend.intelligence.types import RemediationInput
from backend.models.certificate_chain import CertificateChain
from backend.models.crypto_assessment import CryptoAssessment
from backend.models.discovered_asset import DiscoveredAsset
from backend.models.enums import ComplianceTier, ScanStatus, ServiceType
from backend.models.scan_job import ScanJob
from backend.repositories.cbom_repo import CbomDocumentRepository
from backend.repositories.compliance_cert_repo import ComplianceCertificateRepository
from backend.repositories.remediation_repo import RemediationBundleRepository
from tests.unit._certificate_helpers import build_rsa_certificate_chain
from tests.unit._phase6_helpers import write_sample_corpus
from tests.unit._phase7_helpers import unavailable_oqs_capability


@pytest.fixture
async def db_session():
    engine = create_async_engine(get_settings().DATABASE_URL, echo=False, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        transaction = await session.begin()
        try:
            yield session
        finally:
            await transaction.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_vulnerable_tls12_flow_persists_cbom_remediation_and_certificate(
    tmp_path,
    monkeypatch,
    db_session,
) -> None:
    leaf_pem, root_pem = build_rsa_certificate_chain()
    tls_result = TLSProbeResult(
        hostname="testssl.sh",
        ip_address="104.21.64.1",
        port=443,
        protocol="tcp",
        tls_version="1.2",
        cipher_suite="TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
        certificate_chain_pem=(leaf_pem, root_pem),
        server_software="nginx",
    )

    extracted = CertificateExtractor().extract(tls_result)
    analyzed = CertificateAnalyzer().analyze(extracted)
    parsed_cipher = parse_tls12_cipher_suite(tls_result.cipher_suite or "")
    risk = calculate_risk_score(
        kex_vulnerability=parsed_cipher.kex_vulnerability,
        sig_vulnerability=parsed_cipher.sig_vulnerability,
        sym_vulnerability=parsed_cipher.sym_vulnerability,
        tls_version=tls_result.tls_version,
    )
    evaluation = RulesEngine().evaluate(
        ComplianceInput(
            kex_algorithm=parsed_cipher.kex_algorithm,
            auth_algorithm=parsed_cipher.auth_algorithm,
            enc_algorithm=parsed_cipher.enc_algorithm,
            risk_score=risk.score,
        )
    )

    scan_job = ScanJob(
        id=uuid.uuid4(),
        target=tls_result.hostname or tls_result.ip_address,
        status=ScanStatus.COMPLETED,
    )
    asset = DiscoveredAsset(
        id=uuid.uuid4(),
        scan_id=scan_job.id,
        hostname=tls_result.hostname,
        ip_address=tls_result.ip_address,
        port=tls_result.port,
        protocol=tls_result.protocol,
        service_type=ServiceType.TLS,
        server_software=tls_result.server_software,
    )
    assessment = CryptoAssessment(
        id=uuid.uuid4(),
        asset_id=asset.id,
        tls_version=tls_result.tls_version,
        cipher_suite=tls_result.cipher_suite,
        kex_algorithm=parsed_cipher.kex_algorithm,
        auth_algorithm=parsed_cipher.auth_algorithm,
        enc_algorithm=parsed_cipher.enc_algorithm,
        mac_algorithm=parsed_cipher.mac_algorithm,
        kex_vulnerability=parsed_cipher.kex_vulnerability,
        sig_vulnerability=parsed_cipher.sig_vulnerability,
        sym_vulnerability=parsed_cipher.sym_vulnerability,
        tls_vulnerability=risk.tls_vulnerability,
        risk_score=risk.score,
    )

    db_session.add(scan_job)
    db_session.add(asset)
    db_session.add(assessment)
    await db_session.flush()

    persisted_certificates: list[CertificateChain] = []
    for extracted_cert, analyzed_cert in zip(extracted, analyzed, strict=True):
        certificate = CertificateChain(
            id=uuid.uuid4(),
            asset_id=asset.id,
            cert_level=extracted_cert.cert_level,
            subject=extracted_cert.subject,
            issuer=extracted_cert.issuer,
            public_key_algorithm=extracted_cert.public_key_algorithm,
            key_size_bits=extracted_cert.key_size_bits,
            signature_algorithm=extracted_cert.signature_algorithm,
            quantum_safe=analyzed_cert.quantum_safe,
            not_before=extracted_cert.not_before,
            not_after=extracted_cert.not_after,
        )
        db_session.add(certificate)
        persisted_certificates.append(certificate)
    await db_session.flush()

    cbom_mapper = CycloneDxMapper()
    cbom_document = await cbom_mapper.persist_cbom(
        bundle=AssetCbomBundle(
            asset=asset,
            assessment=assessment,
            certificates=persisted_certificates,
            compliance=evaluation,
        ),
        cbom_repository=CbomDocumentRepository(db_session),
    )

    retrieval_service = RetrievalService(
        client=QdrantClient(":memory:"),
        collection_name="phase3_to_phase7_docs",
        embedding_provider=create_embedding_provider(Settings()),
        default_top_k=5,
    )
    retrieval_service.ingest_source_directory(write_sample_corpus(tmp_path / "corpus"))
    remediation_bundle = await RagOrchestrator(retrieval_service=retrieval_service).generate_and_persist(
        remediation_input=RemediationInput(
            asset=asset,
            assessment=assessment,
            cbom_document=cbom_document,
            compliance_tier=evaluation.tier,
        ),
        remediation_repository=RemediationBundleRepository(db_session),
        certificates=persisted_certificates,
    )

    signer = CertificateSigner(runtime_dir=tmp_path / "cert-runtime")
    monkeypatch.setattr(signer, "_detect_oqs_capability", lambda: unavailable_oqs_capability())
    persisted_certificate = await signer.issue_and_persist(
        certificate_request=CertificateRequest(
            asset=asset,
            assessment=assessment,
            remediation_bundle=remediation_bundle,
        ),
        compliance_certificate_repository=ComplianceCertificateRepository(db_session),
    )
    parsed_certificate = load_certificate(persisted_certificate.certificate_pem)

    assert analyzed[0].quantum_safe is False
    assert risk.score == 84.5
    assert evaluation.tier is ComplianceTier.QUANTUM_VULNERABLE
    assert assessment.compliance_tier is ComplianceTier.QUANTUM_VULNERABLE
    assert cbom_document.cbom_json["quantumRiskSummary"]["tier"] == "QUANTUM_VULNERABLE"
    assert remediation_bundle is not None
    assert "ssl_ecdh_curve X25519MLKEM768:X25519;" in remediation_bundle.patch_config
    assert remediation_bundle.source_citations["documents"]
    assert persisted_certificate.tier is ComplianceTier.QUANTUM_VULNERABLE
    assert persisted_certificate.remediation_bundle_id == remediation_bundle.id
    assert get_extension_payload(parsed_certificate, "pqc_status") == "VULNERABLE"
    assert (
        get_extension_payload(parsed_certificate, "remediation_bundle_id")
        == str(remediation_bundle.id)
    )
