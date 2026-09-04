import './App.css'
import {fileHandler} from './index.ts'
import {PDFDocument} from 'pdf-lib'
import {useState, useEffect, Fragment, type ChangeEvent, type KeyboardEvent} from "react";
import {publishSheet, leaveRoom, fetchRoom, watchRoom, newRoomCode, sweepOldRooms, roomsReady, type RoomRow} from './supabase.ts'


type CharInfo = Map<string, string | boolean | undefined>

// the three characteristics a frenzy does not get in the way of
const physicalChars = ["Str", "Ag", "End"]

const rankLadder = [
    {abbr: "", name: "Untrained", bonus: -20},
    {abbr: "Novi.", name: "Novice", bonus: 0},
    {abbr: "Appr.", name: "Apprentice", bonus: 10},
    {abbr: "Jour.", name: "Journeyman", bonus: 20},
    {abbr: "Adep.", name: "Adept", bonus: 30},
    {abbr: "Expe.", name: "Expert", bonus: 40},
    {abbr: "Mast.", name: "Master", bonus: 50},
]

// a sheet might spell a rank out, shorten it, shout it, or misspell it, so this pins
// whatever it says onto one of the seven ranks. two letters is enough to tell them
// apart, except that a bare no, none or n/a means no rank at all rather than novice
function readRank(raw: string) {
    const letters = raw.toLowerCase().replace(/[^a-z]/g, "")
    if (letters === "") return ""
    if (["none", "na", "nil", "no", "untrained", "unt", "un", "u"].includes(letters)) return ""

    const byTwo: Record<string, string> = {
        un: "", no: "Novi.", ap: "Appr.", jo: "Jour.",
        ad: "Adep.", ex: "Expe.", ma: "Mast.",
    }
    const two = letters.slice(0, 2)
    if (byTwo[two] !== undefined) return byTwo[two]

    // a single letter still gives it away for everything except a and its two ranks
    const byOne: Record<string, string> = {u: "", n: "Novi.", j: "Jour.", e: "Expe.", m: "Mast."}
    if (byOne[letters[0]] !== undefined) return byOne[letters[0]]
    return ""
}

// a creature's full write up, worded exactly as the book has it
type Statblock = {
    name: string,
    flavour: string,
    tags: string,
    stats: {group: string, rows: [string, string][]}[],
    sections: {head: string, kind: "list" | "prose", items: {name?: string, text?: string}[]}[],
}

const statblocks: Record<string, Statblock> = {
    "Snow Bear": {
        name: "Snow Bear",
        flavour: "Covered in stark-white fur and larger than their southern cousins, Snow Bears can be found roaming the frozen tundras and craggy glaciers of Tamriel\u2019s northernmost provinces. They are stronger and more aggressive than other varieties of bear.",
        tags: "Bear, Beast; Average; White Soul (300)",
        stats: [
            {group: "Characteristics", rows: [
                    ["Strength", "50"], ["Endurance", "50"], ["Agility", "30"], ["Intelligence", "15"],
                    ["Willpower", "35"], ["Perception", "30"], ["Personality", "5"], ["Morale", "45"],
                ]},
            {group: "Attributes", rows: [
                    ["Hit Points", "50"], ["Wound Thr.", "16"], ["Magicka", "15"], ["Stamina", "5"],
                    ["Initiative", "+7"], ["Action Pts.", "3"], ["Speed", "11m"], ["Size", "Large"],
                ]},
            {group: "Skills", rows: [
                    ["Combat", "70"], ["Magic", "-"], ["Evade", "30"], ["Observe", "50"],
                    ["Stealth", "40"], ["Knowledge", "-"], ["Social", "-"], ["Physical", "70"],
                ]},
        ],
        sections: [
            {head: "Weapons and Armor", kind: "list", items: [
                    {name: "Claws", text: "1d12 Crushing or Splitting; Reach 1m"},
                    {name: "Bite", text: "1d10 Crushing; Reach 1m"},
                    {name: "Natural Toughness (3)"},
                    {name: "Resist Frost (8)", text: "Reduces incoming Frost damage by 8."},
                ]},
            {head: "Special Abilities", kind: "list", items: [
                    {name: "Maul (1 AP + 2 SP)", text: "The bear performs a melee attack as a Primary action that deals 2d8 Crushing damage to a target creature within 1 meter. Additionally, all creatures within reach that are Medium or smaller must succeed on an Acrobatics or Athletics test or be knocked prone."},
                ]},
            {head: "Traits", kind: "list", items: [
                    {name: "Bestial"},
                    {name: "Strong Jaws", text: "A Bite attack made by this character that deals damage automatically starts a Grapple. The test to contest this Grapple is made against the original test made by the attacker. If the target Counter Attacks a Bite attack, the Counter Attack ignores the creature\u2019s AR and Natural Toughness trait."},
                    {name: "Diseased (+0)", text: "If the creature successfully deals damage to an undiseased target with their natural weapons, then the target creature must succeed on a +0 Endurance test or contract a Common Disease."},
                    {name: "Quadruped"},
                    {name: "Savage", text: "Rolls damage twice and uses the highest result."},
                ]},
            {head: "Encountering Snow Bears", kind: "prose", items: [
                    {text: "Snow bears can be found roaming the frozen tundras and glacier-filled ravines of Tamriel\u2019s northernmost provinces and islands. They roam these frozen lands year-round and, due to the harsh conditions in which they live, these animals will seldom give up an opportunity to make a kill. Unlike their southern cousins, they will eat men or mer they bring down and will guard the carcasses of their prey ferociously."},
                    {text: "Snow bears will become very territorial and aggressive unless the target is obviously superior or causes Fear. These bears will relentlessly pursue their prey, and can run on all fours nearly as fast as a horse despite their great size."},
                ]},
            {head: "Loot", kind: "list", items: [
                    {text: "On a +30 Survival test, a character can remove the bear\u2019s pelt, worth 200 drakes, over the course of a Short Rest.This pelt has an ENC of 2. Failing this test spoils the pelt, halving its worth."},
                    {text: "On a +20 Survival test, a character can, over the course of a Long Rest, turn a bear pelt into two limb pieces of Full Snow Bear Fur armor, or one Full Snow Bear Fur chest piece. Bear Fur armor is exactly the same as regular Fur but has 4 AR and gives 4 Frost AR. Failing this test spoils the pelt instead, rendering it useless and halving its worth."},
                    {text: "On a +20 Simple Survival test over a Long Rest, a character can harvest DoS x 3 days\u2019 rations of bear meat. The meat will spoil within a day if not properly preserved."},
                    {text: "On a +0 Alchemy test over a Short Rest, a character can harvest and powder the bear\u2019s claws, which are a Rare Alteration ingredient. The character harvests DoS dosages."},
                ]},
        ],
    },
    "Bear": {
        name: "Bear",
        flavour: "Bears are large ursine quadrupeds that are widespread and ubiquitous in temperate and arctic regions. They are typically large and capable of crushing an armored man.",
        tags: "Bear, Beast; Average; White Soul (250)",
        stats: [
            {group: "Characteristics", rows: [
                    ["Strength", "50"], ["Endurance", "50"], ["Agility", "30"], ["Intelligence", "15"],
                    ["Willpower", "35"], ["Perception", "30"], ["Personality", "5"], ["Morale", "35"],
                ]},
            {group: "Attributes", rows: [
                    ["Hit Points", "35"], ["Wound Thr.", "13"], ["Magicka", "15"], ["Stamina", "5"],
                    ["Initiative", "+7"], ["Action Pts.", "3"], ["Speed", "11m"], ["Size", "Large"],
                ]},
            {group: "Skills", rows: [
                    ["Combat", "70"], ["Magic", "-"], ["Evade", "30"], ["Observe", "50"],
                    ["Stealth", "40"], ["Knowledge", "-"], ["Social", "-"], ["Physical", "70"],
                ]},
        ],
        sections: [
            {head: "Weapons and Armor", kind: "list", items: [
                    {name: "Claws", text: "1d12 Crushing or Splitting; Reach 1m"},
                    {name: "Bite", text: "1d10 Crushing; Reach 1m"},
                    {name: "Natural Toughness (3)"},
                ]},
            {head: "Special Abilities", kind: "list", items: [
                    {name: "Maul (1 AP + 2 SP)", text: "The bear performs a melee attack as a Primary Action that deals 2d8 Crushing damage to a target creature within 1 meter. Additionally, all creatures within reach that are Medium or smaller must succeed on an Acrobatics or Athletics test or be knocked prone."},
                ]},
            {head: "Traits", kind: "list", items: [
                    {name: "Bestial"},
                    {name: "Strong Jaws", text: "A Bite attack made by this character that deals damage automatically starts a Grapple. The test to contest this Grapple is made against the original test made by the attacker. If the target Counter Attacks a Bite attack, the Counter Attack ignores the creature\u2019s AR and Natural Toughness trait."},
                    {name: "Diseased (+0)", text: "If the creature successfully deals damage to an undiseased target with their natural weapons, the target creature must succeed on a +0 Endurance test or contract a Common Disease."},
                    {name: "Quadruped"},
                ]},
            {head: "Variant: Cave Bear", kind: "list", items: [
                    {name: "Dark Sight"},
                    {name: "Stubborn", text: "The creature may re-roll failed Fear tests."},
                ]},
            {head: "Encountering Bears", kind: "prose", items: [
                    {text: "Bears are often found in their dens or roaming in search of food. They frequent temperate or evergreen woodlands, though their adaptable nature allows them to thrive in many climates. During winter, bears will be found almost exclusively in their dens with the exception of Snow Bears which will continue to roam and hunt during the cold season, but will be far less active. Bears are sometimes accompanied by their cubs, which they will defend with their lives."},
                    {text: "Bears will become very territorial and aggressive unless the target is obviously superior or causes Fear. If the bear wins the fight, they will typically leave their opponent alone, bleeding and battered after they are convinced the threat is subdued, and don\u2019t tend to eat humans unless desperate. Bears will relentlessly pursue their prey, and can run on all fours nearly as fast as a horse."},
                ]},
            {head: "Loot", kind: "list", items: [
                    {text: "On a +30 Survival test, a character can remove the bear\u2019s pelt, worth 100 drakes, over the course of a Short Rest. This pelt has an ENC of 2. Failing this test spoils the pelt, halving its worth."},
                    {text: "On a +20 Survival test, a character can, over the course of a Long Rest, turn a bear pelt into two limb pieces of Full Bear Fur armor or one Full Bear Fur chest piece. Bear Fur armor is the same as regular Fur but has 4 AR. Failing spoils the pelt instead, making it useless and halving its worth."},
                    {text: "On a +20 Simple Survival test over a Long Rest, a character can harvest DoS x 3 days\u2019 rations of bear meat. The meat will spoil within a day if not properly preserved."},
                    {text: "On a +0 Alchemy test over a Short Rest, a character can harvest and powder the bear\u2019s claws, which are a Rare Alteration ingredient. The character harvests DoS dosages."},
                ]},
        ],
    },
}

// every creature in the book, by chapter and category. a category holding one creature
// adds it straight away, one holding several opens to show them. variants live inside a
// statblock rather than here, so a cave bear is part of the bear write up
const creatureLibrary: {chapter: string, category: string, members: string[]}[] = [
    {chapter: "Beasts", category: "Bears", members: ["Bear", "Snow Bear"]},
    {chapter: "Beasts", category: "Rats", members: ["Cave Rat", "Skeever"]},
    {chapter: "Beasts", category: "Crocodile", members: ["Crocodile"]},
    {chapter: "Beasts", category: "Dogs", members: ["Dog", "War Dog"]},
    {chapter: "Beasts", category: "Dreughs", members: ["Dreugh", "Land Dreugh"]},
    {chapter: "Beasts", category: "Durzog", members: ["Durzog"]},
    {chapter: "Beasts", category: "Game Animals", members: ["Small Game", "Large Game"]},
    {chapter: "Beasts", category: "Giant", members: ["Giant"]},
    {chapter: "Beasts", category: "Giant Bat", members: ["Giant Bat"]},
    {chapter: "Beasts", category: "Giant Snake", members: ["Giant Snake"]},
    {chapter: "Beasts", category: "Giant Spider", members: ["Giant Spider"]},
    {chapter: "Beasts", category: "Goblins", members: ["Goblin Grunt", "Goblin Berserker", "Goblin War-Chief", "Goblin Shaman"]},
    {chapter: "Beasts", category: "Harpy", members: ["Harpy"]},
    {chapter: "Beasts", category: "Horker", members: ["Horker"]},
    {chapter: "Beasts", category: "Horses", members: ["Horse", "War Horse"]},
    {chapter: "Beasts", category: "Imp", members: ["Imp"]},
    {chapter: "Beasts", category: "Lamia", members: ["Lamia"]},
    {chapter: "Beasts", category: "Lion", members: ["Lion"]},
    {chapter: "Beasts", category: "Minotaur", members: ["Minotaur"]},
    {chapter: "Beasts", category: "Mudcrab", members: ["Mudcrab"]},
    {chapter: "Beasts", category: "Ogre", members: ["Ogre"]},
    {chapter: "Beasts", category: "Slaughterfish", members: ["Slaughterfish"]},
    {chapter: "Beasts", category: "Trolls", members: ["Cave Troll", "Frost Troll"]},
    {chapter: "Beasts", category: "Wolf", members: ["Wolf"]},

    {chapter: "People", category: "Acrobat", members: ["Acrobat"]},
    {chapter: "People", category: "Agent", members: ["Agent"]},
    {chapter: "People", category: "Assassin", members: ["Assassin"]},
    {chapter: "People", category: "Arena Fighters", members: ["Gladiator", "Champion"]},
    {chapter: "People", category: "Bandits", members: ["Bandit", "Bandit Marauder", "Bandit Poacher", "Bandit Hedge Mage"]},
    {chapter: "People", category: "Bandit Ringleader", members: ["Bandit Ringleader"]},
    {chapter: "People", category: "Barbarian", members: ["Barbarian"]},
    {chapter: "People", category: "Bard", members: ["Bard"]},
    {chapter: "People", category: "Battlemage", members: ["Battlemage"]},
    {chapter: "People", category: "Bureaucrat", members: ["Bureaucrat"]},
    {chapter: "People", category: "Commoner", members: ["Commoner"]},
    {chapter: "People", category: "Crusader", members: ["Crusader"]},
    {chapter: "People", category: "Cultists", members: ["Cultist", "Cultist Fanatic", "Cultist Mage"]},
    {chapter: "People", category: "Guards", members: ["City/Town Guard", "Legion Zero Watchman"]},
    {chapter: "People", category: "Healer", members: ["Healer"]},
    {chapter: "People", category: "Knight", members: ["Knight"]},
    {chapter: "People", category: "Mages", members: ["Mage", "Archmage"]},
    {chapter: "People", category: "Necromancer", members: ["Necromancer"]},
    {chapter: "People", category: "Hedge Mage", members: ["Hedge Mage"]},
    {chapter: "People", category: "Merchant", members: ["Merchant"]},
    {chapter: "People", category: "Monks", members: ["Monk", "Two-Moons Dance Monk"]},
    {chapter: "People", category: "Nightblade", members: ["Nightblade"]},
    {chapter: "People", category: "Pilgrim", members: ["Pilgrim"]},
    {chapter: "People", category: "Priest", members: ["Priest"]},
    {chapter: "People", category: "Rangers", members: ["Archer", "Hunter", "Bounty Hunter"]},
    {chapter: "People", category: "Rogue", members: ["Rogue"]},
    {chapter: "People", category: "Scholar", members: ["Scholar"]},
    {chapter: "People", category: "Scout", members: ["Scout"]},
    {chapter: "People", category: "Sorcerer", members: ["Sorcerer"]},
    {chapter: "People", category: "Spellsword", members: ["Spellsword"]},
    {chapter: "People", category: "Thief", members: ["Thief"]},
    {chapter: "People", category: "Warrior", members: ["Warrior"]},
    {chapter: "People", category: "Witchhunter", members: ["Witchhunter"]},
    {chapter: "People", category: "Slave", members: ["Slave"]},

    {chapter: "Undead", category: "Bonelords", members: ["Bonelord", "Ancient Bonelord"]},
    {chapter: "Undead", category: "Bonewalkers", members: ["Bonewalker", "Greater Bonewalker"]},
    {chapter: "Undead", category: "Bonewolf", members: ["Bonewolf"]},
    {chapter: "Undead", category: "Death Hound", members: ["Death Hound"]},
    {chapter: "Undead", category: "Draugr", members: ["Draugr Thrall", "Draugr Wight", "Draugr Scourge", "Draugr Wight Lord", "Draugr Deathlord", "Dragon Priest"]},
    {chapter: "Undead", category: "Ghost", members: ["Ghost"]},
    {chapter: "Undead", category: "Liches", members: ["Nether Lich", "Lich", "Ancient Lich"]},
    {chapter: "Undead", category: "Skeletons", members: ["Skeleton", "Skeletal Champion"]},
    {chapter: "Undead", category: "Wraiths", members: ["Wraith", "Gloom Wraith"]},
    {chapter: "Undead", category: "Zombies", members: ["Zombie", "Dread Zombie"]},
]

// a search should find a skeever when you type rat, so the category and the chapter
// count as well as the name, and a trailing s is ignored on both sides
function searchable(word: string) {
    const bare = word.toLowerCase().trim()
    return bare.endsWith("s") ? bare.slice(0, -1) : bare
}

function creatureMatches(name: string, category: string, chapter: string, search: string) {
    const want = searchable(search)
    if (want === "") return true
    return [name, category, chapter].some(field =>
        searchable(field).includes(want) || field.toLowerCase().includes(search.toLowerCase().trim()))
}

// the pools a creature starts with come straight off its own write up
function statOf(sb: Statblock | undefined, label: string, fallback: number) {
    if (!sb) return fallback
    for (const group of sb.stats) {
        for (const row of group.rows) {
            if (row[0] === label) {
                const n = Number(row[1])
                if (!isNaN(n)) return n
            }
        }
    }
    return fallback
}

function startingPools(name: string) {
    const sb = statblocks[name]
    const hp = statOf(sb, "Hit Points", 10)
    const ap = statOf(sb, "Action Pts.", 3)
    const sp = statOf(sb, "Stamina", 4)
    return {hp: [hp, hp] as [number, number], ap: [ap, ap] as [number, number], sp: [sp, sp] as [number, number]}
}

// bear, then bear 2, then bear 3, the way a folder names a repeated file. the first
// free slot is taken, so deleting bear 2 and adding another bear fills that gap again
function nextCreatureName(base: string, taken: string[]) {
    if (!taken.includes(base)) return base
    let n = 2
    while (taken.includes(base + " " + n)) n++
    return base + " " + n
}

// a creature the gm has put into the fight. players come from the room instead, so
// only these are stored, and only these can be edited or removed here
type Creature = {
    id: string,
    name: string,
    from: string,
    hp: [number, number],
    ap: [number, number],
    sp: [number, number],
}

// pulls the pools out of a published sheet so the tracker can show them
function poolsOf(snapshot: string) {
    try {
        const s = JSON.parse(snapshot)
        const info = new Map<string, string | boolean | undefined>(s.charInfo)
        const pair = (cur: string, max: string): [number, number] =>
            [Number(info.get(cur)) || 0, Number(info.get(max)) || 0]
        return {hp: pair("Current HP", "Max HP"), ap: pair("Current AP", "Max AP"), sp: pair("Current SP", "Max SP")}
    } catch {
        return {hp: [0, 0] as [number, number], ap: [0, 0] as [number, number], sp: [0, 0] as [number, number]}
    }
}

// armour weight classes, worded as the rulebook has them. the sheet is never parsed
// for these, the player steps through them by hand and the numbers follow
const weightClasses: {
    name: string,
    rules: string,
    // the agility penalty spares combat style, which is why it is its own hook
    agility: number,
    acrobatics: number,
    speed: number,
    all: number,
    still: boolean,
}[] = [
    {name: "No listed class", rules: "The armor is light enough it imposes no penalties on its user.",
        agility: 0, acrobatics: 0, speed: 0, all: 0, still: false},
    {name: "Light", rules: "Light armor imposes a minor penalty on a character\u2019s mobility: The character suffers a -10 penalty to Acrobatics skill tests.",
        agility: 0, acrobatics: -10, speed: 0, all: 0, still: false},
    {name: "Medium", rules: "Medium armor imposes a moderate penalty on a character\u2019s mobility: the character suffers a -10 penalty to Agility based tests (except Combat Style skill tests) and reduces their Speed by 1.",
        agility: -10, acrobatics: 0, speed: -1, all: 0, still: false},
    {name: "Heavy", rules: "Heavy armor imposes a substantial penalty on a character\u2019s mobility: the character suffers a -20 penalty to Agility based tests (except Combat Style skill tests) and reduces their Speed by 2.",
        agility: -20, acrobatics: 0, speed: -2, all: 0, still: false},
    {name: "Super-Heavy", rules: "Super-Heavy armor imposes a staggering penalty on a character\u2019s mobility: the character suffers a -30 penalty to Agility based tests (except Combat Style skill tests) and reduces their Speed by 3.",
        agility: -30, acrobatics: 0, speed: -3, all: 0, still: false},
    {name: "Crippling", rules: "Character cannot move, and suffers a -40 to all tests.",
        agility: 0, acrobatics: 0, speed: 0, all: -40, still: true},
]

const weightIntro = "Most armors and shields have a weight class, reflected by one of the qualities below, that represents how heavy and restrictive that armor is. When wearing multiple different types of armor and/or carrying a shield, the character always uses the effects of their heaviest armor piece."

// what each attribute works out to from the characteristics. these are used as a
// difference rather than an answer, so if a sheet says 5 Stamina where the formula
// says 4, raising Endurance takes it to 6 and the extra point is kept
const derivedFormulas: {keys: string[], calc: (i: CharInfo) => number}[] = [
    {keys: ["Max HP", "Current HP"], calc: i => Math.ceil((Number(i.get("End")) || 0) / 2)},
    {keys: ["Max MP", "Current MP"], calc: i => Number(i.get("Int")) || 0},
    {keys: ["Max SP", "Current SP"], calc: i => bonusFrom(i, "End")},
    {keys: ["Max LP", "Current LP"], calc: i => bonusFrom(i, "Lck")},
    {keys: ["WT"], calc: i => bonusFrom(i, "End") + bonusFrom(i, "Str") + bonusFrom(i, "Wp")},
    {keys: ["Base Speed", "Current Speed"], calc: i => bonusFrom(i, "Str") + 2 * bonusFrom(i, "Ag")},
    {keys: ["IR"], calc: i => bonusFrom(i, "Ag") + bonusFrom(i, "Int") + bonusFrom(i, "Prc")},
    {keys: ["Carry Rating"], calc: i => 4 * bonusFrom(i, "Str") + 2 * bonusFrom(i, "End")},
    {keys: ["Linguistics"], calc: i => Math.min(4, bonusFrom(i, "Int") - 2)},
]

// changing a characteristic shifts everything that grows from it by the same amount
// it moved, so whatever the sheet already had is carried along rather than replaced
function withCharChange(info: CharInfo, key: string, value: string) {
    const next = new Map(info)
    next.set(key, value)

    derivedFormulas.forEach(f => {
        const shift = f.calc(next) - f.calc(info)
        if (shift === 0) return
        f.keys.forEach(k => {
            const now = Number(next.get(k))
            if (isNaN(now) || String(next.get(k) ?? "").trim() === "") return
            next.set(k, String(now + shift))
        })
    })

    return next
}

// changing a rank writes the matching bonus too, so every target number follows along
function setRank(info: CharInfo, skill: string, abbr: string) {
    const step = rankLadder.find(r => r.abbr === abbr)
    const bonus = step ? step.bonus : 0
    const next = new Map(info)
    next.set(skill + " Rank", abbr)
    next.set(skill + " Bonus", (bonus >= 0 ? "+" : "") + bonus)
    return next
}

const charNames: Record<string, string> = {
    Str: "Strength", End: "Endurance", Ag: "Agility", Int: "Intelligence",
    Wp: "Willpower", Prc: "Perception", Prs: "Personality", Lck: "Luck",
}

// the combat actions and reactions straight from the rulebook
const onTurnActions: {name: string, text: string, bullets?: {label: string, text: string}[]}[] = [
    {name: "Attack", text: "The character can make an attack with a melee or ranged weapon. A character may make no more than two total attacks in a single round. When attacking they can use one of three optional variations of this action. A player must declare if their character is choosing one of these variations before the attack test has been made.", bullets: [
            {label: "All Out Attack (melee only)", text: "The character makes a melee attack with a +20 bonus by spending an additional AP. This is not an Extended Action."},
            {label: "Coup de Gr\u00e2ce", text: "The character makes a killing blow against a helpless target. A helpless target is one who is either unconscious, both restrained and prone, or otherwise physically incapable of defending themselves. The GM may rule that certain characters cannot be killed in this way depending on the circumstances. This kills the target outright. For unarmed Coup de Gr\u00e2ce, refer to the Grappling rules."},
            {label: "Precision Strike", text: "A character attempting a precision strike is aiming to hit a particular part of their opponent's body and thus suffers a -20 penalty on the attack test. If successful, the character may choose the hit location of that attack in addition to resolving any other effects the attack would have."},
        ]},
    {name: "Grappling", text: "In place of making a normal attack a character can choose to attempt to grapple their opponent. This requires a Combat Style test (the style must include unarmed combat) opposed against either a Combat Style (with unarmed), Athletics, or Evade test. On success, the target gains the restrained condition. The target may attempt to escape by using the resist action. On success they break free. Characters suffer a -30 penalty when attempting to grapple characters of larger size than them, and they cannot grapple characters of two or more sizes larger. While they have an opponent restrained, the character may not move but may take the following actions (each is a primary action that costs 1 AP):", bullets: [
            {label: "Takedown", text: "The character may render their victim, and themself, prone. They suffer no prone penalties in relation to any tests made against their target."},
            {label: "Move", text: "The character may move themself and their victim a number of meters up to their Strength bonus in any direction."},
            {label: "Attack", text: "The character may make a normal attack against their restrained victim, who cannot defend themself. They must use a weapon with a 1m range or less. If the target is both prone and restrained and the character is armed, this can be a coup de gr\u00e2ce. If the character is unarmed, then they can choose to instead cause the target to lose 1 Stamina point."},
        ]},
    {name: "Disengage", text: "The character can use this action to retreat from combat with an enemy. If they move out of an enemy's engagement range during this Turn then the attack of opportunity reaction or other delayed actions/reactions, may not be taken against them."},
    {name: "Cast Magic", text: "The character casts a spell that they know using the rules for spellcasting found in Chapter 6: Magic (page 125). This may be used to cast spells that count as attacks, but a character may make no more than two attacks in a single round."},
    {name: "Delay Turn", text: "The character declares a set of circumstances in which they will act. The character then skips their Turn without spending AP and may insert their delayed Turn into the order as a free reaction if the conditions are met. If the delayed Turn is not taken before the character's next Turn would occur, then the Action Points are lost entirely."},
    {name: "Defensive Stance", text: "Using this action grants the character +10 on any defensive tests made until their next Turn. Taking this action reduces the character's Attack limit to 0 until their next Turn."},
    {name: "Aim", text: "A character can spend an Action Point to aim, gaining a +10 bonus to their next ranged attack, including spells with the Bolt form. This bonus can stack if the character takes this action multiple consecutive times before the next ranged or bolt attack, but only up to three times for a maximum bonus of +30. The \"chain\" of aim actions can stretch across rounds. This chain is broken and the bonus lost if the character makes an attack with another weapon or takes any actions or reactions other than to continue aiming or fire the aimed weapon or spell. Once the aimed weapon is fired, the bonuses from this action are reset to +0."},
    {name: "Cast Magic (Instant only)", text: "The character casts a spell that they know using the rules for spellcasting found in Chapter 6. This may only be used to cast spells that have the Instant spell attribute."},
    {name: "Dash", text: "The character can use this action in order to move up to their speed. If this is done on their Turn, this movement is added to their base movement for that Turn. This action can be used to allow a character to move several times their speed during a round."},
    {name: "Hide", text: "The character can use this action to attempt to hide from foes. If anyone might detect them while they do this, they must make a Stealth skill test opposed by the Observe of anyone who might spot them. On success, they gain the Hidden condition."},
    {name: "Ready Weapon / Drink Potion", text: "The character may draw, sheath, withdraw, or reload a weapon. This action may also be used to drink a potion, assuming it is accessible to the character, but this costs 2 AP instead. Some missile weapons may require several AP to reload, in which case this action must be extended."},
    {name: "Arise", text: "Allows the character to use a momentary opening to roll back up to their feet, removing the prone condition without granting opponents the ability to make an attack of opportunity."},
    {name: "Bash", text: "Character makes an Athletics or unarmed Combat Style test which their opponent may oppose with their Athletics, unarmed Combat Style, or Evade skill. If they win, their opponent is knocked back 1 meter, loses an AP, and must make an Acrobatics test to avoid falling prone. Target character cannot be of larger size and must be within 2 meters."},
    {name: "Blind Opponent", text: "Character makes a Combat Style test which their opponent may oppose with their Evade or Combat Style (if wielding a shield). If the target loses, they become blinded for 1 round. The character must reasonably have access to some way to blind their opponent (thrown sand or rocks, for example)."},
    {name: "Disarm", text: "Character makes an Athletics or unarmed Combat Style test which their opponent may oppose with their unarmed Combat Style or Athletics skill. If the target of the disarm attempt loses, the character may choose to either take the target's weapon if they have a free hand or fling the target's weapon 1d4 meters in a random direction. Target cannot be of larger size and must be within 2 meters. Cannot disarm natural weapons."},
    {name: "Feint", text: "Character attempts a Combat Style or Deceive test against an opponent's Observe or Combat Style within a 2m range. If successful, they treat their next melee attack against the target as if they were Hidden. This effect only applies if the attack occurs before the end of the character's current Turn."},
    {name: "Force Movement", text: "Character makes a Combat Style test which their opponent may oppose with their Combat Style or Athletics skill. If they win, they may move themself and their opponent up to three meters in any direction (they must both move in the same direction and the same amount) as the character shifts the location of the fight. Target character must be within melee range."},
    {name: "Resist", text: "Character makes an Athletics or unarmed Combat Style test which their opponent may oppose with their Athletics or unarmed Combat Style skill. If they win, they may escape being restrained, grappled, or blinded."},
    {name: "Trip", text: "Character makes an Athletics or unarmed Combat Style test which their opponent may oppose with their Athletics, unarmed Combat Style, or Evade skill. If they win, their opponent falls prone. Target character cannot be of larger size and must be within 2 meters."},
]

