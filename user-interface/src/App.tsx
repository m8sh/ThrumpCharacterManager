import './App.css'
import {fileHandler} from './index.ts'
import {PDFDocument} from 'pdf-lib'
import {useState, useEffect, Fragment, type ChangeEvent} from "react";

type CharInfo = Map<string, string | boolean | undefined>

// the pdf shortens the ranks and an empty rank means untrained
const rankNames: Record<string, string> = {
    "": "Untrained", "Novi.": "Novice", "Appr.": "Apprentice",
    "Jour.": "Journeyman", "Adep.": "Adept", "Expe.": "Expert", "Mast.": "Master",
}

// the three characteristics a frenzy does not get in the way of
const physicalChars = ["Str", "Ag", "End"]

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

type Cond = {name: string, value?: number, part?: string, fresh?: boolean, auto?: boolean, why?: string}

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
    "Body": {note: "organ damage, half healing, -1 SP max and WT", wtMod: -1, spMaxMod: -1, halfHealing: true},
}

// losing a matched pair pulls a second condition along with it
const derivedRules: {when: (parts: string[], conds: Cond[]) => boolean, gives: string, why: string}[] = [
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
}> = {
    "Bleeding": {
        kind: "value",
        max: 99,
        note: "X damage a round, then X drops by 1",
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
        note: "one less Action Point each round",
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
        note: "+3 WT, +1 SB, -20 to non physical tests",
        wtMod: () => 3,
        sbMod: () => 1,
        // everything that is not strength, agility or endurance takes the penalty
        frenzyMod: () => -20,
        recap: () => "You are Frenzied. You must attack the nearest person or creature in melee combat each Turn if able, including allies, using only All Out Attacks. If you are not in range, you must move toward the nearest potential target. You are immune to stunned, fear, and passive wound effects.",
    },
    "Hidden": {
        kind: "flag",
        note: "movement costs double, cannot Dash",
        recap: () => "You are Hidden, so check the movement and line of sight rules.",
    },
    "Immobilized": {
        kind: "flag",
        note: "cannot move at all",
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
        note: "frozen, speech and motion free spells only",
        zeroSpeed: () => true,
        recap: () => "You are Paralyzed, unable to move any part of your body, and may only cast spells that do not require speech or motion.",
    },
    "Prone": {
        kind: "flag",
        note: "-20 to combat tests, movement costs double",
        csMod: () => -20,
        recap: () => "You are Prone, taking -20 on combat related tests, paying 2 meters of movement for every 1 you cover, and counting any full armor you wear as partial.",
    },
    "Restrained": {
        kind: "flag",
        note: "cannot move, attack or defend",
        zeroSpeed: () => true,
        recap: () => "You are Restrained and cannot move, attack or defend yourself, and may only cast spells that do not require motion.",
    },
    "Silenced": {
        kind: "flag",
        note: "-20 when casting spells",
        magicMod: () => -20,
        recap: () => "You are Silenced. You take the usual -20 for being unable to speak when casting spells, and may roll a Perception test at the start of each round to realise what is happening.",
    },
    "Stunned": {
        kind: "flag",
        note: "no Action Points, and none come back",
        recap: () => "You are Stunned and do not regain Action Points at the start of the round.",
    },
    "Unconscious": {
        kind: "flag",
        note: "knocked out, cannot act",
        zeroSpeed: () => true,
        recap: () => "You are Unconscious and may not take actions. Gaining a level of fatigue now would kill you.",
    },
    "Invisible": {
        kind: "flag",
        note: "cannot be seen, attackers take -30",
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
            {text: "Once the encounter has ended, the character snaps out of their frenzied state and loses 2 SP (this cannot kill them). The char- acter can also test Willpower at a -20 as a Secondary Action during combat to attempt to snap out of frenzy, which ends the condition."},
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

// a characteristic bonus is the tens digit of the score
function bonusFrom(info: CharInfo, key: string) {
    return Math.floor((Number(info.get(key)) || 0) / 10)
}

// speed can be written as a plain number or as a little sum like 10 - 1
function addUp(text: string) {
    const parts = String(text).replace(/\s+/g, "").match(/[+-]?\d+/g)
    if (!parts) return NaN
    return parts.reduce((a, b) => a + Number(b), 0)
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
    const [woundLines, setWoundLines] = useState<string[]>([])
    const [popout, setPopout] = useState<string | null>(null)
    const [restLines, setRestLines] = useState<string[] | null>(null)

    // anything in this list being edited saves the sheet again
    useEffect(() => {
        if (!charInfo) return
        try {
            localStorage.setItem(saveKey, JSON.stringify({
                // a Map does not survive being turned into text so store it as pairs
                charInfo: Array.from(charInfo),
                languages, mode, panel, inventory, ttp, specializations,
                rituals, spells, melee, ranged, openActions, conditions,
                woundList: wounds, shield, armorNotes,
            }))
        } catch {
            // running out of space or private browsing should not break the sheet
        }
    }, [charInfo, languages, mode, panel, inventory, ttp, specializations,
        rituals, spells, melee, ranged, openActions, conditions, wounds,
        shield, armorNotes])

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
        derivedRules.forEach(rule => {
            const owed = rule.when(partsHit, conditions)
            const already = conditions.some(c => c.name === rule.gives) || derived.some(c => c.name === rule.gives)
            if (owed && !already) derived.push({name: rule.gives, value: 1, auto: true, why: rule.why})
        })
        const allConditions = [...conditions, ...derived]

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
        const untreated = wounds.filter(w => !w.treated)
        const woundTestMod = untreated.length * -20
        const woundIrMod = untreated.length * -2

        const testMod = modOf("testMod") + woundTestMod
        const csMod = modOf("csMod")
        const magicMod = modOf("magicMod")
        const wtMod = modOf("wtMod")
        const apMaxMod = modOf("apMaxMod")
        const spMaxMod = modOf("spMaxMod")
        const frenzyMod = modOf("frenzyMod")
        const sbMod = modOf("sbMod")
        const halfSpeed = allConditions.some(c => conditionTypes[c.name].halfSpeed !== undefined)
        const zeroSpeed = allConditions.some(c => conditionTypes[c.name].zeroSpeed !== undefined)

        // a character never drops below one action point no matter how dazed they are
        const shownApMax = Math.max(1, Number(charInfo.get("Max AP") ?? 0) + apMaxMod)
        const shownSpMax = Math.max(0, Number(charInfo.get("Max SP") ?? 0) + spMaxMod)
        const baseSpeed = addUp(String(charInfo.get("Current Speed") ?? ""))
        const shownSpeed = zeroSpeed ? "0"
            : halfSpeed && !isNaN(baseSpeed) ? String(Math.ceil(baseSpeed / 2))
                : String(charInfo.get("Current Speed") ?? "")

        // an ear or eye wound needs a side, everything else already names its part
        const woundTarget = woundPart === "Head (Ear)" ? woundSide + " Ear"
            : woundPart === "Head (Eye)" ? woundSide + " Eye"
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
                if (!conditions.some(c => c.name === "Stunned")) added.push({name: "Stunned"})
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

        const nameOf = (c: Cond) => {
            const type = conditionTypes[c.name]
            if (type.label) return type.label(c)
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
                        <div>{rankNames[String(charInfo.get("Alteration Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Alteration Rank") ? String(charInfo.get("Alteration Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Alteration Rank") ? Number(charInfo.get("Alteration Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Conjuration</div>
                        <div>{rankNames[String(charInfo.get("Conjuration Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Conjuration Rank") ? String(charInfo.get("Conjuration Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Conjuration Rank") ? Number(charInfo.get("Conjuration Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Destruction</div>
                        <div>{rankNames[String(charInfo.get("Destruction Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Destruction Rank") ? String(charInfo.get("Destruction Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Destruction Rank") ? Number(charInfo.get("Destruction Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Illusion</div>
                        <div>{rankNames[String(charInfo.get("Illusion Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Illusion Rank") ? String(charInfo.get("Illusion Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Intelligence <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Illusion Rank") ? Number(charInfo.get("Illusion Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Mysticism</div>
                        <div>{rankNames[String(charInfo.get("Mysticism Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Mysticism Rank") ? String(charInfo.get("Mysticism Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Wp")) + (charInfo.get("Mysticism Rank") ? Number(charInfo.get("Mysticism Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Necromancy</div>
                        <div>{rankNames[String(charInfo.get("Necromancy Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Necromancy Rank") ? String(charInfo.get("Necromancy Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Intelligence <b className={testMod + frenzyMod + magicMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Necromancy Rank") ? Number(charInfo.get("Necromancy Bonus") ?? 0) : -20) + testMod + frenzyMod + magicMod}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Restoration</div>
                        <div>{rankNames[String(charInfo.get("Restoration Rank") ?? "")] ?? "Untrained"}</div>
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
                                <input
                                    type="text"
                                    value={trait.name}
                                    onChange={e => setTtp(ttp.map((old, j) => j === i ? {...old, name: e.target.value} : old))}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            const copy = [...ttp]
                                            copy.splice(i + 1, 0, {name: "", note: ""})
                                            setTtp(copy)
                                            setTimeout(() => {
                                                const rows = document.querySelectorAll<HTMLInputElement>("#center .ttp input")
                                                rows[(i + 1) * 2]?.focus()
                                            }, 0)
                                        }
                                        if (e.key === "Backspace" && trait.name === "" && trait.note === "" && ttp.length > 1) {
                                            e.preventDefault()
                                            setTtp(ttp.filter((_old, j) => j !== i))
                                            setTimeout(() => {
                                                const rows = document.querySelectorAll<HTMLInputElement>("#center .ttp input")
                                                rows[(i - 1) * 2]?.focus()
                                            }, 0)
                                        }
                                    }}
                                />
                            </div>
                            <div className="tnote">
                                <input
                                    type="text"
                                    value={trait.note}
                                    onChange={e => setTtp(ttp.map((old, j) => j === i ? {...old, note: e.target.value} : old))}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )

        return (
            <section id='center'>
                <div className="nameRow">
                    <div className="upload">
                        <button type="button" className="newChar" onClick={() => setPopout("newChar")}>Upload New Character</button>
                        <button type="button" className="savePdf" onClick={downloadPdf}>Download PDF</button>
                    </div>
                    <h1>{charInfo.get("Name")}</h1>
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
                            <input type="text" className="pair" id="xp" value={String(charInfo.get("Current XP") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Current XP", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="xpTotal" value={String(charInfo.get("Total XP") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Total XP", e.target.value))}/>
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
                                <div><input type="text" id="str" value={String(charInfo.get("Str") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Str", e.target.value))}/></div>
                                <div><input type="text" id="end" value={String(charInfo.get("End") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("End", e.target.value))}/></div>
                                <div><input type="text" id="ag" value={String(charInfo.get("Ag") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Ag", e.target.value))}/></div>
                                <div><input type="text" id="int" value={String(charInfo.get("Int") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Int", e.target.value))}/></div>
                                <div><input type="text" id="wp" value={String(charInfo.get("Wp") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Wp", e.target.value))}/></div>
                                <div><input type="text" id="prc" value={String(charInfo.get("Prc") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Prc", e.target.value))}/></div>
                                <div><input type="text" id="prs" value={String(charInfo.get("Prs") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Prs", e.target.value))}/></div>
                                <div><input type="text" id="lck" value={String(charInfo.get("Lck") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Lck", e.target.value))}/></div>
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
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current HP", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="hpMax"
                                   value={String(charInfo.get("Max HP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max HP", e.target.value))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.min(100, 100 * Number(charInfo.get("Current HP")) / Number(charInfo.get("Max HP")) || 0) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Magicka Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="mp"
                                   value={String(charInfo.get("Current MP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current MP", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="mpMax"
                                   value={String(charInfo.get("Max MP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max MP", e.target.value))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.min(100, 100 * Number(charInfo.get("Current MP")) / Number(charInfo.get("Max MP")) || 0) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Stamina Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="sp"
                                   value={String(charInfo.get("Current SP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current SP", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className={spMaxMod !== 0 ? "pair modded" : "pair"} id="spMax"
                                   value={String(shownSpMax)}
                                   readOnly={spMaxMod !== 0}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max SP", e.target.value))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.min(100, 100 * Number(charInfo.get("Current SP")) / shownSpMax || 0) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Luck Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="lp"
                                   value={String(charInfo.get("Current LP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current LP", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="lpMax"
                                   value={String(charInfo.get("Max LP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max LP", e.target.value))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.min(100, 100 * Number(charInfo.get("Current LP")) / Number(charInfo.get("Max LP")) || 0) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Action Points</div>
                        <div className="band val">
                            <input type="text" className="pair" id="ap"
                                   value={String(charInfo.get("Current AP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Current AP", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className={apMaxMod !== 0 ? "pair modded" : "pair"} id="apMax"
                                   value={String(shownApMax)}
                                   readOnly={apMaxMod !== 0}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max AP", e.target.value))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.min(100, 100 * Number(charInfo.get("Current AP")) / shownApMax || 0) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Speed</div>
                        <div className="band val">
                            <input type="text" className={halfSpeed || zeroSpeed ? "pair modded" : "pair"} id="speed"
                                   value={shownSpeed}
                                   readOnly={halfSpeed || zeroSpeed}
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
                                                         onChange={e => setCharInfo(new Map(charInfo).set("WT", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Initiative Rating</div>
                        <div className="band val"><input type="text" id="ir" className={woundIrMod !== 0 ? "modded" : ""}
                                                         value={String(Number(charInfo.get("IR") ?? 0) + woundIrMod)}
                                                         readOnly={woundIrMod !== 0}
                                                         onChange={e => setCharInfo(new Map(charInfo).set("IR", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Linguistics</div>
                        <div className="band val"><input type="text" id="linguistics" value={String(charInfo.get("Linguistics") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Linguistics", e.target.value))}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Encumbrance / Carry Rating</div>
                        <div className="band val">
                            <input type="text" className="pair" id="enc" value={String(charInfo.get("Encumbrance") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Encumbrance", e.target.value))}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="cr" value={String(charInfo.get("Carry Rating") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Carry Rating", e.target.value))}/>
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
                                    <div>{rankNames[String(charInfo.get("Acrobatics Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Acrobatics Rank") ? String(charInfo.get("Acrobatics Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Acrobatics Rank") ? Number(charInfo.get("Acrobatics Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Agility <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Acrobatics Rank") ? Number(charInfo.get("Acrobatics Bonus") ?? 0) : -20) + testMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Alchemy</div>
                                    <div>{rankNames[String(charInfo.get("Alchemy Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Alchemy Rank") ? String(charInfo.get("Alchemy Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Alchemy Rank") ? Number(charInfo.get("Alchemy Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Athletics</div>
                                    <div>{rankNames[String(charInfo.get("Athletics Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Athletics Rank") ? String(charInfo.get("Athletics Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Athletics Rank") ? Number(charInfo.get("Athletics Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Endurance <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("End")) + (charInfo.get("Athletics Rank") ? Number(charInfo.get("Athletics Bonus") ?? 0) : -20) + testMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Command</div>
                                    <div>{rankNames[String(charInfo.get("Command Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Command Rank") ? String(charInfo.get("Command Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Commerce</div>
                                    <div>{rankNames[String(charInfo.get("Commerce Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Commerce Rank") ? String(charInfo.get("Commerce Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Commerce Rank") ? Number(charInfo.get("Commerce Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Commerce Rank") ? Number(charInfo.get("Commerce Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Deceive</div>
                                    <div>{rankNames[String(charInfo.get("Deceive Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Deceive Rank") ? String(charInfo.get("Deceive Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Deceive Rank") ? Number(charInfo.get("Deceive Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Deceive Rank") ? Number(charInfo.get("Deceive Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Enchant</div>
                                    <div>{rankNames[String(charInfo.get("Enchant Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Enchant Rank") ? String(charInfo.get("Enchant Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Enchant Rank") ? Number(charInfo.get("Enchant Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Evade</div>
                                    <div>{rankNames[String(charInfo.get("Evade Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Evade Rank") ? String(charInfo.get("Evade Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Evade Rank") ? Number(charInfo.get("Evade Bonus") ?? 0) : -20) + testMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Investigate</div>
                                    <div>{rankNames[String(charInfo.get("Investigate Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Investigate Rank") ? String(charInfo.get("Investigate Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Investigate Rank") ? Number(charInfo.get("Investigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Investigate Rank") ? Number(charInfo.get("Investigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Logic</div>
                                    <div>{rankNames[String(charInfo.get("Logic Rank") ?? "")] ?? "Untrained"}</div>
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
                                    <div>{rankNames[String(charInfo.get("Lore Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Lore Rank") ? String(charInfo.get("Lore Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Lore Rank") ? Number(charInfo.get("Lore Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Navigate</div>
                                    <div>{rankNames[String(charInfo.get("Navigate Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Navigate Rank") ? String(charInfo.get("Navigate Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Navigate Rank") ? Number(charInfo.get("Navigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Navigate Rank") ? Number(charInfo.get("Navigate Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Observe</div>
                                    <div>{rankNames[String(charInfo.get("Observe Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Observe Rank") ? String(charInfo.get("Observe Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Observe Rank") ? Number(charInfo.get("Observe Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Persuade</div>
                                    <div>{rankNames[String(charInfo.get("Persuade Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Persuade Rank") ? String(charInfo.get("Persuade Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Str")) + (charInfo.get("Persuade Rank") ? Number(charInfo.get("Persuade Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Personality <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prs")) + (charInfo.get("Persuade Rank") ? Number(charInfo.get("Persuade Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Ride</div>
                                    <div>{rankNames[String(charInfo.get("Ride Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Ride Rank") ? String(charInfo.get("Ride Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Ride Rank") ? Number(charInfo.get("Ride Bonus") ?? 0) : -20) + testMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Stealth</div>
                                    <div>{rankNames[String(charInfo.get("Stealth Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Stealth Rank") ? String(charInfo.get("Stealth Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Stealth Rank") ? Number(charInfo.get("Stealth Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Stealth Rank") ? Number(charInfo.get("Stealth Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Subterfuge</div>
                                    <div>{rankNames[String(charInfo.get("Subterfuge Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Subterfuge Rank") ? String(charInfo.get("Subterfuge Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b className={testMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Ag")) + (charInfo.get("Subterfuge Rank") ? Number(charInfo.get("Subterfuge Bonus") ?? 0) : -20) + testMod}</b></span>
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Subterfuge Rank") ? Number(charInfo.get("Subterfuge Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Survival</div>
                                    <div>{rankNames[String(charInfo.get("Survival Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Survival Rank") ? String(charInfo.get("Survival Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Int")) + (charInfo.get("Survival Rank") ? Number(charInfo.get("Survival Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                        <span>Perception <b className={testMod + frenzyMod !== 0 ? "modded" : ""}>{Number(charInfo.get("Prc")) + (charInfo.get("Survival Rank") ? Number(charInfo.get("Survival Bonus") ?? 0) : -20) + testMod + frenzyMod}</b></span>
                                    </div>
                                </div>
                                {charInfo.get("Profession 1") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 1"))}</div>
                                        <div>{rankNames[String(charInfo.get("Profession 1 Rank") ?? "")] ?? "Untrained"}</div>
                                        <div>{charInfo.get("Profession 1 Rank") ? String(charInfo.get("Profession 1 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p1Char] ?? p1Char} <b className={testMod + (physicalChars.includes(p1Char) ? 0 : frenzyMod) !== 0 ? "modded" : ""}>{Number(charInfo.get(p1Char) ?? 0) + (charInfo.get("Profession 1 Rank") ? Number(charInfo.get("Profession 1 Bonus") ?? 0) : -20) + testMod + (physicalChars.includes(p1Char) ? 0 : frenzyMod)}</b></span>
                                        </div>
                                    </div>
                                )}
                                {charInfo.get("Profession 2") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 2"))}</div>
                                        <div>{rankNames[String(charInfo.get("Profession 2 Rank") ?? "")] ?? "Untrained"}</div>
                                        <div>{charInfo.get("Profession 2 Rank") ? String(charInfo.get("Profession 2 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p2Char] ?? p2Char} <b className={testMod + (physicalChars.includes(p2Char) ? 0 : frenzyMod) !== 0 ? "modded" : ""}>{Number(charInfo.get(p2Char) ?? 0) + (charInfo.get("Profession 2 Rank") ? Number(charInfo.get("Profession 2 Bonus") ?? 0) : -20) + testMod + (physicalChars.includes(p2Char) ? 0 : frenzyMod)}</b></span>
                                        </div>
                                    </div>
                                )}
                                {charInfo.get("Profession 3") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 3"))}</div>
                                        <div>{rankNames[String(charInfo.get("Profession 3 Rank") ?? "")] ?? "Untrained"}</div>
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
                                            <div className="band val"><input type="text" value={String(charInfo.get("Drakes") ?? "")} onChange={e => setCharInfo(new Map(charInfo).set("Drakes", e.target.value))}/></div>
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
                                <h3>Armor</h3>

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
                                        <span>{rankNames[String(charInfo.get("Combat Style Rank") ?? "")] ?? "Untrained"}</span>
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
                                                    ? (w.damage > 0 ? "healed " + w.healed + " of the " + w.damage + " needed to cure" : "cure it by hand once the damage is healed")
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
                                                <span className="condNote">{conditionTypes[c.name].shortOf ? conditionTypes[c.name].shortOf!(c) : conditionTypes[c.name].note}</span>
                                                <div className="condTools">
                                                    {(conditionTypes[c.name].kind === "levels" || conditionTypes[c.name].kind === "value") && (
                                                        <button type="button" onClick={() => {
                                                            // stepping below 1 means the condition is simply gone
                                                            if ((c.value ?? 1) > 1) setConditions(conditions.map((old, j) => j === i ? {...old, value: (old.value ?? 1) - 1} : old))
                                                            else setConditions(conditions.filter((_old, j) => j !== i))
                                                        }}>&#8722;</button>
                                                    )}
                                                    {(conditionTypes[c.name].kind === "levels" || conditionTypes[c.name].kind === "value") && (
                                                        <button type="button" onClick={() => {
                                                            if ((c.value ?? 1) < (conditionTypes[c.name].max ?? 99)) setConditions(conditions.map((old, j) => j === i ? {...old, value: (old.value ?? 1) + 1} : old))
                                                        }}>+</button>
                                                    )}
                                                    {/* an automatic condition leaves when its cause does, so there is nothing to press */}
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
                            const stunned = allConditions.some(c => c.name === "Stunned")
                            if (!stunned) next.set("Current AP", String(shownApMax))
                            setApRefreshed(!stunned)

                            const lines: string[] = []
                            const kept: Cond[] = []
                            let hp = Number(next.get("Current HP")) || 0

                            // an untreated wound bleeds, and after five rounds it drops you
                            const woundsAfter = wounds.map(w => {
                                if (w.treated) return w
                                const left = w.rounds - 1
                                if (left <= 0) {
                                    hp = 0
                                    lines.push("Your untreated wound on your " + w.part + " has bled you out. You are at 0 HP.")
                                } else {
                                    lines.push("You currently have an untreated wound on your " + w.part + " so you will pass out from blood loss after " + left + " more round" + (left === 1 ? "" : "s") + ".")
                                }
                                return {...w, rounds: Math.max(0, left)}
                            })
                            setWounds(woundsAfter)

                            conditions.forEach(c => {
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
                                kept.push(c)
                                const say = conditionTypes[c.name].recap
                                if (say) lines.push(say(c))
                            })

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
                                        <div className="actHead groupHead" onClick={() => setOpenActions(openActions.includes("group Conditions") ? openActions.filter(n => n !== "group Conditions") : [...openActions, "group Conditions"])}>
                                            <span>Conditions</span>
                                            <span className="ap">{conditionRules.length}</span>
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
                                    const taken = conditionTypes[name].kind !== "part" && allConditions.some(c => c.name === name)
                                    return (
                                        <button type="button" key={name} className={taken ? "pickRow taken" : "pickRow"} onClick={() => {
                                            if (taken) return
                                            if (conditionTypes[name].kind === "part") {
                                                setPopout("part " + name)
                                                return
                                            }
                                            setConditions([...conditions, {name: name, value: 1, fresh: name === "Bleeding"}])
                                            // the rage grants a stamina point that is allowed to sit above the maximum
                                            if (name === "Frenzied") setCharInfo(new Map(charInfo).set("Current SP", String(Number(charInfo.get("Current SP") ?? 0) + 1)))
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
                                    if (!conditions.some(c => c.name === "Burning")) setConditions([...conditions, {name: "Burning", value: 1}])
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
            </section>
        </>
    )
}

export default App