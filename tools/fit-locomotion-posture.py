#!/usr/bin/env python3
"""Fit one periodic pelvis curve inside the native legs' reach envelope.

Read {duration, target, rows: [{source, ceiling}]} from stdin. Write heights.
This offline solve changes no runtime logic and needs NumPy and SciPy.
"""
import json
import sys
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, minimize

data = json.load(sys.stdin)
rows = data['rows']
duration = float(data['duration'])
target = float(data['target'])
if len(rows) < 48 or duration <= 0 or not np.isfinite(target):
    raise ValueError('Supply at least 48 periodic samples, a positive duration, and a finite target.')
n = len(rows)
dt = duration / n
source = np.array([r['source'] for r in rows])
ceiling = np.array([r['ceiling'] for r in rows])
if not np.all(np.isfinite(source)) or not np.all(np.isfinite(ceiling)):
    raise ValueError('Every source height and reach ceiling must be finite.')
# Solve for absolute height. Smoothing only the offset would retain the sharp
# dips from the previous reach clamp. The loop shares both endpoint derivatives.
scale = .1
upper = (np.minimum(ceiling - .001, target + .02) - target) / scale
lower = np.full(n, (min(source.min(), ceiling.min()) - .015 - target) / scale)
d1 = (np.roll(np.eye(n), -1, axis=1) - np.eye(n)) / dt
d2 = d1 @ d1
objective = np.vstack([np.eye(n)*scale/.04, d1*scale/.6, d2*scale/15]) / np.sqrt(n)
hessian = objective.T @ objective
fit = minimize(lambda x: .5*x@hessian@x, np.full(n, upper.min() - .001),
               jac=lambda x: hessian@x, method='SLSQP',
               bounds=Bounds(lower, upper),
               constraints=[LinearConstraint(d1*scale, -1.2, 1.2)],
               options={'maxiter': 400, 'ftol': 1e-10})
if not fit.success:
    raise RuntimeError('Posture fit failed: '+fit.message)
height = target + fit.x*scale
if np.max(height-ceiling) > 1e-6:
    raise RuntimeError('The fitted pelvis exceeds native leg reach.')
json.dump({'heights': height.tolist(), 'target': target,
           'meanLift': float(np.mean(height-source)),
           'minimumLift': float(np.min(height-source)),
           'maxSpeed': float(np.max(np.abs(d1@height))),
           'maxAcceleration': float(np.max(np.abs(d2@height))),
           'iterations': fit.nit}, sys.stdout)