const notTurnActions: {name: string, text: string, bullets?: {label: string, text: string}[]}[] = [
    {name: "Attack of Opportunity", text: "This reaction allows a character to take advantage of an opening to make a melee attack (max 2 attacks per round) against an opponent when they are vulnerable. Attacks of Opportunity are resolved before the action they are being made in reaction to is resolved. Any character may use a reaction to an Attack of Opportunity without interrupting their current action, but they must be able to see their target. An Attack of Opportunity may be triggered by the following:", bullets: [
            {label: "Retreat", text: "When an opponent voluntarily moves out of the character's melee range without taking the Disengage action."},
            {label: "Approach", text: "When an opponent moves closer to the character within their melee range (such as from 3 meters away to 2 meters away against a 3m range weapon)."},
            {label: "Spellcast", text: "When an opponent casts a spell within their melee range (unless the spell counts as a melee attack)."},
            {label: "Standing Up", text: "When a prone character stands up within their melee range without using the Arise action."},
            {label: "Ranged Attack", text: "When an opponent makes a ranged attack within the character's engagement range."},
            {label: "Ready", text: "When an opponent readies a weapon, reloads a weapon, or drinks a potion within their melee range. If the opponent does so as a Free Action, it does not allow for an attack of opportunity."},
        ]},
    {name: "Block, Parry, Evade", text: "The character tries to defend against an incoming ranged or melee attack."},
    {name: "Counter-Attack", text: "The character attempts to make a standard melee Counter-Attack (still subject to the two attack per round limit) in response to an attack from an opponent they are aware of through the use of their Combat Style skill."},
    {name: "Aim", text: "A character can spend an Action Point to aim, gaining a +10 bonus to their next ranged attack, including spells with the Bolt form. This bonus can stack if the character takes this action multiple consecutive times before the next ranged or bolt attack, but only up to three times for a maximum bonus of +30. The \"chain\" of aim actions can stretch across rounds. This chain is broken and the bonus lost if the character makes an attack with another weapon or takes any actions or reactions other than to continue aiming or fire the aimed weapon or spell. Once the aimed weapon is fired, the bonuses from this action are reset to +0."},
    {name: "Cast Magic (Instant only)", text: "The character casts a spell that they know using the rules for spellcasting found in Chapter 6. This may only be used to cast spells that have the Instant spell attribute."},
    {name: "Dash", text: "The character can use this action in order to move up to their speed. If this is done on their Turn, this movement is added to their base movement for that Turn. This action can be used to allow a character to move several times their speed during a round."},
    {name: "Hide", text: "The character can use this action to attempt to hide from foes. If anyone might detect them while they do this, they must make a Stealth skill test opposed by the Observe of anyone who might spot them. On success, they gain the Hidden condition."},
    {name: "Ready Weapon / Drink Potion", text: "The character may draw, sheath, withdraw, or reload a weapon. This action may also be used to drink a potion, assuming it is accessible to the character, but this costs 2 AP instead. Some missile weapons may require several AP to reload, in which case this action must be extended."},
    {name: "Arise", text: "Allows the character to use a momentary opening to roll back up to their feet, removing the prone condition without granting opponents the ability to make an attack of opportunity."},
    {name: "Blind Opponent", text: "Character makes a Combat Style test which their opponent may oppose with their Evade or Combat Style (if wielding a shield). If the target loses, they become blinded for 1 round. The character must reasonably have access to some way to blind their opponent (thrown sand or rocks, for example)."},
    {name: "Resist", text: "Character makes an Athletics or unarmed Combat Style test which their opponent may oppose with their Athletics or unarmed Combat Style skill. If they win, they may escape being restrained, grappled, or blinded."},
    {name: "Trip", text: "Character makes an Athletics or unarmed Combat Style test which their opponent may oppose with their Athletics, unarmed Combat Style, or Evade skill. If they win, their opponent falls prone. Target character cannot be of larger size and must be within 2 meters."},
]

// the whole sheet is kept under one key in the browsers own storage
const saveKey = "thrump-character"
const roleKey = "thrump-role"
const trackerKey = "thrump-tracker"
const roomKey = "thrump-room"
const pdfKey = "thrump-pdf"

// this runs once when the page loads rather than on every render
const saved = (() => {
    try {
        const raw = localStorage.getItem(saveKey)
        return raw ? JSON.parse(raw) : null
    } catch {
        // storage can be switched off or the save can be from an older version
        return null
    }
})()

