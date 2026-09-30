import { describe, expect, test } from "bun:test";
import {
  buildDeterministicCta,
  createTemplateContent,
  reviewAndRepairGeneratedContent,
} from "./content-generation";
import { ContentGenerationRequestSchema } from "../types";

const baseFoster = {
  id: "quality-foster",
  name: "Ralph",
  species: "cat" as const,
  sex: "Male" as const,
  age: "",
  breed: "",
  weight: "",
  size: null,
  fosterStartDate: null,
  daysInFoster: null,
  personality: [] as string[],
  personalityNotes: "",
  goodWithDogs: "Unknown" as const,
  goodWithCats: "Unknown" as const,
  goodWithChildren: "Unknown" as const,
  childrenNotes: "",
  houseTrained: "Unknown" as const,
  crateTrained: "Unknown" as const,
  energyLevel: null,
  special: {
    favoriteActivity: "",
    favoriteToy: "",
    favoriteTreat: "",
    funniestHabit: "",
    bestSkill: "",
    mostLovableQuality: "",
    makesYouLaugh: "",
    progressMade: "",
    idealHome: "",
  },
  currentStatus: "",
  latestProgress: null,
  rescueName: "Harbor Home Rescue",
  city: "Portland",
  state: "OR",
  adoptionUrl: "",
  contactMethod: "",
  adoptionFee: "",
  adoptionStatus: "Not Yet Available" as const,
  considerations: [] as string[],
};

type RequestOptions = {
  foster?: Record<string, unknown>;
  tone?: "Warm" | "Funny" | "Heartwarming" | "Playful" | "Professional" | "Hopeful" | "Straightforward";
  length?: "Short" | "Medium" | "Detailed";
  description?: string;
  rewrite?: Record<string, unknown>;
};

function request(options: RequestOptions = {}) {
  return ContentGenerationRequestSchema.parse({
    contentType: "Social Media Post",
    foster: { ...baseFoster, ...options.foster },
    tone: options.tone ?? "Warm",
    length: options.length ?? "Medium",
    source: { type: "photo", description: options.description ?? "", mediaUrl: null },
    rewrite: options.rewrite,
  });
}

function render(options: RequestOptions = {}) {
  const input = request(options);
  return reviewAndRepairGeneratedContent(createTemplateContent(input), input.foster);
}

