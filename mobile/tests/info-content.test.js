import { describe, expect, test } from "bun:test";

import { FAQS, PRIVACY_SECTIONS, RESOURCE_GUIDES, TERMS_SECTIONS, resourceSlugForTitle } from "../src/lib/info-content";
import { RESOURCE_LIBRARY } from "../src/lib/options";

const RESOURCE_SLUGS = [
  "photo-tips",
  "video-tips",
  "facebook",
  "instagram",
  "tiktok",
  "adoption-listings",
  "captions-bios",
  "search-hashtags",
  "creative-promotion",
  "common-mistakes",
  "safety-accuracy",
];

describe("launch information content", () => {
  test("provides complete content for every Resource Library route", () => {
    expect(Object.keys(RESOURCE_GUIDES).sort()).toEqual([...RESOURCE_SLUGS].sort());

    expect(RESOURCE_LIBRARY).toHaveLength(11);
    expect(RESOURCE_LIBRARY.map((resource) => resourceSlugForTitle(resource.title)).sort()).toEqual([...RESOURCE_SLUGS].sort());

    RESOURCE_SLUGS.forEach((slug) => {
      const guide = RESOURCE_GUIDES[slug];
      expect(guide.title).toBeTruthy();
      expect(guide.intro).toBeTruthy();
      expect(guide.sections.length).toBeGreaterThan(0);
      expect(guide.sections.every((section) => section.heading && section.points.length > 0)).toBe(true);
    });
  });

  test("includes factual help, privacy, and terms content", () => {
    expect(FAQS.length).toBeGreaterThanOrEqual(14);
    expect(PRIVACY_SECTIONS.length).toBeGreaterThanOrEqual(6);
    expect(TERMS_SECTIONS.length).toBeGreaterThanOrEqual(6);
  });
});
