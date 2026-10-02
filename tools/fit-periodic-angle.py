#!/usr/bin/env python3
"""Fit a periodic C2 joint correction inside measured angular bounds.

Read {duration, speedLimit, controls?, rows: [{lower, upper}]} from stdin.
Angles use radians; speedLimit uses radians/second. Samples are equally spaced
over one cycle and omit its repeated endpoint. Output cubic B-spline controls.
The smallest smooth correction is preferred. Infeasible bounds fail explicitly.
"""
import json
import sys
import numpy as np
from scipy.linalg import solve_triangular
from scipy.optimize import LinearConstraint, linprog, minimize

data = json.load(sys.stdin)
rows = data['rows']
n = len(rows)
m = int(data.get('controls', 96))
duration = float(data['duration'])
speed_limit = float(data['speedLimit'])
lower = np.asarray([r['lower'] for r in rows], dtype=float)
upper = np.asarray([r['upper'] for r in rows], dtype=float)
if n < 48 or m < 8 or m > n or not np.isfinite(duration) or duration <= 0:
    raise ValueError('Supply at least 48 samples, 8..sample-count controls, and a positive duration.')
if not np.isfinite(speed_limit) or speed_limit <= 0:
    raise ValueError('speedLimit must be positive radians per second.')
if not np.all(np.isfinite(lower)) or not np.all(np.isfinite(upper)) or np.any(lower > upper):
    raise ValueError('Every angular interval must have finite lower <= upper bounds.')

basis = np.zeros((n, m))
velocity = np.zeros((n, m))
acceleration = np.zeros((n, m))
for row in range(n):
    at = row*m/n
    i, t = int(at), at % 1
    indices = [(i+j) % m for j in (-1, 0, 1, 2)]
    basis[row, indices] = [(1-t)**3/6, (3*t**3-6*t*t+4)/6,
                           (-3*t**3+3*t*t+3*t+1)/6, t**3/6]
    velocity[row, indices] = np.array([-(1-t)**2/2, 1.5*t*t-2*t,
                                      -1.5*t*t+t+.5, t*t/2])*m/duration
    acceleration[row, indices] = np.array([1-t, 3*t-2, 1-3*t, t])*(m/duration)**2

if np.all(lower <= 0) and np.all(upper >= 0):
    controls = np.zeros(m)
    iterations = 0
else:
    # Fit complete curves, so a narrow required correction can start before
    # the source joint reaches its limit. The runtime needs no extra filter.
    constraint = np.vstack([basis, velocity])
    lo = np.concatenate([lower, np.full(n, -speed_limit)])
    hi = np.concatenate([upper, np.full(n, speed_limit)])
    extent = max(np.max(np.abs(lower)), np.max(np.abs(upper)))
    initial = linprog(np.zeros(m), A_ub=np.vstack([constraint, -constraint]),
                      b_ub=np.concatenate([hi, -lo]), bounds=[(-extent, extent)]*m,
                      method='highs')
    if not initial.success:
        raise RuntimeError('No periodic angle satisfies the measured bounds and speed limit: '+initial.message)
    objective = np.vstack([basis/np.deg2rad(5), velocity/np.deg2rad(60),
                           acceleration/np.deg2rad(600)])/np.sqrt(n)
    hessian = objective.T @ objective
    # Whiten the convex quadratic before solving. Angular, velocity, and
    # acceleration costs otherwise differ by several orders of magnitude.
    # The transform changes conditioning, not the objective or constraints.
    root = np.linalg.cholesky(hessian).T
    inverse = solve_triangular(root, np.eye(m), lower=False)
    full = np.vstack([constraint, np.eye(m)]) @ inverse
    lower_full = np.concatenate([lo, np.full(m, -extent)])
    upper_full = np.concatenate([hi, np.full(m, extent)])
    norms = np.linalg.norm(full, axis=1)
    full, lower_full, upper_full = full/norms[:, None], lower_full/norms, upper_full/norms
    fit = minimize(lambda z: .5*z@z, root@initial.x,
                   jac=lambda z: z, method='SLSQP',
                   constraints=[LinearConstraint(full, lower_full, upper_full)],
                   options={'maxiter': 1500, 'ftol': 1e-10})
    if not fit.success:
        raise RuntimeError('Periodic angle fit failed: '+fit.message)
    controls, iterations = inverse@fit.x, fit.nit

angles = basis @ controls
speeds = velocity @ controls
violation = max(float(np.max(lower-angles)), float(np.max(angles-upper)),
                float(np.max(np.abs(speeds))-speed_limit), 0.)
if violation > 1e-7:
    raise RuntimeError('Periodic angle violates its measured bounds: '+str(violation))
json.dump({'controls': controls.tolist(), 'angles': angles.tolist(),
           'maxAngle': float(np.max(np.abs(angles))),
           'maxSpeed': float(np.max(np.abs(speeds))),
           'maxAcceleration': float(np.max(np.abs(acceleration @ controls))),
           'violation': violation, 'iterations': iterations}, sys.stdout)
