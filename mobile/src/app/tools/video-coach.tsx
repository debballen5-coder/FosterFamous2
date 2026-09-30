import React from "react";

import { CoachScreen } from "@/components/coach/CoachScreen";
import { VIDEO_COACH_GOALS } from "@/lib/options";

export default function VideoCoachScreen() {
  return (
    <CoachScreen
      mediaType="video"
      goals={VIDEO_COACH_GOALS}
      title="Video Coach"
      headline="Capture the moments that make people stop"
      intro={(fosterName) =>
        `Short, honest clips let adopters see ${fosterName} move, play, connect, and relax.`
      }
    />
  );
}
