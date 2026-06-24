// ── Car Thief 6: Night Crime — static data ──────────────────────────
export const SKILLS = ["acting","shooting","hiding","driving","locksmith","electronics"];
export const SKILL_ICONS = {acting:"🎭",shooting:"🔫",hiding:"🌫️",driving:"🏎️",locksmith:"🗝️",electronics:"💻"};

export const CLASSES = [
  {id:"actor",      face:"🎭", name:"Actor",       desc:"Talks his way into anything.",            sk:{acting:5,shooting:1,hiding:3,driving:2,locksmith:2,electronics:2}},
  {id:"shooter",    face:"🔫", name:"Shooter",     desc:"When subtle fails, he doesn't.",          sk:{acting:1,shooting:5,hiding:2,driving:3,locksmith:2,electronics:1}},
  {id:"thief",      face:"🌫️", name:"Thief",       desc:"You never saw him. Nobody ever does.",    sk:{acting:2,shooting:1,hiding:5,driving:2,locksmith:3,electronics:2}},
  {id:"driver",     face:"🏎️", name:"Driver",      desc:"Fast behind the wheel, quick to vanish.", sk:{acting:2,shooting:1,hiding:3,driving:5,locksmith:2,electronics:2}},
  {id:"locksmith",  face:"🗝️", name:"Locksmith",   desc:"No door stays closed for long.",          sk:{acting:2,shooting:1,hiding:2,driving:2,locksmith:5,electronics:3}},
  {id:"electrician",face:"💻", name:"Electrician", desc:"Alarms and immobilizers are puzzles.",    sk:{acting:2,shooting:1,hiding:2,driving:2,locksmith:3,electronics:5}},
];

export const DIFFS = [
  {name:"Easy",      debt:400000,  cash:5000, interest:.003, copMult:.7,  desc:"$400K debt · 0.3%/night interest · relaxed police"},
  {name:"Normal",    debt:746800,  cash:3000, interest:.005, copMult:1,   desc:"$746.8K debt · 0.5%/night interest · the classic setup"},
  {name:"Hard",      debt:1000000, cash:1500, interest:.008, copMult:1.4, desc:"$1M debt · 0.8%/night interest · police everywhere"},
  {name:"Impossible",debt:1500000, cash:1000, interest:.011, copMult:1.8, desc:"$1.5M debt · 1.1%/night interest · the city hates you"},
];

export const CARS = [
  {n:"Rusty Compacta",   v:900,    d:0,  ic:"🚗", bt:"hatch",  col:"#9a6e4e", tmax:20},
  {n:"Vista Sedan",      v:2200,   d:1,  ic:"🚗", bt:"sedan",  col:"#7a8aa0", tmax:40},
  {n:"Brava Hatchback",  v:3500,   d:2,  ic:"🚙", bt:"hatch",  col:"#b03a3a", tmax:60},
  {n:"Workhorse Pickup", v:5200,   d:3,  ic:"🛻", bt:"pickup", col:"#3e5e8e", tmax:40},
  {n:"Falcon Coupe",     v:9000,   d:5,  ic:"🚘", bt:"coupe",  col:"#2e2e34", tmax:60},
  {n:"Imperator Luxury", v:18000,  d:7,  ic:"🚖", bt:"luxury", col:"#1d2438", tmax:60},
  {n:"Stallion GT",      v:32000,  d:9,  ic:"🏎️", bt:"gt",     col:"#b08c1a", tmax:80},
  {n:"Vendetta Sport",   v:55000,  d:11, ic:"🏎️", bt:"sport",  col:"#8f1d1d", tmax:100},
  {n:"Eclipse Supercar", v:120000, d:13, ic:"🏎️", bt:"super",  col:"#f0f0f4", tmax:100},
  {n:"Mirage Hypercar",  v:300000, d:16, ic:"🏎️", bt:"hyper",  col:"#1a8f8f", tmax:100},
  {n:"Wrecker Tow Truck",v:14000,  d:4,  ic:"🚚", bt:"truck",  col:"#c87820", tow:true, tmax:20}, // index 10 — only via its own job
  {n:"'67 Concours Phantom", v:500000, d:18, ic:"👑", bt:"luxury", col:"#caa83a", tmax:40}, // index 11 — you don't turbo a Phantom
];

