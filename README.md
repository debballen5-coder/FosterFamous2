# Foster Famous

**Help Your Foster Pet Get Noticed, Shared & Adopted**

A mobile app for foster parents who want their foster dog or cat adopted faster. Foster Famous
gives simple daily post ideas, photo and video coaching, adoption bios, a 30-day promotion plan,
and a place to track what's actually working.

> **Status: Phase 4 complete.** The app now includes saved foster profiles, guarded AI-assisted
> content generation, editable versions, persistent drafts, platform-aware sharing through the device
> share sheet, confirmed posting history, and Home/Plan/Tracker integrations. Direct social publishing,
> social sign-in, scheduled posting, and automatic analytics remain intentionally out of scope.

---

## The design system

- **Palette** — warm cream background (`#FBF5E9`), deep forest green primary (`#14432A`), warm clay
  orange accent (`#E1712B`), charcoal ink text, soft beige secondary surfaces.
- **Type** — Fraunces (warm display serif) for headings, Nunito (rounded sans) for body.
- **Shape** — large rounded cards (28–36px), 44–58px tap targets, generous whitespace.
- **Motion** — restrained: staggered fade-ins, spring press feedback, animated progress bars, light
  haptics. No busy gradients, no neon.
- **Paw prints and hearts** are used sparingly as accents, never as wallpaper.

