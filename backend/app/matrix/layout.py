"""Shared description of the workbook layout used by the exporter and the parser."""

from __future__ import annotations

import re

from ..models import CauseEffectRule

SHEET_NAME = "Cause & Effect Matrix"

#: Rows of the generated workbook.
TITLE_ROW, GROUP_ROW, HEADER_ROW, FIRST_DATA_ROW = 1, 2, 3, 4

#: (group header, [(column header, rule field)]).
MATRIX_LAYOUT: list[tuple[str, list[tuple[str, str]]]] = [
    (
        "IDENTIFICATION",
        [
            ("Alarm Code", "alarm_code"),
            ("Station ID", "station_id"),
            ("Station Name", "station_name"),
            ("Severity", "severity"),
            ("Alarm Title", "title"),
        ],
    ),
    (
        "CAUSE",
        [
            ("Root Cause", "root_cause"),
            ("Trip Condition", "trip_condition"),
        ],
    ),
    (
        "FIELD HARDWARE",
        [
            ("Device Tag", "device_tag"),
            ("Device Description", "device_description"),
            ("PLC Input", "plc_input"),
            ("Cabinet", "cabinet"),
            ("Junction Box", "junction_box"),
        ],
    ),
    (
        "EFFECT",
        [
            ("Interlock Effect", "interlock_effect"),
            ("Affected Output", "affected_output"),
            ("Output Description", "affected_output_description"),
        ],
    ),
    (
        "RESPONSE",
        [
            ("Recommended Field Action", "recommended_action"),
        ],
    ),
]

#: Fields rendered in wide, wrapped columns.
WIDE_FIELDS = frozenset(
    {"root_cause", "interlock_effect", "recommended_action", "title", "device_description"}
)

REQUIRED_FIELDS = frozenset(CauseEffectRule.model_fields)


def normalise_header(value: object) -> str:
    """Lower-case a header and collapse punctuation, so wording variations match."""
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


#: Normalised column header -> rule field. The extra aliases tolerate the wording
#: commonly found in hand-maintained matrices.
HEADER_ALIASES: dict[str, str] = {
    **{
        normalise_header(header): field
        for _, columns in MATRIX_LAYOUT
        for header, field in columns
    },
    "alarm id": "alarm_code",
    "priority": "severity",
    "description": "title",
    "cause": "root_cause",
    "setpoint": "trip_condition",
    "instrument tag": "device_tag",
    "plc address": "plc_input",
    "panel": "cabinet",
    "jb": "junction_box",
    "effect": "interlock_effect",
    "action": "recommended_action",
}