// slot: melee | gun | vest | tool · weapons: dmg [lo,hi] · vests: block %
export const ITEMS = [
  // ── melee (Melee Slot) ──
  {id:"knife",   n:"Switchblade",     cost:300,   slot:"melee", dmg:[3,7],   ic:"🔪", blurb:"Quiet. Personal. Always loaded."},
  {id:"bat",     n:"Baseball Bat",    cost:550,   slot:"melee", dmg:[5,10],  ic:"🏏", blurb:"America's pastime."},
  {id:"machete", n:"Machete",         cost:1600,  slot:"melee", dmg:[8,14],  ic:"🗡️", blurb:"Negotiations end quickly."},
  // ── guns (Gun Slot) ──
  {id:"pistol",  n:"9mm Pistol",      cost:2000,  slot:"gun",  dmg:[6,12],  sk:"shooting", b:1, ic:"🔫", blurb:"Semi-automatic, caliber 9mm."},
  {id:"magnum",  n:".45 Hand Cannon", cost:4500,  slot:"gun",  dmg:[9,16],  sk:"shooting", b:1, ic:"🔫", blurb:"Persuasion, full-size print."},
  {id:"shotgun", n:"Sawn-off Shotgun",cost:7500,  slot:"gun",  dmg:[12,22], sk:"shooting", b:2, loud:3, ic:"💥", blurb:"Ends arguments. Starts sirens."},
  // ── vests (Vest Slot) ──
  {id:"armor",   n:"Kevlar Vest",     cost:5000,  slot:"vest", block:50, ic:"🦺", blurb:"Blocks half of any beating."},
  {id:"plated",  n:"Plated Vest",     cost:12000, slot:"vest", block:65, ic:"🛡️", blurb:"Heavy, loud to run in, hard to hurt."},
  // ── tools (Tool Slots / backpack) ──
  {id:"hammer",  n:"Hammer",          cost:200,   slot:"tool", ic:"🔨", blurb:"Opens any window. Loudly.", tool:true},
  {id:"wedge",   n:"Pump Wedge",      cost:900,   slot:"tool", ic:"🪛", blurb:"Eases the door open, nice and quiet.", tool:true},
  {id:"buster",  n:"The Buster",      cost:3500,  slot:"tool", ic:"🪚", blurb:"Eats steering and pedal locks for lunch.", tool:true},
  {id:"slimjim", n:"Slim Jim",        cost:300,   slot:"tool", sk:"locksmith", b:1, ic:"📏", blurb:"Bent steel, honest work.", tool:true},
  {id:"picks",   n:"Pro Lockpicks",   cost:1500,  slot:"tool", sk:"locksmith", b:2, ic:"🗝️", blurb:"Tension wrench included."},
  {id:"laptop",  n:"Code Grabber",    cost:4000,  slot:"tool", sk:"electronics", b:2, ic:"💻", blurb:"Eats key-fob signals for breakfast."},
  {id:"scanner", n:"Police Scanner",  cost:2500,  slot:"tool", sk:"hiding", b:2, ic:"📻", blurb:"Hear them coming."},
  {id:"disguise",n:"Disguise Kit",    cost:1200,  slot:"tool", sk:"acting", b:2, ic:"🎭", blurb:"Mustache, valet jacket, clipboard."},
  {id:"nitro",   n:"Nitro Kit",       cost:6000,  slot:"tool", sk:"driving", b:2, ic:"⚡", blurb:"For when second place is prison."},
  {id:"jammer",  n:"Signal Jammer",   cost:12000, slot:"tool", sk:"electronics", b:3, ic:"📡", blurb:"Trackers? What trackers?"},
];
export const PACK_SIZE = 9;
// tuning is a ladder — each rung costs real money, premium metal costs more
export const TUNE_STAGES = [
  {n:"Street tune",       to:20,  cost:600,   blurb:"Plugs, fluids, a proper map."},
  {n:"Performance chip",  to:40,  cost:1800,  blurb:"The ECU stops lying to the engine."},
  {n:"Turbo kit",         to:60,  cost:5400,  blurb:"Spool up. Hold on."},
  {n:"Race suspension",   to:80,  cost:14000, blurb:"Corners stop being suggestions."},
  {n:"Full race build",   to:100, cost:32000, blurb:"Cage, slicks, straight pipe. A weapon."},
];
export const itemStats = it => [
  it.dmg ? `Damage: ${it.dmg[0]}..${it.dmg[1]}` : null,
  it.block ? `Blocks: ${it.block}% of damage` : null,
  it.sk ? `+${it.b} ${it.sk[0].toUpperCase()+it.sk.slice(1)}` : null,
  it.loud ? `Noise: +${it.loud} when fired` : null,
  `Works in: ${it.slot==="tool"?"Tool Slot / Backpack":it.slot==="melee"?"Melee Slot":it.slot==="gun"?"Gun Slot":"Vest Slot"}`,
].filter(Boolean);

