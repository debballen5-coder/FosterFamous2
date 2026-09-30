import type { ContentType } from './types';

export type FosterPlanTaskStatus = 'todo' | 'done' | 'skipped';

export interface FosterPlanTaskState {
  day: number;
  status: FosterPlanTaskStatus;
  scheduledDay: number;
  completedAt: string | null;
  skippedAt: string | null;
  movedAt: string | null;
  linkedContentPostId: string | null;
}

export interface FosterPlanRun {
  id: string;
  startedAt: string;
  tasks: Record<number, FosterPlanTaskState>;
}

export interface FosterPlanState {
  activeRun: FosterPlanRun;
  previousRuns: FosterPlanRun[];
}

export interface FosterPlanDefinition {
  day: number;
  title: string;
  goal: string;
  action: string;
  format: string;
  kind?: ContentType;
  destination: 'profile' | 'photo-coach' | 'video-coach' | 'create' | 'adoption-bio' | 'update' | 'saved-content' | 'score' | 'media';
  context?: string;
  goalId?: string;
}

const contentContext = (title: string, goal: string): string =>
  `${title}\n${goal}\nUse only the foster information already saved in Foster Famous.`;

export const FOSTER_FAMOUS_PLAN: readonly FosterPlanDefinition[] = [
  { day: 1, title: 'Complete the Foster Profile', goal: 'Make sure the basic foster information is complete and accurate.', action: 'Open Foster Profile', format: 'Profile', destination: 'profile' },
  { day: 2, title: 'Capture a Hero Adoption Photo', goal: 'Get one strong, clear primary adoption photo.', action: 'Open Photo Coach', format: 'Photo', destination: 'photo-coach', goalId: 'hero-adoption-photo' },
  { day: 3, title: 'Create an Introduction Post', goal: 'Introduce the foster pet to potential adopters.', action: 'Create Introduction Post', format: 'Post', destination: 'create', kind: 'Social Media Post', context: contentContext('Introduction post', 'Create a warm, accurate introduction post.') },
  { day: 4, title: 'Capture a Personality Video', goal: 'Show something about the foster’s personality that a still photo cannot.', action: 'Open Video Coach', format: 'Video', destination: 'video-coach' },
  { day: 5, title: 'Share With Your Local Community', goal: 'Reach people geographically closer to the foster.', action: 'Create Local Community Post', format: 'Local post', destination: 'create', kind: 'Local Community Post', context: contentContext('Local community post', 'Create an accurate local-community post. Never include a foster-home address.') },
  { day: 6, title: 'Create or Improve the Adoption Bio', goal: 'Make the adoption listing accurate, engaging, and easy to read.', action: 'Open Adoption Bio', format: 'Adoption bio', destination: 'adoption-bio' },
  { day: 7, title: 'Share a Personality Moment', goal: 'Show who the foster is outside of basic profile facts.', action: 'Create Personality Post', format: 'Post', destination: 'create', kind: 'Heartwarming Post', context: contentContext('Personality moment', 'Focus on a known personality trait, routine, or story.') },
  { day: 8, title: 'Capture a Full-Body Photo', goal: 'Give adopters a clear idea of the foster’s size and appearance.', action: 'Open Photo Coach', format: 'Photo', destination: 'photo-coach', goalId: 'full-body' },
  { day: 9, title: 'Create a Short Video/Reel', goal: 'Create a short piece of motion content suitable for social sharing.', action: 'Open Video Coach', format: 'Video', destination: 'video-coach' },
  { day: 10, title: 'Share a Progress Update', goal: 'Show something the foster has learned, improved, recovered from, or experienced.', action: 'Create Progress Update', format: 'Post', destination: 'create', kind: 'Progress Update', context: contentContext('Progress update', 'Use a saved Current Status or Progress History detail only. Do not invent progress.') },
  { day: 11, title: 'Refresh the Main Adoption Photo', goal: 'Review whether the foster’s strongest current image is being used.', action: 'Review Media', format: 'Photo review', destination: 'media', context: 'Review the current hero or profile photo. Keep it if it is already the strongest image.' },
  { day: 12, title: 'Highlight a Favorite Thing', goal: 'Show a toy, activity, food, routine, nap spot, game, or other known preference.', action: 'Create Favorite Thing Post', format: 'Post', destination: 'create', kind: 'Social Media Post', context: contentContext('Favorite thing', 'Use a saved favorite thing or routine only.') },
  { day: 13, title: 'Share to a Different Audience', goal: 'Encourage platform or community variety.', action: 'Create Another Version', format: 'Post', destination: 'create', kind: 'Social Media Post', context: contentContext('Different audience', 'Prepare an accurate version for a platform or community the foster parent chooses. Do not claim one is best.') },
  { day: 14, title: 'Adoption Bio Checkup', goal: 'Review the current adoption bio against the foster’s newest information.', action: 'Open Adoption Bio', format: 'Adoption bio', destination: 'adoption-bio' },
  { day: 15, title: 'Capture an Everyday-Life Photo', goal: 'Show what living with the foster actually looks like.', action: 'Open Photo Coach', format: 'Photo', destination: 'photo-coach', goalId: 'relaxing-indoors' },
  { day: 16, title: 'Create a “Why You’ll Love Them” Post', goal: 'Highlight known positive traits without exaggeration.', action: 'Create Post', format: 'Post', destination: 'create', kind: 'Heartwarming Post', context: contentContext('Why you’ll love them', 'Highlight known positive traits without exaggeration.') },
  { day: 17, title: 'Capture a Compatibility Moment', goal: 'When safe and available, capture an authentic compatibility or lifestyle moment.', action: 'Open Photo Coach', format: 'Photo or video', destination: 'photo-coach', goalId: 'calm-moment', context: 'Only capture a safe, authentic moment. Unknown compatibility stays unknown; never stage an unsafe interaction.' },
  { day: 18, title: 'Reshare With Fresh Wording', goal: 'Reuse a strong existing photo or video with a newly written accurate caption.', action: 'Open Media', format: 'Refresh post', destination: 'media', context: 'Choose existing media, then write fresh accurate wording. Do not automatically duplicate an old caption.' },
  { day: 19, title: 'Share a Funny or Charming Moment', goal: 'Show personality and create approachable content.', action: 'Create Funny Post', format: 'Post', destination: 'create', kind: 'Funny Post', context: contentContext('Funny or charming moment', 'Use only known facts or context the foster parent supplies.') },
  { day: 20, title: 'Check the Foster Famous Score', goal: 'Identify the biggest current marketing gap.', action: 'Open Foster Famous Score', format: 'Score review', destination: 'score' },
  { day: 21, title: 'Capture a Calm/Relaxed Moment', goal: 'Show the foster in normal home life.', action: 'Open Photo Coach', format: 'Photo or video', destination: 'photo-coach', goalId: 'calm-moment' },
  { day: 22, title: 'Create an Ideal Home Post', goal: 'Explain what kind of home may be a good match using known profile information.', action: 'Create Ideal Home Post', format: 'Post', destination: 'create', kind: 'Petfinder / Rescue Listing', context: contentContext('Ideal home post', 'Use known profile information only. Do not invent restrictions or compatibility.') },
  { day: 23, title: 'Local Share Day', goal: 'Reach another relevant local audience.', action: 'Create Local Community Post', format: 'Local post', destination: 'create', kind: 'Local Community Post', context: contentContext('Local share day', 'Prepare a local community post. Do not imply automatic posting or group membership.') },
  { day: 24, title: 'Update What’s New', goal: 'Make sure Foster Famous knows the foster’s latest status.', action: 'Add Foster Update', format: 'Current update', destination: 'update' },
  { day: 25, title: 'Refresh an Older Post', goal: 'Take an older saved or published post and update it with current information.', action: 'Open Saved Content', format: 'Refresh post', destination: 'saved-content' },
  { day: 26, title: 'Create a Short Adoption Video', goal: 'Create or prepare another brief video emphasizing personality and adoptability.', action: 'Open Video Coach', format: 'Video', destination: 'video-coach' },
  { day: 27, title: 'Highlight a Milestone', goal: 'Share a real foster milestone if one exists.', action: 'Create Milestone Post', format: 'Post', destination: 'create', kind: 'Progress Update', context: contentContext('Milestone or current-life post', 'Use a real Progress History milestone. If none exists, use a general positive current-life detail instead.') },
  { day: 28, title: 'Review the Adoption Listing', goal: 'Check whether adoption information still matches Current Status.', action: 'Open Adoption Bio', format: 'Listing review', destination: 'adoption-bio' },
  { day: 29, title: 'Share the Foster Again', goal: 'Create another accurate adoption-focused post for an audience or platform chosen by the user.', action: 'Create Adoption Post', format: 'Post', destination: 'create', kind: 'Social Media Post', context: contentContext('Adoption-focused post', 'Create another accurate adoption-focused post for the audience the foster parent chooses.') },
  { day: 30, title: 'Campaign Review & Next Step', goal: 'Celebrate completed work and decide what the foster needs next.', action: 'Review Campaign', format: 'Review', destination: 'score' },
];

