// M6 settings service: exposes only M6-needed validated settings; provider secrets stay in Main.
export interface SettingsView {
  reviewModeDefault: "human_review" | "full_auto";
  countdownTickMs: number;
  segmentIntervalMs: number;
  configured: boolean;
}

export interface SettingsSource {
  reviewModeDefault(): "human_review" | "full_auto";
  countdownTickMs(): number;
  segmentIntervalMs(): number;
}

export class SettingsService {
  constructor(private readonly source: SettingsSource) {}

  view(): SettingsView {
    return {
      reviewModeDefault: this.source.reviewModeDefault(),
      countdownTickMs: this.source.countdownTickMs(),
      segmentIntervalMs: this.source.segmentIntervalMs(),
      configured: true,
    };
  }
}
