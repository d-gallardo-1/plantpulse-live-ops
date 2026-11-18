"""Cause & Effect rules for STN-01 Mould Preparation and STN-02 Cage Loading."""

from __future__ import annotations

from ..models import Severity
from .stations import make_rule

RULES = [
    make_rule(
        "STN-01",
        alarm_code="ALM-201",
        severity=Severity.WARNING,
        title="Release Agent Tank Low Level",
        root_cause=(
            "Release agent consumption outpaced the refill interval and the tank "
            "level fell below the low level switch."
        ),
        trip_condition="Below 15 % tank level",
        device_tag="LSL-112",
        device_description="Level switch low, release agent tank",
        plc_input="R1.S2.DI04",
        cabinet="CP-01",
        junction_box="JB-110",
        interlock_effect="Inhibits spray cycle; mould held at station.",
        affected_output="R1.S5.DO03",
        affected_output_description="Spray pump enable",
        recommended_action=(
            "Refill the release agent tank and confirm LSL-112 clears at JB-110 "
            "before resuming the spray cycle."
        ),
    ),
    make_rule(
        "STN-01",
        alarm_code="ALM-202",
        severity=Severity.HIGH,
        title="Compressed Air Header Low Pressure",
        root_cause=(
            "Header pressure sagged below the pneumatic actuator minimum, typically "
            "after a compressor trip or a large leak downstream of the dryer."
        ),
        trip_condition="Below 5.0 bar",
        device_tag="PSL-105",
        device_description="Pressure switch low, compressed air header",
        plc_input="R1.S2.DI09",
        cabinet="CP-01",
        junction_box="JB-104",
        interlock_effect="Inhibits pneumatic cleaning brushes and lid actuators.",
        affected_output="R1.S5.DO06",
        affected_output_description="Brush and lid valve manifold enable",
        recommended_action=(
            "Check compressor status and the header isolation valve; inspect the "
            "filter-regulator unit near JB-104 for leaks."
        ),
    ),
    make_rule(
        "STN-02",
        alarm_code="ALM-203",
        severity=Severity.CRITICAL,
        title="Guard Gate Open During Manipulator Cycle",
        root_cause=(
            "The access gate interlock switch opened while the cage manipulator "
            "was running in automatic cycle."
        ),
        trip_condition="Gate switch open while cycle active",
        device_tag="GS-214",
        device_description="Guard gate safety switch, manipulator cell",
        plc_input="F-R1.S1.DI02",
        cabinet="SCP-01",
        junction_box="JB-214",
        interlock_effect="Safe stop on cage manipulator.",
        affected_output="F-R1.S3.DO01",
        affected_output_description="Manipulator safe stop channel",
        recommended_action=(
            "Clear the cell, close and latch the gate, then acknowledge and reset "
            "the safety circuit at the cell panel."
        ),
    ),
    make_rule(
        "STN-02",
        alarm_code="ALM-204",
        severity=Severity.HIGH,
        title="Cage Presence Not Confirmed",
        root_cause=(
            "The photoelectric sensor did not detect the reinforcement cage after "
            "the placement step completed."
        ),
        trip_condition="No detection within 6 s",
        device_tag="PE-220",
        device_description="Photoelectric sensor, cage presence",
        plc_input="R1.S3.DI05",
        cabinet="CP-02",
        junction_box="JB-220",
        interlock_effect="Blocks mould release to casting.",
        affected_output="R1.S6.DO02",
        affected_output_description="Mould release permit",
        recommended_action=(
            "Verify the cage is seated in the mould; clean the PE-220 lens and "
            "check alignment with its reflector."
        ),
    ),
]
