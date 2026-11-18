"""Export the synthetic dataset for the browser demo of the frontend.

The browser demo runs the simulation inside the page, with no backend, so it
needs its own copy of the stations, the matrix and the network nodes. That copy
is generated here from the backend's data instead of being typed twice:

    python scripts/export_demo_dataset.py

It needs the backend's Python environment (it imports the application). It prints the JSON to stdout; ``--write`` saves it where the frontend reads it.
A backend test fails when the saved file no longer matches the backend data.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# The application package lives in backend/; make it importable from any directory.
sys.path.insert(0, str(ROOT / "backend"))

from app.mock_data import (  # noqa: E402
    CAUSE_EFFECT_RULES,
    FACILITY_NAME,
    GATEWAY_NODE_ID,
    NETWORK_NODES,
    SHIFT_TARGET,
    STATIONS,
)

TARGET = ROOT / "frontend" / "src" / "demo" / "dataset.json"


def build() -> str:
    """Return the dataset as JSON text, exactly as it is stored in the frontend."""
    dataset = {
        "facility": FACILITY_NAME,
        "shift_target": SHIFT_TARGET,
        "gateway_node_id": GATEWAY_NODE_ID,
        "stations": [station.model_dump(mode="json") for station in STATIONS],
        "rules": [rule.model_dump(mode="json") for rule in CAUSE_EFFECT_RULES],
        "nodes": [node.model_dump(mode="json") for node in NETWORK_NODES],
    }
    return json.dumps(dataset, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    text = build()
    if "--write" in sys.argv[1:]:
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        TARGET.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {TARGET}", file=sys.stderr)
    else:
        sys.stdout.buffer.write(text.encode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
