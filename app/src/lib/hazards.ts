// Hazard helpers — skeleton (Phase D Task 1); Task 3 fills in isOpen,
// renewedExpiry, and nearLine. HAZARD_KINDS is canonically defined in
// ./closed-sets.ts (the DB CHECK mirror required by AGENTS.md §1) and
// re-exported here so hazard code imports from one home.
import { HAZARD_KINDS } from './closed-sets.js';

export { HAZARD_KINDS };

export type HazardKind = (typeof HAZARD_KINDS)[number];

// Worst-first rank: closure > unsafe > police > pothole > surface > other
// (lower wins the explore badge; Task 3 unit-tests the order).
export const WORST_RANK: Record<HazardKind, number> = {
	closure: 0,
	unsafe: 1,
	police: 2,
	pothole: 3,
	surface: 4,
	other: 5
};
