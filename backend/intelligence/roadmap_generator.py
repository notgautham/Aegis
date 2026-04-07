"""
Retrieved-context-grounded roadmap generation for Phase 6.
"""

from __future__ import annotations

from collections.abc import Sequence

import httpx

from backend.core.config import Settings, get_settings

from .retrieval import build_citation_payload, build_langchain_documents, _clean_openssl_env
from .types import HndlTimelineResult, PatchArtifact, RemediationInput, RetrievedChunk, RoadmapResult
from .cloud_utils import call_cloud_api


class RoadmapGenerationError(RuntimeError):
    """Raised when a roadmap cannot be safely produced."""


class RoadmapGenerator:
    """Generate migration roadmaps with strict retrieval grounding."""

    def __init__(self, *, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def generate(
        self,
        *,
        remediation_input: RemediationInput,
        retrieved_chunks: Sequence[RetrievedChunk],
        hndl_timeline: HndlTimelineResult,
        patch: PatchArtifact,
    ) -> RoadmapResult:
        """Generate a roadmap from retrieved context, using deterministic fallback when needed."""
        if not retrieved_chunks:
            raise RoadmapGenerationError("Retrieved context is required for roadmap generation.")

        citations = build_citation_payload(retrieved_chunks)
        if self.settings.LLM_PROVIDER_MODE.lower() == "cloud":
            providers = []
            if getattr(self.settings, "GROQ_API_KEY", None):
                providers.append((
                    self.settings.GROQ_BASE_URL,
                    self.settings.GROQ_API_KEY,
                    self.settings.GROQ_MODEL
                ))
            if getattr(self.settings, "OPENROUTER_API_KEY", None):
                providers.append((
                    self.settings.OPENROUTER_BASE_URL,
                    self.settings.OPENROUTER_API_KEY,
                    self.settings.OPENROUTER_MODEL
                ))

            for base_url, api_key, model in providers:
                try:
                    content = self._generate_with_provider(
                        remediation_input=remediation_input,
                        retrieved_chunks=retrieved_chunks,
                        hndl_timeline=hndl_timeline,
                        patch=patch,
                        base_url=base_url,
                        api_key=api_key,
                        model=model,
                    )
                    return RoadmapResult(
                        content=content,
                        citations=citations,
                        used_deterministic_fallback=False,
                    )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("LLM provider %s failed: %s", base_url, e)
                    continue

        return RoadmapResult(
            content=self._build_deterministic_stub(
                remediation_input=remediation_input,
                retrieved_chunks=retrieved_chunks,
                hndl_timeline=hndl_timeline,
                patch=patch,
            ),
            citations=citations,
            used_deterministic_fallback=True,
        )

    def _generate_with_provider(
        self,
        *,
        remediation_input: RemediationInput,
        retrieved_chunks: Sequence[RetrievedChunk],
        hndl_timeline: HndlTimelineResult,
        patch: PatchArtifact,
        base_url: str,
        api_key: str,
        model: str,
    ) -> str:
        documents = build_langchain_documents(retrieved_chunks)
        context = "\n\n".join(
            f"Source: {document.metadata.get('title')} | "
            f"Section: {document.metadata.get('section')} | "
            f"Page: {document.metadata.get('page')}\n{document.page_content}"
            for document in documents
        )
        if not context:
            raise ValueError("No retrieval context could be constructed for the provider call.")

        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are generating a post-quantum migration roadmap. "
                        "Use only the supplied sources. Return plain text with the headings "
                        "'Preparation / Prerequisites', 'Hybrid Deployment', and "
                        "'Full PQC Replacement'. Cite the supplied source titles inline."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Asset: {remediation_input.asset.hostname or remediation_input.asset.ip_address}\n"
                        f"Tier: {remediation_input.compliance_tier.value}\n"
                        f"Server Type: {patch.server_type}\n"
                        f"HNDL Urgency: {hndl_timeline.urgency}\n"
                        f"Current Config:\n{patch.patch}\n\n"
                        f"Standards Context:\n{context}"
                    ),
                },
            ],
            "temperature": 0.2,
        }
        
        response_json = call_cloud_api(url, headers, payload)
        content = response_json["choices"][0]["message"]["content"].strip()
        if not content:
            raise ValueError("Provider returned an empty roadmap.")
        return content

    @staticmethod
    def _build_deterministic_stub(
        *,
        remediation_input: RemediationInput,
        retrieved_chunks: Sequence[RetrievedChunk],
        hndl_timeline: HndlTimelineResult,
        patch: PatchArtifact,
    ) -> str:
        source_titles = ", ".join(
            dict.fromkeys(
                chunk.metadata.get("title") or "Untitled Source" for chunk in retrieved_chunks
            )
        )
        urgent_algorithm = hndl_timeline.most_urgent_algorithm or "classical cryptography"
        return "\n\n".join(
            [
                "Preparation / Prerequisites\n"
                f"- Confirm an OQS-provider-enabled OpenSSL build on the {patch.server_type} estate.\n"
                f"- Preserve {patch.preserved_cipher or 'AES-256-GCM'} while validating hybrid deployment.\n"
                f"- Review the retrieved guidance set: {source_titles}.",
                "Hybrid Deployment\n"
                f"- Introduce hybrid key exchange to reduce HNDL exposure tied to {urgent_algorithm}.\n"
                "- Apply the deterministic server patch and validate TLS 1.3 negotiation in staging.\n"
                "- Re-scan after rollout to confirm the asset remains in scope and transitions cleanly.",
                "Full PQC Replacement\n"
                f"- Replace residual classical dependencies associated with {urgent_algorithm}.\n"
                "- Re-issue certificates and remove temporary hybrid compatibility once dependent clients are ready.\n"
                f"- Re-run Aegis remediation and certification workflows for the asset tier {remediation_input.compliance_tier.value}.",
            ]
        )
