export type InfoAction =
  | { label: string; route: '/tools/photo-coach' | '/tools/video-coach' | '/create/editor'; kind?: string }
  | { label: string; route: '/(tabs)/create' | '/(tabs)/more' };

export interface ResourceGuide {
  title: string;
  intro: string;
  sections: readonly { heading: string; points: readonly string[] }[];
  action?: InfoAction;
}

const RESOURCE_TITLE_SLUGS: Record<string, string> = {
  'Facebook Tips': 'facebook',
  'Instagram Tips': 'instagram',
  'TikTok Tips': 'tiktok',
};

export function resourceSlugForTitle(title: string): string {
  return RESOURCE_TITLE_SLUGS[title] ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const RESOURCE_GUIDES: Record<string, ResourceGuide> = {
  'photo-tips': {
    title: 'Photo Tips',
    intro: 'Clear, honest photos help an adopter picture everyday life with your foster.',
    sections: [{ heading: 'A strong, safe photo session', points: [
      'Use bright natural or indirect light whenever you can.',
      'Photograph at the animal’s eye level for a more personal connection.',
      'Choose uncluttered backgrounds and make the face and eyes clear when possible.',
      'Include full-body photos alongside close-ups.',
      'Show personality and normal home life; take several shots rather than chasing one perfect image.',
      'Never stage unsafe or stressful interactions just for a photo.',
    ] }],
    action: { label: 'Open Photo Coach', route: '/tools/photo-coach' },
  },
  'video-tips': {
    title: 'Video Tips',
    intro: 'Short, steady moments are often more useful than a single long recording.',
    sections: [{ heading: 'Keep it natural', points: [
      'Capture many short clips instead of one long video.',
      'Start with something visually interesting: a greeting, movement, or favorite activity.',
      'Use good light, hold the phone steady when possible, and reduce distracting background noise.',
      'Show real behavior and personality.',
      'Do not force or stage stressful interactions.',
    ] }],
    action: { label: 'Open Video Coach', route: '/tools/video-coach' },
  },
  facebook: {
    title: 'Facebook Tips',
    intro: 'Give local communities the information they need to share responsibly.',
    sections: [{ heading: 'Make each post useful', points: [
      'Lead with a strong photo or video and keep important adoption details easy to find.',
      'Share to relevant local, community, and rescue groups only when permitted.',
      'Use fresh wording rather than reposting identical captions repeatedly.',
      'Include a clear call to action and confirm adoption or contact instructions are current.',
      'Follow group rules and protect private personal information.',
    ] }],
    action: { label: 'Create Facebook Post', route: '/create/editor', kind: 'Facebook Post' },
  },
  instagram: {
    title: 'Instagram Tips',
    intro: 'A clear first image and a warm, truthful story can make a quick scroll stop.',
    sections: [{ heading: 'Build a trustworthy post', points: [
      'Use a strong first image or video, then write a readable caption.',
      'Show personality and progress with specific, current details.',
      'Use Reels or video when appropriate and post consistently in a realistic rhythm.',
      'Use useful hashtags and a clear adoption or contact call to action.',
      'Avoid inaccurate claims.',
    ] }],
    action: { label: 'Create Instagram Content', route: '/create/editor', kind: 'Instagram Caption' },
  },
  tiktok: {
    title: 'TikTok Tips',
    intro: 'Lead with your foster’s personality rather than a long introduction.',
    sections: [{ heading: 'Get to the good part', points: [
      'Hook attention quickly with movement, a favorite habit, or a clear moment of personality.',
      'Keep clips concise and use readable on-screen text when it helps.',
      'Use good light and lead with the foster, not a long intro.',
      'Keep captions truthful and make adoption information easy to find.',
    ] }],
    action: { label: 'Create Reel / TikTok Script', route: '/create/editor', kind: 'Reel / TikTok Script' },
  },
  'adoption-listings': {
    title: 'Adoption Listings',
    intro: 'The best listing is accurate, readable, and helps the right adopter take a next step.',
    sections: [{ heading: 'What to include', points: [
      'Keep facts current and lead with personality.',
      'Be realistic and clear about known compatibility.',
      'Include medical or special-needs information when it is relevant.',
      'Avoid excessive negative framing while never hiding important considerations.',
      'Include clear next-step and contact information.',
    ] }],
    action: { label: 'Create / View Adoption Bio', route: '/create/editor', kind: 'Adoption Bio' },
  },
  'captions-bios': {
    title: 'Captions & Bios',
    intro: 'Specific facts create a more believable story than generic praise.',
    sections: [{ heading: 'Write with care', points: [
      'Lead with something specific about the foster.',
      'Keep facts current and show personality through examples.',
      'Avoid generic “perfect pet” claims.',
      'Include a clear call to action and adjust length for the platform.',
    ] }],
    action: { label: 'Create Content', route: '/(tabs)/create' },
  },
  'search-hashtags': {
    title: 'Search & Hashtags',
    intro: 'Keywords can help local people understand what they are seeing; they do not guarantee reach.',
    sections: [{ heading: 'Make tags easier to discover', points: [
      'Foster Famous prioritizes specific foster, life-stage, and adoption tags over broad generic rescue labels when the saved facts support them.',
      'For a kitten, suggestions lead with tags like #FosterKitten and #KittenRescue; puppy posts receive the equivalent focused strategy.',
      'A city-and-species tag is included when a public city is saved, helping the right local audience find the post.',
      'Suggestions are starting points to review, not promises of discoverability, ranking, or views.',
    ] }],
    action: { label: 'Create Content', route: '/(tabs)/create' },
  },
  'creative-promotion': {
    title: 'Creative Promotion',
    intro: 'A thoughtful mix of local and online sharing can keep a foster’s story fresh.',
    sections: [{ heading: 'Ideas to consider', points: [
      'Share in local community spaces, rescue social pages, and adoption-event posts where allowed.',
      'Use workplace or community bulletin sharing and printed flyers when appropriate.',
      'Ask friends and followers to share an accurate post.',
      'Try seasonal or photo-themed content and short update videos.',
    ] }],
    action: { label: 'Create Local Community Post', route: '/create/editor', kind: 'Local Community Post' },
  },
  'common-mistakes': {
    title: 'Common Mistakes',
    intro: 'Small changes can make adoption information clearer without making it less honest.',
    sections: [{ heading: 'A quick review before posting', points: [
      'Using outdated information.',
      'Posting poor, dark, or confusing photos.',
      'Only posting “please adopt.”',
      'Burying key facts in overly long blocks of text.',
      'Exaggerating compatibility or behavior.',
      'Posting once and disappearing.',
      'Focusing only on challenges.',
      'Forgetting a clear adoption or contact next step.',
    ] }],
  },
  'safety-accuracy': {
    title: 'Safety & Accuracy',
    intro: 'Accurate details protect your foster, potential adopters, and the rescue process.',
    sections: [{ heading: 'Foster Famous accuracy principles', points: [
      'Use stored facts only; Unknown stays Unknown.',
      'Current Status overrides outdated facts in older drafts or updates.',
      'Do not claim compatibility that is not known or minimize documented medical or special needs.',
      'Do not expose private foster or rescue information unnecessarily.',
      'Do not stage unsafe interactions.',
      'Review generated content before posting.',
    ] }],
  },
};

export const FAQS: readonly { question: string; answer: string }[] = [
  { question: 'How do I add a foster?', answer: 'Open Fosters, then choose Add Foster.' },
  { question: 'How do I update current information?', answer: 'Open a foster profile and choose What’s New / Add Update. Current Status takes priority over older information.' },
  { question: 'Why does an old draft show a current-information warning?', answer: 'Drafts keep their history. Use Refresh With Current Info to make a new version based on the latest saved foster details.' },
  { question: 'Where are my drafts?', answer: 'Open Create, then Drafts / Saved Content.' },
  { question: 'How do I share a post?', answer: 'Open a saved post, choose Share/Post and a platform, then continue through your device share sheet and confirm only after you post.' },
  { question: 'Does Foster Famous post directly to Facebook or Instagram?', answer: 'No. It prepares content and opens your device’s native share experience. You stay in control of posting.' },
  { question: 'How does the Foster Famous Score work?', answer: 'It is calculated from deterministic categories including profile completeness, media, adoption bio, and confirmed or recorded marketing activity.' },
  { question: 'What is the 30-Day Plan?', answer: 'It is a foster-specific campaign of practical promotion steps. Each foster keeps their own plan progress.' },
  { question: 'What is Adoption Boost?', answer: 'It is a focused seven-step campaign that helps you work through a fresh set of promotion actions.' },
  { question: 'What if my foster is adopted?', answer: 'Their profile, history, media, and saved content stay in Adopted / Archived while active marketing is paused.' },
  { question: 'What if the adoption does not work out?', answer: 'Open the adopted profile and choose Reactivate Foster to safely begin a new foster period.' },
  { question: 'How do I delete or archive content?', answer: 'Open Create → Drafts / Saved Content, then use the available content actions.' },
  { question: 'Does Foster Famous know views or likes?', answer: 'No. It does not receive social-media views, likes, or shares. Marketing Activity uses confirmed and locally recorded information.' },
  { question: 'Is AI always correct?', answer: 'No. Review every generated draft before posting. Foster Famous uses saved current information and accuracy safeguards, but you remain responsible for the final post.' },
];

export const PRIVACY_SECTIONS: readonly { heading: string; body: string }[] = [
  { heading: 'Information you enter', body: 'Foster Famous stores the foster and pet information you enter, such as profile details, adoption details, current status, progress updates, drafts, saved content, and locally recorded marketing activity.' },
  { heading: 'Photos and videos', body: 'Photos and videos you choose are used in your foster’s media library and content workflows. The app maintains local and durable app-managed copies when available so your saved work can continue to use the selected media.' },
  { heading: 'Local app data', body: 'Foster profile data, plans, drafts, settings, and related app data are persisted on your device. Deleting a foster does not currently have a user-facing delete flow; archived adopted profiles and their history are intentionally retained. You can remove individual saved content and media using the actions available in the app.' },
  { heading: 'AI-assisted content', body: 'When you ask Foster Famous to generate content, the foster information and creation details needed for that request are sent to the app’s content-generation service. Generated content is a draft for you to review and correct before posting.' },
  { heading: 'Sharing', body: 'Sharing takes place through your device’s native share experience. Foster Famous does not automatically post to social networks and does not automatically know views, likes, or shares.' },
  { heading: 'Third parties and support', body: 'The app uses the services needed to provide its configured content-generation and media features. If a support contact is configured, it is shown in Contact Support. This in-app policy does not replace a future public policy URL that may be required for store distribution.' },
];

export const TERMS_SECTIONS: readonly { heading: string; body: string }[] = [
  { heading: 'Purpose of the app', body: 'Foster Famous is a marketing and content-support tool for foster parents. It helps organize information and prepare adoption content; it does not make placement decisions.' },
  { heading: 'Your responsibility', body: 'You are responsible for reviewing, correcting, and deciding whether to share generated content. Use accurate current information, protect private information, and follow rescue, social-platform, and community rules.' },
  { heading: 'No guarantees', body: 'Foster Famous does not guarantee adoption, audience reach, engagement, inquiries, applications, or any outcome from using the app.' },
  { heading: 'Not professional advice', body: 'Foster Famous is not veterinary or legal advice. Seek appropriate professional guidance for medical, behavioral, legal, rescue-policy, or safety questions.' },
  { heading: 'Your media and content', body: 'You are responsible for the photos, videos, and other material you upload or share, including making sure you have permission to use them and that they are safe and accurate.' },
  { heading: 'App availability', body: 'The app is provided as a helpful productivity tool. Features may depend on device capabilities and third-party services, and may not always be available or error-free.' },
];