function postText(options: RequestOptions = {}) {
  const generated = render(options);
  return [generated.hook, generated.caption, generated.callToAction, generated.hashtags.join(" ")]
    .filter(Boolean)
    .join("\n\n");
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const internalLanguage = /no made-up backstory|based on verified facts|provided information|no assumptions|foster parent reports|safety rules|optional ai writer/i;

describe("fallback marketing quality", () => {
  test("turns a Ralph-like sparse kitten profile into a photo-led marketing post without safety-language leakage", () => {
    const result = render({
      foster: {
        age: "very young kitten",
        personality: ["Food Motivated", "Cuddly"],
        special: { ...baseFoster.special, favoriteActivity: "enjoying his bottle" },
      },
      description: "Ralph is enjoying his bottle.",
    });

    expect(result.hook).toBe("Bottle time is serious business for Ralph. 🍼");
    expect(result.caption).toContain("meals are important, and cuddles are even better");
    expect(result.caption).toContain("not available just yet");
    expect([result.hook, result.caption, result.callToAction, ...result.notes].join(" ")).not.toMatch(internalLanguage);
    expect(result.hashtags).toEqual([
      "#FosterKitten",
      "#KittenRescue",
      "#RescueKitten",
      "#CatLovers",
      "#PortlandCats",
    ]);
  });

  test("keeps Charlie's selected photo/story moment ahead of unrelated food traits", () => {
    const result = render({
      foster: {
        name: "Charlie",
        species: "dog",
        personality: ["Food Motivated"],
        special: { ...baseFoster.special, favoriteTreat: "training treats" },
      },
      description: "Charlie found a bed where he can hide from his foster brother.",
    });
    const post = [result.hook, result.caption, result.shortVersion].join(" ");

    expect(post).toContain("bed where he can hide from his foster brother");
    expect(post).not.toMatch(/snack time|mealtime|training treats/i);
  });

  test("uses a detailed personality profile as a story rather than a field summary", () => {
    const rich = render({
      foster: {
        name: "Juniper",
        species: "dog",
        age: "5-year-old",
        breed: "Labrador Retriever mix",
        size: "Large",
        personality: ["Playful", "Food Motivated", "Cuddly"],
        goodWithDogs: "Yes",
        houseTrained: "Yes",
        energyLevel: "High",
        adoptionStatus: "Available",
        adoptionUrl: "https://example.org/juniper",
        considerations: ["Only Pet"],
        special: {
          favoriteActivity: "splashing in the kiddie pool",
          favoriteToy: "a squeaky tennis ball",
          favoriteTreat: "peanut butter treats",
          funniestHabit: "carrying a shoe to the door when guests arrive",
          bestSkill: "waiting politely for dinner",
          mostLovableQuality: "leaning in for full-body cuddles",
          makesYouLaugh: "",
          progressMade: "",
          idealHome: "an active home where she can be the only pet",
        },
      },
      length: "Detailed",
      description: "Juniper is splashing in her kiddie pool.",
    });

    expect(rich.caption).toContain("Juniper is splashing in her kiddie pool");
    expect(rich.caption).toContain("There is a soft spot for cuddles");
    expect(rich.caption).not.toMatch(/mealtime|peanut butter treats/i);
    expect(rich.caption).toContain("only pet");
    expect(rich.caption).toContain("A favorite activity");
    expect(rich.caption).not.toContain("Juniper's foster describes");
  });

  test("uses a follow-and-share CTA for a foster who is not yet available", () => {
    const result = render();
    expect(result.callToAction).toContain("not available for adoption just yet");
    expect(result.callToAction).toContain("future fan club");
  });

  test("uses an inquiry CTA and only recorded adoption details for an available foster", () => {
    const result = render({
      foster: {
        adoptionStatus: "Available",
        adoptionUrl: "https://example.org/ralph",
      },
    });
    expect(result.callToAction).toContain("Learn more or apply: https://example.org/ralph");
    expect(result.callToAction).toContain("Harbor Home Rescue");
  });

  test("uses the latest recovery update instead of reviving a stale pre-surgery photo note", () => {
    const result = render({
      foster: {
        name: "Valor",
        adoptionStatus: "Medical Hold",
        currentStatus: "Surgery is complete. Valor is recovering comfortably.",
        latestProgress: {
          summary: "Valor completed surgery and is now recovering comfortably.",
          occurredAt: "2026-09-26T12:00:00.000Z",
        },
      },
      description: "Valor is waiting for surgery.",
    });

    expect([result.hook, result.caption].join(" ")).toContain("completed surgery");
    expect([result.hook, result.caption].join(" ")).not.toContain("waiting for surgery");
    expect(result.callToAction).toContain("medical hold");
  });

  test("keeps senior, shy, high-energy, and only-pet requirements accurate and readable", () => {
    const senior = render({ foster: { name: "Mabel", age: "senior cat" }, description: "Mabel is relaxing in a sunny spot." });
    const shy = render({ foster: { name: "Willow", personality: ["Shy"] }, description: "Willow is watching the room from her blanket." });
    const energetic = render({ foster: { name: "Rocket", personality: ["High Energy"] }, description: "Rocket is racing after his toy." });
    const onlyPet = render({ foster: { name: "Solo", considerations: ["Only Pet"] }, description: "Solo is curled up on the sofa." });

    expect(senior.caption).toContain("senior cat");
    expect(shy.caption).toContain("shy side");
    expect(energetic.caption).toContain("high-energy enthusiasm");
    expect(onlyPet.caption).toContain("only pet");
  });

  test("creates a materially different angle for Write Another Draft", () => {
    const originalInput = request({
      foster: { personality: ["Cuddly"] },
      description: "Ralph is enjoying his bottle.",
    });
    const original = reviewAndRepairGeneratedContent(createTemplateContent(originalInput), originalInput.foster);
    const alternative = render({
      foster: { personality: ["Cuddly"] },
      description: "Ralph is enjoying his bottle.",
      rewrite: {
        type: "Try Another Version",
        previousResult: original,
      },
    });

    expect(alternative.hook).not.toBe(original.hook);
    expect(alternative.caption).not.toBe(original.caption);
    expect(alternative.caption).toContain("The more you get to know");
  });

  test("makes warm, funny, and professional output noticeably different", () => {
    const warm = render({ tone: "Warm", description: "Ralph is enjoying his bottle." });
    const funny = render({ tone: "Funny", description: "Ralph is enjoying his bottle." });
    const professional = render({ tone: "Professional", description: "Ralph is enjoying his bottle." });

    expect(warm.hook).not.toBe(funny.hook);
    expect(funny.hook).toContain("🚨");
    expect(professional.hook).toContain("A standout moment");
  });

  test("honors Short, Medium, and Detailed requests without padding sparse profiles", () => {
    const richFoster = {
      name: "Juniper",
      species: "dog",
      age: "5-year-old",
      breed: "Labrador Retriever mix",
      size: "Large",
      personality: ["Playful", "Food Motivated", "Cuddly"],
      goodWithDogs: "Yes",
      houseTrained: "Yes",
      energyLevel: "High",
      adoptionStatus: "Available",
      adoptionUrl: "https://example.org/juniper",
      considerations: ["Only Pet"],
      special: {
        favoriteActivity: "splashing in the kiddie pool",
        favoriteToy: "a squeaky tennis ball",
        favoriteTreat: "peanut butter treats",
        funniestHabit: "carrying a shoe to the door when guests arrive",
        bestSkill: "waiting politely for dinner",
        mostLovableQuality: "leaning in for full-body cuddles",
        makesYouLaugh: "",
        progressMade: "",
        idealHome: "an active home where she can be the only pet",
      },
    };
    const short = wordCount(postText({ foster: richFoster, length: "Short", description: "Juniper is splashing in her kiddie pool." }));
    const medium = wordCount(postText({ foster: richFoster, length: "Medium", description: "Juniper is splashing in her kiddie pool." }));
    const detailed = wordCount(postText({ foster: richFoster, length: "Detailed", description: "Juniper is splashing in her kiddie pool." }));
    const sparseDetailed = postText({ length: "Detailed", description: "Ralph is enjoying his bottle." });

    expect(short).toBeLessThan(medium);
    expect(medium).toBeLessThan(detailed);
    expect(detailed).toBeGreaterThanOrEqual(150);
    expect(sparseDetailed).not.toMatch(/no made-up backstory|based on verified facts|provided information/i);
  });

  test("continues to route every status through the status-safe CTA", () => {
    const available = request({ foster: { adoptionStatus: "Available" } });
    const adopted = request({ foster: { adoptionStatus: "Adopted" } });
    expect(buildDeterministicCta(available.foster)).toContain("Could Ralph be the foster");
    expect(buildDeterministicCta(adopted.foster)).toContain("has been adopted");
  });
});