// the pdf is held as text so it can sit in storage beside everything else
function bytesToText(bytes: Uint8Array) {
    let out = ""
    // going a chunk at a time because a whole file at once overflows the call stack
    for (let i = 0; i < bytes.length; i += 8192) {
        out += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    return btoa(out)
}

function textToBytes(text: string) {
    const raw = atob(text)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return bytes
}

const savedPdf = (() => {
    try {
        return localStorage.getItem(pdfKey)
    } catch {
        return null
    }
})()

type Wound = {part: string, treated: boolean, rounds: number, damage: number, healed: number, caused?: {name: string, part?: string}[]}

type Cond = {name: string, value?: number, part?: string, result?: string, fresh?: boolean, auto?: boolean, why?: string, rounds?: number, snapped?: boolean}

const bodyParts = ["Left Eye", "Right Eye", "Left Ear", "Right Ear", "Left Arm", "Right Arm", "Left Leg", "Right Leg", "Body"]

// what losing or crippling each body part actually costs
const partInfo: Record<string, {note: string, wtMod?: number, spMaxMod?: number, halfHealing?: boolean}> = {
    "Left Eye": {note: "-20 to tests relying on sight"},
    "Right Eye": {note: "-20 to tests relying on sight"},
    "Left Ear": {note: "-20 to tests relying on hearing"},
    "Right Ear": {note: "-20 to tests relying on hearing"},
    "Left Arm": {note: "-20 to tests relying on two hands"},
    "Right Arm": {note: "-20 to tests relying on two hands"},
    "Left Leg": {note: "-20 to tests relying on two legs"},
    "Right Leg": {note: "-20 to tests relying on two legs"},
    "Body": {note: "Organ damage, half healing, -1 SP max and WT", wtMod: -1, spMaxMod: -1, halfHealing: true},
}

// losing a matched pair pulls a second condition along with it
const derivedRules: {when: (parts: string[], conds: Cond[], traits: string[]) => boolean, gives: string, why: string}[] = [
    {when: (_p, _c, tr) => tr.includes("Blind"), gives: "Blinded", why: "of the Blind trait"},
    {when: (_p, _c, tr) => tr.includes("Deaf"), gives: "Deafened", why: "of the Deaf trait"},
    {when: p => p.includes("Left Eye") && p.includes("Right Eye"), gives: "Blinded", why: "both eyes are gone"},
    {when: p => p.includes("Left Ear") && p.includes("Right Ear"), gives: "Deafened", why: "both ears are gone"},
    {when: p => p.includes("Left Leg") && p.includes("Right Leg"), gives: "Immobilized", why: "both legs are gone"},
    {when: p => p.includes("Left Leg") || p.includes("Right Leg"), gives: "Slowed", why: "a leg is gone"},
    {when: (_p, c) => c.some(x => x.name === "Fatigued" && (x.value ?? 1) >= 4), gives: "Unconscious", why: "fatigue has reached level 4"},
]

const fatigueSteps = [
    {label: "Fatigued", level: "Fatigued (1)", effect: "-10 penalty to all tests."},
    {label: "Exhausted", level: "Exhausted (2)", effect: "-20 penalty to all tests."},
    {label: "Drained", level: "Drained (3)", effect: "-30 penalty to all tests"},
    {label: "Unconscious", level: "Unconscious (4)", effect: "Characters falls unconscious"},
    {label: "Dead", level: "5+", effect: "Character dies"},
]

// each condition is described once here. a flag condition is just on or off, a
// levels condition steps through named stages, a value condition carries a number
// that changes on its own, and a part condition names a body part. anything a
// condition does not write down is simply treated as zero
const conditionTypes: Record<string, {
    kind: string,
    max?: number,
    note: string,
    label?: (c: Cond) => string,
    detail?: (c: Cond) => string,
    testMod?: (c: Cond) => number,
    csMod?: (c: Cond) => number,
    magicMod?: (c: Cond) => number,
    frenzyMod?: (c: Cond) => number,
    sbMod?: (c: Cond) => number,
    wtMod?: (c: Cond) => number,
    apMaxMod?: (c: Cond) => number,
    spMaxMod?: (c: Cond) => number,
    halfSpeed?: (c: Cond) => boolean,
    zeroSpeed?: (c: Cond) => boolean,
    shortOf?: (c: Cond) => string,
    recap?: (c: Cond) => string,
    // these two run their own number up or down so a round clock would only fight them
    ownClock?: boolean,
    // what happens the moment the condition lands
    onApply?: string,
    // nothing comes back at the start of the round while this is on you
    blocksApRefresh?: boolean,
    // a willpower test at the end of your turn can shake this one off
    canSnapOut?: boolean,
}> = {
    "Bleeding": {
        kind: "value",
        max: 99,
        note: "X damage a round, then X drops by 1",
        ownClock: true,
        wtMod: () => -1,
        detail: (c) => c.fresh ? "starts next round" : "",
    },
    "Blinded": {
        kind: "flag",
        note: "-30 to tests benefitting from sight",
        recap: () => "You are still Blinded and suffer a -30 to tests benefiting from sight.",
    },
    "Burning": {
        kind: "value",
        max: 99,
        note: "X fire damage a round, then X grows by 1",
        ownClock: true,
    },
    "Chameleon": {
        kind: "value",
        max: 99,
        note: "-X to sight based tests to detect you",
        recap: (c) => "You have Chameleon (" + c.value + ") and sight based tests to detect you suffer a -" + c.value + " penalty.",
    },
    "Crippled": {
        kind: "part",
        note: "",
        wtMod: (c) => partInfo[c.part ?? ""].wtMod ?? 0,
        spMaxMod: (c) => partInfo[c.part ?? ""].spMaxMod ?? 0,
        shortOf: (c) => partInfo[c.part ?? ""].note,
        recap: (c) => "You have Crippled (" + c.part + ") and " + partInfo[c.part ?? ""].note + ".",
    },
    "Dazed": {
        kind: "flag",
        note: "One less Action Point each round",
        apMaxMod: () => -1,
        recap: () => "You are Dazed and gain one less Action Point each round.",
    },
    "Deafened": {
        kind: "flag",
        note: "-30 to tests benefitting from hearing",
        recap: () => "You are still Deafened and suffer a -30 to tests benefiting from hearing.",
    },
    "Entangled": {
        kind: "flag",
        note: "-20 Combat Style, half movement speed",
        csMod: () => -20,
        halfSpeed: () => true,
        recap: () => "You are Entangled, taking -20 on Combat Style tests at half movement speed.",
    },
    "Fear": {
        kind: "fear",
        note: "A failed panic test",
        label: (c) => "Fear - " + c.result,
        testMod: (c) => panicResults[c.result ?? ""]?.testMod?.(c) ?? 0,
        zeroSpeed: (c) => panicResults[c.result ?? ""]?.zeroSpeed?.(c) === true,
        shortOf: (c) => {
            const r = panicResults[c.result ?? ""]
            if (!r) return ""
            return r.shortOf ? r.shortOf(c) : r.note
        },
        recap: (c) => panicResults[c.result ?? ""]?.recap(c) ?? "",
    },
    "Horror": {
        kind: "fear",
        note: "A failed horror test",
        label: (c) => "Horror - " + c.result,
        testMod: (c) => horrorResults[c.result ?? ""]?.testMod?.(c) ?? 0,
        zeroSpeed: (c) => horrorResults[c.result ?? ""]?.zeroSpeed?.(c) === true,
        shortOf: (c) => {
            const r = horrorResults[c.result ?? ""]
            if (!r) return ""
            return r.shortOf ? r.shortOf(c) : r.note
        },
        recap: (c) => horrorResults[c.result ?? ""]?.recap(c) ?? "",
    },
    "Fatigued": {
        kind: "levels",
        max: 5,
        note: "",
        label: (c) => fatigueSteps[(c.value ?? 1) - 1].label,
        detail: (c) => "level " + c.value + " of 5",
        shortOf: (c) => fatigueSteps[(c.value ?? 1) - 1].effect,
        // levels 4 and 5 are not a bigger number they are just being out of the fight
        testMod: (c) => (c.value ?? 1) <= 3 ? -10 * (c.value ?? 1) : -30,
        recap: (c) => "You are " + fatigueSteps[(c.value ?? 1) - 1].label + ", " + fatigueSteps[(c.value ?? 1) - 1].effect.replace(/\.$/, "").toLowerCase() + ".",
    },
    "Frenzied": {
        kind: "flag",
        onApply: "gainSp",
        note: "+3 WT, +1 SB, -20 to non physical tests",
        wtMod: () => 3,
        sbMod: () => 1,
        // everything that is not strength, agility or endurance takes the penalty
        frenzyMod: () => -20,
        recap: () => "You are Frenzied. You must attack the nearest person or creature in melee combat each Turn if able, including allies, using only All Out Attacks. If you are not in range, you must move toward the nearest potential target. You are immune to stunned, fear, and passive wound effects.",
    },
    "Hidden": {
        kind: "flag",
        note: "Movement costs double, cannot Dash",
        recap: () => "You are Hidden, so check the movement and line of sight rules.",
    },
    "Immobilized": {
        kind: "flag",
        note: "Cannot move at all",
        zeroSpeed: () => true,
        recap: () => "You are Immobilized and cannot move, though you can still attack and defend.",
    },
    "Muffled": {
        kind: "value",
        max: 99,
        note: "-X to hearing based tests to detect you",
        recap: (c) => "You have Muffled (" + c.value + ") and hearing based tests to detect you suffer a -" + c.value + " penalty.",
    },
    "Paralyzed": {
        kind: "flag",
        note: "Frozen, speech and motion free spells only",
        zeroSpeed: () => true,
        recap: () => "You are Paralyzed, frozen and unable to move any part of your body. You may only cast spells that need neither speech nor motion.",
    },
    "Prone": {
        kind: "flag",
        note: "-20 to combat tests, movement costs double",
        csMod: () => -20,
        recap: () => "You are Prone, taking -20 on combat related tests, paying 2 meters of movement for every 1 you cover, and counting any full armor you wear as partial.",
    },
    "Restrained": {
        kind: "flag",
        note: "Cannot move, attack or defend",
        zeroSpeed: () => true,
        recap: () => "You are Restrained. You cannot move, attack, or defend yourself, and may only cast spells that do not require motion.",
    },
    "Silenced": {
        kind: "flag",
        note: "-20 when casting spells",
        magicMod: () => -20,
        recap: () => "You are Silenced. You take the usual -20 for being unable to speak when casting spells, and may roll a Perception test at the start of each round to realise what is happening.",
    },
    "Stunned": {
        kind: "flag",
        note: "No Action Points, and none come back",
        onApply: "zeroAp",
        blocksApRefresh: true,
        recap: () => "You are Stunned and do not regain Action Points at the start of the round.",
    },
    "Unconscious": {
        kind: "flag",
        note: "Knocked out, cannot act",
        zeroSpeed: () => true,
        recap: () => "You are Unconscious and may not take actions. You fall prone if the circumstances allow, and gaining a level of fatigue now would kill you.",
    },
    "Invisible": {
        kind: "flag",
        note: "Cannot be seen, attackers take -30",
        recap: () => "You are Invisible, so check what enemies can and cannot do about it.",
    },
    "Lost": {
        kind: "part",
        note: "",
        wtMod: (c) => partInfo[c.part ?? ""].wtMod ?? 0,
        spMaxMod: (c) => partInfo[c.part ?? ""].spMaxMod ?? 0,
        shortOf: (c) => partInfo[c.part ?? ""].note,
        recap: (c) => "You have Lost (" + c.part + ") and " + partInfo[c.part ?? ""].note + ".",
    },
    "Slowed": {
        kind: "flag",
        note: "Speed reduced by half",
        halfSpeed: () => true,
        recap: () => "You are Slowed and your Speed is reduced by half, rounding up.",
    },
}

// a fear result carries its own penalties and reminder, and the Fear or Horror
// condition holding it just hands every question through
type FearResult = {
    note: string,
    testMod?: (c: Cond) => number,
    zeroSpeed?: (c: Cond) => boolean,
    canSnapOut?: boolean,
    shortOf?: (c: Cond) => string,
    recap: (c: Cond) => string,
}

// what a failed panic test leaves behind
const panicResults: Record<string, FearResult> = {
    "Startled": {
        note: "No reactions until your next Turn",
        recap: () => "You are Startled and may not make any reactions at all until the beginning of your next Turn.",
    },
    "Spooked": {
        note: "-10 to all tests for the rest of the encounter",
        testMod: () => -10,
        canSnapOut: true,
        recap: () => "You are Spooked, fretting and full of doubt, taking -10 to all tests for the rest of the encounter unless you snap out of it.",
    },
    "Frightened": {
        note: "-10 to all tests, cannot approach your fear",
        testMod: () => -10,
        recap: () => "You are Frightened. You take -10 to all tests and cannot willingly approach the object of your fear, and this lasts until the end of the encounter.",
    },
    "Lost Composure": {
        note: "Frozen, no actions until you snap out",
        // frozen at first, and once you snap out of it the nerves stay for the encounter
        testMod: (c) => c.snapped ? -10 : 0,
        zeroSpeed: (c) => !c.snapped,
        canSnapOut: true,
        shortOf: (c) => c.snapped ? "-10 to all tests for the rest of the encounter" : "Frozen, no actions until you snap out",
        recap: (c) => c.snapped
            ? "You have snapped out of losing your composure, but you still make all tests at -10 for the rest of the encounter."
            : "You have Lost Composure and may take no actions until you snap out of it.",
    },
    "Running and Screaming": {
        note: "-20 to all tests, fleeing your fear",
        testMod: () => -20,
        canSnapOut: true,
        recap: () => "You are Running and Screaming. You must flee directly away from your fear as fast as you can, ditching anything that slows you down, at -20 to all tests. Only snapping out of it or the end of the encounter gives you back control.",
    },
    "Unnerved": {
        note: "-20 to tests needing concentration",
        recap: () => "You are Unnerved and take -20 to any test that requires concentration while you remain near the object of your fear.",
    },
}

// what a failed horror test leaves behind
const horrorResults: Record<string, FearResult> = {
    "Momentary Blackout": {
        note: "-10 to all actions for the rest of the encounter",
        testMod: () => -10,
        recap: () => "After your Momentary Blackout you take -10 to all actions for the rest of the encounter.",
    },
    "Uncontrollable Vomiting": {
        note: "Helpless while it lasts",
        zeroSpeed: () => true,
        recap: () => "You are vomiting uncontrollably and count as helpless, so anyone attacking you is free to do as they like.",
    },
    "Manic Terror": {
        note: "Attacking the nearest living thing",
        canSnapOut: true,
        recap: () => "You are in a Manic Terror and must keep attacking the closest friend or foe with whatever is in your hands. You may try to snap out of it at the start of your first Turn each round, or someone must knock you unconscious to stop the rampage.",
    },
    "Hopeless and Despairing": {
        note: "On the ground babbling, shut out from everything",
        zeroSpeed: () => true,
        recap: () => "You are Hopeless and Despairing, on the ground babbling and shutting out all other sounds. You lose 1d4 Stamina when you come out of it.",
    },
    "Blackout": {
        note: "Catatonic for 1d4 hours, cannot be roused",
        zeroSpeed: () => true,
        recap: () => "You are Catatonic for 1d4 hours and cannot be roused by normal means. The sheet counts rounds rather than hours, so take this one off by hand when the time is up.",
    },
    "Mind Break": {
        note: "Cannot attack or approach the source of horror",
        canSnapOut: true,
        recap: () => "Your mind is broken. You cannot attack or approach the source of the horror until you snap out of it or the encounter ends.",
    },
    "Unnerved": {
        note: "-20 to tests needing concentration",
        recap: () => "You are Unnerved and take -20 to any test that requires concentration while you remain near the object of your fear.",
    },
}

// whichever list the condition draws its result from
function resultsFor(name: string): Record<string, FearResult> {
    return name === "Horror" ? horrorResults : panicResults
}

// the rules text shown in the conditions and rules panel, worded exactly as the
// rulebook has it, only broken up so it does not arrive as one block
const conditionRules: {name: string, blocks: {head?: string, text?: string, bullets?: string[]}[]}[] = [
    {name: "Bleeding (X)", blocks: [
            {text: "Reduce Wound Threshold by 1. At the end of the character\u2019s next Turn, they take X damage (bypass AR/resistance); then X is reduced by 1."},
            {text: "If the character regains HP from any source, subtract the total HP regained (including HP that would go beyond the character\u2019s maximum HP) from X."},
            {text: "Bleeding can also be reduced by making a Profession [Medicine] +0 skill test and using a Healer\u2019s Kit. Reduce X by the DoS of the test. The Healer\u2019s Kit is not consumed in the process."},
            {text: "If X ever becomes 0, the Bleeding condition is removed."},
            {text: "If the Bleeding(X) condition would be inflicted on a character that already has a Bleeding condition, the value of each is added together and replaces the current Bleeding condition."},
        ]},
    {name: "Blinded", blocks: [
            {text: "The character loses all vision and suffers the following penalties:", bullets: [
                    "Cannot see anything.",
                    "Suffers a -30 to tests benefitting from sight.",
                    "Automatically fail any tests that rely solely on sight.",
                ]},
        ]},
    {name: "Burning (X)", blocks: [
            {text: "The target is engulfed in flames, with the intensity of the fire determined by a number X.", bullets: [
                    "Start of Turn: At the end of each of their turns, a burning character suffers a single hit of X fire damage to the appro priate hit location (body is the default). Then increase X by 1.",
                    "Stacking Burning: If a second instance of burning is inflicted on a character, simply combine the two X values.",
                    "Taking Action: A burning character must pass a Willpower test with a -20 penalty at the beginning of a Turn in order to attempt any action other than putting out the fire.",
                    "Putting It Out: A burning character can attempt to extin guish the flames on their Turn by spending an Action Point and making an Strengrh or Agility test with a +20 bonus and a -10 penalty for every point of the X value beyond 1. The burning character becomes prone and, if the test succeeds, loses the burning condition.",
                ]},
        ]},
    {name: "Chameleon (X)", blocks: [
            {text: "A character with this condition blends into their environment. Sight based tests to detect this character are made with a -X penalty."},
            {text: "Only apply the highest value version of this condition if a character would receive it more than once."},
        ]},
    {name: "Crippled Body Part", blocks: [
            {text: "A piece of the character\u2019s body has been rendered temporarily useless. Multiple instances of this condition can affect a character at once as long as each affects a different hit location and/or the body parts associated with that hit location."},
            {text: "Any body part that has been crippled suffers all the same penalties as if it had been lost. Use Lost Eye or Lost Ear if the head location has been crippled and the Organ Damage condition if the body location has been crippled."},
        ]},
    {name: "Dazed", blocks: [
            {text: "The character gains one less Action Point at the beginning of each round, to a minimum of one."},
        ]},
    {name: "Deafened", blocks: [
            {text: "The character loses all hearing and suffers the following penalties:", bullets: [
                    "Cannot hear anything.",
                    "Suffers a -30 to tests benefitting from hearing.",
                    "Automatically fail any tests that rely solely on hearing.",
                ]},
        ]},
    {name: "Entangled", blocks: [
            {text: "The character makes all Combat Style tests with a -20 penalty and their movement speed is halved (round up)."},
        ]},
    {name: "Fatigued", blocks: [
            {text: "When a chracter gains a level of fatigue, they acquire the Fatigued condition. If they gain additional levels of fatigue, the effects worsen."},
            {text: "Fatigue is most typically gained when a character falls below 0 SP or spends/loses SP when they are at 0."},
        ]},
    {name: "Frenzied", blocks: [
            {text: "The character is flung into an uncontrollable rage. Frenzied characters gain the following rules:", bullets: [
                    "Must attempt to attack the nearest person or creature in melee combat each Turn if able, using only All Out Attacks.",
                    "If not within range of a potential target, the character must move toward the nearest potential target. They may not attempt to flee the fight.",
                    "Increase WT by 3 and SB by 1. Suffer a -20 penalty to all skill tests based on anything except Strength, Agility, or Endurance.",
                    "Gain an extra SP, which can exceed their SP maximum.",
                    "Immune to the effects of the stunned condition, fear, and passive wound effects.",
                ]},
            {text: "Once the encounter has ended, the character snaps out of their frenzied state and loses 2 SP (this cannot kill them). The character can also test Willpower at a -20 as a Secondary Action during combat to attempt to snap out of frenzy, which ends the condition."},
        ]},
    {name: "Hidden", blocks: [
            {text: "The character is hidden from enemies and moving stealthily. Characters must spend 2 meters of their movement for the round for each 1 meter that they actually move while hidden, and they cannot Dash. Enemies cannot attempt to defend themselves against the attacks of hidden characters, but attacking causes a character to lose this condition immediately afterwards."},
            {text: "If a hidden character would enter line of sight of at least one character from whom they have not previously hidden, they must make a Stealth test opposed by that character\u2019s Observe. On success, or if they achieve more degrees of success, they remain hidden. Otherwise that character becomes aware of them."},
        ]},
    {name: "Immobilized", blocks: [
            {text: "Immobilized characters cannot move. They may still attack and take other actions and can defend themselves."},
        ]},
    {name: "Invisible", blocks: [
            {text: "Invisible characters cannot be seen. Characters fail all sight related tests related to spotting the Invisible character and attack them at a -30 penalty, assuming they can guess where the character might be in the first place."},
        ]},
    {name: "Muffled (X)", blocks: [
            {text: "A character with this condition is harder to hear. Hearing based tests to detect this character are made with a -X penalty. Only apply the highest value version of this condition if a character would receive it more than once."},
        ]},
    {name: "Paralyzed", blocks: [
            {text: "The character is frozen, unable to move any part of their body. They may only cast spells that do not require speech or motion."},
        ]},
    {name: "Prone", blocks: [
            {text: "The character is prone, and every 1 meter that they move while prone costs 2 meters of their movement for the round. They also suffer a -20 penalty to all combat related tests and count any full armor they are wearing as partial (to represent that it is easier for characters to take advantage of gaps in their defenses while they are down)."},
            {text: "Dropping prone costs no movement, but standing up requires that a character spend movement equal to half of their base Speed. If the character does not have this much movement left over to use, then they cannot get up unless they take the Arise action."},
        ]},
    {name: "Restrained", blocks: [
            {text: "The character is restrained and thus unable to move. They also cannot attack or defend themselves. They may only cast spells that do not require motion."},
        ]},
    {name: "Silenced", blocks: [
            {text: "Magically silenced characters believe they are making sound, but in reality their words never pass their lips. They suffer the usual -20 penalty for being unable to speak when casting spells. At the start of each round they can roll a Perception test to see if they realize what is happening."},
        ]},
    {name: "Slowed", blocks: [
            {text: "The character\u2019s Speed is reduced by half (round up)."},
        ]},
    {name: "Stunned", blocks: [
            {text: "The character immediately loses all remaining Action Points upon becoming stunned. Stunned characters do not regain Action Points at the start of each round."},
        ]},
    {name: "Unconscious", blocks: [
            {text: "The character is knocked out and loses consciousness. They fall prone if the circumstances allow and may not take actions. If a character gains a level of fatigue while unconscious, they die."},
        ]},
    {name: "Lost Body Part", blocks: [
            {text: "The character loses a part of their body. A character can have multiple instances of this condition at once, each affecting a different body part. If an attack would hit a body part that has been entirely lost, the attack hits the body location instead. This condition applies additional penalties that vary based on the body part. In the case of the head, there is a choice between an ear or an eye (GM\u2019s decision)."},
            {head: "Lost Ear", text: "The character has had their ear removed or destroyed and their hearing damaged. They suffer the following penalties:", bullets: [
                    "All tests that rely on hearing are made with a -20 penalty.",
                    "If both ears are lost, the character gains the deafened con dition permanently.",
                ]},
            {head: "Lost Eye", text: "The character has had their eye removed or destroyed and suffers the following penalties:", bullets: [
                    "All tests that rely on sight are made with a -20 penalty.",
                    "If both eyes are lost, the character gains the blinded con dition permanently.",
                ]},
            {head: "Lost Foot/Leg", text: "The character has had their leg severed somewhere between the ankle and the hip and suffers the following penalties.", bullets: [
                    "Gain the slowed condition permanently.",
                    "All tests that rely on the use of two legs are made with a -20 penalty.",
                    "If both legs are lost, gain the Immobilized condition per manently and fail any tests that rely entirely on movement.",
                ]},
            {head: "Lost Hand/Arm", text: "The character has had their arm severed somewhere between the wrist and the shoulder, and suffers the following penalties:", bullets: [
                    "Can no longer use two-handed weapons, shields (if the whole arm is missing), or one handed weapons in that arm.",
                    "All tests that rely on the use of two hands are made with a -20 penalty.",
                    "If both hands are lost, the character cannot wield weapons and automatically fails all tests that rely on the use of hands.",
                ]},
            {head: "Organ Damage (Lost Body Part: Body)", text: "The character has had their internal organs damaged. Characters with this condition heal damage at half speed and reduce their SP maximum and WT by 1."},
        ]},
]

// the wounds and healing rules, worded exactly as the rulebook has them
type RuleBlock = {head?: string, text?: string, bullets?: string[]}

const woundRules: RuleBlock[] = [
    {text: "Wounds represent devestating injuries caused by more damaging attacks, and not just simple cuts and bruises. If a character ever takes damage from a single attack (including enchantments and/or poisons) in excess of their Wound Threshold (WT), then they take a wound. Record the amount of damage and hit location, then follow these steps:"},
    {head: "Shock Effects", text: "First, the character must make a special Endurance test known as a Shock Test, which represents how well the character fares against the initial effects.", bullets: [
            "If the wound is to the body, the character loses an Action Point. If they have none remaining, they begin the next round with one less. If they fail the shock test then they also suffer the crippled body condition.",
            "If the wound is to a limb, the character suffers the crippled limb condition (blows to the head instead stun for 1 round). If they fail the shock test, then they also suffer the lost limb condition (lost ear or lost eye for the head).",
        ]},
    {text: "If the wound was caused by magic damage, the following applies:", bullets: [
            "If the wound is by an attack which includes fire damage, the character also must pass a Strength or Agility test or gain the Burning (1) condition.",
            "If the wound is from an attack which includes magic, frost, or poison damage, the character also loses a Stamina point.",
            "If the wound is from an attack which includes shock damage, the character also loses Magicka points equal to the damage inflicted.",
            "If the wound is from an attack which includes multiple magic damage types, the type that contributed the most damage determines this effect. In case of a tie, the attacker chooses which effect is applied.",
        ]},
    {head: "Passive Effects", text: "After the shock test has been resolved, the character suffers a -20 to all tests and a -2 to future initiative rolls until the wound is fully healed. The character has 30 seconds (5 rounds) before they drop to 0 HP through blood loss. These effects can be removed by first aid (a Survival or Profession [Medicine] skill test must be performed, which takes 1 Turn and requires a healer\u2019s kit or other supplies), or delayed with magical healing (see below)."},
]

const healingRules: RuleBlock[] = [
    {text: "There are two means by which characters can heal damage and wounds which have been dealt to them: natural healing, and magic healing."},
    {head: "Restoring HP", text: "Both magical and natural healing can restore missing HP."},
    {head: "Magical Healing", text: "Magical healing will always specify an amount of missing HP that it restores, and this happens instantly unless otherwise noted."},
    {head: "Natural Healing", text: "Characters naturally regenerate a number of missing HP equal to their Endurance bonus each time they take a long rest as long as they have no untreated wounds. This amount is doubled if the character is not doing anything strenuous and is focused entirely on healing themselves (or if another person is caring for them)."},
    {head: "Healing Wounds", text: "In order for a character to begin to heal wounds, those wounds must be treated first. If a wound is not treated within a number of days equal to the character\u2019s Endurance bonus, the character becomes Maimed: any body parts crippled by the wound become crippled permanently and count as being lost."},
    {head: "Healing Untreated Wounds", text: "Characters cannot regenerate HP naturally while they have untreated wounds. In addition to restoring HP, magical healing done while the character is wounded temporarily removes the passive effects and forestalls unconsciousness for a number of rounds equal to the amount healed. If a character ever heals to full HP while they have an untreated wound, they become maimed as the wound has healed improperly."},
    {head: "Treating Wounds", text: "A wound can be treated by a successful Profession [Medicine] test, which takes approximately an hour. Once a character\u2019s wound(s) have been treated, they can begin to heal naturally again. Treating a wound related to the Crippled Condition can only be done once per long rest. If this test results in a dramatic failure, the limb immediately becomes Maimed."},
    {head: "Curing Wounds", text: "Once a wound has been treated it can be properly healed. After treatment if a character regenerates HP (by magical or natural means) equal to or in excess of the damage that caused the wound, then the wound and all of its effects are removed. The one exception is that characters cannot heal lost limbs in this fashion."},
]

const fearIntro: RuleBlock[] = [
    {text: "When a character is confronted by an excessively frightening event or adversary, they must make a Fear Test. There are two types of fear tests: panic and horror tests. If the character fails the test, they succumb to the effects of fear."},
    {text: "Your GM may call on you to make a Panic Test when you are confronted by mundane shock or horror. This is represented by the Panic (+/- X) notation, which is simply a Willpower test with a +/- X modifier."},
    {text: "Your GM may call on you to make a Horror Test when you are confronted by supernatural terrors. This is represented by the Horror (+/- X) notation, which is simply a Willpower test with a +/- X modifier. In general, horror tests with any sort of penalty should be reserved for the most terrifying monsters and mind melting terrors."},
    {head: "Fear Effects", text: "If in combat a character fails a fear test, they must immediately roll a d100 on the appropriate table on the next page. The effects listed are applied immediately to the character."},
    {text: "If in a non-combat situation the character fails a fear test, the character becomes unnerved and suffers a -20 penalty to any tests that requires concentration on their part. This penalty lasts while the character remains in the vicinity of the object of their fear."},
    {text: "Characters may be able to shake off some of the effects of fear after the initial shock has worn off. The table below will specify certain cases where a character can make a Willpower test when it is their next Turn to \u201csnap out\u201d of their fear. \u201cSnapping out\u201d of the fear always happens at the end of their Turn."},
    {text: "If this succeeds, then they regain their senses, shrug off the effects, and may act normally from then on. If they fail this test, the effect continues, and they may try again when it is their next Turn."},
]

// the two tables, kept as data so the roll can look its own result up
const horrorTable: {range: string, low: number, high: number, name: string, text: string}[] = [
    {range: "1-40", low: 1, high: 40, name: "Momentary Blackout", text: "The character is so overcome with horror that their mind fails them for a few precious seconds in the face of this horror. The character drops to the ground unconscious for 1 round and has a -10 penalty to all actions afterwards for the rest of the encounter."},
    {range: "41-60", low: 41, high: 60, name: "Uncontrollable Vomiting", text: "The character\u2019s own body reacts with a gut wrenching sound as the character\u2019s innards empty themselves, and they start vomiting uncontrollably. The character bends over and vomits for 1 round and is considered helpless during this time. Afterwards the character is still nauseous and loses 1 Stamina point immediately."},
    {range: "61-80", low: 61, high: 80, name: "Manic Terror", text: "The Character\u2019s mind cracks like a fragile glass sculpture, and they begin to laugh maniacally. Turning upon the closest nearby friend or foe they start attacking them with whatever weapon they have in their hands at the moment. The character can attempt to snap out of it at the start of their first Turn each round or be knocked unconscious to stop their manic rampage. Afterwards the character loses 1d4 Stamina points immediately."},
    {range: "81-90", low: 81, high: 90, name: "Hopeless and Despairing", text: "The character falls to the ground and cries out in despair and terror while shutting out all other sounds, babbling and mumbling to themselves for comfort for 1d6 rounds. When they regain their senses they immediately lose 1d4 Stamina."},
    {range: "91-95", low: 91, high: 95, name: "Blackout", text: "The character\u2019s mind snaps like a twig, unable to truly process the horror of the situation and collapsing instead. The character goes catatonic for 1d4 hours and cannot be roused by normal means during this time."},
    {range: "96-99", low: 96, high: 99, name: "Mind Break", text: "The character\u2019s will bends as their mind shatters. They drop to the ground while stuttering and mumbling incomprehensibly for 1d6 rounds. The character\u2019s mind is irrepressibly damaged, and they lose either 1d8 Willpower or Personality (player\u2019s choice) permanently from the harrowing experience. Afterwards, the character cannot attack or approach the source of horror until they snap out of the effect or for the rest of the encounter."},
    {range: "100", low: 100, high: 100, name: "Scared to Death", text: "The character is so immeasurably overcome with terror and horror that their heart stops beating; they must make an Endurance test or die on the spot. Should they succeed, they instead fall catatonic for 1d4 hours as with Blackout."},
]

const panicTable: {range: string, low: number, high: number, name: string, text: string}[] = [
    {range: "01-30", low: 1, high: 30, name: "Startled", text: "The character is startled by the source of panic. They jump in their boots and pause for a brief moment as they struggle to reassess the situation. They may not make any reactions until the beginning of their next Turn."},
    {range: "31-60", low: 31, high: 60, name: "Spooked", text: "The character gets the shakes from the source of their panic. Fretting, nervous, and full of doubt, they suffer a -10 penalty to all tests for the rest of the encounter unless they snap out of it."},
    {range: "61-90", low: 61, high: 90, name: "Frightened", text: "The character is taken aback, and their teeth clatter in their skull as they inch back from the source of their panic. The character cannot willingly approach the object of their fear, and they suffer a \u201310 penalty to all tests until the end of the encounter."},
    {range: "91-95", low: 91, high: 95, name: "Lost Composure", text: "The character loses their nerve and freezes in place. Their will to act is decimated by the stress on their mind from the source of their Panic. The character may take no actions until they snap out of it. After snapping out of it, the character will make all tests at a \u201310 penalty for the rest of the encounter."},
    {range: "96-100", low: 96, high: 100, name: "Running and Screaming", text: "The character breaks down with fear and flees. They must immediately flee directly away from the source of their fear as fast as they can, which includes ditching equipment slowing them down. They must do everything in their power to accomplish this and is at a -20 penalty to all tests. Once away from the danger, they must successfully snap out of it to regain control, or the encounter must end."},
]

// the opening of the combat chapter, above the four steps rather than inside them
const combatIntro: RuleBlock[] = [
    {text: "Combat is resolved as an exchange of blows between two characters. This exchange is simulated by the Combat Roll, in which a pair of attack and defense tests are compared."},
]

// a bullet can carry its own bullets underneath it
type StepBullet = {text: string, subs?: string[]}
type StepBlock = {head?: string, text?: string, bullets?: StepBullet[], table?: boolean}

const combatSteps: {name: string, blocks: StepBlock[]}[] = [
    {name: "Step 1: Attack", blocks: [
            {text: "The attacker first chooses their target, weapon, and combat style for the attack before making the attack test and applying any relevant circumstantial modifiers. Weapons not included in the character\u2019s combat style are made at the standard untrained -20 penalty for all attack and defense tests."},
            {bullets: [
                    {text: "Melee Weapon Attacks: The attacker makes a Combat Style test using either Strength or Agility against a target within the range of their weapon."},
                    {text: "Ranged Weapon Attacks: The attacker makes a Combat Style test using Agility against a target within the range of their weapon."},
                    {text: "Cast Magic Attacks: The attacking caster makes a skill test with the skill corresponding to the school of the spell."},
                ]},
        ]},

    {name: "Step 2: Defend", blocks: [
            {text: "The defender then picks their method of defense and combat style before making the defense test. A character must be aware of an attack to defend against it, and must choose to defend before the attacker has rolled."},
            {bullets: [
                    {text: "Evade: The defender rolls an Evade test (Agility)."},
                    {text: "Parry: Melee weapons or shields may be used to parry melee attacks. The defender makes the Combat Style test using Strength or Agility."},
                    {text: "Block: Shields may be used to block ranged or melee attacks. The defender makes a Combat Style test using Strength."},
                    {text: "Counter-Attack: The characters both attempt to strike the other while parrying their opponent\u2019s blows. The defender also makes a melee attack, using the rules above. Both characters count as \u201cattackers\u201d in step 3."},
                ]},
        ]},

    {name: "Step 3: Roll Tests & Determine Result", blocks: [
            {text: "If one character is able to gain a significant advantage over their opponent in melee, they are said to have gained an Advantage. Note that if a defender does not try to defend, or cannot do so, they are treated as having automatically failed."},
            {bullets: [
                    {text: "Both characters fail: Neither attack nor defense resolves."},
                    {text: "1 character fails: The winner gains an advantage (if melee).", subs: [
                            "Attacker wins: The attack is successful, the attacker chooses how to utilize their advantage, and resolves it.",
                            "Defender wins: The defense is successful, the defender chooses how to utilize their advantage and resolves it.",
                        ]},
                    {text: "Both characters pass: No characters gain an advantage.", subs: [
                            "Attack vs. Block: The defender blocks the attack regardless of attacker degrees of success. Resolve the block using the rules in Step 4 as if the defender won.",
                            "Attack vs. Parry or Evade: The defense is negated if the attacker has more degrees of success. Resolve the attack.",
                            "Counter-Attack: Whichever character achieves more degrees of success hits the other. If both characters achieve the same degrees of success, then neither the Attack nor the Counter-Attack resolve.",
                        ]},
                ]},
            {head: "Critical Success/Failure", text: "If one character critically succeeded, treat it as if they succeeded with more DoS than their opponent (if their opponent succeeded at all). They also gain an advantage. If one character rolls a critical failure, and their opponent passed, then their opponent counts as having critically succeeded. If one character critically succeeds and the other fails, or one succeeds and one critically fails, then the character who succeeded gains two advantages, which can stack if applicable. If both sides roll a critical success or failure, then no advantage is gained, and neither attack nor defense resolves."},
        ]},

    {name: "Step 4: Resolve Attack & Advantages", blocks: [
            {text: "Finally, resolve the attack based on the result."},
            {head: "Hit Locations", table: true},
            {head: "Attacker Won", text: "The attack hits the target and deals damage. If the target\u2019s armor values differ across hit locations, then check to see where it hit using the ones digit of the attack roll or a d10 (count 10 as 0). (You can often skip this step entirely or delay it until it is necessary)."},
            {text: "Next, resolve any advantage gained from the combat roll. Ranged attackers and spells cannot gain or utilize advantage. Then roll the damage of the attack and subtract the Armor Rating (AR) of the hit location struck. Reduce the target\u2019s HP by the remaining amount. Some types of AR only mitigate certain types of damage. If the damage dealt after reduction exceeds the target\u2019s Wound Threshold, the attack has also caused a wound. See Physical Health for details."},
            {head: "Defender won", text: "If the defender won an advantage, resolve it first:", bullets: [
                    {text: "Evade: If an attack is evaded it is negated entirely. The character may move up to 1 meter in any direction for free. This movement does not provoke Attacks of Opportunity."},
                    {text: "Parry: If an attack is parried it is negated entirely."},
                    {text: "Block: If an attack is blocked, roll the damage of the attack. If the damage exceeds the shield\u2019s Block Rating against that damage type, then the character takes the full damage to their shield arm. Otherwise no damage is taken. Magic damage treats BR as half (round up) unless there is a magic BR."},
                ]},
            {text: "Should there be multiple defenders against a single attack, only one defender gains a defensive advantage."},
            {head: "Advantage", text: "Characters with advantage may utilize it in the following ways:", bullets: [
                    {text: "Precision Strike (attack only): Choose the hit location of the attack."},
                    {text: "Penetrate Armor (attack only): Treat full armor as partial and partial as unarmored for the purposes of resolving an attack. This does not affect AR."},
                    {text: "Press Advantage (attack only): Character gains a +10 to their next melee attack against the opponent within 1 round."},
                    {text: "Forceful Impact (attack only): The character can apply the Damaged(1) quality to one armor piece or shield on the hit location of the attack."},
                    {text: "Overextend (block/evade/parry only): The opponent\u2019s next attack test within 1 round is made at a -10 penalty."},
                    {text: "Overwhelm: Your attack or defense engages your opponent\u2019s attention completely. The opponent cannot take attacks of opportunity until the attacking character\u2019s next Turn."},
                    {text: "Special Advantage: Immediately take a special advantage that is listed in the character\u2019s Combat Style. Ignore the AP cost, or automatically win any opposed roll involved."},
                ]},
        ]},
]

const hitLocations = [
    {roll: "1-5", where: "Body"},
    {roll: "6", where: "Right Leg"},
    {roll: "7", where: "Left Leg"},
    {roll: "8", where: "Right Arm"},
    {roll: "9", where: "Left Arm"},
    {roll: "0", where: "Head"},
]

// the traits a creature carries. these are kept apart from the player traits because
// they are worded for the gm and a few of them differ from the player version
const npcCommonIntro = "The traits in this section are used commonly enough that their inclusion in each profile would be redundant and hinder the GM\u2019s ability to reference the statblock\u2019s rules during play."

const npcCommonTraits: {name: string, text: string[]}[] = [
    {name: "Bestial", text: [
            "NPCs with this trait automatically pass Survival tests in their natural habitat.",
            "A Bestial creature\u2019s habitat is simply defined as a place where it would naturally live or reasonably adapt to. For example, a wild dog might be able to count a city as its habitat, while a wolf would likely not.",
        ]},
    {name: "From Beyond", text: [
            "NPCs with this trait are immune to the effects of disease, fear, toxins, and any mind-affecting magic (i.e. illusions).",
        ]},
    {name: "Mechanical", text: [
            "NPCs with this trait are immune to disease, poison, illusion spells, and any biological effects as determined by the GM. They cannot be reanimated via Necromancy and do not need to eat, sleep, or breathe to remain active.",
        ]},
    {name: "Quadruped", text: [
            "The creature moves up to twice their speed when they use the Dash action and three times their speed when they use the Sprint stamina ability.",
        ]},
    {name: "Skeletal", text: [
            "NPCs with this trait have purely skeletal forms. Attempts to hit them with ranged weapons suffer a -20 penalty. Characters with this trait also automatically gain the Undead trait as well and are immune to the Burning (X) condition.",
        ]},
    {name: "Tonal Reinforcement", text: [
            "NPCs with this trait are immune to disintegrate item effects and spells.",
        ]},
    {name: "Undead", text: [
            "NPCs with this trait are mere walking corpses. They do not breathe or require organs to function. They are immune to things such as disease, poison, passive wound effects, aging, fatigue, and a number of conditions including but not limited to dazed, deafened, and organ damage. Use common sense when deciding what can and cannot affect characters with this trait. The character cannot spend Stamina Points if doing so would bring their current SP to below 0.",
        ]},
]

const npcSpecialIntro = "The traits listed in this section are traits that are not natively added to the statblocks in this book. Instead, they represent traits which can be added in special circumstances, specific scenarios, or as desired by the GM."

const npcSpecialTraits: {name: string, text: string[]}[] = [
    {name: "Elite", text: [
            "Elite NPCs gain the ability to use the Heroic Action stamina ability. NPCs with this trait are significant threats to the party, so GMs should make full use of the rules in their profile to reflect the character\u2019s prowess.",
        ]},
    {name: "Fated (X)", text: [
            "The character has X Luck points that function just like normal Luck points except, once spent, they cannot be regained (i.e. burned). When these characters are called to make a Luck test, multiply X by 10 to calculate the base target number.",
        ]},
    {name: "Minion", text: [
            "If an NPC with this trait would suffer a wound, their HP is immediately reduced to 0.",
        ]},
    {name: "Spellcaster", text: [
            "This character does not track Magicka, but instead can cast each of their listed spells one time.",
            "Give an NPC this trait when tracking magicka would provide little to no benefit to gameplay or as a general rule if tracking magicka for NPCs is too cumbersome for you or your table.",
        ]},
    {name: "Thrall", text: [
            "This character has become enthralled by a supernatural master, usually a vampire or some other corrupted individual. A thrall willingly and enthusiastically follows the commands of their master. However, for as long as they are enthralled, their Intelligence is halved and they should receive direct and specific instructions lest they misinterpret the intent of their master\u2019s words. This trait can be removed by the character being targeted by a successful level 4 or higher Dispel effect or through the death of their master.",
        ]},
]

// the opening of the traits chapter, which sits above the list rather than inside it
const traitIntro: RuleBlock[] = [
    {text: "Traits are rules that reflect various natural facts about the character or certain abilities they possess. They include things such as the ability to fly, inherent physical weaknesses, personality traits, and so forth. They are typically the result of birth, upbringing, or racial circumstance but may be gained through other means later in life, though rarely by choice or without the use of magic."},
    {text: "Traits do not stack unless otherwise specified. If traits with an X value are applied to a target with an already existing instance of that trait, apply the highest value of X unless otherwise specified."},
]

// a blank in a trait name or rule. token is what gets replaced, and the kind decides
// whether the sheet asks for a number or for a few words
type TraitField = {
    token: string,
    label: string,
    kind: "text" | "number" | "choice",
    // for a choice, the value that goes in and the wording that explains it
    options?: {value: string, label: string}[],
}

// the traits themselves, worded exactly as the rulebook has them. base is the name
// without its blanks, and fields are whatever the sheet has to ask for first
const traitList: {
    base: string,
    name: string,
    fields?: TraitField[],
    text: string[],
    // a few traits carry a small table of their own
    table?: {head: string, cols: [string, string], rows: [string, string][]},
}[] = [
    {
        base: "Amphibious",
        name: "Amphibious",
        text: ["The character can breathe water and ignores the skill cap placed on their combat rolls by their Athletics skill when fighting in water."],
    },
    {
        base: "Bestial",
        name: "Bestial",
        text: ["The character has no need to make Survival skill tests in their natural habitat, but they must test Willpower to avoid fleeing combat if the GM feels that it\u2019s appropriate (for example, if the creature would feel intimidated by its foe)."],
    },
    {
        base: "Blind",
        name: "Blind",
        text: ["The character has the blinded condition while they have this trait."],
    },
    {
        base: "Bound",
        name: "Bound",
        text: [
            "This creature is bound by the will of their master. They must obey the commands of their master, except they will always prioritize defending themselves. Additionally, if the bound creature's master or their master's allies intentionally take hostile or harmful action against them for any reason, they immediately turn hostile and lose the bound trait.",
            "Items with this trait use their creator\u2019s Willpower score when forced to roll any relevant test (except Combat Style). These items are practically weightless, counting as having an effective ENC rating of 0.",
        ],
    },
    {
        base: "Climber",
        name: "Climber (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["The character can climb walls and ceilings as if open ground. Their Climb Speed is now set to Xm."],
    },
    {
        base: "Crawler",
        name: "Crawler",
        text: ["Rather than walking, a character with this trait crawls. They halve their normal Speed (round up) and take no penalties for moving through difficult terrain."],
    },
    {
        base: "Dark Sight",
        name: "Dark Sight",
        text: ["A character with this trait can see normally even in areas with total darkness and never takes penalties for acting in areas with dim or no lighting."],
    },
    {
        base: "Dawn-Cursed",
        name: "Dawn-Cursed (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Characters with this trait are fatally sensitive to sunlight. While in direct sunlight, the character suffers X damage per round which ignores all damage mitigation. If the character covers themselves completely with clothing and a hood with sufficient coverage, this damage is reduced to X per hour in the sunlight. If the vampire is under full cover which would block out all sunlight, like a fully covered wagon or inside a building, they take no damage."],
    },
    {
        base: "Deaf",
        name: "Deaf",
        text: ["The character has the deafened condition while they have this trait. See the Conditions section in Chapter 5 for rules on this condition."],
    },
    {
        base: "Disease Resistance",
        name: "Disease Resistance (X%)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Whenever a character with this trait would be infected by a common disease, roll a d100. If the roll is less than or equal to X, the character doesn\u2019t get the disease."],
    },
    {
        base: "Diseased",
        name: "Diseased (+/- X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["If a character with this trait deals at least 1 point of damage (after mitigation) with their natural weapons to a target without the Diseased trait, then the affected target must test Endurance +/- X or contract a common disease."],
    },
    {
        base: "Flyer",
        name: "Flyer (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["The character can fly. They have a Speed equal to X when flying."],
    },
    {
        base: "Frightening",
        name: "Frightening (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Those who encounter this character must immediately make a Panic (X) test."],
    },
    {
        base: "From Beyond",
        name: "From Beyond",
        text: ["The character is immune to the effects of disease, fear, toxins, and any mind-affecting magic (i.e. illusions)."],
    },
    {
        base: "Immunity",
        name: "Immunity (*)",
        fields: [{token: "*", label: "Type of effect", kind: "text"}],
        text: ["The character is immune to any effects of the type specified in parenthesis. The character may have multiple instances of this trait for different effects *."],
    },
    {
        base: "Incorporeal",
        name: "Incorporeal",
        text: ["Incorporeal characters are spirits, faintly visible and capable of moving through objects. They gain the Flyer (Speed) trait and may use it to freely move through solid objects. They can be targeted by attacks, but they cannot suffer damage except from magic damage or damage from attacks with the Magic quality. Incorporeal characters do not normally affect the world, but they can use magic and make attacks that are capable of damaging non-incorporeal beings. Attacks from Incorporeal characters ignore all AR from any armor that does not have the Magic quality and cannot be blocked by shields without that quality."],
    },
    {
        base: "Natural Toughness",
        name: "Natural Toughness (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["The character with this trait is naturally tough and reduces incoming damage of all types by X. This functions like AR for the purposes of reducing damage, but it does not count as armor."],
    },
    {
        base: "Natural Weapons",
        name: "Natural Weapons (Type, Damage, Range)",
        fields: [
            {token: "Type", label: "Type", kind: "text"},
            {token: "Damage", label: "Damage", kind: "text"},
            {token: "Range", label: "Range", kind: "text"},
        ],
        text: ["The character with this trait has unique natural weapons of some kind. The Type, Damage, and Range together specify the complete profile for the character\u2019s natural weapons. This overrides the default natural weapons profile and they cannot be disarmed. Default Natural Weapons profiles can be found in Unarmed Combat on page 104. Natural Weapons cannot be enchanted."],
    },
    {
        base: "Power Well",
        name: "Power Well (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Characters with this trait have more magicka than usual. The size of their Magicka Pool is increased by X. If the character would receive this trait twice, combine the X values."],
    },
    {
        base: "Quadruped",
        name: "Quadruped",
        text: ["Characters with this trait move up to twice their speed when they use the Dash action and three times their speed when they use the Sprint stamina ability."],
    },
    {
        base: "Regeneration",
        name: "Regeneration (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Characters with this trait heal very quickly. They may make an Endurance test at the start of each round to heal X HP. This does not count as magical healing unless applied by some magical source."],
    },
    {
        base: "Resist Normal Weapons",
        name: "Resist Normal Weapons (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Characters with this trait are resistant to mundane weapons. If the character suffers damage from a weapon/attack without the Magic quality, reduce that damage by X after any other mitigation."],
    },
    {
        base: "Resistance",
        name: "Resistance (*, X)",
        fields: [
            {token: "*", label: "Type", kind: "text"},
            {token: "X", label: "X", kind: "number"},
        ],
        text: [
            "Characters with this trait reduce damage of * type by X after any other mitigation and gain a +10 bonus per X to tests made to resist non-damaging effects of the listed type.",
            "In cases where the character is not making the * related test, but rather a * related roll is being made against one of their Characteristics, increase that characteristic by 10 times X for the purposes of resolving that roll.",
        ],
    },
    {
        base: "Running Out of Luck",
        name: "Running Out of Luck",
        text: ["The character\u2019s luck is running out. Whenever they would burn any amount of Luck, burn twice that amount. If the character does not have this much Luck remaining, just burn all remaining Luck."],
    },
    {
        base: "Savage",
        name: "Savage",
        text: ["The character treats weapons that they wield (including Natural Weapons) as if they had the Proven Weapon Quality. If the Weapon has the Primitive Quality, then the character treats the weapon as having neither Quality."],
    },
    {
        base: "Silver-Scarred",
        name: "Silver-Scarred (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Any damage inflicted on a character with this trait after mitigation by an attack from a silver weapon is increased by X before calculating the effects of the damage."],
    },
    {
        base: "Skeletal",
        name: "Skeletal",
        text: ["Characters with this trait have purely skeletal forms. Attempts to hit them with ranged weapons suffer a -20 penalty. Characters with this trait also automatically gain the Undead trait as well and are immune to the Burning (X) condition."],
    },
    {
        base: "Spell Absorption",
        name: "Spell Absorption (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: [
            "Characters with this trait absorb a portion of the magic directed at them to fuel their own magicka reserves. Whenever magic from another source/character affects them, roll a d10. If the value is less than or equal to X, the magic has no effect on them; instead, they regain missing MP up to the cost of the magic.",
            "If a character with this trait would be affected by the Reflect spell, then the effects of each should be resolved in the reverse order to which they were applied.",
            "For example, if a character with this trait has the Reflect spell effect applied to them after this trait is applied, then when the character is affected by another spell effect they would resolve Reflect against that effect first, then Spell Aborption if the effect is not reflected.",
        ],
    },
    {
        base: "Strong Jaws",
        name: "Strong Jaws",
        text: ["A Bite attack made by this character that deals damage automatically starts a Grapple test. The test to contest this Grapple is made against the original test made by the attacker. If the target Counter Attacks againt a Bite attack, the Counter Attack ignores the creature\u2019s AR and Natural Toughness trait."],
    },
    {
        base: "Stunted Magicka",
        name: "Stunted Magicka",
        text: ["Characters with this trait do not regenerate magicka naturally and halve the benefits (round down) gained from Spell Restraint."],
    },
    {
        base: "Summoned",
        name: "Summoned",
        text: ["This creature or item has been conjured from another plane of existence. Upon its death or destruction, it returns to where it came from immediately."],
    },
    {
        base: "Sun-Scarred",
        name: "Sun-Scarred (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: [
            "Any damage inflicted on a character with this trait after mitigation by an attack that counts as sunlight is increased by X before calculating the effects of the damage.",
            "If this character is exposed to normal sunlight they lose 1 SP each hour. Cloud cover or other such weather halves the rate of SP loss. The character must spend an hour in a dark place before they can remove levels of fatigue/regain SP lost in this manner.",
        ],
    },
    {
        base: "Swimmer",
        name: "Swimmer",
        text: ["The character\u2019s Swim Speed is doubled."],
    },
    {
        base: "Telekinesis",
        name: "Telekinesis (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: [
            "Characters with this trait can move objects with their mind within a range of 10 * X meters. This can only be used to move fairly small objects (at most a large crate or barrel) at a speed of about 1 meter per second (6 per round).",
            "The character can also throw an object at an opponent. This is a Primary Action and a Ranged Attack, and it uses Mysticism (Willpower) for the test. Any object used in this manner counts as an improvised weapon and can only be thrown a distance of WB * 2 meters.",
        ],
    },
    {
        base: "Telepathy",
        name: "Telepathy (X)",
        fields: [{token: "X", label: "Telepathic Strength", kind: "choice", options: [
                {value: "1", label: "A single word"},
                {value: "2", label: "A short sentence."},
                {value: "3", label: "A full sentence."},
                {value: "4", label: "Up to five sentences."},
                {value: "5", label: "As many words as the character desires."},
                {value: "6", label: "Images."},
                {value: "7", label: "Complex feelings and concepts."},
            ]}],
        text: [
            "Characters with this trait can communicate with others telepathically. They are capable of \u201cbroadcasting\u201d thoughts to a maximum number of characters equal to their WB within a number of meters equal to one hundred times their WB. They must have line of sight to the character to whom they are broadcasting, unless the target character has this trait as well.",
            "Characters with this trait can make a Perception test as a Free Action to attempt to locate other characters with this trait within their broadcast range, though this test can be opposed by a Willpower test if a character wishes to remain hidden.",
            "The strength X of this trait determines the complexity of the thoughts they can broadcast.",
        ],
        table: {head: "Telepathic Strength", cols: ["X", "Maximum Message Complexity"], rows: [
                ["1", "A single word"],
                ["2", "A short sentence."],
                ["3", "A full sentence."],
                ["4", "Up to five sentences."],
                ["5", "As many words as the character desires."],
                ["6", "Images."],
                ["7+", "Complex feelings and concepts."],
            ]},
    },
    {
        base: "Terrifying",
        name: "Terrifying (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Those who encounter this character must immediately make a Horror (X) test."],
    },
    {
        base: "Thick Skull",
        name: "Thick Skull",
        text: ["Immune to Stun and Dazed."],
    },
    {
        base: "Tough",
        name: "Tough (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Increase Wound Threshold by X."],
    },
    {
        base: "Undead",
        name: "Undead",
        text: ["Characters with this trait are mere walking corpses. They do not breathe or require organs to function. They are immune to things such as disease, poison, passive wound effects, aging, fatigue, and a number of conditions including but not limited to dazed, deafened, and organ damage. Use common sense when deciding what can and cannot affect characters with this trait. The character cannot spend Stamina Points if doing so would bring their current SP to below 0."],
    },
    {
        base: "Undying",
        name: "Undying",
        text: ["Characters are free from most concerns of the living. They are immune to disease and the effects of aging."],
    },
    {
        base: "Unnatural Senses",
        name: "Unnatural Senses (*, X)",
        fields: [
            {token: "*", label: "Senses", kind: "text"},
            {token: "X", label: "X", kind: "number"},
        ],
        text: ["The character with this trait can perceive its surroundings using additional and/or different senses than the usual. Their Senses allow them to detect the things specified by * within range of X meters (even through solid objects). If * is \u201call\u201d then their Senses have been replaced entirely, and they can simply see \u201cnormally\u201d through solid objects up to X meters away."],
    },
    {
        base: "Vicious",
        name: "Vicious (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["The creature treats their SB as being X for the purposes of resolving damage. This does not effect the character's Strength Characteristic Score."],
    },
    {
        base: "Weak Bones",
        name: "Weak Bones (X)",
        fields: [{token: "X", label: "X", kind: "number"}],
        text: ["Reduce Wound Threshold by X."],
    },
    {
        base: "Weakness",
        name: "Weakness (*, X)",
        fields: [
            {token: "*", label: "Type", kind: "text"},
            {token: "X", label: "X", kind: "number"},
        ],
        text: [
            "Characters with this trait are weak to a certain damage or effect type. They increase damage of * type by X after any other mitigation and suffer a -10 penalty per X to tests made to resist non-damaging effects of this type.",
            "If this trait would stack for a single damage type, instead only apply the highest value of X. Different values of * damage type are considered different traits.",
            "In cases where the character is not making the * related test, but rather a * related roll is being made against one of their Characteristics, decrease that characteristic by 10 times X for the purposes of resolving that roll.",
        ],
    },
]

