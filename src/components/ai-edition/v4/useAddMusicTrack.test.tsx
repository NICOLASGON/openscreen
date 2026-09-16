// @vitest-environment jsdom
// Placing a bundled track. The defaults are the feature (see the hook's header), so what
// this pins is that a pick turns into the RIGHT bed, not merely into one.

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxcutAsset } from "@/lib/ai-edition/schema";
import type { useTimeline } from "@/lib/ai-edition/store/useTimeline";
import type { MusicTrack } from "@/lib/music";
import { useAddMusicTrack } from "./useAddMusicTrack";

vi.mock("@/contexts/I18nContext", () => ({
	useScopedT: () => (key: string) => key,
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const store = {
	document: null as null | {
		assets: Array<Partial<AxcutAsset>>;
		timeline: { clips: Array<{ timelineEndSec: number }> };
	},
	currentTimeSec: 0,
	addAudioAsset: vi.fn(),
};
vi.mock("@/lib/ai-edition/store/projectStore", () => ({
	useProjectStore: { getState: () => store },
}));

const BED_PATH = "/Applications/Openscreen.app/Contents/Resources/music/sleepy-clouds.ogg";

const TRACK: MusicTrack = {
	id: "sleepy-clouds",
	file: "sleepy-clouds.ogg",
	title: "Sleepy Clouds",
	author: "fupi",
	durationSec: 76.3,
	mood: ["ambient"],
	license: "CC0-1.0",
	licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
	sourceUrl: "https://opengameart.org/content/sleepy-clouds",
};

const resolveMusicTrack = vi.fn();
const addAudioTrack = vi.fn();

function hook() {
	const tl = { addAudioTrack } as unknown as ReturnType<typeof useTimeline>;
	return renderHook(() => useAddMusicTrack(tl)).result.current;
}

beforeEach(() => {
	store.document = { assets: [], timeline: { clips: [{ timelineEndSec: 300 }] } };
	store.currentTimeSec = 0;
	store.addAudioAsset.mockResolvedValue({ id: "asset_new", kind: "audio", originalPath: BED_PATH });
	resolveMusicTrack.mockResolvedValue({ success: true, path: BED_PATH });
	addAudioTrack.mockResolvedValue("audio_1");
	(window as unknown as { electronAPI?: unknown }).electronAPI = { resolveMusicTrack };
});

afterEach(() => {
	vi.clearAllMocks();
	(window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
});

describe("useAddMusicTrack", () => {
	// Picking the same bed twice is one file under two tracks. A second import of the path
	// would leave two assets on it, and `addAudioAsset` finds the one it just added BY PATH,
	// so its duration probe would patch the first.
	it("reuses the asset already imported for that track", async () => {
		store.document?.assets.push({ id: "asset_existing", kind: "audio", originalPath: BED_PATH });
		await hook()(TRACK);
		expect(store.addAudioAsset).not.toHaveBeenCalled();
		expect(addAudioTrack).toHaveBeenCalledWith("asset_existing", 0, expect.anything());
		expect(toastError).not.toHaveBeenCalled();
	});

	// The placement and every default are one write, so one undo step, and a failed save
	// cannot leave a half-configured bed at unity gain behind.
	it("places the bed with its defaults in a single timeline call", async () => {
		await hook()(TRACK);
		expect(addAudioTrack).toHaveBeenCalledTimes(1);
		expect(addAudioTrack.mock.calls[0][2]).toMatchObject({
			kind: "music",
			initial: { gainDb: -18, fadeInMs: 500, fadeOutMs: 500 },
		});
	});

	// Null covers a failed save; the user still has to learn the pick did not land.
	it("says so when the track could not be placed", async () => {
		addAudioTrack.mockResolvedValue(null);
		await hook()(TRACK);
		expect(toastError).toHaveBeenCalledWith("audio.musicAddFailed");
	});

	it("imports the track when the project does not hold it yet", async () => {
		await hook()(TRACK);
		expect(store.addAudioAsset).toHaveBeenCalledWith(BED_PATH, "Sleepy Clouds");
		expect(addAudioTrack).toHaveBeenCalledWith("asset_new", 0, expect.anything());
	});
});
