"""Fan-out of plant snapshots to every connected SSE client."""

from __future__ import annotations

import asyncio

from ..models import PlantSnapshot

#: Per-subscriber queue bound. Every message is a full snapshot, so dropping the
#: oldest one for a slow client loses nothing: the next snapshot supersedes it.
QUEUE_SIZE = 16


class Broadcaster:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[PlantSnapshot]] = set()

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> asyncio.Queue[PlantSnapshot]:
        queue: asyncio.Queue[PlantSnapshot] = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[PlantSnapshot]) -> None:
        self._subscribers.discard(queue)

    def publish(self, snapshot: PlantSnapshot) -> None:
        for queue in self._subscribers:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(snapshot)
