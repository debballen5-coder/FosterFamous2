import { expect, test } from "bun:test";

import {
  captionOnlyText,
  fullPostText,
  normalizeCaptionFormatting,
  prepareShareContent,
} from "../src/lib/share-content";

test("formats legacy inline structured caption labels without changing facts", () => {
  const caption =
    "Adoption status: Not Yet Available Important considerations: Medical Needs, Special Needs.";

  expect(normalizeCaptionFormatting(caption)).toBe(
    "Adoption status: Not Yet Available\n\nImportant considerations: Medical Needs, Special Needs.",
  );
});

test("copies only the caption when a legacy draft repeats structured fields", () => {
  const post = {
    hook: "Meet Piper!",
    caption: "Hook: Meet Piper!\n\nCaption: Piper enjoys quiet walks.\n\nCall to Action: Apply today.\n\n#AdoptPiper #RescueDog",
    callToAction: "Apply today.",
    onScreenText: "Meet Piper",
    hashtags: ["#AdoptPiper", "#RescueDog"],
  };

  expect(captionOnlyText(post)).toBe("Piper enjoys quiet walks.");
  expect(fullPostText(post)).toBe(
    "Meet Piper!\n\nPiper enjoys quiet walks.\n\nApply today.\n\nOn-screen text: Meet Piper\n\n#AdoptPiper #RescueDog",
  );
});

test("uses one normalized payload and includes the adoption link only where supported", () => {
  const post = {
    hook: "",
    caption: "Adoption status: Available Important considerations: None recorded.",
    callToAction: "Apply today.",
    onScreenText: "",
    hashtags: ["#Adopt", "#Adopt", "#Rescue"],
    shortVersion: "",
    contentType: "Social Media Post",
  };
  const foster = { name: "Valor", adoptionUrl: "https://rescue.example/valor" };

  const instagram = prepareShareContent(post, foster, "Instagram");
  const facebook = prepareShareContent(post, foster, "Facebook");

  expect(instagram.title).toBe("Meet Valor");
  expect(instagram.adoptionLink).toBeNull();
  expect(instagram.caption).toContain("\n\nImportant considerations:");
  expect(instagram.hashtags).toEqual(["#Adopt", "#Rescue"]);
  expect(facebook.adoptionLink).toBe("https://rescue.example/valor");
  expect(facebook.shareText).toContain("https://rescue.example/valor");
});