export const HIDEOUTS = [
  {n:"Backstreet lockup",  cap:2,  cost:0,      costs:50},
  {n:"Old warehouse",      cap:4,  cost:15000,  costs:120},
  {n:"Chop-shop garage",   cap:7,  cost:45000,  costs:250},
  {n:"Dockside compound",  cap:12, cost:120000, costs:500},
  {n:"Private marina",     cap:20, cost:300000, costs:900},
];

export const NAMES = ["Vinnie","Marco","Lola","Duke","Tasha","Smokey","Ray","Bianca","Carlos","Eddie","Pearl","Knuckles","Slim","Rosa","Tony","Jade","Mickey","Dee","Hector","Ivy"];
export const FACES = ["🧔","👩","👨‍🦲","🧑","👱","🧕"];

// chk: [primary, secondary] · diff: d20 target · en: energy cost · heat: wanted pressure
export const MISSIONS = [
  {id:"pickpocket", n:"Pickpocket",      ic:"👜", chk:["acting","hiding"],        diff:8,  en:2, heat:1, minLvl:1,
    desc:"Tourists on the boardwalk, wallets fat with vacation money.", pay:[250,950]},
  {id:"carparts",   n:"Strip a car",     ic:"🔩", chk:["locksmith","hiding"],     diff:9,  en:2, heat:1, minLvl:1,
    desc:"A parked car in a dark lot. The rims alone are worth something.", pay:[500,1450]},
  {id:"stealcar",   n:"Steal a car",     ic:"🚗", chk:["locksmith","electronics"],diff:10, en:3, heat:2, minLvl:1, car:[0,4],
    desc:"An unattended car, yours if you can beat the lock and the alarm."},
  {id:"carjack",    n:"Carjacking",      ic:"🔫", chk:["shooting","driving"],     diff:12, en:3, heat:3, minLvl:2, car:[3,7],
    desc:"Take it at a red light — keys included. Witnesses included too."},
  {id:"burglary",   n:"Burglary",        ic:"🏠", chk:["hiding","locksmith"],     diff:12, en:3, heat:2, minLvl:2,
    desc:"A dark house in the suburbs. In and out before the lights come on.", pay:[2400,9500]},
  {id:"race",       n:"Street race",     ic:"🏁", chk:["driving","driving"],      diff:12, en:3, heat:2, minLvl:2, race:true,
    desc:"Put money down, drive like hell. Winner takes the pot."},
  {id:"order",      n:"Special order",   ic:"📋", chk:["locksmith","electronics"],diff:14, en:3, heat:3, minLvl:4, order:true,
    desc:"A collector wants a specific model — delivered tonight, premium paid."},
  {id:"gang",       n:"Gang trouble",    ic:"👊", chk:["shooting","acting"],      diff:13, en:3, heat:2, minLvl:3,
    desc:"A rival crew is muscling into your turf. Settle it.", pay:[3200,11000]},
  {id:"mansion",    n:"Mansion job",     ic:"🏛️", chk:["electronics","hiding"],   diff:16, en:3, heat:4, minLvl:6,
    desc:"Gated estate, private security, a safe full of bearer bonds.", pay:[13000,40000]},
  {id:"exotic",     n:"Exotic showroom", ic:"💎", chk:["electronics","locksmith"],diff:18, en:3, heat:6, minLvl:8, car:[7,9],
    desc:"Behind that glass sits a machine worth more than a house."},
  {id:"towtruck",   n:"Steal a tow truck",ic:"🚚", chk:["locksmith","driving"],   diff:11, en:3, heat:2, minLvl:2, truck:true,
    desc:"A wrecker parked behind the impound lot. With one of these, you don't break into cars — you take them."},
  {id:"impound",    n:"Impound raid",     ic:"🚔", chk:["locksmith","hiding"],     diff:13, en:3, heat:3, minLvl:99,
    desc:"Your own car sits behind their fence with an evidence tag on the mirror. Ten days until auction. Go get it."},
  {id:"casino",     n:"Casino count room",ic:"🎰", chk:["electronics","acting"],   diff:17, en:4, heat:5, minLvl:99, pay:[40000,90000],
    desc:"Saturday's takings stacked in the count room behind the cage. The house always wins — until tonight."},
];

