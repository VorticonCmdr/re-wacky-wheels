// Calibrated against the original 38x28 rear frames: 36 opaque columns and
// tyre contact at row 192. Keep physical size independent of racer distance.
export const TRACK_CAMERA = { distance: 124, height: 39.5, pitch: 0, focal: 277 };
export function trackKartUnits(mesh) {
  const [width, , depth] = mesh.bounds, pixels = 36;
  // The nearest part is closer than the model centre. Include that perspective
  // expansion when fitting, rather than treating a 3D kart as a flat billboard.
  return pixels * TRACK_CAMERA.distance / (TRACK_CAMERA.focal * width + pixels * depth / 2);
}
