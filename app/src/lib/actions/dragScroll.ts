// Drag-to-scroll action for horizontal carousels (board chips, mode rows).
// Native overflow-x scrolls with wheel/shift-wheel and touch, but not mouse
// drag — this adds pointer-drag scrolling plus click suppression so a drag
// ending on a label doesn't toggle its radio. Touch pointers keep native
// scrolling (no interference); keyboard users scroll via tabindex + arrows.

export const dragScroll = (node: HTMLElement): { destroy(): void } => {
	let down = false;
	let moved = false;
	let startX = 0;
	let startScroll = 0;

	const onDown = (e: PointerEvent): void => {
		if (e.pointerType !== 'mouse') return;
		if (e.button !== 0) return;
		down = true;
		moved = false;
		startX = e.clientX;
		startScroll = node.scrollLeft;
	};

	const onMove = (e: PointerEvent): void => {
		if (!down) return;
		const dx = e.clientX - startX;
		if (!moved && Math.abs(dx) > 4) {
			moved = true;
			node.classList.add('dragging');
		}
		if (moved) node.scrollLeft = startScroll - dx;
	};

	const end = (): void => {
		down = false;
		node.classList.remove('dragging');
	};

	// Capture phase: swallow the click that ends a drag so radios don't flip.
	const onClick = (e: MouseEvent): void => {
		if (moved) {
			e.preventDefault();
			e.stopPropagation();
			moved = false;
		}
	};

	node.addEventListener('pointerdown', onDown);
	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', end);
	window.addEventListener('pointercancel', end);
	node.addEventListener('click', onClick, true);

	return {
		destroy(): void {
			node.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', end);
			node.removeEventListener('click', onClick, true);
		}
	};
};
