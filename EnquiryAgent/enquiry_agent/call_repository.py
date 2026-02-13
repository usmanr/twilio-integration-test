from __future__ import annotations

import os
import logging
from dataclasses import dataclass, field
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger(__name__)


@dataclass
class CallRecord:
    call_sid: str
    from_number: str = ""
    to_number: str = ""
    status: str = ""
    recording_url: Optional[str] = None
    recording_status: Optional[str] = None
    transcript: Optional[str] = None
    steps: list[dict] = field(default_factory=list)


class CallRepository:
    """Abstract interface for call storage."""

    async def log_call(self, call_sid: str, from_number: str, to_number: str, status: str) -> None:
        raise NotImplementedError

    async def add_recording(self, call_sid: str, recording_url: str, recording_status: str) -> None:
        raise NotImplementedError

    async def update_call_record(self, call_sid: str, data: dict) -> None:
        raise NotImplementedError

    async def get_call_record(self, call_sid: str) -> Optional[CallRecord]:
        raise NotImplementedError

    async def get_all_calls(self) -> list[CallRecord]:
        raise NotImplementedError


class DynamoCallRepository(CallRepository):
    def __init__(self, table_name: str) -> None:
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION"))
        self._table = dynamodb.Table(table_name)

    async def log_call(self, call_sid: str, from_number: str, to_number: str, status: str) -> None:
        logger.info("[DB] Logged Call %s: %s. From: %s, To: %s", call_sid, status, from_number, to_number)
        self._table.update_item(
            Key={"callSid": call_sid},
            UpdateExpression="SET #from = :from, #to = :to, #status = :status",
            ExpressionAttributeNames={"#from": "from", "#to": "to", "#status": "status"},
            ExpressionAttributeValues={":from": from_number, ":to": to_number, ":status": status},
        )

    async def add_recording(self, call_sid: str, recording_url: str, recording_status: str) -> None:
        logger.info("[DB] Added recording for %s: %s", call_sid, recording_url)
        self._table.update_item(
            Key={"callSid": call_sid},
            UpdateExpression="SET recordingUrl = :url, recordingStatus = :rs",
            ExpressionAttributeValues={":url": recording_url, ":rs": recording_status},
        )

    async def update_call_record(self, call_sid: str, data: dict) -> None:
        logger.info("[DB] Updated Call %s: %s", call_sid, data)

        if "steps" in data:
            existing = await self.get_call_record(call_sid)
            merged_steps = (existing.steps if existing else []) + data["steps"]

            rest = {k: v for k, v in data.items() if k != "steps"}
            names = {"#steps": "steps"}
            values = {":steps": merged_steps}
            parts = ["#steps = :steps"]

            for key, value in rest.items():
                names[f"#{key}"] = key
                values[f":{key}"] = value
                parts.append(f"#{key} = :{key}")

            self._table.update_item(
                Key={"callSid": call_sid},
                UpdateExpression=f"SET {', '.join(parts)}",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
        else:
            names = {}
            values = {}
            parts = []
            for key, value in data.items():
                names[f"#{key}"] = key
                values[f":{key}"] = value
                parts.append(f"#{key} = :{key}")

            if parts:
                self._table.update_item(
                    Key={"callSid": call_sid},
                    UpdateExpression=f"SET {', '.join(parts)}",
                    ExpressionAttributeNames=names,
                    ExpressionAttributeValues=values,
                )

    async def get_call_record(self, call_sid: str) -> Optional[CallRecord]:
        logger.info("[DB] Getting record for %s", call_sid)
        result = self._table.get_item(Key={"callSid": call_sid})
        item = result.get("Item")
        if not item:
            return None
        return CallRecord(
            call_sid=item.get("callSid", ""),
            from_number=item.get("from", ""),
            to_number=item.get("to", ""),
            status=item.get("status", ""),
            recording_url=item.get("recordingUrl"),
            recording_status=item.get("recordingStatus"),
            transcript=item.get("transcript"),
            steps=item.get("steps", []),
        )

    async def get_all_calls(self) -> list[CallRecord]:
        result = self._table.scan()
        items = result.get("Items", [])
        return [
            CallRecord(
                call_sid=item.get("callSid", ""),
                from_number=item.get("from", ""),
                to_number=item.get("to", ""),
                status=item.get("status", ""),
                recording_url=item.get("recordingUrl"),
                recording_status=item.get("recordingStatus"),
                transcript=item.get("transcript"),
                steps=item.get("steps", []),
            )
            for item in items
        ]


class InMemoryCallRepository(CallRepository):
    def __init__(self) -> None:
        self._calls: list[CallRecord] = []

    def _find(self, call_sid: str) -> Optional[CallRecord]:
        return next((c for c in self._calls if c.call_sid == call_sid), None)

    async def log_call(self, call_sid: str, from_number: str, to_number: str, status: str) -> None:
        logger.info("[DB] Logged Call %s: %s. From: %s, To: %s", call_sid, status, from_number, to_number)
        existing = self._find(call_sid)
        if existing:
            existing.status = status
        else:
            self._calls.append(CallRecord(call_sid=call_sid, from_number=from_number, to_number=to_number, status=status))

    async def add_recording(self, call_sid: str, recording_url: str, recording_status: str) -> None:
        logger.info("[DB] Added recording for %s: %s", call_sid, recording_url)
        call = self._find(call_sid)
        if call:
            call.recording_url = recording_url
            call.recording_status = recording_status

    async def update_call_record(self, call_sid: str, data: dict) -> None:
        logger.info("[DB] Updated Call %s: %s", call_sid, data)
        call = self._find(call_sid)
        if call:
            if "steps" in data:
                call.steps.extend(data["steps"])
            for key, value in data.items():
                if key == "steps":
                    continue
                if hasattr(call, key):
                    setattr(call, key, value)
        else:
            self._calls.append(CallRecord(call_sid=call_sid, status="PROCESSING", steps=data.get("steps", [])))

    async def get_call_record(self, call_sid: str) -> Optional[CallRecord]:
        logger.info("[DB] Getting record for %s", call_sid)
        return self._find(call_sid)

    async def get_all_calls(self) -> list[CallRecord]:
        return list(self._calls)


def create_call_repository() -> CallRepository:
    table_name = os.environ.get("TWILIO_CALLS_TABLE_NAME")
    if table_name:
        return DynamoCallRepository(table_name)
    logger.info("[CallRepo] No TWILIO_CALLS_TABLE_NAME set, using in-memory store")
    return InMemoryCallRepository()
