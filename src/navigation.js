// The camera looks along +Z at yaw zero. Its screen-right vector is -X.
export function cameraRelativeMove(right, forward, yaw) {
  const length = Math.max(1, Math.hypot(right, forward));
  return {
    x: (-right * Math.cos(yaw) + forward * Math.sin(yaw)) / length,
    z: (right * Math.sin(yaw) + forward * Math.cos(yaw)) / length,
  };
}
export function aimDelta(screenRight, seconds) { return -screenRight * seconds * .32; }
export function wrapAngle(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }
export function turnToward(from, to, amount) { return from + wrapAngle(to - from) * Math.min(1, amount); }
export function radarPoint(dx, dz, yaw, radius, range) {
  const right = -dx * Math.cos(yaw) + dz * Math.sin(yaw);
  const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const distance = Math.hypot(right, forward);
  const scale = radius / Math.max(range, distance);
  return { x: right * scale, y: -forward * scale, outside: distance > range };
}
