// Every word and sample number in the video lives here, so it's easy to change
// without touching the animation code.

export const SITE = {
  url: 'trust-feed-livid.vercel.app',
  author: 'Deepanshu', // <- check this reads the way you want it on the end card
  tagline: 'The feed that shows its work.',
};

export type VerdictLabel = 'Well Supported' | 'Mixed Evidence' | 'Unsupported' | 'Unable to Verify';

export const BADGE_CLASS: Record<VerdictLabel, string> = {
  'Well Supported': 'supported',
  'Mixed Evidence': 'mixed',
  Unsupported: 'unsupported',
  'Unable to Verify': 'unable',
};

// The sample posts are illustrative, but the facts are true and the sources
// below are real pages, so nothing in the video is made up.
export const MOON = {
  handle: '@stargazer',
  topic: 'space',
  fileName: 'moon-drift.mp4',
  fileSize: '18.4 MB',
  transcript:
    'The Moon is drifting away from Earth by about 3.8 centimeters every year, about as fast as your fingernails grow.',
  claims: [
    'The Moon is drifting away from Earth by about 3.8 cm a year.',
    'Apollo astronauts left laser reflectors on the Moon that scientists still use today.',
  ],
  explanation:
    'Laser beams bounced off mirrors left by Apollo astronauts show the Moon moving away from Earth by about 3.8 cm each year.',
  relevance: 94,
  sources: [
    {
      title: 'The Apollo Experiment That Keeps on Giving',
      host: 'jpl.nasa.gov',
      snippet: 'Lunar laser ranging shows the Moon slowly moving away from Earth, about 3.8 centimeters each year.',
    },
    {
      title: 'NASA - Accuracy of Eclipse Predictions',
      host: 'eclipse.gsfc.nasa.gov',
      snippet: 'Laser pulses bounced off reflectors left on the Moon measure its distance from Earth very precisely.',
    },
  ],
};

export const OCTOPUS = {
  handle: '@nova',
  topic: 'wildlife',
  quote: 'Octopuses have three hearts and blue blood.',
  explanation: 'Two hearts pump blood through the gills and one pumps it to the rest of the body. The blood is blue because it is copper-based.',
};

export const MYTH = {
  topic: 'psychology',
  text: 'Humans only use 10% of their brains',
};

// The app's own wording (backend/app/agents/gate.py), shown exactly as it appears.
export const REJECTION = `1 claim(s) found unsupported by evidence: ${MYTH.text}`;
export const BORDERLINE =
  'Relevance score 52 is borderline for the declared topic -- needs a human look before publishing.';

export const TECH = ['FastAPI', 'React + TypeScript', 'Gemini', 'Tavily', 'MCP', 'Supabase', 'Redis', 'Vercel', 'Render'];