export function createPlanRun(now = new Date().toISOString()): FosterPlanRun {
  return {
    id: `plan-run-${Date.now()}`,
    startedAt: now,
    tasks: Object.fromEntries(FOSTER_FAMOUS_PLAN.map((definition) => [definition.day, {
      day: definition.day,
      status: 'todo',
      scheduledDay: definition.day,
      completedAt: null,
      skippedAt: null,
      movedAt: null,
      linkedContentPostId: null,
    }])) as Record<number, FosterPlanTaskState>,
  };
}

export function createFosterPlan(now?: string): FosterPlanState {
  return { activeRun: createPlanRun(now), previousRuns: [] };
}

export function orderedPlanTasks(plan: FosterPlanState | undefined): FosterPlanTaskState[] {
  const tasks = plan?.activeRun.tasks ?? createPlanRun().tasks;
  return Object.values(tasks).sort((first, second) => first.scheduledDay - second.scheduledDay || first.day - second.day);
}

export function updatePlanTask(
  plan: FosterPlanState | undefined,
  day: number,
  status: FosterPlanTaskStatus,
  now = new Date().toISOString(),
  linkedContentPostId: string | null = null
): FosterPlanState {
  const current = plan ?? createFosterPlan(now);
  const task = current.activeRun.tasks[day];
  if (!task) return current;
  return {
    ...current,
    activeRun: {
      ...current.activeRun,
      tasks: {
        ...current.activeRun.tasks,
        [day]: {
          ...task,
          status,
          completedAt: status === 'done' ? now : null,
          skippedAt: status === 'skipped' ? now : null,
          linkedContentPostId: linkedContentPostId ?? task.linkedContentPostId,
        },
      },
    },
  };
}

