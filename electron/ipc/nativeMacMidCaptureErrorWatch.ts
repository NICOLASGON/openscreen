/**
 * Decides, one live helper event at a time, when the macOS helper raised an
 * error mid-take.
 *
 * The start and stop waits only listen while they are pending, so an error the
 * helper raises between them (a dead writer, a stream that stopped) used to sit
 * in the buffer until the user pressed stop, while the HUD counted on for
 * minutes (issue #621). Before `recording-started` the start wait owns the
 * error, and a helper that is no longer the current process has nobody to stop.
 */
export function createNativeMacMidCaptureErrorWatch(
	isCurrentProcess: () => boolean,
	onError: () => void,
) {
	let recordingStarted = false;
	return (event: Record<string, unknown>) => {
		if (event.event === "recording-started") {
			recordingStarted = true;
		}
		if (event.event === "error" && recordingStarted && isCurrentProcess()) {
			onError();
		}
	};
}
