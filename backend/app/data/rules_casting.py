"""Cause & Effect rules for STN-03 Casting & Vibration and STN-04 Finishing."""

from __future__ import annotations

from ..models import Severity
from .stations import make_rule

RULES = [
    make_rule(
        "STN-03",
        alarm_code="ALM-205",
        severity=Severity.HIGH,
        title="Mould Vibrator Motor Overtemperature",
        root_cause=(
            "The winding thermistor on vibrator group B exceeded its trip "
            "temperature after extended duty or blocked cooling fins."
        ),
        trip_condition="Winding above 120 °C",
        device_tag="TS-318",
        device_description="Winding temperature switch, vibrator group B",
        plc_input="R2.S2.DI03",
        cabinet="CP-03",
        junction_box="JB-318",
        interlock_effect="Stops vibrator group B; holds pour sequence.",
        affected_output="R2.S5.DO04",
        affected_output_description="Vibrator group B contactor",
        recommended_action=(
            "Allow group B to cool, clear concrete build-up from the motor "
            "housings and review the vibration duty time."
        ),
    ),
    make_rule(
        "STN-03",
        alarm_code="ALM-206",
        severity=Severity.WARNING,
        title="Concrete Hopper Low Level",
        root_cause="Hopper inventory is insufficient for a full segment pour.",
        trip_condition="Below 20 % hopper level",
        device_tag="LT-305",
        device_description="Level transmitter, casting hopper",
        plc_input="R2.S3.AI01",
        cabinet="CP-03",
        junction_box="JB-305",
        interlock_effect="Inhibits next pour start; raises batch request.",
        affected_output="R2.S5.DO08",
        affected_output_description="Pour start permit",
        recommended_action=(
            "Confirm the batch request reached the mixing plant and check LT-305 "
            "for material build-up on the probe."
        ),
    ),
    make_rule(
        "STN-03",
        alarm_code="ALM-207",
        severity=Severity.CRITICAL,
        title="Hopper Discharge Gate Failed to Close",
        root_cause=(
            "The closed-position switch was not made after the close command; "
            "aggregate may be jamming the gate blade."
        ),
        trip_condition="Closed position not reached within 3 s",
        device_tag="ZS-309",
        device_description="Position switch closed, hopper discharge gate",
        plc_input="R2.S2.DI07",
        cabinet="CP-03",
        junction_box="JB-309",
        interlock_effect="Locks carousel advance.",
        affected_output="R2.S6.DO01",
        affected_output_description="Carousel advance permit",
        recommended_action=(
            "Stop the feed, clear the obstruction and verify ZS-309 actuation "
            "before re-enabling carousel advance."
        ),
    ),
    make_rule(
        "STN-04",
        alarm_code="ALM-208",
        severity=Severity.CRITICAL,
        title="Emergency Stop Pressed, Finishing Platform",
        root_cause=(
            "An operator pressed the emergency stop pushbutton on the finishing "
            "platform."
        ),
        trip_condition="E-stop channel open",
        device_tag="ES-402",
        device_description="Emergency stop pushbutton, finishing platform",
        plc_input="F-R1.S1.DI06",
        cabinet="SCP-01",
        junction_box="JB-402",
        interlock_effect="Safe stop on carousel main drive.",
        affected_output="F-R1.S3.DO02",
        affected_output_description="Carousel main drive safe torque off",
        recommended_action=(
            "Confirm the hazard is cleared, release the ES-402 pushbutton and "
            "reset the safety relay at the operator pulpit."
        ),
    ),
]
