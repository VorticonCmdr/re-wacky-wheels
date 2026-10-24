// Shared with the live mesh pass so the contact patch meets the rendered wheels.
export const KART_PITCH = .34;
export const KART_FOCAL_LENGTH = 277;
export function kartProjection(item) {
  const [bx, , bz] = item.mesh.bounds, span = Math.max(bx, bz);
  // Calibrate once at the player's camera distance, then use the same world
  // units per voxel at every depth. Sprite size classes are only anchor inputs.
  const units = item.referenceWidth / bx * item.referenceDistance / KART_FOCAL_LENGTH;
  return {
    units,
    pixels: units * KART_FOCAL_LENGTH * item.scale / Math.max(item.distance, 1),
    groundOffset: span / 2 * Math.sin(KART_PITCH),
  };
}

// Soft footprint on the same ground plane as the mesh, accumulated by maximum
// rather than addition. The existing compositor applies it only to floor pixels,
// before fog, HUD and GPU karts; scenery and sprite fallbacks cannot be darkened.
export function stampKartShadow(shade, width, height, item, gridScale = 1) {
  const { pixels, groundOffset } = kartProjection(item), pitch = Math.sin(KART_PITCH);
  const lift = Math.max(0, item.groundY - item.y) / item.scale;
  const keep = 1 - Math.min(lift / 24, 1) * .5;
  const a = Math.max(.75, item.mesh.bounds[0] * pixels * .75 * keep * gridScale);
  const b = Math.max(.75, item.mesh.bounds[2] * pixels * .75 * keep * gridScale);
  const c = Math.cos(item.yaw), s = Math.sin(item.yaw);
  const rx = Math.hypot(c * a, s * b), ry = pitch * Math.hypot(s * a, c * b);
  const cx = item.x * gridScale, cy = (item.groundY - groundOffset * pixels) * gridScale;
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + .5 - cx, dz = -(y + .5 - cy) / pitch;
    const u = (c * dx - s * dz) / a, v = (s * dx + c * dz) / b;
    const q = u * u + v * v;
    if (q >= 1) continue;
    const i = y * width + x;
    shade[i] = Math.max(shade[i], keep * (1 - q) ** 1.1);
  }
}

// Horizontal travel away from the light per unit of height above the ground.
export function sunShadowSlope(sun) {
  const elevation = Math.max(sun[1], .05);
  return [sun[0] / elevation, sun[2] / elevation];
}
