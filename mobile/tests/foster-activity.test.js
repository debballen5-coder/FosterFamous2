import { describe, expect, test } from "bun:test";

import { latestFosterActivity } from "../src/lib/foster-activity";

const valor = {
  id: "valor",
  isDemo: false,
  name: "Valor",
  adoptionStatus: "Not Yet Available",
  fosterStartDate: "2026-09-01",
  daysInFoster: 0,
};

const emptySources = {
  contentPosts: [],
  publicationRecords: [],
  marketingActivities: [],
  mediaItems: [],
  adoptionBoostTasks: [],
};

describe("recent foster activity", () => {
  test("uses a newly created social post as meaningful recent activity", () => {
    const activity = latestFosterActivity(valor, {
      ...emptySources,
      contentPosts: [
        {
          id: "valor-post",
          petId: "valor",
          contentType: "Social Media Post",
          createdAt: "2026-09-08T15:00:00.000Z",
          updatedAt: "2026-09-08T15:00:00.000Z",
        },
      ],
    });

    expect(activity).toMatchObject({
      kind: "content-created",
      title: "Social media post created",
      occurredAt: "2026-09-08T15:00:00.000Z",
    });
  });

  test("prefers a confirmed published post over an older profile revision", () => {
    const activity = latestFosterActivity(
      { ...valor, currentInfoUpdatedAt: "2026-09-07T09:00:00.000Z" },
      {
        ...emptySources,
        publicationRecords: [
          {
            id: "published-valor-post",
            petId: "valor",
            contentType: "Social Media Post",
            postedAt: "2026-09-08T15:00:00.000Z",
          },
        ],
      }
    );

    expect(activity).toMatchObject({
      kind: "post-published",
      title: "Social media post published",
    });
  });

  test("returns no activity when only the foster profile exists", () => {
    expect(latestFosterActivity(valor, emptySources)).toBeNull();
  });
});
