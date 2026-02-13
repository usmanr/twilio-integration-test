"""
AWS Lambda handler — Python equivalent of src/twilio/lambda.ts.

Routes API Gateway V2 (HTTP API) events to controller functions,
replicating the Express-like req/res adapter from the TypeScript version.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from typing import Any, Callable, Awaitable
from urllib.parse import parse_qs

from .controller import (
    get_incoming_call_with_ivr_response,
    handle_ivr_selection,
    handle_ivr_recording_completed,
    handle_ivr_transcription_completed,
    handle_va_incoming_call,
    handle_va_recording_available,
    handle_va_transcription_available,
    get_all_calls,
    get_polished_description,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

HandlerFn = Callable[[dict, dict], Awaitable[None]]

ROUTES: list[dict[str, Any]] = [
    # IVR flow
    {"method": "POST", "path": "/webhooks/voice/ivr-incoming", "handler": get_incoming_call_with_ivr_response},
    {"method": "POST", "path": "/webhooks/voice/ivr-selection", "handler": handle_ivr_selection},
    {"method": "POST", "path": "/webhooks/voice/ivr-recording-completed", "handler": handle_ivr_recording_completed},
    {"method": "POST", "path": "/webhooks/voice/ivr-transcription-completed", "handler": handle_ivr_transcription_completed},
    # VA flow
    {"method": "POST", "path": "/webhooks/voice/va-incoming", "handler": handle_va_incoming_call},
    {"method": "POST", "path": "/webhooks/voice/va-transcription-available", "handler": handle_va_transcription_available},
    {"method": "POST", "path": "/webhooks/voice/va-recording-post", "handler": handle_va_recording_available},
    # Debug / read endpoints
    {"method": "GET", "path": "/webhooks/voice/all-calls", "handler": get_all_calls},
    {"method": "GET", "path": "/webhooks/voice/all-calls/polished", "handler": get_polished_description},
]


def _parse_body(event: dict) -> dict[str, Any]:
    """Parse the event body (handles form-urlencoded from Twilio and JSON)."""
    raw_body: str = event.get("body", "") or ""
    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    content_type = (event.get("headers") or {}).get("content-type", "")

    if "application/json" in content_type:
        try:
            return json.loads(raw_body)
        except (json.JSONDecodeError, TypeError):
            return {}

    # Default: application/x-www-form-urlencoded (Twilio webhook format)
    parsed = parse_qs(raw_body, keep_blank_values=True)
    # parse_qs returns lists; flatten single-value keys to match querystring.parse behaviour
    return {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}


def _lowercase_keys(obj: dict[str, Any]) -> dict[str, Any]:
    """Replicate the lowercaseBodyKeys middleware used in Express."""
    return {k.lower(): v for k, v in obj.items()}


async def _async_handler(event: dict) -> dict[str, Any]:
    http_ctx = event.get("requestContext", {}).get("http", {})
    method = http_ctx.get("method", "")
    path = event.get("rawPath", "")

    # Derive BASE_URL from the API Gateway domain
    domain = event.get("requestContext", {}).get("domainName", "")
    if domain:
        os.environ["BASE_URL"] = f"https://{domain}"

    route = next(
        (r for r in ROUTES if r["method"] == method and r["path"] == path),
        None,
    )
    if not route:
        return {
            "statusCode": 404,
            "body": json.dumps({"error": "Route not found"}),
        }

    body = _lowercase_keys(_parse_body(event))
    req: dict[str, Any] = {
        "body": body,
        "query": event.get("queryStringParameters") or {},
        "headers": event.get("headers") or {},
        "params": event.get("pathParameters") or {},
    }

    res: dict[str, Any] = {
        "status_code": 200,
        "body": "",
        "content_type": "application/json",
    }

    try:
        await route["handler"](req, res)
        return {
            "statusCode": res["status_code"],
            "headers": {"Content-Type": res["content_type"]},
            "body": res["body"],
        }
    except Exception:
        logger.exception("Lambda handler error")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"}),
        }


def handler(event: dict, context: Any = None) -> dict[str, Any]:
    """AWS Lambda entry point."""
    return asyncio.get_event_loop().run_until_complete(_async_handler(event))
