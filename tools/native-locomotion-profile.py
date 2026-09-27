"""Periodic posture targets for native running; independent of Blender."""
import math

POSTURE_LIFT = .055
REACH_RESERVE = .02
PELVIS_YAW = math.radians(4)

def smooth_min(a, b, width=.003):
    return .5 * (a + b - math.sqrt((a - b) ** 2 + width ** 2))

def posture_lift(phase, reach_budgets):
    """Load during stance and rise through flight, within native leg reach."""
    previous_bounce = .022 * math.cos(phase * math.tau * 2)
    supported_bounce = .018 * math.cos((phase - .36) * math.tau * 2)
    wanted = POSTURE_LIFT + supported_bounce - previous_bounce
    limit = wanted
    for budget in reach_budgets:
        limit = smooth_min(limit, budget - REACH_RESERVE)
    return max(0., limit)

def pelvis_yaw(phase, travel_angle):
    # Backpedal uses the opposite licensed upper-body phase.
    direction = -1 if math.cos(travel_angle) < -.5 else 1
    return -direction * PELVIS_YAW * math.cos((phase + .06) * math.tau)

def recovery_lift(u, height):
    """Fold the free knee earlier without changing the last planted interpolation keys."""
    original = height * math.sin(math.pi * u) ** 1.2
    toe_off = math.sin(.25) * .12
    upward_speed = math.cos(.25) * .12 * (.25 / .04) * .72
    folded = (2*u**3-3*u*u+1)*toe_off + (u**3-2*u*u+u)*upward_speed + 16*u*u*(1-u)**2*height
    blend = max(0., min(1., (u-.04)/.14))
    blend = blend*blend*(3-2*blend)
    gain=max(0.,folded-original)
    softness=min(1.,gain/.003);softness=softness*softness*(3-2*softness)
    late=max(0.,min(1.,(u-.65)/.35))
    return original + gain*softness*blend + .06*math.sin(math.pi*late)**2
