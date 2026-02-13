from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from .call_repository import CallRepository, create_call_repository

logger = logging.getLogger(__name__)


@dataclass
class Tradie:
    id: str
    name: str
    virtual_number: str
    real_mobile: str
    auto_create_jobs: bool


MOCK_TRADIES: list[Tradie] = [
    Tradie(
        id="TRADIE_101",
        name="Tom's Plumbing",
        virtual_number="+61400555666",
        real_mobile="+61499888777",
        auto_create_jobs=False,
    ),
]

_call_repo: CallRepository = create_call_repository()


class DB:
    def __init__(self, repo: CallRepository) -> None:
        self._repo = repo

    async def get_tradie_by_virtual_number(self, virtual_number: str) -> Optional[Tradie]:
        return MOCK_TRADIES[0]

    async def log_call(self, call_sid: str, from_number: str, to_number: str, status: str) -> None:
        await self._repo.log_call(call_sid, from_number, to_number, status)

    async def add_recording(self, call_sid: str, recording_url: str, recording_status: str) -> None:
        await self._repo.add_recording(call_sid, recording_url, recording_status)

    async def update_call_record(self, call_sid: str, data: dict) -> None:
        await self._repo.update_call_record(call_sid, data)

    async def get_call_record(self, call_sid: str):
        return await self._repo.get_call_record(call_sid)

    async def get_all_calls(self):
        return await self._repo.get_all_calls()


db = DB(_call_repo)