// fills a trait's blanks. the X rule leaves letters alone so Xm and MAX both behave,
// and +/- X takes the whole thing since the player types the sign themselves
function fillTrait(s: string, fields: TraitField[], values: Record<string, string>, forTitle?: boolean) {
    let out = s
    fields.forEach(f => {
        const v = (values[f.token] ?? "").trim()
        if (v === "") return
        // the kind is checked before the token, since a choice can also be called X
        if (f.kind === "choice" && !forTitle) {
            // the picked number goes in brackets, and what it means finishes the sentence
            const shown = "(" + v + ")"
            out = out.replace(new RegExp("(?<![A-Za-z])" + f.token, "g"), shown)
            const at = out.indexOf(shown)
            const opt = (f.options ?? []).find(o => o.value === v)
            if (at !== -1 && opt) {
                const stop = out.indexOf(".", at)
                const meaning = opt.label.replace(/\.$/, "")
                if (stop !== -1) out = out.slice(0, stop) + ": " + meaning + out.slice(stop)
                else out = out + ": " + meaning
            }
        } else if (f.kind === "choice") {
            // in a title the picked number stands on its own with no brackets
            out = out.replace(new RegExp("(?<![A-Za-z])" + f.token, "g"), v)
        } else if (f.token === "X") {
            out = out.replace(/\+\/-\s*X/g, v).replace(/(?<![A-Za-z])X/g, v)
        } else if (f.token === "*") {
            out = out.split("*").join(v)
        } else {
            out = out.replace(new RegExp("\\b" + f.token + "\\b", "g"), v)
        }
    })
    return out
}

// a row on the sheet reads like "Climber (12)", so the base name is what comes first
function traitFor(rowName: string) {
    const base = rowName.split("(")[0].trim()
    return traitList.find(tr => tr.base === base)
}


// which characteristics each skill tests, used when writing the sheet back out
const skillChars: {name: string, chars: string[]}[] = [
    {name: "Acrobatics", chars: ["Str", "Ag"]},
    {name: "Alchemy", chars: ["Int"]},
    {name: "Alteration", chars: ["Wp"]},
    {name: "Athletics", chars: ["Str", "End"]},
    {name: "Command", chars: ["Str", "Int", "Prs"]},
    {name: "Commerce", chars: ["Int", "Prs"]},
    {name: "Conjuration", chars: ["Wp"]},
    {name: "Deceive", chars: ["Int", "Prs"]},
    {name: "Destruction", chars: ["Wp"]},
    {name: "Enchant", chars: ["Int"]},
    {name: "Evade", chars: ["Ag"]},
    {name: "Illusion", chars: ["Int"]},
    {name: "Investigate", chars: ["Int", "Prc"]},
    {name: "Logic", chars: ["Int", "Prc"]},
    {name: "Lore", chars: ["Int"]},
    {name: "Mysticism", chars: ["Wp"]},
    {name: "Navigate", chars: ["Int", "Prc"]},
    {name: "Necromancy", chars: ["Int"]},
    {name: "Observe", chars: ["Prc"]},
    {name: "Persuade", chars: ["Str", "Prs"]},
    {name: "Restoration", chars: ["Wp"]},
    {name: "Ride", chars: ["Ag"]},
    {name: "Stealth", chars: ["Ag", "Prc"]},
    {name: "Subterfuge", chars: ["Ag", "Int"]},
    {name: "Survival", chars: ["Int", "Prc"]},
]

// a skill with no rank is untrained, which is a flat -20 rather than a bonus
function targetNumber(info: CharInfo, skill: string, char: string) {
    const score = Number(info.get(char)) || 0
    const ranked = info.get(skill + " Rank")
    const bonus = ranked ? Number(info.get(skill + " Bonus") ?? 0) : -20
    return score + bonus
}

// holding an arrow key makes the browser repeat it, and the longer it is held the
// bigger each step gets. one number is enough since only one box has focus at a time
let arrowHold = 0

function arrowStep(repeating: boolean) {
    if (!repeating) {
        arrowHold = 0
        return 1
    }
    arrowHold++
    if (arrowHold > 40) return 10
    if (arrowHold > 20) return 5
    if (arrowHold > 8) return 2
    return 1
}

// up and down nudge a number box. a single press can go past the ends, but holding
// the key stops at zero and at the cap so nothing runs away on its own
function numberArrows(value: string, apply: (next: string) => void, max?: number) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
        const now = Number(value)
        // something like "10 - 1" is not a plain number so leave it be
        if (value.trim() === "" || isNaN(now)) return
        e.preventDefault()
        let next = now + arrowStep(e.repeat) * (e.key === "ArrowUp" ? 1 : -1)
        if (e.repeat) {
            if (next < 0) next = 0
            if (max !== undefined && next > max) next = max
        }
        apply(String(next))
    }
}

// a characteristic bonus is the tens digit of the score
function bonusFrom(info: CharInfo, key: string) {
    return Math.floor((Number(info.get(key)) || 0) / 10)
}

