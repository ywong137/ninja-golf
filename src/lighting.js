// The measured sun in coastal-sky.hdr sits at 47.888 degrees elevation.
// Keep the photographed horizon level and rotate its azimuth to the shared sun.
export const DAY_SKY_YAW=2.95409344;
export const SUN_ELEVATION=47.888*Math.PI/180;
export const SUN_DIRECTION=Object.freeze([-Math.cos(SUN_ELEVATION)/Math.SQRT2,Math.sin(SUN_ELEVATION),-Math.cos(SUN_ELEVATION)/Math.SQRT2]);