/** A move swaps presentation slots, so neither task is lost. */
export function movePlanTask(
  plan: FosterPlanState | undefined,
  day: number,
  targetScheduledDay: number,
  now = new Date().toISOString()
): FosterPlanState {
  const current = plan ?? createFosterPlan(now);
  const task = current.activeRun.tasks[day];
  if (!task || task.status !== 'todo' || targetScheduledDay < 1 || targetScheduledDay > 30) return current;
  const other = Object.values(current.activeRun.tasks).find((item) => item.scheduledDay === targetScheduledDay);
  const tasks = { ...current.activeRun.tasks };
  tasks[day] = { ...task, scheduledDay: targetScheduledDay, movedAt: now };
  if (other && other.day !== day) tasks[other.day] = { ...other, scheduledDay: task.scheduledDay, movedAt: now };
  return { ...current, activeRun: { ...current.activeRun, tasks } };
}

export function restartPlan(plan: FosterPlanState | undefined, now = new Date().toISOString()): FosterPlanState {
  const current = plan ?? createFosterPlan(now);
  return { activeRun: createPlanRun(now), previousRuns: [...current.previousRuns, current.activeRun] };
}

export function migrationPlanFromLegacy(statuses: Record<number, FosterPlanTaskStatus> | undefined, now = new Date().toISOString()): FosterPlanState {
  const plan = createFosterPlan(now);
  if (!statuses) return plan;
  return FOSTER_FAMOUS_PLAN.reduce(
    (result, definition) => updatePlanTask(result, definition.day, statuses[definition.day] ?? 'todo', now),
    plan
  );
}
