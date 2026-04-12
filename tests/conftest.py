from __future__ import annotations

from collections.abc import AsyncGenerator
import sys

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from backend.core.config import get_settings


def pytest_sessionstart(session: pytest.Session) -> None:
    if sys.version_info < (3, 11):
        pytest.exit(
            "Aegis requires Python 3.11+ for tests. "
            "Use the backend container or a local Python 3.11 environment.",
            returncode=2,
        )


_TEST_TARGET_FILTER = """
    target LIKE 'phase8-%.example.com'
    OR target LIKE 'shared-%.example.com'
    OR target LIKE 'other-%.example.com'
    OR target LIKE 'critical-%.example.com'
    OR target LIKE 'transition-%.example.com'
    OR target LIKE 'failed-%.example.com'
    OR target = 'latest.example.com'
"""


async def _purge_synthetic_scan_history() -> None:
    engine = create_async_engine(get_settings().DATABASE_URL, echo=False, future=True)
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    f"""
                    DELETE FROM remediation_actions
                    WHERE asset_id IN (
                        SELECT id FROM discovered_assets
                        WHERE scan_id IN (
                            SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER}
                        )
                    );
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM remediation_bundles
                    WHERE asset_id IN (
                        SELECT id FROM discovered_assets
                        WHERE scan_id IN (
                            SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER}
                        )
                    );
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM compliance_certificates
                    WHERE asset_id IN (
                        SELECT id FROM discovered_assets
                        WHERE scan_id IN (
                            SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER}
                        )
                    );
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM certificate_chains
                    WHERE asset_id IN (
                        SELECT id FROM discovered_assets
                        WHERE scan_id IN (
                            SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER}
                        )
                    );
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM crypto_assessments
                    WHERE asset_id IN (
                        SELECT id FROM discovered_assets
                        WHERE scan_id IN (
                            SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER}
                        )
                    );
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM cbom_documents
                    WHERE scan_id IN (SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER})
                    OR asset_id IN (
                        SELECT id FROM discovered_assets
                        WHERE scan_id IN (
                            SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER}
                        )
                    );
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM dns_records
                    WHERE scan_id IN (SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER});
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM scan_events
                    WHERE scan_id IN (SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER});
                    """
                )
            )
            await conn.execute(
                text(
                    f"""
                    DELETE FROM discovered_assets
                    WHERE scan_id IN (SELECT id FROM scan_jobs WHERE {_TEST_TARGET_FILTER});
                    """
                )
            )
            await conn.execute(text(f"DELETE FROM scan_jobs WHERE {_TEST_TARGET_FILTER};"))
    finally:
        await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
async def cleanup_synthetic_scan_history() -> AsyncGenerator[None, None]:
    # Keep local/dev DB history focused on real scans while allowing integration tests to run.
    await _purge_synthetic_scan_history()
    yield
    await _purge_synthetic_scan_history()
