import { MODES } from '../engine/index.js';
import { parseSports, parseHome } from './profile.js';
import { ONBOARDING_KEY, loadBoard, loadJSON, loadMode, saveJSON } from '../storage.js';

export interface OnboardingDraft {
	displayName: string;
	sports: string[];
	modeId: string;
	boardVal: string;
	home: { lat: number; lon: number; label: string } | null;
}

export const coerceDraft = (v: Record<string, unknown>): OnboardingDraft => {
	const rawName = typeof v.displayName === 'string' ? v.displayName.trim().slice(0, 40) : '';
	const modeId = typeof v.modeId === 'string' && MODES[v.modeId] ? v.modeId : 'eskate';
	const boardVal = typeof v.boardVal === 'string' ? v.boardVal : MODES[modeId].boards[0].value;
	return { displayName: rawName, sports: parseSports(v.sports), modeId, boardVal, home: parseHome(v.home) };
};

// Draft persistence for the onboarding wizard (Task 2) — planner defaults in
// Task 7 read this back. Mode/board already live in TRANSPORT_KEY/BOARD_KEY
// via domain.selectMode/selectBoard, so this only persists the full coerced
// shape and falls back to those keys for missing fields. Never reinvented.
export const readOnboardingDraft = (): OnboardingDraft => {
	const stored = loadJSON<Record<string, unknown>>(ONBOARDING_KEY, {});
	const savedMode = loadMode();
	const savedBoard = loadBoard();
	return coerceDraft({
		...stored,
		modeId:
			typeof stored.modeId === 'string' && stored.modeId ? stored.modeId : savedMode || undefined,
		boardVal:
			typeof stored.boardVal === 'string' && stored.boardVal
				? stored.boardVal
				: savedBoard || undefined
	});
};

export const writeOnboardingDraft = (v: Record<string, unknown>): void => {
	saveJSON(ONBOARDING_KEY, coerceDraft(v));
};
