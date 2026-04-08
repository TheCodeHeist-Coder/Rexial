const WARRIOR_SEEDS = [
     'Ironclad', 'Shadowblade', 'Thunderfist', 'Grimhammer', 'Nightwolf',
  'Blizzard', 'Scorpius', 'Ravenclaw', 'Flamestrike', 'Stonefist',
  'Vortex', 'Dragonfury', 'Silverbolt', 'Doomslayer', 'Ashborne',
  'Hurricano', 'Goliath', 'Vindicator', 'Specter', 'Titanfall',
  'Phantomblade', 'Warpaint', 'Magmaborn', 'Frostfang', 'Bonecrusher',
  'Cinderella', 'Merlin', 'Torchbearer', 'Blazewarden', 'Moonstriker',
  'Galaxiano', 'Zephyrax', 'Cryptkeeper', 'Starforged', 'Runeblade',
  'Emberstorm', 'Glitchhunter', 'Neonking', 'Chaoswalker', 'Witchfire',
]

const AVATAR_COLORS = [
     'from-pink-500 to-rose-600',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-red-500 to-pink-600',
  'from-indigo-500 to-blue-600',
  'from-yellow-500 to-orange-600',
  'from-fuchsia-500 to-pink-600',
  'from-sky-500 to-indigo-600',
]

function hash(str:string): number {
    let h = 5381;
    for(let i = 0; i < str.length; i++){
        h = (h*33) ^ str.charCodeAt(i);
    }
    return Math.abs(h);
}

export function getAvatar(participantId: string): string {
    const seed = WARRIOR_SEEDS[hash(participantId) % WARRIOR_SEEDS.length];
    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=transparent`;

}

export function getAvatarColor(participantId: string): string {
    return AVATAR_COLORS[hash(participantId + 'c') % AVATAR_COLORS.length];
}