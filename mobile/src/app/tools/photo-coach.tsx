import React from "react";

import { CoachScreen } from "@/components/coach/CoachScreen";
import { PHOTO_COACH_GOALS } from "@/lib/options";

export default function PhotoCoachScreen() {
  return (
    <CoachScreen
      mediaType="photo"
      goals={PHOTO_COACH_GOALS}
      title="Photo Coach"
      headline="Build a photo library that tells their story"
      intro={(fosterName) =>
        `Each goal gives you a different, useful way to help adopters notice ${fosterName}.`
      }
    />
  );
}
