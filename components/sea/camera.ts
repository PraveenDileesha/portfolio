/**
 * Camera solved from the photograph, rather than eyeballed.
 *
 * Four things were measured off the source frame (1200x800 working copy):
 *
 *   horizon      y = 0.4125 of frame height
 *   boat waterline y = 0.6375
 *   boat length  x = 0.353 .. 0.628, i.e. 0.275 of frame WIDTH
 *   boat centre  x = 0.4908
 *
 * For a pinhole camera pitched down by `p` with vertical half-angle `hv`, a ray
 * of elevation `e` above the horizontal lands at
 *
 *   v = 0.5 - tan(e + p) / (2 * tan(hv))
 *
 * The horizon is e = 0, which fixes the pitch. The boat's waterline sits at
 * depression atan(H/D), which then fixes the camera height once the distance is
 * known - and the distance follows from how wide the boat is in frame. So the
 * whole rig is determined by the measurements plus a choice of focal length.
 *
 * Only the field of view is a free parameter (the photo does not record it).
 * 22 degrees vertical is a short telephoto, matching the compressed look of the
 * original. Changing it moves the camera closer or further but keeps the
 * framing identical, which is the useful property here.
 */

const DEG = Math.PI / 180;

/** Free parameter: vertical field of view. Everything else is derived. */
export const FOV_Y = 22 * DEG;

/** Measured from the photo. */
export const HORIZON_FRAC = 0.4125;
export const WATERLINE_FRAC = 0.6375;
/** Boat length as a fraction of frame HEIGHT (0.275 of width at 3:2). */
export const BOAT_SPAN_FRAC_H = 0.275 * 1.5;
export const BOAT_CENTRE_FRAC = 0.4908;

/** Chosen scale: a small inshore fishing boat, stem to stern. */
export const BOAT_LENGTH = 9;

const tanHalfV = Math.tan(FOV_Y / 2);

/** Downward pitch that puts the horizon at HORIZON_FRAC. */
export const PITCH = Math.atan((0.5 - HORIZON_FRAC) * 2 * tanHalfV);

/** Depression angle from the camera down to the boat's waterline. */
const DELTA = PITCH - Math.atan((0.5 - WATERLINE_FRAC) * 2 * tanHalfV);

/** Distance to the boat, from how much width it occupies. */
export const BOAT_DIST = BOAT_LENGTH / (BOAT_SPAN_FRAC_H * 2 * tanHalfV);

/** Camera height above the waterline. */
export const CAM_HEIGHT = BOAT_DIST * Math.tan(DELTA);

/** Sideways offset that reproduces the boat's off-centre placement. */
export const BOAT_OFFSET_X =
  (BOAT_CENTRE_FRAC - 0.5) * 2 * 1.5 * tanHalfV * BOAT_DIST;

/**
 * Angular span the photo's colour scanlines cover. The sky LUT runs from the
 * horizon (0) up to E_TOP; the water LUT from the horizon down to D_BOTTOM.
 * Mapping the LUTs by ANGLE rather than by screen position is what keeps the
 * gradient correct when the camera drifts.
 */
export const E_TOP = Math.atan(tanHalfV) - PITCH;
export const D_BOTTOM = Math.atan(tanHalfV) + PITCH;

if (process.env.NODE_ENV === "development") {
  const r = (x: number) => Math.round(x * 1000) / 1000;
  console.debug("[sea] camera solved:", {
    pitchDeg: r(PITCH / DEG),
    distance: r(BOAT_DIST),
    height: r(CAM_HEIGHT),
    skyTopDeg: r(E_TOP / DEG),
    waterBottomDeg: r(D_BOTTOM / DEG),
  });
}