export const CITIES = [
  {n:"Miami, FL",     mult:1,    districts:["South Beach","Downtown","Little Havana","Wynwood","Coral Way","The Docks"],
    perk:"docks", perkDesc:"🚢 The Docks: ship any car overseas — even hot or recognizable — for 85% value, wired in 3 days. One ship every 5 days."},
  {n:"Atlanta, GA",   mult:1.2,  districts:["Midtown","Buckhead","Old Fourth Ward","East Atlanta","Bankhead","Decatur"],
    perk:"chop", perkDesc:"🪓 Chop town: Atlanta's chop shops pay 45% instead of 35%."},
  {n:"Las Vegas, NV", mult:1.45, districts:["The Strip","Fremont East","Spring Valley","Paradise","Summerlin","North LV"],
    perk:"casino", perkDesc:"🎰 The casino: one wager a night, double or nothing. The house edge is real."},
  {n:"Los Angeles, CA",mult:1.7, districts:["Venice","Echo Park","Compton","Hollywood","Downtown","San Pedro"],
    perk:"collectors", perkDesc:"🎬 Collector town: special orders and race pots pay 15% extra."},
];

// every city has its own fence — different cash, different tastes
export const FENCES = [
  {n:"Manny",            face:"🧔", city:0, budgetMult:1,   lootB:0,    blurb:'"Bring me metal, I bring you money. Hot cars sell cheap — let \'em cool first."'},
  {n:"Aunt Dee",         face:"👵", city:1, budgetMult:0.9, lootB:0.2,  carB:-0.05, blurb:'"Jewelry, watches, electronics — that\'s real money, baby. Cars are just heavy."'},
  {n:"Sammy Two-Phones", face:"🕴️", city:2, budgetMult:1.1, lootB:0,    carB:0.10, loud:true, blurb:'"I pay over book, friend. And everybody on the Strip hears about it."'},
  {n:"Mr. Sterling",     face:"🤵", city:3, budgetMult:1.3, lootB:0,    carB:0, exoticB:0.15, cheapPen:0.10, blurb:'"I deal in automobiles, not... transportation. Bring me something worth insuring."'},
];
export const FLY_BASE = 250, FLY_PER = 350, DRIVE_PER = 120;
export const THUG = {hp:[16,26], atk:[4,11], names:["Knuckle","Ratchet","Big Sosa","Pinky","Two-Step","El Mudo","Crowbar","Lil Tax"]};
export const FENCE_BUDGET = [8000, 15000, 25000, 40000, 65000]; // Manny's daily cash by hideout tier
export const RECOG_VALUE = 30000; // cars this hot need a respray before any fence touches them

