/**
 * Offline template-based content generators for the Mock AI engine.
 * Produces plausible, original-looking content — never meta disclaimers.
 */

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
};

interface GameVocab {
  locations: string[];
  mechanics: string[];
  challenges: string[];
  hooks: string[];
}

const VOCAB: Record<string, GameVocab> = {
  'GTA V': {
    locations: ['Mount Chiliad', 'the Maze Bank Tower', 'Los Santos International Airport', 'the Pacific Bluffs tunnels', 'Vespucci Beach pier', 'the Land Act Dam', 'Fort Zancudo', 'the Del Perro freeway'],
    mechanics: ['a scramjet boost', 'a stolen Oppressor Mk II', 'only a bicycle', 'a cargo plane', 'a ramp buggy', 'a jetpack', 'no weapons at all', 'a rusty tractor'],
    challenges: ['Surviving a 5-Star Wanted Level', 'Escaping the Entire Police Force', 'Landing a Cargo Jet on the Highway', 'Crossing the Map in Under 3 Minutes', 'Winning a Street Race Blindfolded', 'Base Jumping into a Moving Train'],
    hooks: ['Nobody thought this was possible', 'One mistake ends everything', 'The physics engine did NOT expect this', 'I broke every rule in the book']
  },
  'GTA Online': {
    locations: ['Cayo Perico', 'the Diamond Casino', 'a moving MOC truck', 'the Kosatka submarine', 'LSIA runway', 'a rival organization\'s yacht'],
    mechanics: ['a solo speedrun route', 'a jet-vs-supercar dogfight', 'zero armor', 'a stock Karin Futo', 'friendly fire enabled', 'a $500 starter budget'],
    challenges: ['The Impossible Solo Heist', 'Speedrunning the Cayo Perico Finale', 'Surviving a 30-Player Lobby Ambush', 'Robbing Every Store in One Take', 'Winning a Transform Race Last-to-First'],
    hooks: ['The lobby thought I was cheating', 'Rockstar didn\'t plan for this', 'Zero deaths or I restart', 'One attempt, no retries']
  },
  'Minecraft': {
    locations: ['the Deep Dark', 'a floating sky island', 'the Nether roof', 'a drowned-city seabed', 'an amplified mountain range', 'the End void'],
    mechanics: ['only redstone', 'no diamonds', 'a single inventory slot', 'half a heart', 'gravity-reversed movement', 'one life hardcore'],
    challenges: ['Building a Self-Running Megabase', '100 Days of Hardcore Survival', 'Defeating the Warden Barehanded', 'Terraforming an Entire Biome', 'Building a Working Computer in Survival'],
    hooks: ['Day 100 changes everything', 'I almost lost the world twice', 'The build broke itself at midnight', 'Zero commands, zero creative']
  },
  'Red Dead Redemption 2': {
    locations: ['Saint Denis', 'the Grizzlies', 'Owanjila Lake', 'Van Horn Trading Post', 'the Heartlands', 'Guarma\'s coast'],
    mechanics: ['a bow only', 'a broken-down nag', 'fists only', 'a single revolver', 'no dead-eye', 'a thunderstorm rolling in'],
    challenges: ['Hunting Every Legendary Animal', 'Pulling Off a Train Heist Solo', 'Surviving the Night in the Swamp', 'Becoming Max Honor in One Session', 'Escaping a Pinkerton Ambush'],
    hooks: ['The wilderness fights back', 'Arthur never saw this coming', 'Every outlaw in the state is hunting me', 'One horse, one chance']
  }
};

const DEFAULT_VOCAB: GameVocab = {
  locations: ['the final zone', 'an impossible map', 'the hardest level'],
  mechanics: ['minimal gear', 'one life', 'a speedrun route'],
  challenges: ['The Ultimate Challenge', 'An Unbeatable Run', 'The World Record Attempt'],
  hooks: ['Nobody expected this', 'One mistake ends the run']
};

const vocab = (game: string) => VOCAB[game] || DEFAULT_VOCAB;
const tag = (game: string) => '#' + game.replace(/[^A-Za-z0-9]/g, '');