function App() {
    const [charInfo, setCharInfo] = useState<CharInfo | null>(saved ? new Map(saved.charInfo) : null)
    const [languages, setLanguages] = useState<string[]>(saved?.languages ?? [])
    const [mode, setMode] = useState<string | null>(saved?.mode ?? null)
    const [panel, setPanel] = useState<string | null>(saved?.panel ?? null)
    const [inventory, setInventory] = useState<{name: string, enc: string}[]>(saved?.inventory ?? [])
    const [ttp, setTtp] = useState<{name: string, note: string}[]>(saved?.ttp ?? [])
    const [specializations, setSpecializations] = useState<string[]>(saved?.specializations ?? [])
    const [rituals, setRituals] = useState<string[]>(saved?.rituals ?? [])
    const [spells, setSpells] = useState<{name: string, attr: string, desc: string, levels: {lvl: string, cost: string, str: string}[]}[]>(saved?.spells ?? [])
    const [melee, setMelee] = useState<{name: string, dmg: string, hand: string, reach: string, enc: string, notes: string}[]>(saved?.melee ?? [])
    const [ranged, setRanged] = useState<{name: string, dmg: string, hand: string, reach: string, enc: string, notes: string}[]>(saved?.ranged ?? [])
    const [openActions, setOpenActions] = useState<string[]>(saved?.openActions ?? [])
    const [conditions, setConditions] = useState<Cond[]>(saved?.conditions ?? [])
    const [recap, setRecap] = useState<string[]>([])
    const [wounds, setWounds] = useState<Wound[]>(saved?.woundList ?? [])
    const [pdfText, setPdfText] = useState<string | null>(savedPdf)
    const [shield, setShield] = useState<{br: string, type: string, enc: string}>(saved?.shield ?? {br: "", type: "", enc: ""})
    const [armorNotes, setArmorNotes] = useState<string>(saved?.armorNotes ?? "")
    const [overflow, setOverflow] = useState<string[]>([])
    const [apRefreshed, setApRefreshed] = useState(true)

    // what the wound wizard has been told so far, one answer per question
    const [woundPart, setWoundPart] = useState("")
    const [woundSide, setWoundSide] = useState("")
    const [woundShockPassed, setWoundShockPassed] = useState(true)
    const [woundDamage, setWoundDamage] = useState("")

    // which row of the fear table was rolled, and any number it still needs
    const [fearRow, setFearRow] = useState<{range: string, low: number, high: number, name: string, text: string} | null>(null)
    const [fearNum, setFearNum] = useState("")
    const [fearNum2, setFearNum2] = useState("")
    const [shrugged, setShrugged] = useState("")
    const [fearKind, setFearKind] = useState("Fear")
    const [traitPick, setTraitPick] = useState("")
    const [traitValues, setTraitValues] = useState<Record<string, string>>({})

    // the dice tray. pool is a list of sides, so tapping d6 twice gives [6, 6]
    const [diceOpen, setDiceOpen] = useState(false)
    // which weight class the armour adds up to, chosen rather than read off the sheet
    const [weightClass, setWeightClass] = useState<number>(saved?.weightClass ?? 0)
    const [dicePool, setDicePool] = useState<number[]>([])
    const [diceRolls, setDiceRolls] = useState<{sides: number, value: number}[] | null>(null)
    // automatic conditions the player has taken off by hand, so they do not come straight back
    const [dismissed, setDismissed] = useState<string[]>(saved?.dismissed ?? [])

    // rooms. the sheet still lives in this browser, the room is only a copy being shown
    const [role, setRole] = useState<string>(() => {
        try { return localStorage.getItem(roleKey) ?? "" } catch { return "" }
    })
    const [room, setRoom] = useState<string>(() => {
        try { return localStorage.getItem(roomKey) ?? "" } catch { return "" }
    })
    const [roomInput, setRoomInput] = useState("")

    // the tracker. creatures are the gm's own, everything else is keyed by who it is
    const savedTracker = (() => {
        try {
            const raw = localStorage.getItem(trackerKey)
            return raw ? JSON.parse(raw) : null
        } catch {
            return null
        }
    })()
    const [creatures, setCreatures] = useState<Creature[]>(savedTracker?.creatures ?? [])
    const [creatureSearch, setCreatureSearch] = useState("")
    // which statblock the gm is reading, empty when they are on the tracker
    const [statblock, setStatblock] = useState("")
    // which creature name is being typed over, empty when none is
    const [renaming, setRenaming] = useState("")
    const [tieLines, setTieLines] = useState<string[]>([])
    const [initBy, setInitBy] = useState<Record<string, number>>(savedTracker?.initBy ?? {})
    const [atkBy, setAtkBy] = useState<Record<string, number>>(savedTracker?.atkBy ?? {})
    const [orderKeys, setOrderKeys] = useState<string[]>(savedTracker?.orderKeys ?? [])
    const [roster, setRoster] = useState<RoomRow[]>([])
    // set while the dm is looking at somebody else's sheet, which turns off saving
    const [viewing, setViewing] = useState<string>("")
    const [woundLines, setWoundLines] = useState<string[]>([])
    const [popout, setPopout] = useState<string | null>(null)
    const [restLines, setRestLines] = useState<string[] | null>(null)

    // anything in this list being edited saves the sheet again
    useEffect(() => {
        if (!charInfo) return
        // while the dm is looking at somebody else's sheet this state belongs to them,
        // so saving it here would write their character over the dm's own
        if (viewing !== "") return

        const snapshot = JSON.stringify({
            // a Map does not survive being turned into text so store it as pairs
            charInfo: Array.from(charInfo),
            languages, mode, panel, inventory, ttp, specializations,
            rituals, spells, melee, ranged, openActions, conditions,
            woundList: wounds, shield, armorNotes, dismissed, weightClass,
        })

        try {
            localStorage.setItem(saveKey, snapshot)
        } catch {
            // running out of space or private browsing should not break the sheet
        }

        // the same snapshot goes to the room, so the dm sees exactly this sheet
        if (roomsReady && room !== "") void publishSheet(room, String(charInfo.get("Name") ?? "unnamed"), snapshot)
    }, [charInfo, languages, mode, panel, inventory, ttp, specializations,
        rituals, spells, melee, ranged, openActions, conditions, wounds,
        shield, armorNotes, dismissed, weightClass, room, viewing])

    useEffect(() => {
        try {
            localStorage.setItem(trackerKey, JSON.stringify({creatures, initBy, atkBy, orderKeys}))
        } catch {
            // the tracker simply will not survive a refresh if storage is off
        }
    }, [creatures, initBy, atkBy, orderKeys])

    useEffect(() => {
        try {
            localStorage.setItem(roleKey, role)
            localStorage.setItem(roomKey, room)
        } catch {
            // storage switched off, the choice simply will not survive a refresh
        }
    }, [role, room])

    // the list of who is in the room, kept up to date as the players play
    useEffect(() => {
        if (!roomsReady || room === "") return
        let stopped = false
        const refresh = () => {
            fetchRoom(room).then(rows => {
                if (stopped) return
                setRoster(rows)
                // if a sheet is open, keep it moving with whatever the player is doing
                if (viewing !== "") {
                    const open = rows.find(r => r.name === viewing)
                    if (open) loadSnapshot(open.sheet, true)
                }
            })
        }
        refresh()
        const stopWatching = watchRoom(room, refresh)
        return () => {
            stopped = true
            stopWatching()
        }
    }, [room, viewing])

    // stamina can be spent that the character does not have. landing exactly on zero
    // is free, but every point spent past empty is a level of fatigue. this hands back
    // how many points went under, which is how many levels are owed
    function spendStamina(map: CharInfo, amount: number) {
        const cur = Number(map.get("Current SP") ?? 0)
        const left = cur - amount
        map.set("Current SP", String(Math.max(0, left)))
        return left < 0 ? -left : 0
    }

    // adds levels of fatigue, starting the condition if it was not there already.
    // the cap is how far this particular source is allowed to push it, so running out
    // of stamina can leave a character Drained but never unconscious or dead
    function withFatigue(list: Cond[], levels: number, cap: number) {
        if (levels <= 0) return list
        const f = list.find(c => c.name === "Fatigued")
        if (!f) return [...list, {name: "Fatigued", value: Math.min(cap, levels)}]
        const now = f.value ?? 1
        // never drags a worse fatigue back down to the cap
        const next = Math.max(now, Math.min(cap, now + levels))
        return list.map(c => c === f ? {...c, value: next} : c)
    }

    // running out of stamina can knock a character out but never kills them
    const staminaFatigueCap = 4

    // fills the original sheet back in and hands it over as a download
    async function downloadPdf() {
        if (!charInfo || !pdfText) {
            setPopout("noPdf")
            return
        }

        try {
            const doc = await PDFDocument.load(textToBytes(pdfText))
            const form = doc.getForm()

            // the paper sheet only has so many rows, so anything past the end would
            // vanish without a word. count it up and say so afterwards
            const tooMany: string[] = []
            const checkFit = (what: string, count: number, slots: number) => {
                if (count > slots) tooMany.push(what + ": " + count + " of them, the sheet has room for " + slots)
            }
            checkFit("Inventory items", inventory.length, 28)
            checkFit("Traits, talents and powers", ttp.length, 29)
            checkFit("Spells", spells.length, 21)
            checkFit("Melee weapons", melee.length, 3)
            checkFit("Ranged weapons", ranged.length, 3)
            checkFit("Specializations", specializations.length, 5)
            checkFit("Rituals", rituals.length, 7)
            checkFit("Wounds", wounds.length, 3)
            checkFit("Conditions", conditions.length, 3)

            // one place that knows how to write a value back, unknown fields are skipped
            const put = (name: string, value: string) => {
                try {
                    form.getTextField(name).setText(value)
                } catch {
                    // the sheet does not have this field, nothing to do
                }
            }
            const tick = (name: string, on: boolean) => {
                try {
                    const box = form.getCheckBox(name)
                    if (on) box.check()
                    else box.uncheck()
                } catch {
                    // same again, some sheets simply do not carry this one
                }
            }

            // everything that is still stored under its own field name goes straight back
            charInfo.forEach((value, name) => {
                if (typeof value === "boolean") tick(name, value)
                else put(name, String(value ?? ""))
            })

            // the lists were pulled apart when the sheet loaded, so put them back together
            put("Languages", languages.filter(l => l.trim() !== "").join(", "))

            for (let i = 1; i <= 28; i++) {
                const item = inventory[i - 1]
                put("Item " + i, item ? item.name : "")
                put(i === 1 ? "Item 1 ENC" : "Item 1 ENC " + i, item ? item.enc : "")
            }

            for (let i = 1; i <= 29; i++) {
                const trait = ttp[i - 1]
                put("TTP " + i, trait ? trait.name : "")
                put("TTP Notes " + i, trait ? trait.note : "")
            }

            for (let i = 1; i <= 5; i++) put("Spell Specializations " + i, specializations[i - 1] ?? "")
            for (let i = 1; i <= 7; i++) put("Rituals " + i, rituals[i - 1] ?? "")

            for (let i = 1; i <= 21; i++) {
                const spell = spells[i - 1]
                put("Spell Name " + i, spell ? spell.name : "")
                put("Spell Attributes " + i, spell ? spell.attr : "")
                // the description was read out of two boxes and merged so it all goes in the first
                put("Spell Description 1 " + i, spell ? spell.desc : "")
                put("Spell Description 2 " + i, "")
                for (let j = 1; j <= 7; j++) {
                    const level = spell ? spell.levels[j - 1] : undefined
                    put("Spell Level " + j + " " + i, level ? level.lvl : "")
                    put("Spell Cost " + j + " " + i, level ? level.cost : "")
                    put("Spell Strength " + j + " " + i, level ? level.str : "")
                }
            }

            for (let i = 1; i <= 3; i++) {
                const w = melee[i - 1]
                put("Melee Weapon " + i, w ? w.name : "")
                put("Melee Weapon " + i + " Damage", w ? w.dmg : "")
                put("Melee Weapon " + i + " Hand", w ? w.hand : "")
                put("Melee Weapon " + i + " Reach", w ? w.reach : "")
                put("Melee Weapon " + i + " ENC", w ? w.enc : "")
                put("Melee Weapon Notes " + i, w ? w.notes : "")

                const r = ranged[i - 1]
                put("Ranged Weapon " + i, r ? r.name : "")
                put("Ranged Weapon " + i + " Damage", r ? r.dmg : "")
                put("Ranged Weapon " + i + " Hand", r ? r.hand : "")
                put("Ranged Weapon " + i + " Reach", r ? r.reach : "")
                put("Ranged Weapon " + i + " ENC", r ? r.enc : "")
                put("Ranged Weapon Notes " + i, r ? r.notes : "")
            }

            // the bonuses are worked out rather than stored so they go in fresh
            let exportSbMod = 0
            conditions.forEach(c => {
                const fn = conditionTypes[c.name].sbMod
                if (fn) exportSbMod += fn(c)
            })
            put("SB", String(bonusFrom(charInfo, "Str") + exportSbMod))
            put("EB", String(bonusFrom(charInfo, "End")))
            put("AB", String(bonusFrom(charInfo, "Ag")))
            put("IB", String(bonusFrom(charInfo, "Int")))
            put("WB", String(bonusFrom(charInfo, "Wp")))
            put("PcB", String(bonusFrom(charInfo, "Prc")))
            put("PsB", String(bonusFrom(charInfo, "Prs")))
            put("LB", String(bonusFrom(charInfo, "Lck")))

            // back into the one field the sheet keeps them in
            // the target numbers are worked out from the score and the rank, so they go
            // back in fresh rather than carrying over whatever the sheet was loaded with
            skillChars.forEach(skill => {
                skill.chars.forEach(char => {
                    put(skill.name + " (" + char + ")", String(targetNumber(charInfo, skill.name, char)))
                })
            })

            put("Combat Style (Str)", String(targetNumber(charInfo, "Combat Style", "Str")))
            put("Combat Style (Ag)", String(targetNumber(charInfo, "Combat Style", "Ag")))

            // a profession keeps its target number and its characteristic in one field
            for (let i = 1; i <= 3; i++) {
                const prof = charInfo.get("Profession " + i)
                if (!prof) continue
                const char = String(charInfo.get("Profession " + i + " TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
                if (char === "") continue
                put("Profession " + i + " TN", "TN: " + targetNumber(charInfo, "Profession " + i, char) + "   (" + char + ")")
            }

            put("Languages 2", [shield.br, shield.type, shield.enc].join(" / "))
            put("Armor Notes", armorNotes)
            put("Armor Notes 1", armorNotes)
            put("Armor Notes 2", "")

            for (let i = 1; i <= 3; i++) {
                const w = wounds[i - 1]
                put("Wounds " + i, w ? w.part + (w.treated ? ", treated" : ", untreated") : "")
            }

            // conditions are written out the way they read on the card
            const condLines = conditions.map(c => {
                if (c.result) return c.name + " - " + c.result
                if (c.part) return c.name + " (" + c.part + ")"
                if (conditionTypes[c.name].kind === "value") return c.name + " (" + c.value + ")"
                if (c.name === "Fatigued") return fatigueSteps[(c.value ?? 1) - 1].label
                return c.name
            })
            for (let i = 1; i <= 3; i++) put("Conditions " + i, condLines[i - 1] ?? "")

            // the form is left fillable so the download can be uploaded again later
            const out = await doc.save()
            // copying into a fresh array gives it a plain buffer, which is what a Blob wants
            const bytes = new Uint8Array(out)
            const blob = new Blob([bytes], {type: "application/pdf"})
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = String(charInfo.get("Name") ?? "character") + ".pdf"
            link.click()
            URL.revokeObjectURL(url)

            if (tooMany.length > 0) {
                setOverflow(tooMany)
                setPopout("tooMany")
            }
        } catch {
            setPopout("pdfFailed")
        }
    }

    // the only way back to the upload screen, and the only thing that clears the save
    function startOver() {
        if (room !== "") void leaveRoom(room)
        setRoom("")
        setRoster([])
        setViewing("")
        try {
            localStorage.removeItem(saveKey)
            localStorage.removeItem(pdfKey)
        } catch {
            // nothing to clean up if storage was never available
        }
        setPdfText(null)
        setCharInfo(null)
        setLanguages([])
        setMode(null)
        setPanel(null)
        setInventory([])
        setTtp([])
        setSpecializations([])
        setRituals([])
        setSpells([])
        setMelee([])
        setRanged([])
        setOpenActions([])
        setConditions([])
        setWounds([])
        setShield({br: "", type: "", enc: ""})
        setArmorNotes("")
        setDismissed([])
        setWeightClass(0)
        setPopout(null)
        setRestLines(null)
        setRecap([])
    }

    async function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return
        const PDFInput : ArrayBuffer = await file.arrayBuffer()

        // hang on to the original so the download can fill this very sheet back in
        const asText = bytesToText(new Uint8Array(PDFInput))
        setPdfText(asText)
        try {
            localStorage.setItem(pdfKey, asText)
        } catch {
            // too big for storage, the download still works until the page is refreshed
        }

        const parsed = await fileHandler(PDFInput)
        console.log(parsed)

        // speed comes off the sheet as a sum like "10 - 1", where the tail is the armour
        // penalty. armour is handled on its own, so only the base number is kept
        const firstNumber = (raw: string) => {
            const found = String(raw).match(/-?\d+/)
            return found ? found[0] : ""
        }
        for (const key of ["Current Speed", "Base Speed"]) {
            if (parsed.has(key)) parsed.set(key, firstNumber(String(parsed.get(key) ?? "")))
        }

        // tidy every rank into one of the seven the sheet knows about
        const ranked = ["Combat Style", "Profession 1", "Profession 2", "Profession 3",
            ...skillChars.map(s => s.name)]
        ranked.forEach(name => {
            const key = name + " Rank"
            if (parsed.has(key)) parsed.set(key, readRank(String(parsed.get(key) ?? "")))
        })

        setCharInfo(parsed)
        // the pdf gives all the languages as one string so split it into rows here
        setLanguages(String(parsed.get("Languages") ?? "").split(",").map(l => l.trim()))

        // items 2 and up keep their enc under a weird key like Item 1 ENC 2
        const items = []
        for (let i = 1; i <= 28; i++) {
            const name = parsed.get("Item " + i)
            if (!name) continue
            const encKey = i === 1 ? "Item 1 ENC" : "Item 1 ENC " + i
            items.push({name: String(name), enc: String(parsed.get(encKey) ?? "")})
        }
        setInventory(items)

        // a ttp slot with notes but no name is the rest of the previous ones note
        const traits: {name: string, note: string}[] = []
        for (let i = 1; i <= 29; i++) {
            const name = parsed.get("TTP " + i)
            const note = String(parsed.get("TTP Notes " + i) ?? "")
            if (name) traits.push({name: String(name), note: note})
            else if (note !== "" && traits.length > 0) traits[traits.length - 1].note += " " + note
        }
        setTtp(traits)

        const specs = []
        for (let i = 1; i <= 5; i++) {
            if (parsed.get("Spell Specializations " + i)) specs.push(String(parsed.get("Spell Specializations " + i)))
        }
        setSpecializations(specs)

        const rits = []
        for (let i = 1; i <= 7; i++) {
            if (parsed.get("Rituals " + i)) rits.push(String(parsed.get("Rituals " + i)))
        }
        setRituals(rits)

        // port over every named spell even the thuum shouts that dont use costs
        const spellList = []
        for (let i = 1; i <= 21; i++) {
            const name = parsed.get("Spell Name " + i)
            if (!name) continue
            const levels = []
            for (let j = 1; j <= 7; j++) {
                const lvl = String(parsed.get("Spell Level " + j + " " + i) ?? "")
                const cost = String(parsed.get("Spell Cost " + j + " " + i) ?? "")
                const str = String(parsed.get("Spell Strength " + j + " " + i) ?? "")
                if (lvl !== "" || cost !== "" || str !== "") levels.push({lvl: lvl, cost: cost, str: str})
            }
            spellList.push({
                name: String(name),
                attr: String(parsed.get("Spell Attributes " + i) ?? ""),
                desc: String(parsed.get("Spell Description 1 " + i) ?? "") + String(parsed.get("Spell Description 2 " + i) ?? ""),
                levels: levels.length > 0 ? levels : [{lvl: "", cost: "", str: ""}],
            })
        }
        setSpells(spellList)

        // the sheet has three rows in each weapon table
        const meleeList = []
        for (let i = 1; i <= 3; i++) {
            const name = parsed.get("Melee Weapon " + i)
            if (!name) continue
            meleeList.push({
                name: String(name),
                dmg: String(parsed.get("Melee Weapon " + i + " Damage") ?? ""),
                hand: String(parsed.get("Melee Weapon " + i + " Hand") ?? ""),
                reach: String(parsed.get("Melee Weapon " + i + " Reach") ?? ""),
                enc: String(parsed.get("Melee Weapon " + i + " ENC") ?? ""),
                notes: String(parsed.get("Melee Weapon Notes " + i) ?? ""),
            })
        }
        setMelee(meleeList)

        const rangedList = []
        for (let i = 1; i <= 3; i++) {
            const name = parsed.get("Ranged Weapon " + i)
            if (!name) continue
            rangedList.push({
                name: String(name),
                dmg: String(parsed.get("Ranged Weapon " + i + " Damage") ?? ""),
                hand: String(parsed.get("Ranged Weapon " + i + " Hand") ?? ""),
                reach: String(parsed.get("Ranged Weapon " + i + " Reach") ?? ""),
                enc: String(parsed.get("Ranged Weapon " + i + " ENC") ?? ""),
                notes: String(parsed.get("Ranged Weapon Notes " + i) ?? ""),
            })
        }
        setRanged(rangedList)

        // wounds are tracked as their own things now, so only the named ones come across
        setWounds([parsed.get("Wounds 1"), parsed.get("Wounds 2"), parsed.get("Wounds 3")]
            .filter(w => w)
            .map(w => ({part: String(w), treated: false, rounds: 5, damage: 0, healed: 0})))

        // the shield ended up in a language field on the sheet, written as br / type / enc
        const shieldBits = String(parsed.get("Languages 2") ?? "").split("/")
        setShield({
            br: shieldBits[0]?.trim() ?? "",
            type: shieldBits[1]?.trim() ?? "",
            enc: shieldBits[2]?.trim() ?? "",
        })

        setArmorNotes(String(parsed.get("Armor Notes") ?? parsed.get("Armor Notes 1") ?? "") + String(parsed.get("Armor Notes 2") ?? ""))
    }

    // the sheet writes these as a list, and a d100 gets read against them. the gm has
    // no character, so for them a d100 is read against the critical bands instead
    const luckyRolls = (String(charInfo?.get("Lucky Numbers") ?? "").match(/\d+/g) ?? ([] as string[]))
        .map(n => Number(n)).filter(n => n > 0)
    const unluckyRolls = (String(charInfo?.get("Unlucky Numbers") ?? "").match(/\d+/g) ?? ([] as string[]))
        .map(n => Number(n)).filter(n => n > 0)

    const rollNote = (sides: number, value: number) => {
        if (sides !== 100) return null
        if (role === "gm") {
            if (value <= 3) return {text: "Critical Success!", good: true}
            if (value >= 98) return {text: "Critical Failure!", good: false}
            return null
        }
        if (luckyRolls.includes(value)) return {text: "Lucky Number!", good: true}
        if (unluckyRolls.includes(value)) return {text: "Unlucky Number!", good: false}
        return null
    }

    // the dice tray, sitting over whatever is on screen in the corner
    const diceTray = (
        <>
            <button type="button" className="diceButton" onClick={() => setDiceOpen(!diceOpen)} title="Dice">
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                    <circle cx="8" cy="8" r="1.7" fill="currentColor"/>
                    <circle cx="16" cy="8" r="1.7" fill="currentColor"/>
                    <circle cx="12" cy="12" r="1.7" fill="currentColor"/>
                    <circle cx="8" cy="16" r="1.7" fill="currentColor"/>
                    <circle cx="16" cy="16" r="1.7" fill="currentColor"/>
                </svg>
            </button>

            {diceOpen && (
                <div className="diceTray">
                    <div className="dhead">
                        <b>Dice</b>
                        <button type="button" onClick={() => setDiceOpen(false)}>&#215;</button>
                    </div>

                    <div className="dpick">
                        {[4, 6, 8, 10, 12, 20, 100].map(sides => (
                            <button type="button" key={sides} onClick={() => {
                                // tapping the same die again just adds another of it
                                setDicePool([...dicePool, sides])
                                setDiceRolls(null)
                            }}>d{sides}</button>
                        ))}
                    </div>

                    <div className="dpool">
                        {dicePool.length === 0 && <span className="dnone">Nothing picked yet.</span>}
                        {[4, 6, 8, 10, 12, 20, 100].map(sides => {
                            const many = dicePool.filter(d => d === sides).length
                            if (many === 0) return null
                            return (
                                <button type="button" key={sides} className="dchip" onClick={() => {
                                    // takes one of that die back off the pile
                                    const at = dicePool.lastIndexOf(sides)
                                    setDicePool(dicePool.filter((_d, j) => j !== at))
                                    setDiceRolls(null)
                                }}>{many}d{sides} &#215;</button>
                            )
                        })}
                    </div>

                    {diceRolls && (
                        <div className="drolls">
                            {diceRolls.map((r, i) => {
                                const note = rollNote(r.sides, r.value)
                                return (
                                    <div key={i}>
                                        <span>d{r.sides}</span>
                                        {note && <em className={note.good ? "dlucky" : "dunlucky"}>{note.text}</em>}
                                        <b className={note ? (note.good ? "dlucky" : "dunlucky") : ""}>{r.value}</b>
                                    </div>
                                )
                            })}
                            {diceRolls.length > 1 && (
                                <div className="dtotal"><span>Total</span><b>{diceRolls.reduce((sum, r) => sum + r.value, 0)}</b></div>
                            )}
                        </div>
                    )}

                    <div className="dfoot">
                        <button type="button" onClick={() => {
                            setDicePool([])
                            setDiceRolls(null)
                        }}>Clear</button>
                        <button type="button" className="go" onClick={() => {
                            setDiceRolls(dicePool.map(sides => ({sides: sides, value: Math.floor(Math.random() * sides) + 1})))
                        }}>Roll</button>
                    </div>
                </div>
            )}
        </>
    )

    // pours a snapshot into the sheet. used for looking at another player's
    // character, and for putting our own back when we are done looking
    const loadSnapshot = (text: string, keepView?: boolean) => {
        const s = JSON.parse(text)
        setCharInfo(new Map(s.charInfo))
        setLanguages(s.languages ?? [])
        // mode, panel and the open fold outs belong to whoever is looking, so a refresh
        // leaves them alone and the gm can read the rules without the player opening them
        if (!keepView) setMode(s.mode ?? null)
        if (!keepView) setPanel(s.panel ?? null)
        setInventory(s.inventory ?? [])
        setTtp(s.ttp ?? [])
        setSpecializations(s.specializations ?? [])
        setRituals(s.rituals ?? [])
        setSpells(s.spells ?? [])
        setMelee(s.melee ?? [])
        setRanged(s.ranged ?? [])
        if (!keepView) setOpenActions(s.openActions ?? [])
        setConditions(s.conditions ?? [])
        setWounds(s.woundList ?? [])
        setShield(s.shield ?? {br: "", type: "", enc: ""})
        setArmorNotes(s.armorNotes ?? "")
        setDismissed(s.dismissed ?? [])
        setWeightClass(s.weightClass ?? 0)
    }

    const stopViewing = () => {
        setViewing("")
        try {
            const mine = localStorage.getItem(saveKey)
            if (mine) loadSnapshot(mine)
        } catch {
            // nothing saved to come back to, the upload screen will handle it
        }
    }

    // nobody has said which side of the table they are on yet
    if (role === "") {
        return (
            <section id="center">
                <h1>Thrump's Character Manager</h1>
                <div className="ways">
                    <button type="button" className="wayPlayer" onClick={() => setRole("player")}>PLAYER</button>
                    <button type="button" className="wayGm" onClick={() => setRole("gm")}>GM</button>
                </div>
                {!roomsReady && <p className="offline">Rooms are switched off, the connection settings are missing. Everything else works.</p>}
            </section>
        )
    }

    // a creature's write up, opened from its name on the tracker
    if (role === "gm" && statblock !== "" && statblocks[statblock]) {
        const sb = statblocks[statblock]
        return (
            <section id="center" className="gmRoom">
                <div className="nameRow">
                    <div className="upload">
                        <button type="button" className="backToList" onClick={() => setStatblock("")}>Go Back</button>
                    </div>
                    <h1>{sb.name}</h1>
                </div>

                <p className="flavour">{sb.flavour}</p>
                <p className="sbTags">{sb.tags}</p>

                <div className="sbStats">
                    {sb.stats.map(group => (
                        <div className="sblock" key={group.group}>
                            <div className="shead">{group.group}</div>
                            {group.rows.map(row => (
                                <div className="srow" key={row[0]}>
                                    <span>{row[0]}</span>
                                    {/* a dash means the creature simply does not have that one */}
                                    <b className={row[1] === "-" ? "none" : ""}>{row[1]}</b>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {sb.sections.map(sec => (
                    <div key={sec.head}>
                        <h2>{sec.head}</h2>
                        {sec.kind === "prose" ? (
                            sec.items.map((item, i) => <p key={i}>{item.text}</p>)
                        ) : (
                            <ul className="sbList">
                                {sec.items.map((item, i) => (
                                    <li key={i}>
                                        {item.name && item.text && <><b>{item.name}:</b> {item.text}</>}
                                        {item.name && !item.text && <b>{item.name}</b>}
                                        {!item.name && item.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}

                {diceTray}
            </section>
        )
    }

    // the gm, when they are not looking at somebody's character
    if (role === "gm" && viewing === "") {
        return (
            <section id="center" className={room === "" ? "" : "gmRoom"}>
                {room === "" && (
                    <>
                        <div>
                            <h1>Thrump's Character Manager</h1>
                            <p>Host a room and read the code out to your table.</p>
                        </div>

                        <button type="button" className="hostRoom" onClick={() => {
                            void sweepOldRooms()
                            setRoom(newRoomCode())
                        }}>Host a New Room</button>

                        <button type="button" className="backLink" onClick={() => setRole("")}>back</button>
                    </>
                )}

                {room !== "" && (
                    <>
                        <div className="codeBox">
                            <div className="cap">Room code</div>
                            <div className="code">{room}</div>
                        </div>

                        {(() => {
                            // players come from the room, creatures are the gm's own, and
                            // both sit in one list ordered by whatever the gm has arranged
                            type Line = {key: string, name: string, npc: boolean, from?: string,
                                ir: number, luck: number,
                                hp: [number, number], ap: [number, number], sp: [number, number], sheet?: string}

                            const lines: Line[] = []
                            roster.forEach(entry => {
                                const pools = poolsOf(entry.sheet)
                                let ir = 0
                                let luck = 0
                                try {
                                    const info = new Map<string, string | boolean | undefined>(JSON.parse(entry.sheet).charInfo)
                                    ir = Number(info.get("IR")) || 0
                                    luck = Math.floor((Number(info.get("Lck")) || 0) / 10)
                                } catch {
                                    // an unreadable sheet just sorts as though it had nothing
                                }
                                lines.push({key: entry.player_id, name: entry.name, npc: false,
                                    ir: ir, luck: luck,
                                    hp: pools.hp, ap: pools.ap, sp: pools.sp, sheet: entry.sheet})
                            })
                            creatures.forEach(c => {
                                const sb = statblocks[c.from]
                                lines.push({key: c.id, name: c.name, npc: true, from: c.from,
                                    ir: statOf(sb, "Initiative", 0), luck: 0,
                                    hp: c.hp, ap: c.ap, sp: c.sp})
                            })

                            // anyone the gm has not placed yet goes on the end
                            lines.sort((a, b) => {
                                const ai = orderKeys.indexOf(a.key)
                                const bi = orderKeys.indexOf(b.key)
                                if (ai === -1 && bi === -1) return 0
                                if (ai === -1) return 1
                                if (bi === -1) return -1
                                return ai - bi
                            })

                            const setCreature = (id: string, change: (c: Creature) => Creature) => {
                                setCreatures(prev => prev.map(c => c.id === id ? change(c) : c))
                            }

                            const move = (fromKey: string, toKey: string) => {
                                const keys = lines.map(l => l.key)
                                const from = keys.indexOf(fromKey)
                                const to = keys.indexOf(toKey)
                                if (from === -1 || to === -1 || from === to) return
                                keys.splice(to, 0, keys.splice(from, 1)[0])
                                setOrderKeys(keys)
                            }

                            const pool = (which: "hp" | "ap" | "sp", label: string, line: Line) => {
                                const p = line[which]
                                const width = Math.max(0, Math.min(100, 100 * p[0] / (p[1] || 1)))
                                return (
                                    <div className={"tbar " + which}>
                                        <div className="cap">
                                            <span>{label}</span>
                                            {line.npc ? (
                                                <span className="edit">
                                                    <input
                                                        type="text"
                                                        value={String(p[0])}
                                                        onChange={e => setCreature(line.key, c => ({...c, [which]: [Number(e.target.value) || 0, p[1]]}))}
                                                        onKeyDown={numberArrows(String(p[0]),
                                                            v => setCreature(line.key, c => ({...c, [which]: [Number(v), p[1]]})), p[1])}
                                                    />
                                                    <span className="of">/{p[1]}</span>
                                                </span>
                                            ) : (
                                                <span className="fixed">{p[0]}/{p[1]}</span>
                                            )}
                                        </div>
                                        <div className="track"><span style={{width: width + "%"}}></span></div>
                                    </div>
                                )
                            }

                            return (
                                <>
                                    <div className="trackTop">
                                        <button type="button" onClick={() => {
                                            // initiative first, then initiative rating, then a player
                                            // always beats a creature, and one player beats another on
                                            // the better luck bonus
                                            const compare = (a: Line, b: Line) => {
                                                const ai = initBy[a.key] ?? 0
                                                const bi = initBy[b.key] ?? 0
                                                // blanks wait at the bottom rather than vanishing
                                                if (!ai && !bi) { /* both unrolled, fall through */ }
                                                else if (!ai) return 1
                                                else if (!bi) return -1
                                                else if (ai !== bi) return bi - ai

                                                if (a.ir !== b.ir) return b.ir - a.ir

                                                if (a.npc !== b.npc) return a.npc ? 1 : -1
                                                if (!a.npc && a.luck !== b.luck) return b.luck - a.luck
                                                return 0
                                            }

                                            const sorted = [...lines].sort(compare)
                                            setOrderKeys(sorted.map(l => l.key))

                                            // anything the rules cannot separate is handed back to the gm
                                            const groups: string[][] = []
                                            let i = 0
                                            while (i < sorted.length) {
                                                let j = i
                                                while (j + 1 < sorted.length && compare(sorted[j], sorted[j + 1]) === 0) j++
                                                if (j > i) groups.push(sorted.slice(i, j + 1).map(l => l.name))
                                                i = j + 1
                                            }
                                            if (groups.length > 0) {
                                                setTieLines(groups.map(names => names.join(" and ") + " are tied."))
                                                setPopout("ties")
                                            }
                                        }}>Sort</button>
                                        <button type="button" onClick={() => {
                                            // a d8 each, plus whatever initiative rating their write up gives
                                            const rolled = {...initBy}
                                            creatures.forEach(c => {
                                                const rating = statOf(statblocks[c.from], "Initiative", 0)
                                                rolled[c.id] = Math.floor(Math.random() * 8) + 1 + rating
                                            })
                                            setInitBy(rolled)
                                        }}>Roll All NPC Initiative</button>
                                        <button type="button" onClick={() => setCreatures([])}>Clear All NPCs</button>
                                    </div>

                                    <div className="tracker">
                                        <div className="trow head">
                                            <span className="grip">&#8942;&#8942;</span>
                                            <span className="tinit"><span className="lbl">Initiative</span></span>
                                            <div className="tname"><span className="dot"></span><span className="lbl">Name</span></div>
                                            <div className="tbars">
                                                <span className="lbl">Health</span><span className="lbl">Action</span><span className="lbl">Stamina</span>
                                            </div>
                                            <div className="tatk"><span className="lbl">Attacks</span></div>
                                            <div className="tdel"></div>
                                        </div>

                                        {lines.length === 0 && (
                                            <div className="tempty">Nobody has joined yet. Read the code out and they will appear here.</div>
                                        )}

                                        {lines.map(line => (
                                            <div
                                                className="trow"
                                                key={line.key}
                                                draggable
                                                onDragStart={e => e.dataTransfer.setData("text/plain", line.key)}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => {
                                                    e.preventDefault()
                                                    move(e.dataTransfer.getData("text/plain"), line.key)
                                                }}
                                            >
                                                <span className="grip">&#8942;&#8942;</span>

                                                <input
                                                    type="text"
                                                    className="tinit"
                                                    placeholder="&#8212;"
                                                    value={initBy[line.key] ? String(initBy[line.key]) : ""}
                                                    onChange={e => setInitBy({...initBy, [line.key]: Number(e.target.value) || 0})}
                                                />

                                                <div className="tname">
                                                    <span className={line.npc ? "dot npc" : "dot player"}></span>
                                                    {line.npc && renaming === line.key && (
                                                        <input
                                                            type="text"
                                                            className="cname"
                                                            autoFocus
                                                            value={line.name}
                                                            onChange={e => setCreature(line.key, c => ({...c, name: e.target.value}))}
                                                            onBlur={() => setRenaming("")}
                                                            onKeyDown={e => {if (e.key === "Enter") setRenaming("")}}
                                                        />
                                                    )}
                                                    {line.npc && renaming !== line.key && (
                                                        <>
                                                            <span className="who" onClick={() => setStatblock(line.from ?? line.name)}>{line.name}</span>
                                                            <button type="button" className="pencil" onClick={() => setRenaming(line.key)}>&#9998;</button>
                                                        </>
                                                    )}
                                                    {!line.npc && (
                                                        <span className="who" onClick={() => {
                                                            setViewing(line.name)
                                                            if (line.sheet) loadSnapshot(line.sheet)
                                                        }}>{line.name}</span>
                                                    )}
                                                </div>

                                                <div className="tbars">
                                                    {pool("hp", "HP", line)}
                                                    {pool("ap", "AP", line)}
                                                    {pool("sp", "SP", line)}
                                                </div>

                                                <div className="tatk">
                                                    <button type="button" onClick={() => setAtkBy({...atkBy, [line.key]: Math.max(0, (atkBy[line.key] ?? 0) - 1)})}>&#8722;</button>
                                                    <b>{atkBy[line.key] ?? 0}</b>
                                                    <button type="button" onClick={() => setAtkBy({...atkBy, [line.key]: (atkBy[line.key] ?? 0) + 1})}>+</button>
                                                </div>

                                                <div className="tdel">
                                                    {/* only a creature can be taken off, a player belongs to the room */}
                                                    {line.npc && (
                                                        <button type="button" onClick={() => setCreatures(prev => prev.filter(c => c.id !== line.key))}>&#215;</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button type="button" className="addRow" onClick={() => {
                                        setCreatureSearch("")
                                        setPopout("addCreature")
                                    }}>+ Add Creature</button>

                                    {/* the same trait reference the rules panel has, split
                                        so the gm can reach the creature wording first */}
                                    <div className="actList refList">
                                        <div className="act">
                                            <div className="actHead groupHead npcHead" onClick={() => setOpenActions(openActions.includes("ref npc") ? openActions.filter(n => n !== "ref npc") : [...openActions, "ref npc"])}>
                                                <span>NPC Traits</span>
                                            </div>
                                            {openActions.includes("ref npc") && (
                                                <div className="actGroup">
                                                    <div className="act">
                                                        <div className="actHead" onClick={() => setOpenActions(openActions.includes("ref common") ? openActions.filter(n => n !== "ref common") : [...openActions, "ref common"])}>
                                                            <span>Common Traits</span>
                                                        </div>
                                                        {openActions.includes("ref common") && (
                                                            <>
                                                                <div className="actBody"><p>{npcCommonIntro}</p></div>
                                                                <div className="actGroup">
                                                                    {npcCommonTraits.map(tr => (
                                                                        <div className="act" key={tr.name}>
                                                                            <div className="actHead" onClick={() => setOpenActions(openActions.includes("npct " + tr.name) ? openActions.filter(n => n !== "npct " + tr.name) : [...openActions, "npct " + tr.name])}>
                                                                                <span>{tr.name}</span>
                                                                            </div>
                                                                            {openActions.includes("npct " + tr.name) && (
                                                                                <div className="actBody">
                                                                                    {tr.text.map((para, k) => <p key={k}>{para}</p>)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="act">
                                                        <div className="actHead" onClick={() => setOpenActions(openActions.includes("ref special") ? openActions.filter(n => n !== "ref special") : [...openActions, "ref special"])}>
                                                            <span>Special Traits</span>
                                                        </div>
                                                        {openActions.includes("ref special") && (
                                                            <>
                                                                <div className="actBody"><p>{npcSpecialIntro}</p></div>
                                                                <div className="actGroup">
                                                                    {npcSpecialTraits.map(tr => (
                                                                        <div className="act" key={tr.name}>
                                                                            <div className="actHead" onClick={() => setOpenActions(openActions.includes("npcs " + tr.name) ? openActions.filter(n => n !== "npcs " + tr.name) : [...openActions, "npcs " + tr.name])}>
                                                                                <span>{tr.name}</span>
                                                                            </div>
                                                                            {openActions.includes("npcs " + tr.name) && (
                                                                                <div className="actBody">
                                                                                    {tr.text.map((para, k) => <p key={k}>{para}</p>)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="act">
                                            <div className="actHead groupHead pcHead" onClick={() => setOpenActions(openActions.includes("ref pc") ? openActions.filter(n => n !== "ref pc") : [...openActions, "ref pc"])}>
                                                <span>Player Traits</span>
                                            </div>
                                            {openActions.includes("ref pc") && (
                                                <>
                                                    <div className="actBody">
                                                        {traitIntro.map((block, i) => <p key={i}>{block.text}</p>)}
                                                    </div>
                                                    <div className="actGroup">
                                                        {traitList.map(trait => (
                                                            <div className="act" key={trait.name}>
                                                                <div className="actHead" onClick={() => setOpenActions(openActions.includes("reftrait " + trait.name) ? openActions.filter(n => n !== "reftrait " + trait.name) : [...openActions, "reftrait " + trait.name])}>
                                                                    <span>{trait.name}</span>
                                                                </div>
                                                                {openActions.includes("reftrait " + trait.name) && (
                                                                    <div className="actBody">
                                                                        {trait.text.map((para, k) => <p key={k}>{para}</p>)}
                                                                        {trait.table && (
                                                                            <>
                                                                                <div className="subHead">{trait.table.head}</div>
                                                                                <div className="dtable wide">
                                                                                    <div className="dh">{trait.table.cols[0]}</div>
                                                                                    <div className="dh">{trait.table.cols[1]}</div>
                                                                                    {trait.table.rows.map(row => (
                                                                                        <Fragment key={row[0]}>
                                                                                            <div>{row[0]}</div>
                                                                                            <div>{row[1]}</div>
                                                                                        </Fragment>
                                                                                    ))}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )
                        })()}

                        <button type="button" className="hostRoom" onClick={() => {
                            setRoom("")
                            setRoster([])
                        }}>Leave Room</button>

                        {diceTray}

                        {popout === "ties" && (
                            <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                                <div className="popout">
                                    <div className="pophead">Tied Initiative</div>
                                    <div className="popbody">
                                        {tieLines.map((line, i) => <p key={i}>{line}</p>)}
                                        <p>Please break the tie in whichever way you see fit.</p>
                                    </div>
                                    <div className="popfoot">
                                        <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {popout === "addCreature" && (
                            <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                                <div className="popout big">
                                    <div className="pophead">Add Creature</div>

                                    <div className="searchRow">
                                        <input
                                            type="text"
                                            className="searchBox"
                                            value={creatureSearch}
                                            placeholder="Search"
                                            onChange={e => setCreatureSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="pickList">
                                        {(() => {
                                            const add = (name: string) => {
                                                const id = "c" + Math.random().toString(36).slice(2, 8)
                                                const taken = creatures.map(c => c.name)
                                                const pools = startingPools(name)
                                                setCreatures([...creatures, {
                                                    id: id,
                                                    name: nextCreatureName(name, taken),
                                                    from: name,
                                                    hp: pools.hp, ap: pools.ap, sp: pools.sp,
                                                }])
                                                setOrderKeys([...orderKeys, id])
                                            }

                                            const searching = creatureSearch.trim() !== ""

                                            // with something typed the categories get out of the way and
                                            // every creature that matches is listed on its own
                                            if (searching) {
                                                const hits: {name: string, category: string}[] = []
                                                creatureLibrary.forEach(group => {
                                                    group.members.forEach(name => {
                                                        if (creatureMatches(name, group.category, group.chapter, creatureSearch)) {
                                                            hits.push({name: name, category: group.category})
                                                        }
                                                    })
                                                })
                                                if (hits.length === 0) return <p className="tempty">Nothing matches that.</p>
                                                return hits.map(hit => (
                                                    <button type="button" key={hit.name} className="pickRow" onClick={() => add(hit.name)}>
                                                        <b>{hit.name}</b>
                                                        {hit.category !== hit.name && <span>{hit.category}</span>}
                                                    </button>
                                                ))
                                            }

                                            // with nothing typed the whole book folds down to three
                                            // headings, each one opening to its categories
                                            const chapters: string[] = []
                                            creatureLibrary.forEach(group => {
                                                if (!chapters.includes(group.chapter)) chapters.push(group.chapter)
                                            })

                                            return chapters.map(chapter => {
                                                // open to begin with, since a shut list tells the gm nothing
                                                const shut = openActions.includes("chapShut " + chapter)
                                                return (
                                                    <Fragment key={chapter}>
                                                        <button type="button" className="pickChapter" onClick={() => setOpenActions(shut ? openActions.filter(n => n !== "chapShut " + chapter) : [...openActions, "chapShut " + chapter])}>
                                                            {chapter}
                                                        </button>

                                                        {!shut && creatureLibrary.filter(group => group.chapter === chapter).map(group => {
                                                            // a category holding one creature is that creature, so
                                                            // opening it to show a single name would be a wasted click
                                                            if (group.members.length === 1) {
                                                                return (
                                                                    <button type="button" key={group.category} className="pickRow" onClick={() => add(group.members[0])}>
                                                                        <b>{group.category}</b>
                                                                    </button>
                                                                )
                                                            }
                                                            const open = openActions.includes("cat " + group.category)
                                                            return (
                                                                <div className="pickGroup" key={group.category}>
                                                                    <button type="button" className="pickRow catRow" onClick={() => setOpenActions(open ? openActions.filter(n => n !== "cat " + group.category) : [...openActions, "cat " + group.category])}>
                                                                        <b>{group.category}</b>
                                                                        <span>{group.members.length}</span>
                                                                    </button>
                                                                    {open && group.members.map(name => (
                                                                        <button type="button" key={name} className="pickRow member" onClick={() => add(name)}>
                                                                            <b>{name}</b>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )
                                                        })}
                                                    </Fragment>
                                                )
                                            })
                                        })()}
                                    </div>

                                    <div className="popfoot">
                                        {/* it stays open so a whole pack can go in without reopening it */}
                                        <button type="button" className="go" onClick={() => setPopout(null)}>Done</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>
        )
    }

    if (charInfo) {
        // professions only say which characteristic they use inside their tn text
        const p1Char = String(charInfo.get("Profession 1 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
        const p2Char = String(charInfo.get("Profession 2 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
        const p3Char = String(charInfo.get("Profession 3 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""

        // total enc is just the sum of whatever enc numbers are filled in
        const totalEnc = inventory.reduce((sum, item) => sum + (Number(item.enc) || 0), 0)


        // a pair of lost eyes brings blindness with it. these are worked out fresh every
        // render rather than stored, so giving a part back takes the extra condition away
        // again while one the player added by hand simply stays put
        const partsHit = conditions.filter(c => conditionTypes[c.name].kind === "part").map(c => c.part ?? "")
        const derived: Cond[] = []
        // which traits are on the sheet, by their base name
        const traitsHeld = ttp.map(row => row.name.split("(")[0].trim())

        // a condition the player took off by hand stays off while its cause lasts, and
        // becomes available again only once nothing is asking for it any more
        const stillOwed: string[] = []
        derivedRules.forEach(rule => {
            const owed = rule.when(partsHit, conditions, traitsHeld)
            if (owed) stillOwed.push(rule.gives)
            const already = conditions.some(c => c.name === rule.gives) || derived.some(c => c.name === rule.gives)
            if (owed && !already && !dismissed.includes(rule.gives)) {
                derived.push({name: rule.gives, value: 1, auto: true, why: rule.why})
            }
        })
        const allConditions = [...conditions, ...derived]

        // a dismissal only lasts as long as the thing that caused it, so once nothing
        // is asking for the condition any more the sheet forgets it was ever waved off
        const staleDismissals = dismissed.filter(name => !stillOwed.includes(name))
        if (staleDismissals.length > 0) {
            setTimeout(() => setDismissed(prev => prev.filter(name => !staleDismissals.includes(name))), 0)
        }

        // a condition only writes down the parts it cares about so everything else reads as zero
        const modOf = (which: "testMod" | "csMod" | "magicMod" | "wtMod" | "apMaxMod" | "spMaxMod" | "frenzyMod" | "sbMod") => {
            let total = 0
            allConditions.forEach(c => {
                const fn = conditionTypes[c.name][which]
                if (fn) total += fn(c)
            })
            return total
        }

        const bonusOf = (key: string) => bonusFrom(charInfo, key)

        // an untreated wound is -20 to everything and -2 initiative until it is seen to
        const frenzied = conditions.some(c => c.name === "Frenzied")
        const untreated = wounds.filter(w => !w.treated)
        // the rage makes a character immune to the passive effects of wounds
        const woundTestMod = frenzied ? 0 : untreated.length * -20
        const woundIrMod = frenzied ? 0 : untreated.length * -2

        // the armour penalty splits three ways: one that hits every test, one that hits
        // agility based skills but never combat style, and one only for acrobatics
        const armour = weightClasses[weightClass]
        const agilityMod = armour.agility
        const acrobaticsMod = armour.acrobatics

        const testMod = modOf("testMod") + woundTestMod + armour.all
        const csMod = modOf("csMod")
        const magicMod = modOf("magicMod")
        const wtMod = modOf("wtMod")
        const apMaxMod = modOf("apMaxMod")
        const spMaxMod = modOf("spMaxMod")
        const frenzyMod = modOf("frenzyMod")
        const sbMod = modOf("sbMod")
        const halfSpeed = allConditions.some(c => conditionTypes[c.name].halfSpeed?.(c) === true)
        const zeroSpeed = allConditions.some(c => conditionTypes[c.name].zeroSpeed?.(c) === true)

        // a character never drops below one action point no matter how dazed they are
        const shownApMax = Math.max(1, Number(charInfo.get("Max AP") ?? 0) + apMaxMod)
        const shownSpMax = Math.max(0, Number(charInfo.get("Max SP") ?? 0) + spMaxMod)
        const baseSpeed = Number(charInfo.get("Current Speed"))
        const shownSpeed = (zeroSpeed || armour.still) ? "0"
            : halfSpeed && !isNaN(baseSpeed) ? String(Math.max(0, Math.ceil(baseSpeed / 2) + armour.speed))
                : !isNaN(baseSpeed) ? String(Math.max(0, baseSpeed + armour.speed))
                    : String(charInfo.get("Current Speed") ?? "")

        // an ear or eye wound needs a side, everything else already names its part
        const woundTarget = woundPart === "Head (Ear)" ? (woundSide === "" ? "Head" : woundSide + " Ear")
            : woundPart === "Head (Eye)" ? (woundSide === "" ? "Head" : woundSide + " Eye")
                : woundPart

        const needsSide = woundPart === "Head (Ear)" || woundPart === "Head (Eye)"
        const isHead = needsSide
        const isBody = woundPart === "Body"

        // writes the wound down and applies everything the shock test decided
        const applyWound = (magicType: string) => {
            const added: Cond[] = []
            const said: string[] = []
            const next = new Map(charInfo)

            if (isBody) {
                // a body wound costs an action point, or one off the next round if there are none
                const ap = Number(next.get("Current AP")) || 0
                if (ap > 0) {
                    next.set("Current AP", String(ap - 1))
                    said.push("You suffered a wound to the Body and lose an Action Point.")
                } else {
                    said.push("You suffered a wound to the Body. You have no Action Points left, so you begin the next round with one less.")
                }
                if (!woundShockPassed) {
                    added.push({name: "Crippled", part: "Body"})
                    said.push("Since you failed your Shock Test, you are also suffering from the Crippled (Body) condition, which is organ damage.")
                }
            } else if (isHead) {
                // a blow to the head stuns instead of crippling
                said.push("You suffered a wound to the " + woundTarget + " and are stunned for 1 round.")
                if (frenzied) {
                    said.push("The blow would stun you, but the rage carries you through it.")
                } else if (!conditions.some(c => c.name === "Stunned")) {
                    added.push({name: "Stunned", rounds: 1})
                    next.set("Current AP", "0")
                }
                if (!woundShockPassed) {
                    added.push({name: "Lost", part: woundTarget})
                    said.push("Since you failed your Shock Test, you are also suffering from the Lost (" + woundTarget + ") condition.")
                }
            } else {
                added.push({name: "Crippled", part: woundTarget})
                said.push("You suffered a wound on your " + woundTarget + " and are now suffering from the Crippled (" + woundTarget + ") condition.")
                if (!woundShockPassed) {
                    added.push({name: "Lost", part: woundTarget})
                    said.push("Since you failed your Shock Test, you are also suffering from the Lost (" + woundTarget + ") condition.")
                }
            }

            if (magicType === "Fire") {
                said.push("Since the damage was inflicted with Fire magic, you must make a Strength or Agility test, or gain the Burning (1) condition. Did you pass the test?")
            } else if (magicType === "Magic, Frost, or Poison") {
                const sp = Number(next.get("Current SP")) || 0
                next.set("Current SP", String(sp - 1))
                said.push("Since the damage included magic, frost or poison, you also lose a Stamina point.")
            } else if (magicType === "Shock") {
                said.push("Since the damage included shock, you also lose Magicka points equal to the damage inflicted. Take those off by hand, since the sheet was never told how much the hit was for.")
            }

            said.push("Until this wound is fully healed you take -20 to all tests and -2 to future initiative rolls, and you have 5 rounds before blood loss drops you to 0 HP.")

            // the wound itself is written down with its own five round clock
            setWounds([...wounds, {part: woundTarget, treated: false, rounds: 5, damage: Number(woundDamage) || 0, healed: 0, caused: []}])

            // a part can only be crippled or lost once, so drop any that are already there
            const parts = conditions.filter(c => conditionTypes[c.name].kind === "part").map(c => c.part)
            const fresh = added.filter(c => !c.part || !parts.includes(c.part))

            setCharInfo(next)
            setConditions(prev => [...prev, ...fresh])
            // note what this wound caused, since curing it should undo the same things
            setWounds(list => list.map((w, i) => i === list.length - 1 ? {...w, caused: fresh.map(c => ({name: c.name, part: c.part}))} : w))
            setWoundLines(said)
            setPopout(magicType === "Fire" ? "woundFire" : "woundDone")
        }

        // curing or removing a wound takes its effects with it, but a lost limb
        // cannot be healed this way so it stays
        const clearWound = (i: number) => {
            const gone = wounds[i]
            setWounds(list => list.filter((_w, j) => j !== i))
            const undo = (gone.caused ?? []).filter(c => c.name !== "Lost")
            if (undo.length > 0) {
                setConditions(prev => prev.filter(c => !undo.some(u => u.name === c.name && u.part === c.part)))
            }
        }

        // adding a condition anywhere goes through here so its arrival is handled once
        // the rage also makes a character immune to stunning and to fear
        const addCondition = (name: string, rounds?: number) => {
            if (conditions.some(c => c.name === name)) return
            if (frenzied && (name === "Stunned" || name === "Fear" || name === "Horror")) {
                setShrugged(name)
                setPopout("shrugged")
                return
            }
            const fresh: Cond = {name: name, value: 1, fresh: name === "Bleeding"}
            if (rounds !== undefined) fresh.rounds = rounds
            setConditions(prev => [...prev, fresh])
            // being stunned costs whatever action points are left the moment it lands
            if (conditionTypes[name].onApply === "zeroAp") {
                setCharInfo(prev => new Map(prev).set("Current AP", "0"))
            }
            // the rage grants a stamina point that is allowed to sit above the maximum
            if (conditionTypes[name].onApply === "gainSp") {
                setCharInfo(prev => new Map(prev).set("Current SP", String(Number(prev?.get("Current SP") ?? 0) + 1)))
            }
        }

        // each roll leaves its own mix of conditions, lost stamina and follow up rolls
        const applyFear = (row: {name: string}, num: number, choice: string) => {
            if (frenzied) {
                setShrugged(fearKind)
                setPopout("shrugged")
                return
            }
            const next = new Map(charInfo)
            const add: Cond[] = []
            const said: string[] = []

            const loseSp = (amount: number, why: string) => {
                if (amount <= 0) return
                next.set("Current SP", String((Number(next.get("Current SP")) || 0) - amount))
                said.push("You lose " + amount + " Stamina " + (amount === 1 ? "point" : "points") + " " + why + ".")
            }

            // every roll leaves the one Fear condition, named for whichever result it was
            add.push({name: fearKind, result: row.name})

            if (row.name === "Startled") {
                said.push("You may not make any reactions until the beginning of your next Turn.")
            } else if (row.name === "Spooked") {
                said.push("You take -10 to all tests for the rest of the encounter, unless you snap out of it.")
            } else if (row.name === "Frightened") {
                said.push("You take -10 to all tests until the end of the encounter and cannot willingly approach the object of your fear.")
            } else if (row.name === "Lost Composure") {
                said.push("You may take no actions until you snap out of it. Use Snap Out on the card when you pass a Willpower test, and you will still make all tests at -10 for the rest of the encounter.")
            } else if (row.name === "Running and Screaming") {
                said.push("You flee directly away from your fear as fast as you can, ditching anything that slows you down, at -20 to all tests. You must snap out of it to regain control, or the encounter must end.")
            } else if (row.name === "Momentary Blackout") {
                add.push({name: "Unconscious", rounds: 1})
                said.push("You drop to the ground unconscious for 1 round, then carry a -10 penalty to all actions for the rest of the encounter.")
            } else if (row.name === "Uncontrollable Vomiting") {
                loseSp(1, "from the nausea afterwards")
                said.push("You bend over and vomit for 1 round, helpless while it lasts.")
            } else if (row.name === "Manic Terror") {
                loseSp(num, "once the rampage ends")
                said.push("You attack the closest friend or foe with whatever is in your hands. You may try to snap out of it at the start of your first Turn each round, or be knocked unconscious to stop it.")
            } else if (row.name === "Hopeless and Despairing") {
                said.push("You fall to the ground babbling for " + (num > 0 ? num : 1) + " rounds, shutting out all other sounds.")
                said.push("When the rounds run out you lose 1d4 Stamina. Take that off by hand, since it is rolled after the fact.")
            } else if (row.name === "Blackout") {
                said.push("You go catatonic for " + (num > 0 ? num : 1) + " hours and cannot be roused by normal means. The card has no clock on it since the sheet counts rounds, not hours.")
            } else if (row.name === "Mind Break") {
                const key = choice === "Personality" ? "Prs" : "Wp"
                const drop = Number(fearNum2) || 0
                said.push("You drop to the ground stuttering for " + (num > 0 ? num : 1) + " rounds.")
                if (drop > 0) {
                    next.set(key, String((Number(next.get(key)) || 0) - drop))
                    said.push("Your " + choice + " falls permanently by " + drop + ", from " + (Number(charInfo.get(key)) || 0) + " to " + ((Number(charInfo.get(key)) || 0) - drop) + ".")
                }
                said.push("Afterwards you cannot attack or approach the source of the horror until you snap out of it or the encounter ends.")
            } else if (row.name === "Scared to Death") {
                if (choice === "died") {
                    add.length = 0
                    next.set("Current HP", "0")
                    said.push("Your heart stops. The character dies on the spot.")
                } else {
                    add.length = 0
                    add.push({name: "Horror", result: "Blackout"})
                    said.push("Your heart holds. You instead fall catatonic for 1d4 hours as with Blackout.")
                }
            }

            // a few results run for a set number of rounds
            const clocks: Record<string, number> = {
                "Startled": 1,
                "Uncontrollable Vomiting": 1,
                "Hopeless and Despairing": num > 0 ? num : 1,
                "Mind Break": num > 0 ? num : 1,
            }
            if (clocks[row.name] !== undefined) {
                add.forEach(a => {
                    if (a.name === fearKind) a.rounds = clocks[row.name]
                })
            }

            setCharInfo(next)
            setConditions(prev => [...prev, ...add.filter(a => !prev.some(p => p.name === a.name && p.result === a.result))])
            setRecap(said)
            setPopout("fearDone")
        }

        const nameOf = (c: Cond) => {
            const type = conditionTypes[c.name]
            if (type.label) return type.label(c)
            if (type.kind === "fear") return c.name + " - " + c.result
            if (type.kind === "part") return c.name + " (" + c.part + ")"
            if (type.kind === "value") return c.name + " (" + c.value + ")"
            return c.name
        }

        const detailOf = (c: Cond) => {
            if (c.auto) return "automatic"
            const type = conditionTypes[c.name]
            return type.detail ? type.detail(c) : ""
        }

        // spending an ap, refusing when there is none left
        const spendAp = () => {
            if (Number(charInfo.get("Current AP")) <= 0) {
                setPopout("noAp")
                return
            }
            setCharInfo(new Map(charInfo).set("Current AP", String(Number(charInfo.get("Current AP")) - 1)))
        }

        // tops a pool up but never past its maximum and says how much actually went in
        const topUp = (map: CharInfo, curKey: string, maxKey: string, amount: number) => {
            const cur = Number(map.get(curKey)) || 0
            const max = Number(map.get(maxKey)) || 0
            const gain = Math.max(0, Math.min(amount, max - cur))
            map.set(curKey, String(cur + gain))
            return gain
        }

        // drops fatigue levels and says how many it managed to drop
        const dropFatigue = (levels: number) => {
            const f = conditions.find(c => c.name === "Fatigued")
            if (!f || levels <= 0) return 0
            const dropped = Math.min(levels, f.value ?? 1)
            if ((f.value ?? 1) - dropped <= 0) setConditions(prev => prev.filter(c => c.name !== "Fatigued"))
            else setConditions(prev => prev.map(c => c.name === "Fatigued" ? {...c, value: (c.value ?? 1) - dropped} : c))
            return dropped
        }

        const doShortRest = (pick: string) => {
            const next = new Map(charInfo)
            const lines: string[] = []

            // magicka comes back either way, just drop the ones place off the maximum
            const mp = topUp(next, "Current MP", "Max MP", Math.floor((Number(next.get("Max MP")) || 0) / 10))
            lines.push(mp > 0 ? "Recovered " + mp + " Magicka Points." : "Magicka Points were already full.")

            if (pick === "stamina") {
                const sp = topUp(next, "Current SP", "Max SP", 1)
                lines.push(sp > 0 ? "Recovered 1 Stamina Point." : "Stamina Points were already full.")
            } else {
                const dropped = dropFatigue(1)
                lines.push(dropped > 0 ? "Removed 1 level of fatigue." : "There was no fatigue to remove.")
            }

            setCharInfo(next)
            setRestLines(lines)
        }

        const doLongRest = (focused: boolean) => {
            const next = new Map(charInfo)
            const lines: string[] = []
            const eb = Number(charInfo.get("EB")) || 0

            // fatigue clears first and whatever endurance is left over goes into stamina
            const dropped = dropFatigue(eb)
            if (dropped > 0) lines.push("Removed " + dropped + " level" + (dropped === 1 ? "" : "s") + " of fatigue.")
            const spare = eb - dropped
            if (spare > 0) {
                const sp = topUp(next, "Current SP", "Max SP", spare)
                lines.push(sp > 0 ? "Recovered " + sp + " Stamina Points." : "Stamina Points were already full.")
            }

            let heal = focused ? eb * 2 : eb
            const organs = allConditions.some(c => conditionTypes[c.name].kind === "part" && partInfo[c.part ?? ""].halfHealing)
            if (organs) heal = Math.floor(heal / 2)

            let healed = 0
            if (wounds.some(w => !w.treated)) {
                lines.push("No Hit Points healed, the character still has untreated wounds.")
            } else {
                healed = heal
                const hp = topUp(next, "Current HP", "Max HP", heal)
                lines.push(hp > 0 ? "Healed " + hp + " Hit Points" + (focused ? " (natural healing doubled)" : "") + (organs ? " (halved by organ damage)" : "") + "." : "Hit Points were already full.")
            }

            // a treated wound cures itself once it has been healed for what it cost
            if (healed > 0) {
                const healedWounds: Wound[] = []
                wounds.forEach(w => {
                    if (!w.treated) {
                        healedWounds.push(w)
                        return
                    }
                    const total = w.healed + healed
                    // a wound with no damage written down has to be cured by hand
                    if (w.damage > 0 && total >= w.damage) {
                        lines.push("The wound on your " + w.part + " has healed and is cured.")
                        const undo = (w.caused ?? []).filter(c => c.name !== "Lost")
                        if (undo.length > 0) {
                            setConditions(prev => prev.filter(c => !undo.some(u => u.name === c.name && u.part === c.part)))
                            lines.push("Its effects have lifted, though anything lost outright stays lost.")
                        }
                        return
                    }
                    if (w.damage > 0) lines.push("The wound on your " + w.part + " has healed " + total + " of the " + w.damage + " it needs to cure.")
                    healedWounds.push({...w, healed: total})
                })
                setWounds(healedWounds)
            }

            // any hp regained comes straight off the bleeding value, overheal included
            const bleed = conditions.find(c => c.name === "Bleeding")
            if (healed > 0 && bleed) {
                if ((bleed.value ?? 0) - healed <= 0) {
                    setConditions(prev => prev.filter(c => c.name !== "Bleeding"))
                    lines.push("The bleeding has stopped.")
                } else {
                    setConditions(prev => prev.map(c => c.name === "Bleeding" ? {...c, value: (c.value ?? 0) - healed} : c))
                    lines.push("Bleeding reduced to " + ((bleed.value ?? 0) - healed) + ".")
                }
            }

            const mp = topUp(next, "Current MP", "Max MP", 9999)
            lines.push(mp > 0 ? "Recovered " + mp + " Magicka Points, back to full." : "Magicka Points were already full.")
            lines.push("Remember that many powers also recharge now.")

            setCharInfo(next)
            setRestLines(lines)
        }

        // the spell cards are built once here since the same cards show in narrative and combat
        const spellCards = spells.map((spell, i) => (
            <div className="spellCard" key={i}>
                <div className="sphead">
                    <b><input type="text" value={spell.name} onChange={e => setSpells(spells.map((old, j) => j === i ? {...old, name: e.target.value} : old))}/></b>
                    <span><input type="text" value={spell.attr} onChange={e => setSpells(spells.map((old, j) => j === i ? {...old, attr: e.target.value} : old))}/></span>
                    <div className="spTools">
                        <button type="button" className="addLevel" onClick={() => setSpells(spells.map((old, j) => j === i ? {...old, levels: [...old.levels, {lvl: "", cost: "", str: ""}]} : old))}>+ level</button>
                        <button type="button" className="subLevel" onClick={() => setSpells(spells.map((old, j) => j === i && old.levels.length > 1 ? {...old, levels: old.levels.slice(0, -1)} : old))}>&#8722; level</button>
                        <button type="button" className="delSpell" onClick={() => setSpells(spells.filter((_old, j) => j !== i))}>&#215;</button>
                    </div>
                </div>
                <div className="lvlGrid" style={{gridTemplateColumns: "max-content repeat(" + spell.levels.length + ",minmax(3em,1fr))"}}>
                    <div className="lh">Level</div>
                    {spell.levels.map((level, k) => (
                        <div key={k}><input type="text" value={level.lvl} onChange={e => setSpells(spells.map((old, j) => j === i ? {...old, levels: old.levels.map((l, m) => m === k ? {...l, lvl: e.target.value} : l)} : old))}/></div>
                    ))}
                    <div className="lh">Cost</div>
                    {spell.levels.map((level, k) => (
                        <div key={k}><input type="text" value={level.cost} onChange={e => setSpells(spells.map((old, j) => j === i ? {...old, levels: old.levels.map((l, m) => m === k ? {...l, cost: e.target.value} : l)} : old))}/></div>
                    ))}
                    <div className="lh">Spell Str.</div>
                    {spell.levels.map((level, k) => (
                        <div key={k}><input type="text" value={level.str} onChange={e => setSpells(spells.map((old, j) => j === i ? {...old, levels: old.levels.map((l, m) => m === k ? {...l, str: e.target.value} : l)} : old))}/></div>
                    ))}
                </div>
                <div className="spdescRow">
                    <textarea rows={1} value={spell.desc} onChange={e => setSpells(spells.map((old, j) => j === i ? {...old, desc: e.target.value} : old))}/>
                </div>
            </div>
        ))

        // same idea for the magic skills table with spec and rituals in a side column
        const spellSkills = (
            <div className="spSkillsBand">
                <div className="stable">
                    <div className="srow head">
                        <div>Skill</div><div>Rank</div><div>Bonus</div><div>Target Numbers</div>
                    </div>
                    <div className="srow">
                        <div className="sname">Alteration</div>
                        <div className="rankCell"><select value={String(charInfo.get("Alteration Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Alteration", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                        <div>{charInfo.get("Alteration Rank") ? String(charInfo.get("Alteration Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Alteration Rank") ? Number(charInfo.get("Alteration Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Conjuration</div>
                        <div className="rankCell"><select value={String(charInfo.get("Conjuration Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Conjuration", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                        <div>{charInfo.get("Conjuration Rank") ? String(charInfo.get("Conjuration Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Conjuration Rank") ? Number(charInfo.get("Conjuration Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Destruction</div>
                        <div className="rankCell"><select value={String(charInfo.get("Destruction Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Destruction", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                        <div>{charInfo.get("Destruction Rank") ? String(charInfo.get("Destruction Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Destruction Rank") ? Number(charInfo.get("Destruction Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Illusion</div>
                        <div className="rankCell"><select value={String(charInfo.get("Illusion Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Illusion", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                        <div>{charInfo.get("Illusion Rank") ? String(charInfo.get("Illusion Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Intelligence <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Illusion Rank") ? Number(charInfo.get("Illusion Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Mysticism</div>
                        <div className="rankCell"><select value={String(charInfo.get("Mysticism Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Mysticism", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                        <div>{charInfo.get("Mysticism Rank") ? String(charInfo.get("Mysticism Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Mysticism Rank") ? Number(charInfo.get("Mysticism Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Necromancy</div>
                        <div className="rankCell"><select value={String(charInfo.get("Necromancy Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Necromancy", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                        <div>{charInfo.get("Necromancy Rank") ? String(charInfo.get("Necromancy Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Intelligence <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Necromancy Rank") ? Number(charInfo.get("Necromancy Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Restoration</div>
                        <div className="rankCell"><select value={String(charInfo.get("Restoration Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Restoration", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                        <div>{charInfo.get("Restoration Rank") ? String(charInfo.get("Restoration Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Restoration Rank") ? Number(charInfo.get("Restoration Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                </div>

                <div className="spSide">
                    {specializations.length > 0 && (
                        <>
                            <h3>Specializations</h3>
                            <div className="bonds">
                                {specializations.map((spec, i) => (
                                    <div className="band val" key={i}>
                                        <input
                                            type="text"
                                            value={spec}
                                            onChange={e => setSpecializations(specializations.map((old, j) => j === i ? e.target.value : old))}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    const copy = [...specializations]
                                                    copy.splice(i + 1, 0, "")
                                                    setSpecializations(copy)
                                                }
                                                if (e.key === "Backspace" && spec === "" && specializations.length > 1) {
                                                    e.preventDefault()
                                                    setSpecializations(specializations.filter((_old, j) => j !== i))
                                                }
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {rituals.length > 0 && (
                        <>
                            <h3>Rituals</h3>
                            <div className="bonds">
                                {rituals.map((rit, i) => (
                                    <div className="band val" key={i}>
                                        <input
                                            type="text"
                                            value={rit}
                                            onChange={e => setRituals(rituals.map((old, j) => j === i ? e.target.value : old))}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    const copy = [...rituals]
                                                    copy.splice(i + 1, 0, "")
                                                    setRituals(copy)
                                                }
                                                if (e.key === "Backspace" && rit === "" && rituals.length > 1) {
                                                    e.preventDefault()
                                                    setRituals(rituals.filter((_old, j) => j !== i))
                                                }
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )

        // the whole spellcasting panel shows in both modes so build it once
        const spellPanel = (
            <>
                <h2>Spellcasting</h2>

                {spellSkills}

                <h3>Spells</h3>

                <div className="spellGrid">
                    {spellCards}
                </div>

                <button type="button" className="addSpell" onClick={() => setSpells([...spells, {name: "", attr: "", desc: "", levels: [{lvl: "", cost: "", str: ""}]}])}>+ add spell</button>
            </>
        )

        // ttp shows in both modes too
        const ttpPanel = (
            <>
                <h2>Traits, Talents &amp; Powers</h2>

                <div className="ttp">
                    <div className="ttpRow head"><div>Name</div><div>Description</div></div>
                    {ttp.map((trait, i) => (
                        <div className="ttpRow" key={i}>
                            <div className="tname">
                                <textarea
                                    className="tnameBox"
                                    rows={1}
                                    value={trait.name}
                                    onChange={e => setTtp(ttp.map((old, j) => j === i ? {...old, name: e.target.value} : old))}
                                    onKeyDown={e => {
                                        // a title has no use for a line break, so enter still starts a row
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            const copy = [...ttp]
                                            copy.splice(i + 1, 0, {name: "", note: ""})
                                            setTtp(copy)
                                            setTimeout(() => {
                                                const names = document.querySelectorAll<HTMLTextAreaElement>("#center .ttp .tnameBox")
                                                names[i + 1]?.focus()
                                            }, 0)
                                        }
                                        if (e.key === "Backspace" && trait.name === "" && trait.note === "" && ttp.length > 1) {
                                            e.preventDefault()
                                            setTtp(ttp.filter((_old, j) => j !== i))
                                            setTimeout(() => {
                                                const names = document.querySelectorAll<HTMLTextAreaElement>("#center .ttp .tnameBox")
                                                names[i - 1]?.focus()
                                            }, 0)
                                        }
                                    }}
                                />
                            </div>
                            <div className="tnote">
                                <textarea
                                    className="tnoteBox"
                                    rows={1}
                                    value={trait.note}
                                    onChange={e => setTtp(ttp.map((old, j) => j === i ? {...old, note: e.target.value} : old))}
                                    onKeyDown={e => {
                                        // a long description reads over as many lines as it needs, so plain
                                        // enter just grows the box and shift enter is what starts a new row
                                        if (e.key === "Enter" && e.shiftKey) {
                                            e.preventDefault()
                                            const copy = [...ttp]
                                            copy.splice(i + 1, 0, {name: "", note: ""})
                                            setTtp(copy)
                                            setTimeout(() => {
                                                const names = document.querySelectorAll<HTMLTextAreaElement>("#center .ttp .tnameBox")
                                                names[i + 1]?.focus()
                                            }, 0)
                                        }
                                        // and only clears the row when there is nothing in either box
                                        if (e.key === "Backspace" && trait.name === "" && trait.note === "" && ttp.length > 1) {
                                            e.preventDefault()
                                            setTtp(ttp.filter((_old, j) => j !== i))
                                            setTimeout(() => {
                                                const notes = document.querySelectorAll<HTMLTextAreaElement>("#center .ttp .tnoteBox")
                                                notes[i - 1]?.focus()
                                            }, 0)
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <button type="button" className="addRow" onClick={() => setPopout("addTtp")}>+ Add</button>
            </>
        )

        return (
            <section id='center' className={viewing !== "" ? "viewOnly" : ""}>
                <div className="nameRow">
                    <div className="upload">
                        <button type="button" className="newChar" onClick={() => setPopout("newChar")}>Upload New Character</button>
                        <button type="button" className="savePdf" onClick={downloadPdf}>Download PDF</button>
                    </div>
                    <h1>{charInfo.get("Name")}</h1>
                    {viewing !== "" && (
                        <div className="rests backOnly">
                            <button type="button" className="backToList" onClick={stopViewing}>Back to Characters</button>
                        </div>
                    )}
                    <div className="rests">
                        <button type="button" className="shortRest" onClick={() => {setRestLines(null); setPopout("shortRest")}}>Short Rest</button>
                        <button type="button" className="longRest" onClick={() => {setRestLines(null); setPopout("longRest")}}>Long Rest</button>
                    </div>
                </div>

                <div className="top">
                    <div className="tile">
                        <div className="band head">Race</div>
                        <div className="band val"><input type="text" id="race" value={String(charInfo.get("Race") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Race", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Size</div>
                        <div className="band val"><input type="text" id="size" value={String(charInfo.get("Size") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Size", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Birthsign</div>
                        <div className="band val"><input type="text" id="birthsign" value={String(charInfo.get("Birthsign") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Birthsign", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Elite Advance</div>
                        <div className="band val"><input type="text" id="elite" value={String(charInfo.get("Elite Adv") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Elite Adv", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Experience / Total</div>
                        <div className="band val">
                            <input type="text" className="pair" id="xp" value={String(charInfo.get("Current XP") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Current XP", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Current XP") ?? ""), v => setCharInfo(new Map(charInfo).set("Current XP", v)))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="xpTotal" value={String(charInfo.get("Total XP") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Total XP", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Total XP") ?? ""), v => setCharInfo(new Map(charInfo).set("Total XP", v)))}/>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Lucky Numbers</div>
                        <div className="band val"><input type="text" id="lucky" value={String(charInfo.get("Lucky Numbers") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Lucky Numbers", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Unlucky Numbers</div>
                        <div className="band val"><input type="text" id="unlucky" value={String(charInfo.get("Unlucky Numbers") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Unlucky Numbers", e.target.value))}/></div>
                    </div>
                </div>

                <h2>Characteristics</h2>

                <div className="charsBand">

                    <div className="charsWrap">
                        <div className="cblock">
                            <div className="crow head">
                                <div className="rl"></div>
                                <div>Strength</div><div>Endurance</div><div>Agility</div><div>Intelligence</div>
                                <div>Willpower</div><div>Perception</div><div>Personality</div><div>Luck</div>
                            </div>
                            <div className="crow">
                                <div className="rl">Score</div>
                                <div><input type="text" id="str" value={String(charInfo.get("Str") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "Str", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Str") ?? ""), v => setCharInfo(withCharChange(charInfo, "Str", v)))}/></div>
                                <div><input type="text" id="end" value={String(charInfo.get("End") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "End", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("End") ?? ""), v => setCharInfo(withCharChange(charInfo, "End", v)))}/></div>
                                <div><input type="text" id="ag" value={String(charInfo.get("Ag") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "Ag", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Ag") ?? ""), v => setCharInfo(withCharChange(charInfo, "Ag", v)))}/></div>
                                <div><input type="text" id="int" value={String(charInfo.get("Int") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "Int", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Int") ?? ""), v => setCharInfo(withCharChange(charInfo, "Int", v)))}/></div>
                                <div><input type="text" id="wp" value={String(charInfo.get("Wp") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "Wp", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Wp") ?? ""), v => setCharInfo(withCharChange(charInfo, "Wp", v)))}/></div>
                                <div><input type="text" id="prc" value={String(charInfo.get("Prc") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "Prc", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Prc") ?? ""), v => setCharInfo(withCharChange(charInfo, "Prc", v)))}/></div>
                                <div><input type="text" id="prs" value={String(charInfo.get("Prs") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "Prs", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Prs") ?? ""), v => setCharInfo(withCharChange(charInfo, "Prs", v)))}/></div>
                                <div><input type="text" id="lck" value={String(charInfo.get("Lck") ?? "")} onChange={e => setCharInfo(withCharChange(charInfo, "Lck", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Lck") ?? ""), v => setCharInfo(withCharChange(charInfo, "Lck", v)))}/></div>
                            </div>
                            <div className="crow">
                                <div className="rl">Favored</div>
                                <label className="check"><input type="checkbox" id="favStr" checked={!!charInfo.get("Str Favored")} onChange={e => setCharInfo(new Map(charInfo).set("Str Favored", e.target.checked))}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favEnd" checked={!!charInfo.get("End Favored")} onChange={e => setCharInfo(new Map(charInfo).set("End Favored", e.target.checked))}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favAg" checked={!!charInfo.get("Ag Favored")} onChange={e => setCharInfo(new Map(charInfo).set("Ag Favored", e.target.checked))}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favInt" checked={!!charInfo.get("Int Favored")} onChange={e => setCharInfo(new Map(charInfo).set("Int Favored", e.target.checked))}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favWp" checked={!!charInfo.get("Wp Favored")} onChange={e => setCharInfo(new Map(charInfo).set("Wp Favored", e.target.checked))}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favPrc" checked={!!charInfo.get("Prc Favored")} onChange={e => setCharInfo(new Map(charInfo).set("Prc Favored", e.target.checked))}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favPrs" checked={!!charInfo.get("Prs Favored")} onChange={e => setCharInfo(new Map(charInfo).set("Prs Favored", e.target.checked))}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favLck" checked={!!charInfo.get("Lck Favored")} onChange={e => setCharInfo(new Map(charInfo).set("Lck Favored", e.target.checked))}/><span>&#10003;</span></label>
                            </div>
                            <div className="crow">
                                <div className="rl">Bonus</div>
                                <div><input type="text" id="sb" className={sbMod !== 0 ? "modded" : ""} value={String(bonusOf("Str") + sbMod)} readOnly/></div>
                                <div><input type="text" id="eb" value={String(bonusOf("End"))} readOnly/></div>
                                <div><input type="text" id="ab" value={String(bonusOf("Ag"))} readOnly/></div>
                                <div><input type="text" id="ib" value={String(bonusOf("Int"))} readOnly/></div>
                                <div><input type="text" id="wb" value={String(bonusOf("Wp"))} readOnly/></div>
                                <div><input type="text" id="pcb" value={String(bonusOf("Prc"))} readOnly/></div>
                                <div><input type="text" id="psb" value={String(bonusOf("Prs"))} readOnly/></div>
                                <div><input type="text" id="lb" value={String(bonusOf("Lck"))} readOnly/></div>
                            </div>
                        </div>
                    </div>

                    <div className="langs">
                        <div className="langsInner">
                            <div className="band head">Languages</div>
                            {languages.map((lang, i) => (
                                <div className="band val" key={i}>
                                    <input
                                        type="text"
                                        value={lang}
                                        onChange={e => setLanguages(languages.map((old, j) => j === i ? e.target.value : old))}
                                        onKeyDown={e => {
                                            // enter puts a blank row underneath this one
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                const copy = [...languages]
                                                copy.splice(i + 1, 0, "")
                                                setLanguages(copy)
                                                // the new row does not exist yet so wait a tick before focusing it
                                                setTimeout(() => {
                                                    const rows = document.querySelectorAll<HTMLInputElement>("#center .langs input")
                                                    rows[i + 1]?.focus()
                                                }, 0)
                                            }
                                            // backspace on an empty row deletes it again
                                            if (e.key === "Backspace" && lang === "" && languages.length > 1) {
                                                e.preventDefault()
                                                setLanguages(languages.filter((_old, j) => j !== i))
                                                setTimeout(() => {
                                                    const rows = document.querySelectorAll<HTMLInputElement>("#center .langs input")
                                                    rows[i - 1]?.focus()
                                                }, 0)
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                <h2>Attributes</h2>

                <div className="attrs">
                    <div className="tile">
                        <div className="band head">Hit Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="hp"
                                   value={String(charInfo.get("Current HP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current HP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Current HP") ?? ""), v => setCharInfo(new Map(charInfo).set("Current HP", v)), Number(charInfo.get("Max HP")) || undefined)}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="hpMax"
                                   value={String(charInfo.get("Max HP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max HP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Max HP") ?? ""), v => setCharInfo(new Map(charInfo).set("Max HP", v)))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.max(0, Math.min(100, 100 * Number(charInfo.get("Current HP")) / Number(charInfo.get("Max HP")) || 0)) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Magicka Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="mp"
                                   value={String(charInfo.get("Current MP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current MP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Current MP") ?? ""), v => setCharInfo(new Map(charInfo).set("Current MP", v)), Number(charInfo.get("Max MP")) || undefined)}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="mpMax"
                                   value={String(charInfo.get("Max MP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max MP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Max MP") ?? ""), v => setCharInfo(new Map(charInfo).set("Max MP", v)))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.max(0, Math.min(100, 100 * Number(charInfo.get("Current MP")) / Number(charInfo.get("Max MP")) || 0)) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Stamina Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="sp"
                                   value={String(charInfo.get("Current SP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current SP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Current SP") ?? ""), v => setCharInfo(new Map(charInfo).set("Current SP", v)), Number(charInfo.get("Max SP")) || undefined)}/>
                            <span className="sep">/</span>
                            <input type="text" className={spMaxMod !== 0 ? "pair modded" : "pair"} id="spMax"
                                   value={String(shownSpMax)}
                                   readOnly={spMaxMod !== 0}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max SP", e.target.value))}
                                   onKeyDown={spMaxMod !== 0 ? undefined : numberArrows(String(charInfo.get("Max SP") ?? ""), v => setCharInfo(new Map(charInfo).set("Max SP", v)))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.max(0, Math.min(100, 100 * Number(charInfo.get("Current SP")) / shownSpMax || 0)) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Luck Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="lp"
                                   value={String(charInfo.get("Current LP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current LP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Current LP") ?? ""), v => setCharInfo(new Map(charInfo).set("Current LP", v)), Number(charInfo.get("Max LP")) || undefined)}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="lpMax"
                                   value={String(charInfo.get("Max LP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max LP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Max LP") ?? ""), v => setCharInfo(new Map(charInfo).set("Max LP", v)))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.max(0, Math.min(100, 100 * Number(charInfo.get("Current LP")) / Number(charInfo.get("Max LP")) || 0)) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Action Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="ap"
                                   value={String(charInfo.get("Current AP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current AP", e.target.value))}
                                   onKeyDown={numberArrows(String(charInfo.get("Current AP") ?? ""), v => setCharInfo(new Map(charInfo).set("Current AP", v)), Number(charInfo.get("Max AP")) || undefined)}/>
                            <span className="sep">/</span>
                            <input type="text" className={apMaxMod !== 0 ? "pair modded" : "pair"} id="apMax"
                                   value={String(shownApMax)}
                                   readOnly={apMaxMod !== 0}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max AP", e.target.value))}
                                   onKeyDown={apMaxMod !== 0 ? undefined : numberArrows(String(charInfo.get("Max AP") ?? ""), v => setCharInfo(new Map(charInfo).set("Max AP", v)))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.max(0, Math.min(100, 100 * Number(charInfo.get("Current AP")) / shownApMax || 0)) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Speed</div>
                        <div className="band val">
                            <input type="text" className={halfSpeed || zeroSpeed || armour.speed !== 0 || armour.still ? "pair modded" : "pair"} id="speed"
                                   value={shownSpeed}
                                   readOnly={halfSpeed || zeroSpeed || armour.speed !== 0 || armour.still}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current Speed", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="speedCalc" value={String(charInfo.get("Base Speed") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Base Speed", e.target.value))}/>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Wound Threshold</div>
                        <div className="band val"><input type="text" id="wt" className={wtMod !== 0 ? "modded" : ""}
                                                         value={String(Number(charInfo.get("WT") ?? 0) + wtMod)}
                                                         readOnly={wtMod !== 0}
                                                         onChange={e => setCharInfo(new Map(charInfo).set("WT", e.target.value))}
                                                         onKeyDown={wtMod !== 0 ? undefined : numberArrows(String(charInfo.get("WT") ?? ""), v => setCharInfo(new Map(charInfo).set("WT", v)))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Initiative Rating</div>
                        <div className="band val"><input type="text" id="ir" className={woundIrMod !== 0 ? "modded" : ""}
                                                         value={String(Number(charInfo.get("IR") ?? 0) + woundIrMod)}
                                                         readOnly={woundIrMod !== 0}
                                                         onChange={e => setCharInfo(new Map(charInfo).set("IR", e.target.value))}
                                                         onKeyDown={woundIrMod !== 0 ? undefined : numberArrows(String(charInfo.get("IR") ?? ""), v => setCharInfo(new Map(charInfo).set("IR", v)))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Linguistics</div>
                        <div className="band val"><input type="text" id="linguistics" value={String(charInfo.get("Linguistics") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Linguistics", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Linguistics") ?? ""), v => setCharInfo(new Map(charInfo).set("Linguistics", v)))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Encumbrance / Carry Rating</div>
                        <div className="band val">
                            <input type="text" className="pair" id="enc" value={String(charInfo.get("Encumbrance") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Encumbrance", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Encumbrance") ?? ""), v => setCharInfo(new Map(charInfo).set("Encumbrance", v)))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="cr" value={String(charInfo.get("Carry Rating") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Carry Rating", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Carry Rating") ?? ""), v => setCharInfo(new Map(charInfo).set("Carry Rating", v)))}/>
                        </div>
                    </div>
                </div>

                {!mode && (
                    <div className="modes">
                        <button type="button" className="narrative" onClick={() => setMode("narrative")}>Narrative Time</button>
                        <button type="button" className="combat" onClick={() => setMode("combat")}>Combat Time</button>
                    </div>
                )}

                {mode && (
                    <div className="modeBar">
                        <button type="button" className={mode === "narrative" ? "narrative active" : "narrative"} onClick={() => setMode("narrative")}>Narrative Time</button>
                        <button type="button" className={mode === "combat" ? "combat active" : "combat"} onClick={() => setMode("combat")}>Combat Time</button>
                    </div>
                )}

                {mode === "narrative" && (
                    <>
                        <h2>Bonds</h2>

                        <div className="bonds">
                            {charInfo.get("Bonds 1") && <div className="band val"><input type="text" value={String(charInfo.get("Bonds 1") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Bonds 1", e.target.value))}/></div>}
                            {charInfo.get("Bonds 2") && <div className="band val"><input type="text" value={String(charInfo.get("Bonds 2") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Bonds 2", e.target.value))}/></div>}
                            {charInfo.get("Bonds 3") && <div className="band val"><input type="text" value={String(charInfo.get("Bonds 3") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Bonds 3", e.target.value))}/></div>}
                        </div>

                        <h2>Skills</h2>

                        <div className="skills">

                            <div className="stable">
                                <div className="srow head">
                                    <div>Skill</div><div>Rank</div><div>Bonus</div><div>Target Numbers</div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Acrobatics</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Acrobatics Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Acrobatics", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Acrobatics Rank") ? String(charInfo.get("Acrobatics Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Acrobatics Rank") ? Number(charInfo.get("Acrobatics Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Agility <b className={testMod + agilityMod + acrobaticsMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Acrobatics Rank") ? Number(charInfo.get("Acrobatics Bonus") ?? 0) : -20) + testMod + agilityMod + acrobaticsMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Alchemy</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Alchemy Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Alchemy", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Alchemy Rank") ? String(charInfo.get("Alchemy Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Alchemy Rank") ? Number(charInfo.get("Alchemy Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Athletics</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Athletics Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Athletics", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Athletics Rank") ? String(charInfo.get("Athletics Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Athletics Rank") ? Number(charInfo.get("Athletics Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Endurance <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("End")) + (charInfo.get("Athletics Rank") ? Number(charInfo.get("Athletics Bonus") ?? 0) : -20) + testMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Command</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Command Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Command", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Command Rank") ? String(charInfo.get("Command Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Commerce</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Commerce Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Commerce", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Commerce Rank") ? String(charInfo.get("Commerce Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Commerce Rank") ? Number(charInfo.get("Commerce Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Commerce Rank") ? Number(charInfo.get("Commerce Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Deceive</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Deceive Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Deceive", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Deceive Rank") ? String(charInfo.get("Deceive Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Deceive Rank") ? Number(charInfo.get("Deceive Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Deceive Rank") ? Number(charInfo.get("Deceive Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Enchant</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Enchant Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Enchant", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Enchant Rank") ? String(charInfo.get("Enchant Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Enchant Rank") ? Number(charInfo.get("Enchant Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Evade</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Evade Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Evade", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Evade Rank") ? String(charInfo.get("Evade Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod + agilityMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Evade Rank") ? Number(charInfo.get("Evade Bonus") ?? 0) : -20) + testMod + agilityMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Investigate</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Investigate Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Investigate", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Investigate Rank") ? String(charInfo.get("Investigate Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Investigate Rank") ? Number(charInfo.get("Investigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Investigate Rank") ? Number(charInfo.get("Investigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Logic</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Logic Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Logic", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Logic Rank") ? String(charInfo.get("Logic Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Logic Rank") ? Number(charInfo.get("Logic Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Logic Rank") ? Number(charInfo.get("Logic Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                            </div>

                            <div className="stable">
                                <div className="srow head">
                                    <div>Skill</div><div>Rank</div><div>Bonus</div><div>Target Numbers</div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Lore</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Lore Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Lore", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Lore Rank") ? String(charInfo.get("Lore Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Lore Rank") ? Number(charInfo.get("Lore Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Navigate</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Navigate Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Navigate", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Navigate Rank") ? String(charInfo.get("Navigate Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Navigate Rank") ? Number(charInfo.get("Navigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Navigate Rank") ? Number(charInfo.get("Navigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Observe</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Observe Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Observe", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Observe Rank") ? String(charInfo.get("Observe Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Observe Rank") ? Number(charInfo.get("Observe Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Persuade</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Persuade Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Persuade", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Persuade Rank") ? String(charInfo.get("Persuade Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Persuade Rank") ? Number(charInfo.get("Persuade Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Persuade Rank") ? Number(charInfo.get("Persuade Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Ride</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Ride Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Ride", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Ride Rank") ? String(charInfo.get("Ride Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod + agilityMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Ride Rank") ? Number(charInfo.get("Ride Bonus") ?? 0) : -20) + testMod + agilityMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Stealth</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Stealth Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Stealth", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Stealth Rank") ? String(charInfo.get("Stealth Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod + agilityMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Stealth Rank") ? Number(charInfo.get("Stealth Bonus") ?? 0) : -20) + testMod + agilityMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Stealth Rank") ? Number(charInfo.get("Stealth Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Subterfuge</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Subterfuge Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Subterfuge", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Subterfuge Rank") ? String(charInfo.get("Subterfuge Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod + agilityMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Subterfuge Rank") ? Number(charInfo.get("Subterfuge Bonus") ?? 0) : -20) + testMod + agilityMod}</b></span>
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Subterfuge Rank") ? Number(charInfo.get("Subterfuge Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Survival</div>
                                    <div className="rankCell"><select value={String(charInfo.get("Survival Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Survival", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                    <div>{charInfo.get("Survival Rank") ? String(charInfo.get("Survival Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Survival Rank") ? Number(charInfo.get("Survival Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Survival Rank") ? Number(charInfo.get("Survival Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                {charInfo.get("Profession 1") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 1"))}</div>
                                        <div className="rankCell"><select value={String(charInfo.get("Profession 1 Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Profession 1", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                        <div>{charInfo.get("Profession 1 Rank") ? String(charInfo.get("Profession 1 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p1Char] ?? p1Char} <b className={testMod + (physicalChars.includes(p1Char) ? 0 : frenzyMod) !== 0 ? "modded" : ""}>{Number(charInfo.get(p1Char) ?? 0) + (charInfo.get("Profession 1 Rank") ? Number(charInfo.get("Profession 1 Bonus") ?? 0) : -20) + testMod + (physicalChars.includes(p1Char) ? 0 : frenzyMod)}</b></span>
                                        </div>
                                    </div>
                                )}
                                {charInfo.get("Profession 2") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 2"))}</div>
                                        <div className="rankCell"><select value={String(charInfo.get("Profession 2 Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Profession 2", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                        <div>{charInfo.get("Profession 2 Rank") ? String(charInfo.get("Profession 2 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p2Char] ?? p2Char} <b className={testMod + (physicalChars.includes(p2Char) ? 0 : frenzyMod) !== 0 ? "modded" : ""}>{Number(charInfo.get(p2Char) ?? 0) + (charInfo.get("Profession 2 Rank") ? Number(charInfo.get("Profession 2 Bonus") ?? 0) : -20) + testMod + (physicalChars.includes(p2Char) ? 0 : frenzyMod)}</b></span>
                                        </div>
                                    </div>
                                )}
                                {charInfo.get("Profession 3") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 3"))}</div>
                                        <div className="rankCell"><select value={String(charInfo.get("Profession 3 Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Profession 3", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></div>
                                        <div>{charInfo.get("Profession 3 Rank") ? String(charInfo.get("Profession 3 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p3Char] ?? p3Char} <b className={testMod + (physicalChars.includes(p3Char) ? 0 : frenzyMod) !== 0 ? "modded" : ""}>{Number(charInfo.get(p3Char) ?? 0) + (charInfo.get("Profession 3 Rank") ? Number(charInfo.get("Profession 3 Bonus") ?? 0) : -20) + testMod + (physicalChars.includes(p3Char) ? 0 : frenzyMod)}</b></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="subBar">
                            <button type="button" className={panel === "inv" ? "tInv active" : "tInv"} onClick={() => setPanel(panel === "inv" ? null : "inv")}>Inventory</button>
                            <button type="button" className={panel === "ttp" ? "tTtp active" : "tTtp"} onClick={() => setPanel(panel === "ttp" ? null : "ttp")}>Traits, Talents &amp; Powers</button>
                            <button type="button" className={panel === "spell" ? "tSpell active" : "tSpell"} onClick={() => setPanel(panel === "spell" ? null : "spell")}>Spellcasting</button>
                            <button type="button" className={panel === "craft" ? "tCraft active" : "tCraft"} onClick={() => setPanel(panel === "craft" ? null : "craft")}>Crafting</button>
                        </div>

                        {panel === "inv" && (
                            <>
                                <h2>Inventory</h2>

                                <div className="invBand">
                                    <div className="inv">
                                        <div className="invRow head"><div>Item</div><div>ENC</div></div>
                                        {inventory.map((item, i) => (
                                            <div className="invRow" key={i}>
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={e => setInventory(inventory.map((old, j) => j === i ? {...old, name: e.target.value} : old))}
                                                        onKeyDown={e => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault()
                                                                const copy = [...inventory]
                                                                copy.splice(i + 1, 0, {name: "", enc: ""})
                                                                setInventory(copy)
                                                                // each row has two inputs so the next name field is two over
                                                                setTimeout(() => {
                                                                    const rows = document.querySelectorAll<HTMLInputElement>("#center .inv input")
                                                                    rows[(i + 1) * 2]?.focus()
                                                                }, 0)
                                                            }
                                                            if (e.key === "Backspace" && item.name === "" && item.enc === "" && inventory.length > 1) {
                                                                e.preventDefault()
                                                                setInventory(inventory.filter((_old, j) => j !== i))
                                                                setTimeout(() => {
                                                                    const rows = document.querySelectorAll<HTMLInputElement>("#center .inv input")
                                                                    rows[(i - 1) * 2]?.focus()
                                                                }, 0)
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <input
                                                        type="text"
                                                        className="pair"
                                                        value={item.enc}
                                                        onChange={e => setInventory(inventory.map((old, j) => j === i ? {...old, enc: e.target.value} : old))}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="invSide">
                                        <div className="tile">
                                            <div className="band head">Septims</div>
                                            <div className="band val"><input type="text" value={String(charInfo.get("Drakes") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Drakes", e.target.value))} onKeyDown={numberArrows(String(charInfo.get("Drakes") ?? ""), v => setCharInfo(new Map(charInfo).set("Drakes", v)))}/></div>
                                        </div>
                                        <div className="tile">
                                            <div className="band head">Total ENC</div>
                                            <div className="band val"><input type="text" value={totalEnc} readOnly/></div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {panel === "ttp" && ttpPanel}

                        {panel === "spell" && spellPanel}

                        {panel === "craft" && (
                            <>
                                <h2>Crafting</h2>

                                <h3>Smithing</h3>

                                <div className="craftBand">
                                    <div className="rules">
                                        <p><b>1. Determine item.</b> Pick the item and its quality. Some items only occur naturally and cannot be crafted, at GM discretion. Quality plus base price gives the market value.</p>
                                        <p><b>2. Gather raw materials.</b> Buying all raw materials costs roughly one third of the item's standard price.</p>
                                        <p><b>3. Determine test difficulty.</b> Difficulty comes from the item's quality, and for weapons and armor the material adds a further modifier. See the tables below.</p>
                                        <p><b>4. Make the crafting test.</b> Weapons and armor use Profession [Smithing]. Requires craft tools and forge access. Failure produces no item. Critical success halves the time. Duration runs from hours to days at GM discretion.</p>
                                        <p><b>Repairing.</b> A Profession [Smithing] test, about an hour, and raw materials worth 5% of the item's price. Success reduces the Damaged (X) quality by the degrees of success.</p>
                                    </div>

                                    <div className="craftMid">
                                        <div className="dtable">
                                            <div className="dh">Quality</div><div className="dh">Difficulty</div>
                                            <div>Inferior</div><div>+30</div>
                                            <div>Common</div><div>+0</div>
                                            <div>Superior</div><div>-30</div>
                                        </div>

                                        <div className="rules">
                                            <p><b>Runed Weapons &amp; Armor.</b> With Enchanting knowledge, magic runes can be worked into a weapon or armor during creation by passing an Enchant test. Success adds the Magic quality, and armor also gains 1 Magic AR. On failure the item is made without it, and the test cannot be retried for this item.</p>
                                        </div>
                                    </div>

                                    <div className="craftTables">
                                        <div className="dtable six">
                                            <div className="dh">Material</div><div className="dh">Diff.</div><div className="dh">Material</div><div className="dh">Diff.</div><div className="dh">Material</div><div className="dh">Diff.</div>
                                            <div>Adamantium</div><div>-20</div><div>Ebony</div><div>-30</div><div>Orichalcum</div><div>-10</div>
                                            <div>Bonemold</div><div>-5</div><div>Fur</div><div>+10</div><div>Padded</div><div>+30</div>
                                            <div>Bone</div><div>+0</div><div>Iron</div><div>+20</div><div>Silver</div><div>-5</div>
                                            <div>Chitin</div><div>+0</div><div>Leather</div><div>+10</div><div>Stahlrim</div><div>-10</div>
                                            <div>Dragonbone/scale</div><div>-40</div><div>Malachite</div><div>-20</div><div>Steel</div><div>+0</div>
                                            <div>Dreugh Hide</div><div>-10</div><div>Mithril</div><div>-10</div><div>Wood</div><div>+20</div>
                                            <div>Dwemer</div><div>-10</div><div>Moonstone</div><div>-10</div><div></div><div></div>
                                        </div>
                                    </div>
                                </div>

                                <h3>Alchemy</h3>
                                <div className="rules"><p>WIP</p></div>

                                <h3>Enchanting</h3>
                                <div className="rules"><p>WIP</p></div>
                            </>
                        )}
                    </>
                )}

                {mode === "combat" && (
                    <>
                        <h2>Combat</h2>

                        <div className="combatBand">

                            <div className="combatL">
                                <div className="armHead">
                                    <h3>Armor</h3>
                                    <div className="wcRule"></div>
                                    <span className="wcLabel">Weight Class:</span>
                                    <button type="button" className="wcStep" onClick={() => setWeightClass((weightClass + weightClasses.length - 1) % weightClasses.length)}>&#8722;</button>
                                    <span className={weightClass === 0 ? "wcName none" : "wcName"}>{weightClasses[weightClass].name}</span>
                                    <button type="button" className="wcStep" onClick={() => setWeightClass((weightClass + 1) % weightClasses.length)}>+</button>
                                </div>

                                <div className="armGrid">
                                    <div className="armLoc">
                                        <div className="ahead"><b>Head</b><span>(10)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" value={String(charInfo.get("Head AR") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Head AR", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" value={String(charInfo.get("Head ENC") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Head ENC", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" value={String(charInfo.get("Head Type") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Head Type", e.target.value))}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Body</b><span>(1-5)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" value={String(charInfo.get("Body AR") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Body AR", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" value={String(charInfo.get("Body ENC") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Body ENC", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" value={String(charInfo.get("Body Type") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Body Type", e.target.value))}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Right Arm</b><span>(8)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" value={String(charInfo.get("Right Arm AR") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Right Arm AR", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" value={String(charInfo.get("Right Arm ENC") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Right Arm ENC", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" value={String(charInfo.get("Right Arm Type") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Right Arm Type", e.target.value))}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Left Arm</b><span>(9)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" value={String(charInfo.get("Left Arm AR") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Left Arm AR", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" value={String(charInfo.get("Left Arm ENC") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Left Arm ENC", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" value={String(charInfo.get("Left Arm Type") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Left Arm Type", e.target.value))}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Right Leg</b><span>(6)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" value={String(charInfo.get("Right Leg AR") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Right Leg AR", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" value={String(charInfo.get("Right Leg ENC") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Right Leg ENC", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" value={String(charInfo.get("Right Leg Type") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Right Leg Type", e.target.value))}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Left Leg</b><span>(7)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" value={String(charInfo.get("Left Leg AR") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Left Leg AR", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" value={String(charInfo.get("Left Leg ENC") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Left Leg ENC", e.target.value))}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" value={String(charInfo.get("Left Leg Type") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Left Leg Type", e.target.value))}/></div></div>
                                    </div>
                                </div>

                                <div className="armLoc">
                                    <div className="ahead"><b>Shield</b><span>(BR / Type / ENC)</span></div>
                                    <div className="arow"><div className="al">BR</div><div><input type="text" value={shield.br} onChange={e => setShield({...shield, br: e.target.value})}/></div></div>
                                    <div className="arow"><div className="al">Type</div><div><input type="text" value={shield.type} onChange={e => setShield({...shield, type: e.target.value})}/></div></div>
                                    <div className="arow"><div className="al">ENC</div><div><input type="text" value={shield.enc} onChange={e => setShield({...shield, enc: e.target.value})}/></div></div>
                                </div>

                                <div className="armLoc">
                                    <div className="ahead"><b>Armor Notes</b></div>
                                    <div className="arow"><div style={{gridColumn: "1/-1"}}><textarea className="notesArea" rows={1} value={armorNotes} onChange={e => setArmorNotes(e.target.value)}/></div></div>
                                </div>
                            </div>

                            <div className="combatR">
                                <h3>Combat Style</h3>

                                <div className="csBlock">
                                    <div className="csTop">
                                        <b><input type="text" value={String(charInfo.get("Combat Style") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Combat Style", e.target.value))}/></b>
                                        <span className="rankCell"><select value={String(charInfo.get("Combat Style Rank") ?? "")} onChange={e => setCharInfo(setRank(charInfo, "Combat Style", e.target.value))}>{rankLadder.map(r => <option key={r.name} value={r.abbr}>{r.name}</option>)}</select></span>
                                        <span>{String(charInfo.get("Combat Style Bonus") ?? "")}</span>
                                        <div className="stests">
                                            <span>Strength <b className={testMod + csMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Combat Style Rank") ? Number(charInfo.get("Combat Style Bonus") ?? 0) : -20) + testMod + csMod}</b></span>
                                            <span>Agility <b className={testMod + csMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Combat Style Rank") ? Number(charInfo.get("Combat Style Bonus") ?? 0) : -20) + testMod + csMod}</b></span>
                                        </div>
                                    </div>
                                    <div className="csLine"><textarea className="notesArea" rows={1} value={String(charInfo.get("Combat Style 2") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Combat Style 2", e.target.value))}/></div>
                                    <div className="csLine"><textarea className="notesArea" rows={1} value={String(charInfo.get("Combat Style 3") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Combat Style 3", e.target.value))}/></div>
                                </div>

                                <h3>Melee Weapons</h3>

                                <div className="wtable">
                                    <div className="wrow head"><div>Weapon</div><div>Dmg</div><div>Hand</div><div>Reach</div><div>ENC</div><div></div></div>
                                    {melee.map((w, i) => (
                                        <Fragment key={i}>
                                            <div className="wrow">
                                                <div className="wname"><input type="text" value={w.name} onChange={e => setMelee(melee.map((old, j) => j === i ? {...old, name: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.dmg} onChange={e => setMelee(melee.map((old, j) => j === i ? {...old, dmg: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.hand} onChange={e => setMelee(melee.map((old, j) => j === i ? {...old, hand: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.reach} onChange={e => setMelee(melee.map((old, j) => j === i ? {...old, reach: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.enc} onChange={e => setMelee(melee.map((old, j) => j === i ? {...old, enc: e.target.value} : old))}/></div>
                                                <div className="wdel"><button type="button" onClick={() => setMelee(melee.filter((_old, j) => j !== i))}>&#215;</button></div>
                                            </div>
                                            <div className="wnotes"><input type="text" value={w.notes} onChange={e => setMelee(melee.map((old, j) => j === i ? {...old, notes: e.target.value} : old))}/></div>
                                        </Fragment>
                                    ))}
                                </div>
                                <button type="button" className="addSpell" onClick={() => setMelee([...melee, {name: "", dmg: "", hand: "", reach: "", enc: "", notes: ""}])}>+ Add Weapon</button>

                                <h3>Ranged Weapons</h3>

                                <div className="wtable">
                                    <div className="wrow head"><div>Weapon</div><div>Dmg</div><div>Hand</div><div>Reach</div><div>ENC</div><div></div></div>
                                    {ranged.map((w, i) => (
                                        <Fragment key={i}>
                                            <div className="wrow">
                                                <div className="wname"><input type="text" value={w.name} onChange={e => setRanged(ranged.map((old, j) => j === i ? {...old, name: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.dmg} onChange={e => setRanged(ranged.map((old, j) => j === i ? {...old, dmg: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.hand} onChange={e => setRanged(ranged.map((old, j) => j === i ? {...old, hand: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.reach} onChange={e => setRanged(ranged.map((old, j) => j === i ? {...old, reach: e.target.value} : old))}/></div>
                                                <div><input type="text" value={w.enc} onChange={e => setRanged(ranged.map((old, j) => j === i ? {...old, enc: e.target.value} : old))}/></div>
                                                <div className="wdel"><button type="button" onClick={() => setRanged(ranged.filter((_old, j) => j !== i))}>&#215;</button></div>
                                            </div>
                                            <div className="wnotes"><input type="text" value={w.notes} onChange={e => setRanged(ranged.map((old, j) => j === i ? {...old, notes: e.target.value} : old))}/></div>
                                        </Fragment>
                                    ))}
                                </div>
                                <button type="button" className="addSpell" onClick={() => setRanged([...ranged, {name: "", dmg: "", hand: "", reach: "", enc: "", notes: ""}])}>+ Add Weapon</button>

                                <div className="condBox">
                                    <div className="ahead"><b>Wounds</b></div>

                                    <div className="condList">
                                        {wounds.map((w, i) => (
                                            <div className="condCard" key={w.part + i}>
                                                <b>{w.part}</b>
                                                <span className="condLvl">{w.treated ? "treated" : "untreated"}</span>
                                                <span className="condNote">{w.treated
                                                    ? (w.damage > 0 ? "Healed " + w.healed + " of the " + w.damage + " needed to cure" : "Cure it by hand once the damage is healed")
                                                    : "-20 to all tests, -2 initiative, " + w.rounds + " rounds to blood loss"}</span>
                                                <div className="condTools">
                                                    {/* first aid stops the bleeding, curing takes healing on top of that */}
                                                    {!w.treated && (
                                                        <button type="button" onClick={() => setWounds(wounds.map((old, j) => j === i ? {...old, treated: true} : old))}>Treat Wound</button>
                                                    )}
                                                    {w.treated && (
                                                        <button type="button" onClick={() => clearWound(i)}>Cure Wound</button>
                                                    )}
                                                    <button type="button" onClick={() => clearWound(i)}>Remove</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button type="button" className="addCond" onClick={() => {
                                        setWoundPart("")
                                        setWoundSide("")
                                        setWoundShockPassed(true)
                                        setWoundDamage("")
                                        setPopout("wound1")
                                    }}>+ Add Wound</button>
                                </div>

                                <div className="condBox">
                                    <div className="ahead"><b>Conditions</b></div>

                                    <div className="condList">
                                        {allConditions.map((c, i) => (
                                            <div className="condCard" key={c.name + (c.part ?? "")}>
                                                <b>{nameOf(c)}</b>
                                                {detailOf(c) !== "" && <span className="condLvl">{detailOf(c)}</span>}
                                                {c.rounds !== undefined && <span className="condClock">{c.rounds} round{c.rounds === 1 ? "" : "s"} left</span>}
                                                <span className="condNote">{conditionTypes[c.name].shortOf ? conditionTypes[c.name].shortOf!(c) : conditionTypes[c.name].note}</span>
                                                <div className="condTools">
                                                    {(conditionTypes[c.name].kind === "levels" || conditionTypes[c.name].kind === "value") && (
                                                        <button type="button" onClick={() => {
                                                            // stepping below 1 means the condition is simply gone
                                                            if ((c.value ?? 1) > 1) setConditions(prev => prev.map((old, j) => j === i ? {...old, value: (old.value ?? 1) - 1} : old))
                                                            else setConditions(prev => prev.filter((_old, j) => j !== i))
                                                        }}>&#8722;</button>
                                                    )}
                                                    {(conditionTypes[c.name].kind === "levels" || conditionTypes[c.name].kind === "value") && (
                                                        <button type="button" onClick={() => {
                                                            if ((c.value ?? 1) < (conditionTypes[c.name].max ?? 99)) setConditions(prev => prev.map((old, j) => j === i ? {...old, value: (old.value ?? 1) + 1} : old))
                                                        }}>+</button>
                                                    )}
                                                    {/* a condition that works its own number has no business with a round clock */}
                                                    {!c.auto && !conditionTypes[c.name].ownClock && c.rounds === undefined && (
                                                        <button type="button" onClick={() => setConditions(prev => prev.map((old, j) => j === i ? {...old, rounds: 1} : old))}>Set Rounds</button>
                                                    )}
                                                    {!c.auto && !conditionTypes[c.name].ownClock && c.rounds !== undefined && (
                                                        <button type="button" onClick={() => {
                                                            // taking the clock below one means it has no set length any more
                                                            if ((c.rounds ?? 1) > 1) setConditions(prev => prev.map((old, j) => j === i ? {...old, rounds: (old.rounds ?? 1) - 1} : old))
                                                            else setConditions(prev => prev.map((old, j) => j === i ? {...old, rounds: undefined} : old))
                                                        }}>&#8722; round</button>
                                                    )}
                                                    {!c.auto && !conditionTypes[c.name].ownClock && c.rounds !== undefined && (
                                                        <button type="button" onClick={() => setConditions(prev => prev.map((old, j) => j === i ? {...old, rounds: (old.rounds ?? 1) + 1} : old))}>+ round</button>
                                                    )}
                                                    {/* a willpower test at the end of your turn shakes some fears off */}
                                                    {(conditionTypes[c.name].canSnapOut || (c.result !== undefined && resultsFor(c.name)[c.result]?.canSnapOut)) && !c.snapped && (
                                                        <button type="button" onClick={() => {
                                                            // some fears leave something behind rather than lifting entirely
                                                            if (c.result === "Lost Composure") setConditions(prev => prev.map((old, j) => j === i ? {...old, snapped: true} : old))
                                                            else setConditions(prev => prev.filter((_old, j) => j !== i))
                                                        }}>Snap Out</button>
                                                    )}
                                                    {/* taking off an automatic condition keeps it off until its cause is gone */}
                                                    {c.auto && (
                                                        <button type="button" onClick={() => setDismissed(prev => prev.includes(c.name) ? prev : [...prev, c.name])}>Remove</button>
                                                    )}
                                                    {!c.auto && (
                                                        <button type="button" onClick={() => {
                                                            let list = conditions.filter((_old, j) => j !== i)
                                                            // snapping out of a frenzy costs two stamina, which may run them into fatigue
                                                            if (c.name === "Frenzied") {
                                                                const next = new Map(charInfo)
                                                                list = withFatigue(list, spendStamina(next, 2), staminaFatigueCap)
                                                                setCharInfo(next)
                                                            }
                                                            setConditions(list)
                                                        }}>Remove</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button type="button" className="addCond" onClick={() => setPopout("addCond")}>+ Add Condition</button>
                                </div>
                            </div>

                        </div>

                        <button type="button" className="roundOver" onClick={() => {
                            const next = new Map(charInfo)
                            const lines: string[] = []
                            let hp = Number(next.get("Current HP")) || 0

                            // work out what expires this round before anything reads a modifier,
                            // otherwise a one round stun would cost two rounds of action points
                            const expiring = conditions.filter(c => c.rounds !== undefined && c.rounds - 1 <= 0)
                            const surviving = allConditions.filter(c => !expiring.includes(c))

                            const stillMods = (which: "apMaxMod") => {
                                let total = 0
                                surviving.forEach(c => {
                                    const fn = conditionTypes[c.name][which]
                                    if (fn) total += fn(c)
                                })
                                return total
                            }

                            // a character never drops below one action point no matter how dazed they are
                            const refreshTo = Math.max(1, Number(charInfo.get("Max AP") ?? 0) + stillMods("apMaxMod"))
                            const stunned = surviving.some(c => conditionTypes[c.name].blocksApRefresh)
                            if (!stunned) next.set("Current AP", String(refreshTo))
                            setApRefreshed(!stunned)

                            const kept: Cond[] = []
                            let bledOut = false

                            // an untreated wound bleeds, and after five rounds it drops you
                            const woundsAfter = wounds.map(w => {
                                if (w.treated) return w
                                const left = w.rounds - 1
                                if (left <= 0) {
                                    hp = 0
                                    bledOut = true
                                    lines.push("Your untreated wound on your " + w.part + " has bled you out. You are at 0 HP and fall Unconscious.")
                                } else {
                                    lines.push("You currently have an untreated wound on your " + w.part + " so you will pass out from blood loss after " + left + " more round" + (left === 1 ? "" : "s") + ".")
                                }
                                return {...w, rounds: Math.max(0, left)}
                            })
                            setWounds(woundsAfter)

                            conditions.forEach(c => {
                                // anything whose clock runs out now is already gone, it does not act again
                                if (expiring.includes(c)) {
                                    lines.push(nameOf(c) + " has run its course and is gone.")
                                    return
                                }
                                // bleeding does nothing the round it lands, it starts at the end of the next one
                                if (c.name === "Bleeding" && c.fresh) {
                                    kept.push({...c, fresh: false})
                                    lines.push("Bleeding (" + c.value + ") \u2014 the wound has not opened up yet, it starts at the end of your next round.")
                                    return
                                }
                                if (c.name === "Bleeding") {
                                    const dmg = c.value ?? 0
                                    hp = hp - dmg
                                    let line = "Bleeding (" + dmg + ") \u2014 you have taken " + dmg + " damage, leaving you with " + hp + " HP."
                                    if (dmg - 1 <= 0) line += " You are no longer bleeding."
                                    else kept.push({...c, value: dmg - 1})
                                    lines.push(line)
                                    return
                                }
                                // burning is the mirror of bleeding, it grows instead of winding down
                                if (c.name === "Burning") {
                                    const dmg = c.value ?? 0
                                    hp = hp - dmg
                                    kept.push({...c, value: dmg + 1})
                                    lines.push("Burning (" + dmg + ") \u2014 you have taken " + dmg + " fire damage, leaving you with " + hp + " HP. The fire grows to " + (dmg + 1) + ".")
                                    return
                                }
                                // everything else just loses a round off its clock if it has one
                                if (c.rounds !== undefined) {
                                    const left = c.rounds - 1
                                    kept.push({...c, rounds: left})
                                    const still = conditionTypes[c.name].recap
                                    lines.push((still ? still(c) + " " : nameOf(c) + " is still on you. ")
                                        + left + " round" + (left === 1 ? "" : "s") + " left.")
                                    return
                                }
                                kept.push(c)
                                const say = conditionTypes[c.name].recap
                                if (say) lines.push(say(c))
                            })

                            if (bledOut && !kept.some(c => c.name === "Unconscious")) {
                                kept.push({name: "Unconscious", value: 1})
                            }

                            derived.forEach(c => {
                                const say = conditionTypes[c.name].recap
                                if (say) lines.push(say(c) + (c.why ? " This is because " + c.why + "." : ""))
                            })

                            next.set("Current HP", String(hp))
                            setCharInfo(next)
                            setConditions(kept)
                            setRecap(lines)
                            setPopout("roundOver")
                        }}>Round Over &#8212; refresh Action Points</button>

                        <div className="subBar">
                            <button type="button" className={panel === "onTurn" ? "tOn active" : "tOn"} onClick={() => setPanel(panel === "onTurn" ? null : "onTurn")}>On Your Turn</button>
                            <button type="button" className={panel === "notTurn" ? "tNot active" : "tNot"} onClick={() => setPanel(panel === "notTurn" ? null : "notTurn")}>Not On Your Turn</button>
                            <button type="button" className={panel === "cond" ? "tCond active" : "tCond"} onClick={() => setPanel(panel === "cond" ? null : "cond")}>Conditions &amp; Rules</button>
                            <button type="button" className={panel === "cTtp" ? "tTtp active" : "tTtp"} onClick={() => setPanel(panel === "cTtp" ? null : "cTtp")}>Traits, Talents &amp; Powers</button>
                            <button type="button" className={panel === "cSpell" ? "tSpell active" : "tSpell"} onClick={() => setPanel(panel === "cSpell" ? null : "cSpell")}>Spellcasting</button>
                        </div>

                        {panel === "onTurn" && (
                            <>
                                <h2>On Your Turn</h2>

                                <div className="actList">
                                    {onTurnActions.map(act => (
                                        <div className="act" key={act.name}>
                                            <div className="actHead" onClick={() => setOpenActions(openActions.includes("on " + act.name) ? openActions.filter(n => n !== "on " + act.name) : [...openActions, "on " + act.name])}>
                                                <span>{act.name}</span><span className="ap">1 AP</span>
                                            </div>
                                            {openActions.includes("on " + act.name) && (
                                                <div className="actBody">
                                                    <p>{act.text}</p>
                                                    {act.bullets && (
                                                        <ul>
                                                            {act.bullets.map(b => <li key={b.label}><b>{b.label}:</b> {b.text}</li>)}
                                                        </ul>
                                                    )}
                                                    <button type="button" className="takeAction" onClick={spendAp}>Take This Action</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {panel === "notTurn" && (
                            <>
                                <h2>Not On Your Turn</h2>

                                <div className="rules">
                                    <p>Reactions can be used at any time during the combat round in response to a threat or event that a character is aware of by spending an AP. Reactions can be triggered by other reactions: if this happens, resolve them however makes the most sense.</p>
                                </div>

                                <div className="actList" style={{marginTop: ".4em"}}>
                                    {notTurnActions.map(act => (
                                        <div className="act" key={act.name}>
                                            <div className="actHead" onClick={() => setOpenActions(openActions.includes("not " + act.name) ? openActions.filter(n => n !== "not " + act.name) : [...openActions, "not " + act.name])}>
                                                <span>{act.name}</span><span className="ap">1 AP</span>
                                            </div>
                                            {openActions.includes("not " + act.name) && (
                                                <div className="actBody">
                                                    <p>{act.text}</p>
                                                    {act.bullets && (
                                                        <ul>
                                                            {act.bullets.map(b => <li key={b.label}><b>{b.label}:</b> {b.text}</li>)}
                                                        </ul>
                                                    )}
                                                    <button type="button" className="takeAction" onClick={spendAp}>Take This Action</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {panel === "cond" && (
                            <>
                                <h2>Conditions &amp; Rules</h2>

                                <div className="actList">
                                    {/* one fold out per rules section, the same way the actions read */}
                                    <div className="act">
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Combat") ? openActions.filter(n => n !== "group Combat") : [...openActions, "group Combat"])}>
                                            <span>Attacking &amp; Defending</span>
                                        </div>
                                        {openActions.includes("group Combat") && (
                                            <div className="actBody">
                                                {combatIntro.map((block, i) => <p key={i}>{block.text}</p>)}

                                                {/* the four steps read straight through rather than folding away */}
                                                {combatSteps.map(step => (
                                                    <div key={step.name}>
                                                        <div className="stepHead">{step.name}</div>
                                                        {step.blocks.map((block, i) => (
                                                            <div key={i}>
                                                                {block.head && <div className="subHead">{block.head}</div>}
                                                                {block.text && <p>{block.text}</p>}
                                                                {block.table && (
                                                                    <div className="dtable wide">
                                                                        <div className="dh">Result</div><div className="dh">Location Hit</div>
                                                                        {hitLocations.map(row => (
                                                                            <Fragment key={row.roll}>
                                                                                <div>{row.roll}</div>
                                                                                <div>{row.where}</div>
                                                                            </Fragment>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {block.bullets && (
                                                                    <ul>
                                                                        {block.bullets.map((b, j) => (
                                                                            <li key={j}>
                                                                                {b.text}
                                                                                {b.subs && (
                                                                                    <ul>
                                                                                        {b.subs.map((s, k) => <li key={k}>{s}</li>)}
                                                                                    </ul>
                                                                                )}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="act">
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Weight") ? openActions.filter(n => n !== "group Weight") : [...openActions, "group Weight"])}>
                                            <span>Weight Classes</span>
                                        </div>
                                        {openActions.includes("group Weight") && (
                                            <div className="actBody">
                                                <p>{weightIntro}</p>
                                                {weightClasses.map(w => (
                                                    <div key={w.name}>
                                                        <div className="subHead">{w.name === "No listed class" ? "(No listed class)" : w.name === "Crippling" ? "(Crippling)" : w.name}</div>
                                                        <p>{w.rules}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="act">
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Wounds") ? openActions.filter(n => n !== "group Wounds") : [...openActions, "group Wounds"])}>
                                            <span>Wounds</span>
                                        </div>
                                        {openActions.includes("group Wounds") && (
                                            <div className="actBody">
                                                {woundRules.map((block, i) => (
                                                    <div key={i}>
                                                        {block.head && <div className="subHead">{block.head}</div>}
                                                        {block.text && <p>{block.text}</p>}
                                                        {block.bullets && (
                                                            <ul>
                                                                {block.bullets.map((b, j) => <li key={j}>{b}</li>)}
                                                            </ul>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="act">
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Healing") ? openActions.filter(n => n !== "group Healing") : [...openActions, "group Healing"])}>
                                            <span>Healing</span>
                                        </div>
                                        {openActions.includes("group Healing") && (
                                            <div className="actBody">
                                                {healingRules.map((block, i) => (
                                                    <div key={i}>
                                                        {block.head && <div className="subHead">{block.head}</div>}
                                                        {block.text && <p>{block.text}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="act">
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Fear") ? openActions.filter(n => n !== "group Fear") : [...openActions, "group Fear"])}>
                                            <span>Fear and Horror</span>
                                        </div>
                                        {openActions.includes("group Fear") && (
                                            <div className="actBody">
                                                {fearIntro.map((block, i) => (
                                                    <div key={i}>
                                                        {block.head && <div className="subHead">{block.head}</div>}
                                                        {block.text && <p>{block.text}</p>}
                                                    </div>
                                                ))}

                                                <div className="subHead">Combat Horror Test Results</div>
                                                <div className="dtable roll">
                                                    <div className="dh">Roll</div><div className="dh">Effect</div>
                                                    {horrorTable.map(row => (
                                                        <Fragment key={row.range}>
                                                            <div>{row.range}</div>
                                                            <div><b>{row.name}:</b> {row.text}</div>
                                                        </Fragment>
                                                    ))}
                                                </div>

                                                <div className="subHead">Combat Panic Test Results</div>
                                                <div className="dtable roll">
                                                    <div className="dh">Roll</div><div className="dh">Effect</div>
                                                    {panicTable.map(row => (
                                                        <Fragment key={row.range}>
                                                            <div>{row.range}</div>
                                                            <div><b>{row.name}:</b> {row.text}</div>
                                                        </Fragment>
                                                    ))}
                                                </div>

                                                <button type="button" className="takeAction" onClick={() => {
                                                    setFearRow(null)
                                                    setFearNum("")
                                                    setFearNum2("")
                                                    setPopout("fear1")
                                                }}>I Failed My Fear/Horror Test</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="act">
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Traits") ? openActions.filter(n => n !== "group Traits") : [...openActions, "group Traits"])}>
                                            <span>Traits</span>
                                        </div>
                                        {openActions.includes("group Traits") && (
                                            <>
                                                {/* the chapter opening belongs to the whole section, not to any one trait */}
                                                <div className="actBody">
                                                    {traitIntro.map((block, i) => (
                                                        <p key={i}>{block.text}</p>
                                                    ))}
                                                </div>
                                                <div className="actGroup">
                                                    {traitList.map(trait => (
                                                        <div className="act" key={trait.name}>
                                                            <div className="actHead" onClick={() => setOpenActions(openActions.includes("trait " + trait.name) ? openActions.filter(n => n !== "trait " + trait.name) : [...openActions, "trait " + trait.name])}>
                                                                <span>{trait.name}</span>
                                                            </div>
                                                            {openActions.includes("trait " + trait.name) && (
                                                                <div className="actBody">
                                                                    {trait.text.map((para, k) => <p key={k}>{para}</p>)}
                                                                    {trait.table && (
                                                                        <>
                                                                            <div className="subHead">{trait.table.head}</div>
                                                                            <div className="dtable wide">
                                                                                <div className="dh">{trait.table.cols[0]}</div>
                                                                                <div className="dh">{trait.table.cols[1]}</div>
                                                                                {trait.table.rows.map(row => (
                                                                                    <Fragment key={row[0]}>
                                                                                        <div>{row[0]}</div>
                                                                                        <div>{row[1]}</div>
                                                                                    </Fragment>
                                                                                ))}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="act">
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Conditions") ? openActions.filter(n => n !== "group Conditions") : [...openActions, "group Conditions"])}>
                                            <span>Conditions</span>
                                        </div>
                                        {openActions.includes("group Conditions") && (
                                            <div className="actGroup">
                                                {conditionRules.slice().sort((a, b) => a.name.localeCompare(b.name)).map(rule => (
                                                    <div className="act" key={rule.name}>
                                                        <div className="actHead" onClick={() => setOpenActions(openActions.includes("cond " + rule.name) ? openActions.filter(n => n !== "cond " + rule.name) : [...openActions, "cond " + rule.name])}>
                                                            <span>{rule.name}</span>
                                                        </div>
                                                        {openActions.includes("cond " + rule.name) && (
                                                            <div className="actBody">
                                                                {rule.blocks.map((block, i) => (
                                                                    <div key={i}>
                                                                        {block.head && <div className="subHead">{block.head}</div>}
                                                                        {block.text && <p>{block.text}</p>}
                                                                        {block.bullets && (
                                                                            <ul>
                                                                                {block.bullets.map((b, j) => <li key={j}>{b}</li>)}
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {rule.name === "Fatigued" && (
                                                                    <>
                                                                        <div className="subHead">Fatigue Effects</div>
                                                                        <div className="dtable wide">
                                                                            <div className="dh">Levels</div><div className="dh">Effects</div>
                                                                            {fatigueSteps.map(step => (
                                                                                <Fragment key={step.label}>
                                                                                    <div>{step.level}</div>
                                                                                    <div>{step.effect}</div>
                                                                                </Fragment>
                                                                            ))}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {panel === "cTtp" && ttpPanel}

                        {panel === "cSpell" && spellPanel}
                    </>
                )}

                <div className="foot">
                    {roomsReady && viewing === "" && (
                        <div className="roomLine">
                            {room === "" && (
                                <>
                                    <input type="text" className="roomInput" value={roomInput} placeholder="Room code"
                                           onChange={e => setRoomInput(e.target.value)}/>
                                    <button type="button" className="leave" onClick={() => {
                                        if (roomInput.trim() === "") return
                                        void sweepOldRooms()
                                        setRoom(roomInput.trim())
                                        setRoomInput("")
                                    }}>Join Room</button>
                                </>
                            )}
                            {room !== "" && (
                                <>
                                    <span>Room <b>{room}</b></span>
                                    <button type="button" className="leave" onClick={() => {
                                        void leaveRoom(room)
                                        setRoom("")
                                        setRoster([])
                                    }}>Leave Room</button>
                                </>
                            )}
                        </div>
                    )}
                    <a href="https://github.com/m8sh/ThrumpCharacterManager" target="_blank">github</a>
                    <span>&#183;</span>
                    <span>thrump's character manager</span>
                </div>

                {popout === "tooMany" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Downloaded, But Some Rows Did Not Fit</div>
                            <div className="popbody">
                                <p>The sheet has been downloaded, but the paper character sheet does not have enough rows for everything, so the extras were left out of the file:</p>
                                <ul>
                                    {overflow.map((line, i) => <li key={i}>{line}</li>)}
                                </ul>
                                <p>Nothing has been lost here on the page.</p>
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "noPdf" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">No Sheet To Fill In</div>
                            <div className="popbody"><p>The original PDF is not being held any more, so there is nothing to write these values back into. Upload the character sheet again and the download will work from then on.</p></div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "pdfFailed" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Download Failed</div>
                            <div className="popbody"><p>Something went wrong while filling in the sheet, so nothing was downloaded. Nothing on this page has been changed.</p></div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "newChar" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Upload New Character</div>
                            <div className="popbody"><p>This will wipe all of the current character data. Proceed?</p></div>
                            <div className="popfoot">
                                <button type="button" onClick={() => setPopout(null)}>Cancel</button>
                                <button type="button" className="go" onClick={startOver}>Proceed</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "addCond" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Add a Condition</div>
                            <div className="popbody" style={{padding: 0}}>
                                {Object.keys(conditionTypes).sort().map(name => {
                                    // a body part condition can be taken again and again as long as the part differs
                                    const taken = conditionTypes[name].kind !== "part" && conditionTypes[name].kind !== "fear" && allConditions.some(c => c.name === name)
                                    return (
                                        <button type="button" key={name} className={taken ? "pickRow taken" : "pickRow"} onClick={() => {
                                            if (taken) return
                                            if (conditionTypes[name].kind === "part") {
                                                setPopout("part " + name)
                                                return
                                            }
                                            if (conditionTypes[name].kind === "fear") {
                                                setPopout("pick " + name)
                                                return
                                            }
                                            addCondition(name)
                                            setPopout(null)
                                        }}>
                                            <b>{conditionTypes[name].kind === "part" ? name + " Body Part" : name}{taken ? " \u2014 already applied" : ""}</b>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {popout !== null && popout.startsWith("part ") && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">{popout.slice(5)} Body Part</div>
                            <div className="popbody" style={{padding: 0}}>
                                {bodyParts.map(part => {
                                    const gone = partsHit.includes(part)
                                    return (
                                        <button type="button" key={part} className={gone ? "pickRow taken" : "pickRow"} onClick={() => {
                                            if (gone) return
                                            setConditions([...conditions, {name: popout.slice(5), part: part}])
                                            setPopout(null)
                                        }}>
                                            <b>{part}{gone ? " \u2014 already affected" : ""}</b>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {popout !== null && popout.startsWith("pick ") && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">{popout.slice(5)}</div>
                            <div className="popbody" style={{padding: 0}}>
                                {Object.keys(resultsFor(popout.slice(5))).map(result => {
                                    const kind = popout.slice(5)
                                    const held = conditions.some(c => c.name === kind && c.result === result)
                                    return (
                                        <button type="button" key={result} className={held ? "pickRow taken" : "pickRow"} onClick={() => {
                                            if (held) return
                                            setConditions(prev => [...prev, {name: kind, result: result}])
                                            setPopout(null)
                                        }}>
                                            <b>{result}{held ? " \u2014 already applied" : ""}</b>
                                            <span>{resultsFor(kind)[result].note}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {popout === "roster" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Room {room}</div>
                            <div className="popbody" style={{padding: 0}}>
                                {roster.length === 0 && <p style={{padding: ".6em .7em"}}>Nobody has published a character to this room yet.</p>}
                                {roster.map(entry => (
                                    <button type="button" key={entry.player_id} className="pickRow" onClick={() => {
                                        // looking at somebody else's sheet, so stop saving before loading it
                                        setViewing(entry.name)
                                        loadSnapshot(entry.sheet)
                                        setPopout(null)
                                    }}>
                                        <b>{entry.name}</b>
                                        <span>last updated {new Date(entry.updated_at).toLocaleString()}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "addTtp" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Add</div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout("pickTrait")}>Add A Trait</button>
                                <button type="button" className="go" onClick={() => {
                                    // just a blank line to write whatever the table has agreed on
                                    setTtp([...ttp, {name: "", note: ""}])
                                    setPopout(null)
                                }}>Add Other</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "pickTrait" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Add A Trait</div>
                            <div className="popbody" style={{padding: 0}}>
                                {traitList.length === 0 && (
                                    <p style={{padding: ".6em .7em"}}>No traits have been written up yet.</p>
                                )}
                                {traitList.map(trait => {
                                    const held = ttp.some(row => traitFor(row.name)?.base === trait.base)
                                    return (
                                        <button type="button" key={trait.base} className={held ? "pickRow taken" : "pickRow"} onClick={() => {
                                            if (held) return
                                            // a trait with blanks has to be filled in before it means anything
                                            if (trait.fields && trait.fields.length > 0) {
                                                setTraitPick(trait.base)
                                                setTraitValues({})
                                                setPopout("traitNumber")
                                                return
                                            }
                                            setTtp([...ttp, {name: trait.name, note: trait.text.join(" ")}])
                                            setPopout(null)
                                        }}>
                                            <b>{trait.name}{held ? " \u2014 already on the sheet" : ""}</b>
                                            <span>{trait.text[0]}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {diceTray}

                {popout === "traitNumber" && (() => {
                    const trait = traitList.find(tr => tr.base === traitPick)
                    if (!trait) return null
                    const fields = trait.fields ?? []
                    const ready = fields.every(f => (traitValues[f.token] ?? "").trim() !== "")
                    return (
                        <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                            <div className="popout">
                                <div className="pophead">{trait.name}</div>
                                <div className="popbody">
                                    {trait.text.map((para, i) => <p key={i}>{para}</p>)}
                                    {fields.map(f => (
                                        <div key={f.token}>
                                            <p className="fineprint">{f.label}</p>
                                            {f.kind === "choice" ? (
                                                <div className="traitChoice">
                                                    {(f.options ?? []).map(opt => (
                                                        <button
                                                            type="button"
                                                            key={opt.value}
                                                            className={traitValues[f.token] === opt.value ? "chosen" : ""}
                                                            onClick={() => setTraitValues({...traitValues, [f.token]: opt.value})}
                                                        ><b>{opt.value}</b><span>{opt.label}</span></button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="popInput"
                                                    value={traitValues[f.token] ?? ""}
                                                    placeholder={f.label}
                                                    onChange={e => setTraitValues({...traitValues, [f.token]: e.target.value})}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="popfoot">
                                    <button type="button" onClick={() => setPopout(null)}>Cancel</button>
                                    <button type="button" className="go" onClick={() => {
                                        if (!ready) return
                                        const inText = fields.filter(f => f.token === "X" || f.token === "*")
                                        setTtp([...ttp, {
                                            name: fillTrait(trait.name, fields, traitValues, true),
                                            note: fillTrait(trait.text.join(" "), inText, traitValues),
                                        }])
                                        setPopout(null)
                                    }}>Add</button>
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {popout === "shrugged" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Shrugged Off</div>
                            <div className="popbody">
                                <p>You are Frenzied, so {shrugged} does not take hold. The rage carries you straight through it.</p>
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "fear1" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Fear or Horror?</div>
                            <div className="popbody">
                                <p className="fineprint">Panic covers mundane shock. Horror covers supernatural terrors.</p>
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => {setFearKind("Fear"); setPopout("fearRoll")}}>Fear</button>
                                <button type="button" className="go" onClick={() => {setFearKind("Horror"); setPopout("horrorRoll")}}>Horror</button>
                            </div>
                        </div>
                    </div>
                )}

                {(popout === "fearRoll" || popout === "horrorRoll") && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Roll a d100. What did you get?</div>
                            <div className="popbody" style={{padding: 0}}>
                                {(popout === "fearRoll" ? panicTable : horrorTable).map(row => (
                                    <button type="button" key={row.range} className="pickRow" onClick={() => {
                                        setFearRow(row)
                                        setFearNum("")
                                        setFearNum2("")
                                        // some results need a second roll or a choice before they land
                                        const needsMore = ["Manic Terror", "Hopeless and Despairing", "Blackout", "Mind Break", "Scared to Death"]
                                        setPopout(needsMore.includes(row.name) ? "fearMore" : "fearApply")
                                    }}><b>{row.range}</b><span>{row.name}</span></button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {popout === "fearApply" && fearRow && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">{fearRow.name}</div>
                            <div className="popbody">
                                <p>{fearRow.text}</p>
                            </div>
                            <div className="popfoot">
                                <button type="button" onClick={() => setPopout(null)}>Cancel</button>
                                <button type="button" className="go" onClick={() => applyFear(fearRow, 0, "")}>Apply</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "fearMore" && fearRow && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">{fearRow.name}</div>
                            <div className="popbody">
                                <p>{fearRow.text}</p>

                                {fearRow.name === "Manic Terror" && (
                                    <>
                                        <p className="fineprint">Roll 1d4 for the Stamina you lose once the rampage ends.</p>
                                        <input type="text" className="popInput" value={fearNum} onChange={e => setFearNum(e.target.value)} placeholder="1d4"/>
                                    </>
                                )}
                                {fearRow.name === "Hopeless and Despairing" && (
                                    <>
                                        <p className="fineprint">Roll 1d6 for how many rounds you spend on the ground.</p>
                                        <input type="text" className="popInput" value={fearNum} onChange={e => setFearNum(e.target.value)} placeholder="1d6"/>
                                    </>
                                )}
                                {fearRow.name === "Blackout" && (
                                    <>
                                        <p className="fineprint">Roll 1d4 for how many hours you are out.</p>
                                        <input type="text" className="popInput" value={fearNum} onChange={e => setFearNum(e.target.value)} placeholder="1d4"/>
                                    </>
                                )}
                                {fearRow.name === "Mind Break" && (
                                    <>
                                        <p className="fineprint">Roll 1d6 for how many rounds you spend stuttering on the ground.</p>
                                        <input type="text" className="popInput" value={fearNum} onChange={e => setFearNum(e.target.value)} placeholder="1d6"/>
                                        <p className="fineprint">Roll 1d8. That much comes permanently off whichever characteristic you pick below.</p>
                                        <input type="text" className="popInput" value={fearNum2} onChange={e => setFearNum2(e.target.value)} placeholder="1d8"/>
                                    </>
                                )}
                                {fearRow.name === "Scared to Death" && (
                                    <p className="fineprint">Make the Endurance test now.</p>
                                )}
                            </div>
                            <div className="popfoot">
                                {fearRow.name === "Mind Break" && (
                                    <>
                                        <button type="button" className="go" onClick={() => applyFear(fearRow, Number(fearNum) || 1, "Willpower")}>Lose Willpower</button>
                                        <button type="button" className="go" onClick={() => applyFear(fearRow, Number(fearNum) || 1, "Personality")}>Lose Personality</button>
                                    </>
                                )}
                                {fearRow.name === "Scared to Death" && (
                                    <>
                                        <button type="button" className="go" onClick={() => applyFear(fearRow, Number(fearNum) || 1, "survived")}>I passed</button>
                                        <button type="button" className="go" onClick={() => applyFear(fearRow, 0, "died")}>I failed</button>
                                    </>
                                )}
                                {fearRow.name !== "Mind Break" && fearRow.name !== "Scared to Death" && (
                                    <>
                                        <button type="button" onClick={() => setPopout(null)}>Cancel</button>
                                        <button type="button" className="go" onClick={() => applyFear(fearRow, Number(fearNum) || 1, "")}>Apply</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {popout === "fearDone" && fearRow && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">{fearRow.name}</div>
                            <div className="popbody">
                                {recap.map((line, i) => <p key={i}>{line}</p>)}
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "wound1" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Add Wound</div>
                            <div className="popbody">
                                <p>Did you take damage from a single attack (including enchantments and poisons) that exceeded {Number(charInfo.get("WT") ?? 0) + wtMod}?</p>
                                <p className="fineprint">How much damage was it? The wound cures itself once you have healed this much after treating it.</p>
                                <input type="text" className="popInput" value={woundDamage} onChange={e => setWoundDamage(e.target.value)} placeholder="damage"/>
                            </div>
                            <div className="popfoot">
                                <button type="button" onClick={() => setPopout(null)}>Cancel</button>
                                <button type="button" className="go" onClick={() => setPopout("wound2")}>Yes</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "wound2" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Where were you hit?</div>
                            <div className="popbody" style={{padding: 0}}>
                                {["Head (Ear)", "Head (Eye)", "Left Arm", "Right Arm", "Left Leg", "Right Leg", "Body"].map(part => (
                                    <button type="button" key={part} className="pickRow" onClick={() => {
                                        setWoundPart(part)
                                        setPopout("wound3")
                                    }}><b>{part}</b></button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {popout === "wound3" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Shock Test</div>
                            <div className="popbody">
                                <p>Did you succeed on your Shock Test (Endurance)?</p>
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => {
                                    setWoundShockPassed(true)
                                    setPopout("wound5")
                                }}>Yes</button>
                                <button type="button" className="go" onClick={() => {
                                    setWoundShockPassed(false)
                                    // a failed test costs a part, and the sheet tracks left and right separately
                                    setPopout(needsSide ? "wound4" : "wound5")
                                }}>No</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "wound4" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Which side?</div>
                            <div className="popbody">
                                <p>The shock test failed, so the {woundPart === "Head (Ear)" ? "ear" : "eye"} is lost. Which one?</p>
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => {setWoundSide("Left"); setPopout("wound5")}}>Left</button>
                                <button type="button" className="go" onClick={() => {setWoundSide("Right"); setPopout("wound5")}}>Right</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "wound5" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Magic Damage</div>
                            <div className="popbody">
                                <p>Was the wound caused by magic damage?</p>
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => applyWound("")}>No</button>
                                <button type="button" className="go" onClick={() => setPopout("wound6")}>Yes</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "wound6" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">What type?</div>
                            <div className="popbody">
                                <p className="fineprint">If the wound is from an attack which includes multiple magic damage types, the type that contributed the most damage determines this effect. In case of a tie, the attacker chooses which effect is applied.</p>
                            </div>
                            <div className="popbody" style={{padding: 0}}>
                                {["Fire", "Magic, Frost, or Poison", "Shock"].map(kind => (
                                    <button type="button" key={kind} className="pickRow" onClick={() => applyWound(kind)}><b>{kind}</b></button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {popout === "woundFire" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Wound Taken</div>
                            <div className="popbody">
                                {woundLines.map((line, i) => <p key={i}>{line}</p>)}
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>I passed</button>
                                <button type="button" className="go" onClick={() => {
                                    addCondition("Burning")
                                    setPopout(null)
                                }}>I failed</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "woundDone" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Wound Taken</div>
                            <div className="popbody">
                                {woundLines.map((line, i) => <p key={i}>{line}</p>)}
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "roundOver" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Round Over</div>
                            <div className="popbody">
                                <p>{apRefreshed ? "Your AP is back up to full." : "You are Stunned, so your AP does not come back this round."}</p>
                                {recap.length > 0 && <div className="recapHead">Your conditions:</div>}
                                {recap.map((line, i) => <p key={i}>{line}</p>)}
                            </div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "noAp" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">No Action Points</div>
                            <div className="popbody"><p>You have 0 AP remaining and cannot take this action.</p></div>
                            <div className="popfoot">
                                <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {popout === "shortRest" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Short Rest</div>
                            <div className="popbody">
                                <p>A short rest is an hour long period of downtime in which the character performs no strenuous physical activity.</p>
                                <p>At the end of a short rest, a character regenerates one Stamina Point or removes one level of fatigue. Additionally, they recover a number of Magicka Points determined by dropping the ones place from their Maximum MP. So, if a character&#8217;s Maximum Magicka is 56, they recover 5 Magicka.</p>
                            </div>

                            {restLines && (
                                <div className="result">
                                    {restLines.map((line, i) => <p key={i}>{line}</p>)}
                                </div>
                            )}

                            <div className="popfoot">
                                {!restLines && <button type="button" onClick={() => setPopout(null)}>Cancel</button>}
                                {!restLines && <button type="button" className="go" onClick={() => doShortRest("stamina")}>Rest, recover Stamina</button>}
                                {!restLines && <button type="button" className="go" onClick={() => doShortRest("fatigue")}>Rest, shed fatigue</button>}
                                {restLines && <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>}
                            </div>
                        </div>
                    </div>
                )}

                {popout === "longRest" && (
                    <div className="scrim" onClick={e => {if (e.target === e.currentTarget) setPopout(null)}}>
                        <div className="popout">
                            <div className="pophead">Long Rest</div>
                            <div className="popbody">
                                <p>A long rest is an 8 hour long period of downtime in which the character performs no strenuous physical activity.</p>
                                <p>At the end of a long rest, a character removes a number of levels of fatigue/regains SP (assuming all fatigue is removed first) equal to their Endurance bonus, heals an amount of Health Points equal to their Endurance bonus (as long as they have no untreated wounds), and regenerates all of their missing Magicka Points. Many powers also recharge at the end of a long rest.</p>
                                <p>Their natural healing is doubled if the character is focused entirely on healing themselves or if another person is caring for them.</p>
                                <p>A character cannot benefit from more than one long rest in a 24 hour period and must be conscious at the start to gain its benefits.</p>
                            </div>

                            {restLines && (
                                <div className="result">
                                    {restLines.map((line, i) => <p key={i}>{line}</p>)}
                                </div>
                            )}

                            <div className="popfoot">
                                {!restLines && <button type="button" onClick={() => setPopout(null)}>Cancel</button>}
                                {!restLines && <button type="button" className="go" onClick={() => doLongRest(false)}>Rest</button>}
                                {!restLines && <button type="button" className="go" onClick={() => doLongRest(true)}>Rest and Convalesce</button>}
                                {restLines && <button type="button" className="go" onClick={() => setPopout(null)}>Close</button>}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        )
    }

    return (
        <>
            <section id="center">
                <div>
                    <h1>Thrump's Character Manager</h1>
                    <p>
                        Upload an online filled out PDF of your character sheet to get started.
                    </p>
                </div>

                <input type="file" id="charPDF" name="charPDF" accept=".pdf" onChange={handleFile}/>

                <button type="button" className="backLink" onClick={() => setRole("")}>back</button>
            </section>
        </>
    )
}

export default App