// equipment found installed in cars
export const CAR_EQUIP = [
  {id:"stereo",  n:"Premium stereo", ic:"📻", v:300},
  {id:"gps",     n:"GPS tracker",    ic:"📡", v:0, trace:true},
  {id:"radar",   n:"Radar detector", ic:"🛰️", v:450},
  {id:"navsys",  n:"Nav system",     ic:"🧭", v:350},
  {id:"sub",     n:"Subwoofer",      ic:"🔊", v:250},
  {id:"dvd",     n:"In-dash DVD",    ic:"📀", v:280},
];

// ── property empire: two businesses per city ────────────────────────
export const PROPERTIES = [
  {id:"condo",  city:0, n:"South Beach Condo",    ic:"🏖️", cost:60000,  upkeep:120, income:0,    launder:0,    perk:"rest",   blurb:"A real bed. +1 max energy while in Miami."},
  {id:"carwash",city:0, n:"Sunshine Car Wash",    ic:"🫧", cost:90000,  upkeep:150, income:600,  launder:3500, perk:null,     blurb:"Washes cars. Washes money."},
  {id:"diner",  city:1, n:"Peachtree Diner",      ic:"🍳", cost:70000,  upkeep:130, income:1200, launder:1500, perk:null,     blurb:"Best biscuits inside the Perimeter. Cash business."},
  {id:"chopfr", city:1, n:"Chop Shop Franchise",  ic:"🪓", cost:110000, upkeep:200, income:0,    launder:2500, perk:"chop",   blurb:"+10% chop rates in every city."},
  {id:"pawn",   city:2, n:"Lucky 7 Pawn",         ic:"🎰", cost:120000, upkeep:180, income:900,  launder:4000, perk:"fence",  blurb:"+25% fence budget while in Vegas."},
  {id:"motel",  city:2, n:"Desert Rose Motel",    ic:"🛎️", cost:80000,  upkeep:160, income:1500, launder:1000, perk:"rest",   blurb:"Hourly rates, no questions. +1 max energy in Vegas."},
  {id:"carlot", city:3, n:"Sunset Used Cars",     ic:"🚙", cost:150000, upkeep:250, income:0,    launder:2000, perk:"lot",    blurb:"Sell a clean, cold car at 115% retail — paid clean over 3 days."},
  {id:"storage",city:3, n:"San Pedro Storage",    ic:"📦", cost:100000, upkeep:150, income:0,    launder:1500, perk:"garage", blurb:"+4 garage slots while in LA."},
];
export const LAUNDER_STREET_FEE = 0.18; // the street wash takes its cut
export const LAUNDER_BIZ_FEE = 0.12;    // your own books take less

// ── crew traits (snitch hides as "quiet") ───────────────────────────
export const TRAITS = [
  {id:"greedy", n:"Greedy",  ic:"🤑", blurb:"+1 to their best skill, +25% wage."},
  {id:"loyal",  n:"Loyal",   ic:"🤝", blurb:"Can never be poached."},
  {id:"hothead",n:"Hothead", ic:"🤬", blurb:"+3 damage in fights, worse as a lookout."},
  {id:"ghost",  n:"Ghost",   ic:"👻", blurb:"Sharper lookout, better at covering your mistakes."},
  {id:"snitch", n:"Quiet",   ic:"🤐", blurb:"Doesn't say much.", hidden:true},
];

