#!/usr/bin/env python3
"""Fit one periodic pelvis curve inside the native legs' reach envelope.

Read {duration, target, rows: [{source, ceiling, target?, floor?}]} from stdin.
Each optional row target supplies the desired gait height at that phase.
Write heights and fit diagnostics.
This offline solve changes no runtime logic and needs NumPy and SciPy.
"""
import json
import sys
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, OptimizeResult, lsq_linear, minimize

data = json.load(sys.stdin)
rows = data['rows']
duration = float(data['duration'])
target = float(data['target'])
if len(rows) < 48 or not np.isfinite(duration) or duration <= 0 or not np.isfinite(target):
    raise ValueError('Supply at least 48 periodic samples, a positive duration, and a finite target.')
n = len(rows)
dt = duration / n
speed_limit = float(data.get('speedLimit', 1.2))
if not np.isfinite(speed_limit) or speed_limit <= 0:
    raise ValueError('speedLimit must be a positive finite speed.')
try:
    source = np.array([r['source'] for r in rows], dtype=float)
    ceiling = np.array([r['ceiling'] for r in rows], dtype=float)
    desired = np.array([r.get('target', target) for r in rows], dtype=float)
except (TypeError, ValueError) as error:
    raise ValueError('Every source height, desired height, and reach ceiling must be a finite number.') from error
if not np.all(np.isfinite(source)) or not np.all(np.isfinite(ceiling)) or not np.all(np.isfinite(desired)):
    raise ValueError('Every source height, desired height, and reach ceiling must be a finite number.')
# Solve for absolute height. Smoothing only the offset would retain the sharp
# dips from the previous reach clamp. The loop shares both endpoint derivatives.
scale = .1
upper = (np.minimum(ceiling - .001, desired + .02) - target) / scale
lower = np.full(n, (min(source.min(), ceiling.min()) - .015 - target) / scale)
for i, row in enumerate(rows):
    if 'floor' in row:
        floor = float(row['floor'])
        if not np.isfinite(floor):
            raise ValueError('Each supplied floor must be finite.')
        lower[i] = (floor-target)/scale
if np.any(lower > upper + 1e-12):
    raise ValueError('A row floor exceeds its reachable ceiling after the 1 mm margin.')
lower = np.minimum(lower, upper)
fixed = upper-lower < 1e-10
lower[fixed] = upper[fixed]
d1 = (np.roll(np.eye(n), -1, axis=1) - np.eye(n)) / dt
d2 = d1 @ d1
objective = np.vstack([np.eye(n)*scale/.04, d1*scale/.6, d2*scale/15]) / np.sqrt(n)
hessian = objective.T @ objective
# A supplied gait curve owns the loading and flight rhythm. Penalizing its
# raw curvature would flatten that motion back into the old constant fit.
reference = (desired - target) / scale
reference_speed = d1 @ reference * scale
# Solve the correction directly. Subtracting two large quadratic costs loses
# precision when the desired curve has appreciable acceleration.
fit = None
initial = np.full(n, upper.min() - .001) - reference
if np.any(fixed):
    # Eliminate exact contacts before solving the bounded least-squares fit.
    # Near-zero bound widths make SLSQP report infeasible contact rows even
    # when the linear constraints are feasible. Do not relax those contacts.
    correction = lower-reference
    free = ~fixed
    bounded = lsq_linear(objective[:, free], -objective[:, fixed] @ correction[fixed],
                         bounds=((lower-reference)[free], (upper-reference)[free]),
                         tol=1e-12, max_iter=400, lsq_solver='exact')
    correction[free] = bounded.x
    initial = correction
    speed = d1 @ (correction+reference) * scale
    if bounded.success and np.max(np.abs(speed)) <= speed_limit+1e-8:
        fit = OptimizeResult(x=correction, success=True, nit=bounded.nit,
                             message='Bounded fit also satisfies the speed constraints.')
if fit is None:
    fit = minimize(lambda x: .5*x@hessian@x, initial,
                   jac=lambda x: hessian@x, method='SLSQP',
                   bounds=Bounds(lower-reference, upper-reference),
                   constraints=[LinearConstraint(d1*scale, -speed_limit-reference_speed, speed_limit-reference_speed)],
                   options={'maxiter': 400, 'ftol': 1e-10})
if not fit.success:
    raise RuntimeError('Posture fit failed: '+fit.message)
height = target + (fit.x+reference)*scale
if np.max(height-ceiling) > 1e-6:
    raise RuntimeError('The fitted pelvis exceeds native leg reach.')
json.dump({'heights': height.tolist(), 'target': target,
           'meanLift': float(np.mean(height-source)),
           'minimumLift': float(np.min(height-source)),
           'maxSpeed': float(np.max(np.abs(d1@height))),
           'maxAcceleration': float(np.max(np.abs(d2@height))),
           'targetRmsError': float(np.sqrt(np.mean((height-desired)**2))),
           'iterations': fit.nit}, sys.stdout)