Tokens live in `mobile/tailwind.config.js` (classNames) and `mobile/src/lib/theme.ts` (raw values
for components that don't accept `className`, like `LinearGradient`).

## Navigation map

```
/                          → redirect gate (onboarding vs. home)

/onboarding/welcome        → Welcome / first launch
/onboarding/how-it-works   → modal explainer
/onboarding/species        → "What do you foster?" (Dogs / Cats / Both)
/onboarding/help           → "What would you like help with?" (multi-select)
/onboarding/first-foster   → "Let's make your foster famous."

/(tabs)/home               → greeting, active foster, Today's Mission, quick actions, Score
/(tabs)/fosters            → Active Fosters + Adopted / Archived
/(tabs)/create             → Create New, Drafts / Saved Content, Ready to Post, and 15 formats
/(tabs)/plan               → 30-Day Foster Famous Plan
/(tabs)/more               → Promotion Tools, Resource Library, Settings

/foster/wizard             → 6-step Add Foster wizard + completion screen
/foster/[id]               → Foster profile (Overview / Media / Marketing / Adoption Bio / Progress)
/foster/update             → compact, keyboard-aware routine progress update form
/create/editor             → generic content workspace (all 15 formats route here)
/create/saved              → draft recovery, saved content, and ready-to-post list (optionally foster-filtered)
/share/[postId]            → platform selection, review, native sharing, and posting confirmation
/tools/photo-coach         → 19-shot photo checklist
/tools/video-coach         → 11-clip checklist + Easy Reel Formula
/tools/marketing-tracker   → "What's Working?" summary + post log
/tools/hard-to-place       → 14 challenges → guidance card
/info/[slug]               → generic placeholder for every Resource Library + Settings row
```

Bottom nav is exactly five tabs: **Home, Fosters, Create, Plan, More**. No hamburger menu.
Back buttons safely return to the appropriate parent screen when a route is opened directly or after a reload.
Profile photos can be selected and cropped from the device photo library while adding a foster, then changed from the foster profile.
Every selected profile photo, library photo, and video is copied into app storage and immediately registered in that foster pet’s media library, so it remains usable for social sharing even during a temporary storage-service outage. The app uploads a durable CDN copy as part of the import when possible and automatically retries a missing copy on launch. New library imports support up to 10 photos per selection (or one video), matching the authenticated upload capacity so every chosen item can finish. On launch, older local profile and draft media references are reconciled into the library and backed up remotely when the original file is still available.
Saved foster profiles can be reopened for editing with every recorded field prefilled; changes update the existing pet instead of creating a duplicate. Editing profile details or placement status without choosing a new photo preserves the current photo and never attempts to re-import it before saving the change.
**Days in Foster** uses the saved **Foster Start Date** as its only start-date source of truth. New or edited dates are validated and saved as a local `YYYY-MM-DD` calendar date; legacy text dates and stale nested foster periods are normalized once when local storage migrates. Active stays count **today − Foster Start Date**; adopted stays count **Adoption Date − Foster Start Date**. The count refreshes at local midnight and on app resume. Missing, invalid, future, or contradictory dates receive a direct correction prompt — a same-day intake reads **Started today**, never a misleading `0 days` label.

**Current Status** is the foster’s verified placement field (Active Foster, Available for Adoption, pending stages, holds, Returned to Rescue/Shelter, or Adopted), not a social-post caption. **Recent Activity** is derived from existing saved events: posts and confirmed publishing, adoption-bio changes, added media, foster/profile updates, Adoption Boost work, and lifecycle changes. A profile with no meaningful activity beyond its initial creation reads **No recent activity yet**.

### Foster lifecycle and archived history

Marking a foster **Adopted** moves the profile from active Home, Create, Plan, Adoption Boost, photo-goal, and posting flows into **Adopted / Archived**. Their media, profile, drafts, posts, confirmed tracker records, progress updates, and completed foster period stay intact. **Reactivate Foster** opens a new active period without overwriting the prior adopted period, so a return and later adoption retain the complete sequence. For historical profiles without a saved adoption date, the completed period is visibly marked as having an unrecorded date rather than being allowed to increment indefinitely.

**Drafts / Saved Content** is the persistent recovery point for drafts, ready posts, and saved post history. It is reachable from Create and from each Foster Profile’s Marketing section, which automatically filters to that foster.

### Routine foster updates

A Foster Profile provides a direct **Add Update** action for day-to-day milestones, separate from the full Edit Profile wizard. The full-screen update form records a categorized progress item, can save a factual summary for future content, and is the single authoritative way to complete an active foster’s adoption. Choosing **Adopted** requires a valid, non-future adoption date, saves the update, closes the active foster period, records one adoption event, archives active marketing, and replaces the active selection before returning to the newly archived profile. A backdated adoption date is accepted—even when the foster profile was added after the adoption—and the completed period is aligned to that confirmed date rather than rejecting the record. A placement-only change can be saved without adding a narrative update; **What happened?** is optional unless the foster parent wants to log a milestone. **Edit Profile** never offers a directly saveable Adopted value: it directs an active foster to **Record Adoption in Add Update**, while adopted profiles keep placement locked until **Reactivate Foster** starts a dated new period. Its form content is vertically scrollable, its safe-area-aware **Save Update** action remains available above the keyboard at the bottom of small iPhone and Android screens, and it does not use a draggable sheet. Saving clears that foster’s stored Adoption Boost recommendation.

## Project structure

```
mobile/src/
  app/                     Expo Router routes (see map above)
  components/
    ui/                    Button, Card, Chip, Field, ListRow, Progress, Screen,
                           StatusBadge, EmptyState, Pressables
    FosterCard.tsx          active-foster hero card + list card
    DemoBadge.tsx           "SAMPLE" badge + explainer notice
    PawPattern.tsx          sparse decorative paw scatter
  lib/
    types.ts               domain contract (Foster, AdoptionStatus, Compatibility…)
    content-rules.ts       accuracy rules — see below
    demo-data.ts           Winston + Marigold samples, demo plan, demo tracker rows
    options.ts             every option list in the app (traits, checklists, formats…)
    theme.ts               raw color / font / shadow tokens
    state/app-store.ts     zustand + AsyncStorage persistence
```

## Accuracy rules (non-negotiable)

`mobile/src/lib/content-rules.ts` is the single source of truth. Foster Famous must **never**:

1. invent temperament
2. invent medical history
3. invent behavioral history
4. claim a pet is good with dogs, cats, or children when the value is Unknown
5. hide important behavioral or medical information
6. publish foster-home addresses
7. promise an animal to an adopter when placement is controlled by a shelter or rescue

**Unknown values must remain explicitly unknown.** This is enforced structurally, not just in copy:

- `Compatibility` is a tri-state (`'Yes' | 'No' | 'Unknown' | 'Still evaluating'`), never a boolean,
  so unknown can't collapse into "no".
- `CompatibilityBadge` renders Unknown and Still evaluating in deliberately neutral styling — never
  the green "yes" treatment.
- `isClaimable()` and `NON_CLAIMABLE_VALUES` gate anything that could become a public claim.
- `NEVER_RULES`, `UNKNOWN_VALUE_POLICY`, and `REQUIRED_DISCLOSURES` are written to be injected
  verbatim into future generation prompts.

## Demo data safety

Winston (dog, 18 days in foster, Available) and Marigold (cat) are built-in samples so a new user
can see how the app works before adding anything.

They can never be mistaken for or saved as a real foster:

- Demo fosters live only in `demo-data.ts` and are **never written to the store**.
- `useDisplayFosters()` returns samples only while the user has zero real fosters — adding one
  replaces them instantly.
- Every sample surface carries a `DemoBadge` ("SAMPLE") or a `DemoNotice` explainer.

## Phase 3 content creation

The Smart Post Builder defaults to an idea-based draft, so it is ready to generate immediately while
still allowing a photo, video, or story to be selected. It sends only the selected foster’s relevant
facts and the current request to the backend. A centralized generation service returns structured,
editable content, applies status-aware adoption CTA logic, and reviews compatibility, status, age, size,
rescue, location, and challenge claims before the draft reaches the app. The AI prompt is designed to
turn the selected real moment into a compelling, platform-ready mini-story—not a profile-field summary—and
to vary its approach for tone, length, and **Write Another Draft**. Unknown and Still Evaluating values are
never upgraded. Hashtag suggestions follow a discovery-first strategy: specific foster, kitten/puppy, and
adoption-intent tags lead over generic rescue labels, with a city-and-species tag when a public city is saved.
They are curated suggestions, never a promise of views or ranking. When the optional AI provider is unavailable,
Foster Famous still creates a polished,
fact-grounded social-ready draft using the selected moment, recorded qualities, and current adoption status;
internal accuracy or safety instructions are never shown in user-facing copy.
Drafts persist locally by foster and can be reopened, duplicated, copied, marked Ready to Post, archived,
or deleted with confirmation. A photo-based draft can retain up to 10 selected photos; the first is its saved cover and all remain available when the draft is reopened. Create workspaces explicitly reset when switching fosters: an in-flight generation is cancelled and identity-checked before applying, so a prior foster’s result, manual text, selected media, draft history, or error cannot appear in the newly selected foster’s editor. Generation actions use a fresh idempotency key, while a retry repeats only the same captured request and key. The selected written photo/video/story moment is carried into both the hook and caption; an app-owned public photo is also supplied to the AI for visual grounding when its secure upload is available. Known media ownership is enforced when a draft is saved and during local-state migration. URI-only legacy posts can never import an asset known to belong to another foster, including while a draft is being prepared for sharing. If a provider call fails transiently, retrying the same captured action and idempotency key safely re-attempts it rather than leaving the draft stuck.

## Phase 4 sharing & posting

A reviewed draft can move directly into **Share / Post**: choose a destination, check a platform-specific
preview, copy any needed text, and open the device’s native share flow. Immediately before sharing, legacy
URI-only posts are normalized to their durable library media, the file is checked, and a MIME type is supplied
from saved metadata or its file extension. If the attachment is unavailable, the post remains unrecorded and
Foster Famous explains how to replace it or continue with a text-only share. Photo drafts can retain multiple
attachments: the saved cover photo opens in the device share flow, while the app keeps the remaining selected photos
ready to add in the destination social app. When media and captions cannot be reliably sent together, Foster Famous
copies the prepared caption first and clearly tells the foster parent to paste it after the social app opens. It never
assumes a share became a published post.

After returning, the foster parent explicitly confirms whether they posted and can correct or select multiple
platforms. Foster Famous never opens that confirmation automatically while Instagram or another social app is
handing off, so the social app can finish opening cleanly. If a social app does not resolve its share handoff,
Foster Famous restores its controls on return and shows the non-blocking confirmation card. Every confirmation
creates a local `PublicationRecord`
and a matching foster-specific Marketing Tracker activity. A manually added Marketing Activity has an always
available close action, a keyboard-aware scrolling form, and Save / Cancel actions held above the device’s bottom
safe area, so an entry can always be dismissed or recorded. One post can be recorded on any number of platforms and
can be shared again later. Records, drafts, and media references persist locally through app restarts. A
plan-connected post can mark its plan day
complete only after the foster parent confirms it was posted.

## Deliberately not in Phase 4

Direct social-media publishing, social OAuth, automatic analytics, image/video analysis, subscriptions,
payments, rescue-org team accounts, video editing, social login, push campaigns, cloud sync, and automatic
scheduling remain out of scope.

## Stack

Expo SDK 54 · React Native 0.81 · Expo Router 6 (typed routes) · NativeWind 4 · Reanimated 4 ·
zustand + AsyncStorage · lucide-react-native · Fraunces + Nunito via `@expo-google-fonts`.

No account is required to look around. The backend provides guarded content generation and durable media uploads; foster records and other working data remain local to the device. In development, `backend/.env` supplies the local SQLite URL before Prisma’s startup preflight and the environment helper supplies a stable development-only anonymous-device signing key, so content generation remains available without platform configuration. Platform-supplied values always take precedence. Production must provide its own persistent `INSTALLATION_TOKEN_SECRET` of at least 32 characters through the server environment.