// ── car quirks (20% of stolen/dealer cars) ──────────────────────────
export const QUIRKS = [
  {id:"exmayor", n:"Ex-mayor's car",  ic:"🎩", blurb:"+20% value — provenance sells."},
  {id:"lemon",   n:"Lemon",           ic:"🍋", blurb:"−15% value. Something rattles."},
  {id:"pullsLeft",n:"Pulls left",     ic:"↩️", blurb:"−1 driving when used as your ride."},
  {id:"tuner",   n:"Tuner special",   ic:"🔧", blurb:"Tune ceiling +20."},
  {id:"famous",  n:"Seen in a film",  ic:"🎬", blurb:"+5 fame when sold."},
];

// ── weekly paper headlines by fame band ─────────────────────────────
export const PAPER_NAME = "THE WEEKLY LEDGER";
export const HEADLINES = {
  quiet: ["SLOW WEEK FOR AUTO CRIME, SAY POLICE","CITY COUNCIL DEBATES PARKING METERS","LOCAL MAN GROWS ENORMOUS PUMPKIN"],
  rising:["CAR THEFTS UP — PATTERN SUSPECTED","POLICE SEEK 'PROFESSIONAL' AUTO THIEF","INSURERS RAISE PREMIUMS ON LUXURY CARS"],
  hot:   ["WHO IS THE PHANTOM THIEF?","TASK FORCE FORMED AS THEFTS SOAR","DEALERSHIPS HIRE NIGHT GUARDS"],
  legend:["THE NAME EVERY GARAGE WHISPERS","ONE THIEF, FOUR CITIES, NO ARRESTS","'WE WILL CATCH THEM' — CHIEF, AGAIN"],
};

// ── run mutators + prestige perks ───────────────────────────────────
export const MUTATORS = [
  {id:"iron",     n:"Ironman",  ic:"🪨", blurb:"Autosave only — no manual saves or loads."},
  {id:"pacifist", n:"Pacifist", ic:"🕊️", blurb:"No weapons, ever. Fists and wits. +20% XP."},
  {id:"speed",    n:"Speedrun", ic:"⏱️", blurb:"Interest ×1.5. Fame ×2. Live fast."},
];
export const PRESTIGE_PERKS = [
  {id:"skills", n:"Old hands",      ic:"📈", blurb:"+1 to every skill at start."},
  {id:"cash",   n:"Buried envelope",ic:"💵", blurb:"Start with an extra $20,000 clean."},
  {id:"kit",    n:"The old kit",    ic:"🧰", blurb:"Start with lockpicks, code grabber and scanner."},
  {id:"rep",    n:"Known quantity", ic:"🤝", blurb:"Every fence starts at 10 deals of trust."},
];

// ── loot tables (found while ransacking) ────────────────────────────
export const CAR_LOOT = [
  {n:"GPS unit",        ic:"🧭", v:[80,250]},
  {n:"Car stereo",      ic:"📻", v:[100,400]},
  {n:"Dash cam",        ic:"📹", v:[60,200]},
  {n:"In-dash DVD",     ic:"📀", v:[120,350]},
  {n:"Laptop bag",      ic:"💼", v:[200,800]},
  {n:"Designer shades", ic:"🕶️", v:[50,300]},
  {n:"Phone",           ic:"📱", v:[100,450]},
  {n:"Gym bag",         ic:"🎒", v:[20,120]},
  {n:"Toll change",     ic:"🪙", v:[5,40]},
];
export const HOUSE_LOOT = [
  {n:"Jewelry box",     ic:"💍", v:[800,3500]},
  {n:"Cash bundle",     ic:"💵", v:[500,2500]},
  {n:"Watch collection",ic:"⌚", v:[600,4000]},
  {n:"Silverware",      ic:"🍴", v:[200,900]},
  {n:"Game console",    ic:"🎮", v:[150,500]},
  {n:"Camera",          ic:"📷", v:[250,1200]},
  {n:"Art piece",       ic:"🖼️", v:[1000,6000]},
  {n:"Rare whiskey",    ic:"🥃", v:[150,800]},
];
