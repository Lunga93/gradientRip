// Engine public API — re-export everything consumers need.

export * from './transport-modes/index.js';
export * from './energy-physics/constants.js';
export * from './energy-physics/calculate.js';
export * from './energy-physics/mass.js';
export * from './gradient-bands/thresholds.js';
export * from './gradient-bands/classify.js';
export * from './gradient-bands/css-vars.js';
export * from './route-geometry/haversine.js';
export * from './route-geometry/resample.js';
export * from './route-geometry/cumulative.js';
export * from './route-geometry/nearest.js';
export * from './route-segments/grade-at.js';
export * from './route-segments/segment.js';
export * from './route-segments/merge.js';
export * from './elevation-profile/smooth.js';
export * from './elevation-profile/svg.js';
export * from './verdict/decide.js';
export * from './verdict/messages.js';
export * from './plan-packet/types.js';
export * from './plan-packet/build.js';