export function genIdea(game: string, style: string): string {
  const v = vocab(game);
  return `${pick(v.challenges)} With ${pick(v.mechanics)}`;
}

export function genTitles(game: string, concept: string): string[] {
  const v = vocab(game);
  return [
    `${game}: ${concept}`,
    `${concept} — ${pick(v.hooks)} (${game})`,
    `I Tried ${pick(v.challenges)} in ${game} and It Went WRONG`
  ];
}

export function genScript(game: string, concept: string): string {
  const v = vocab(game);
  const loc = pick(v.locations);
  return `[SCRIPT] ${game} — "${concept}"
[00:00] COLD OPEN — mid-action clip of the climax. Voiceover: "${pick(v.hooks)}."
[00:12] INTRO — quick channel tag, explain the rules: ${concept.toLowerCase()}.
[00:45] SETUP — gear up, route to ${loc}, explain the plan and the stakes.
[02:00] ATTEMPT 1 — the plan falls apart early; quick cut of the failure, dry humor commentary.
[04:30] ADAPT — adjust the strategy near ${loc}; tension builds, music drops out.
[06:30] CLIMAX — the full attempt, uncut. Slow the pace, let the gameplay breathe.
[08:30] RESULT — victory or glorious failure; recap the best moments.
[09:15] OUTRO — like/subscribe CTA, tease the next challenge. End card.`;
}

export function genGameplayPlan(game: string, concept: string): string {
  const v = vocab(game);
  const [a, b] = pickN(v.locations, 2);
  return `GAMEPLAY PLAN — ${game}
1. Opening shot: cinematic pan over ${a}, then snap to gameplay.
2. Route: start at ${a}, rotate through ${b} for the mid-act escalation.
3. Constraint showcase: emphasize ${pick(v.mechanics)} — capture 3 clear "rule" shots.
4. Key mechanic moments: ${pick(v.mechanics)} reveal at ~40%, main stunt at ~75%.
5. Camera: chase-cam for action, freecam cinematic for transitions, slow-mo on the climax.
6. Coverage: capture 3 attempts minimum; keep the fail for the mid-act beat.`;
}

export function genDescription(game: string, concept: string, hashtags: string[]): string {
  const v = vocab(game);
  return `${concept} — a ${game} production by NEXUS AI.

${pick(v.hooks)}. Watch the full run, from setup at ${pick(v.locations)} to the final attempt.

🎮 Game: ${game}
🤖 Produced autonomously by NEXUS AI

${hashtags.join(' ')}`;
}

export function genHashtags(game: string): string[] {
  const base = [tag(game), '#Gaming', '#NEXUSAI'];
  const extras = game.includes('GTA') ? ['#GTAV', '#GTAOnline', '#Rockstar'] :
    game === 'Minecraft' ? ['#Minecraft', '#100Days', '#Survival'] :
    ['#RDR2', '#RedDeadRedemption'];
  return [...base, ...pickN(extras, 3)];
}

/** Route a free-form generation prompt to the right template. */
export function generateFromPrompt(prompt: string, game = 'GTA V', concept = ''): string {
  const p = prompt.toLowerCase();
  const c = concept || extractTitle(prompt) || genIdea(game, 'Fast Cinematic');
  if (/titles?|catchy/.test(p)) return genTitles(game, c).join('\n');
  if (/script/.test(p)) return genScript(game, c);
  if (/gameplay plan|plan/.test(p)) return genGameplayPlan(game, c);
  if (/description|hashtag/.test(p)) return genDescription(game, c, genHashtags(game));
  if (/concept|idea|title/.test(p)) return genIdea(game, p.match(/fast|funny|documentary|tutorial|cinematic/i)?.[0] || 'Fast Cinematic');
  return genScript(game, c);
}

function extractTitle(prompt: string): string {
  const m = prompt.match(/"([^"]{8,120})"/) || prompt.match(/titled\s+"?([^"\n]{8,120})"?/i);
  return m ? m[1].trim() : '';
}
