"""Cause & Effect rules for STN-05 Curing, STN-06 Demoulding and STN-07 Stacking."""

from __future__ import annotations

from ..models import Severity
from .stations import make_rule

RULES = [
    make_rule(
        "STN-05",
        alarm_code="ALM-209",
        severity=Severity.HIGH,
        title="Steam Valve Position Feedback Mismatch",
        root_cause=(
            "Valve position feedback deviates from the commanded position, which "
            "points to a sticking actuator or loss of instrument air."
        ),
        trip_condition="Deviation above 10 % for 30 s",
        device_tag="ZT-512",
        device_description="Position transmitter, zone 2 steam control valve",
        plc_input="R3.S2.AI04",
        cabinet="CP-05",
        junction_box="JB-512",
        interlock_effect="Closes zone 2 steam isolation valve; holds tunnel advance.",
        affected_output="R3.S5.DO02",
        affected_output_description="Zone 2 steam isolation valve",
        recommended_action=(
            "Stroke-test the zone 2 valve, check the positioner air supply and "
            "verify ZT-512 wiring at JB-512."
        ),
    ),
    make_rule(
        "STN-05",
        alarm_code="ALM-210",
        severity=Severity.WARNING,
        title="Tunnel Humidity Below Setpoint",
        root_cause="Relative humidity in the tunnel dropped below the curing setpoint.",
        trip_condition="Below 85 % RH",
        device_tag="MT-520",
        device_description="Humidity transmitter, curing tunnel",
        plc_input="R3.S2.AI06",
        cabinet="CP-05",
        junction_box="JB-520",
        interlock_effect="Starts fogging nozzles; flags quality hold on batch.",
        affected_output="R3.S5.DO05",
        affected_output_description="Fogging pump start",
        recommended_action=(
            "Inspect fogging nozzles for blockage, check the tunnel door seals "
            "and review the affected batch before release."
        ),
    ),
    make_rule(
        "STN-06",
        alarm_code="ALM-211",
        severity=Severity.CRITICAL,
        title="Vacuum Lifter Low Vacuum",
        root_cause="Vacuum level at the lifter pads is insufficient for a safe lift.",
        trip_condition="Weaker than -0.60 bar",
        device_tag="PT-618",
        device_description="Vacuum pressure transmitter, lifter pads",
        plc_input="R4.S2.AI02",
        cabinet="CP-06",
        junction_box="JB-618",
        interlock_effect="Inhibits lift command; keeps segment in mould.",
        affected_output="R4.S5.DO01",
        affected_output_description="Lift command enable",
        recommended_action=(
            "Inspect pad seals and the segment surface for debris; check the "
            "vacuum pump and hose couplings."
        ),
    ),
    make_rule(
        "STN-07",
        alarm_code="ALM-212",
        severity=Severity.HIGH,
        title="Turning Device Motor Thermal Overload",
        root_cause="The thermal overload relay tripped on the turning device motor.",
        trip_condition="Overload relay tripped",
        device_tag="OL-705",
        device_description="Thermal overload relay, turning device motor",
        plc_input="R4.S3.DI08",
        cabinet="CP-07",
        junction_box="JB-705",
        interlock_effect="Stops rotation; blocks stacking crane entry.",
        affected_output="R4.S6.DO03",
        affected_output_description="Stacking crane entry permit",
        recommended_action=(
            "Let the motor cool, check for mechanical binding on the turning "
            "frame, then reset OL-705 in CP-07."
        ),
    ),
]
