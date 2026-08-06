import './App.css'
import {fileHandler} from './index.ts'
import {useState, Fragment, type ChangeEvent} from "react";

type CharInfo = Map<string, string | boolean | undefined>

// the pdf shortens the ranks and an empty rank means untrained
const rankNames: Record<string, string> = {
    "": "Untrained", "Novi.": "Novice", "Appr.": "Apprentice",
    "Jour.": "Journeyman", "Adep.": "Adept", "Expe.": "Expert", "Mast.": "Master",
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

function App() {
    const [charInfo, setCharInfo] = useState<CharInfo | null>(null)
    const [languages, setLanguages] = useState<string[]>([])
    const [mode, setMode] = useState<string | null>(null)
    const [panel, setPanel] = useState<string | null>(null)
    const [inventory, setInventory] = useState<{name: string, enc: string}[]>([])
    const [ttp, setTtp] = useState<{name: string, note: string}[]>([])
    const [specializations, setSpecializations] = useState<string[]>([])
    const [rituals, setRituals] = useState<string[]>([])
    const [spells, setSpells] = useState<{name: string, attr: string, desc: string, levels: {lvl: string, cost: string, str: string}[]}[]>([])
    const [melee, setMelee] = useState<{name: string, dmg: string, hand: string, reach: string, enc: string, notes: string}[]>([])
    const [ranged, setRanged] = useState<{name: string, dmg: string, hand: string, reach: string, enc: string, notes: string}[]>([])
    const [openActions, setOpenActions] = useState<string[]>([])

    async function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return
        const PDFInput : ArrayBuffer = await file.arrayBuffer()
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

        // if weapons come up empty check these key names against the console log
        const meleeList = []
        for (let i = 1; i <= 5; i++) {
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
        for (let i = 1; i <= 5; i++) {
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
    }

    if (charInfo) {
        // professions only say which characteristic they use inside their tn text
        const p1Char = String(charInfo.get("Profession 1 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
        const p2Char = String(charInfo.get("Profession 2 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
        const p3Char = String(charInfo.get("Profession 3 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""

        // total enc is just the sum of whatever enc numbers are filled in
        const totalEnc = inventory.reduce((sum, item) => sum + (Number(item.enc) || 0), 0)

        // spending an ap and refreshing them, shared by every take this action button
        const spendAp = () => setCharInfo(new Map(charInfo).set("Current AP", String(Math.max(0, Number(charInfo.get("Current AP")) - 1))))

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
                            <span>Willpower <b>{Number(charInfo.get("Wp")) + (charInfo.get("Alteration Rank") ? Number(charInfo.get("Alteration Bonus") ?? 0) : -20)}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Conjuration</div>
                        <div>{rankNames[String(charInfo.get("Conjuration Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Conjuration Rank") ? String(charInfo.get("Conjuration Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b>{Number(charInfo.get("Wp")) + (charInfo.get("Conjuration Rank") ? Number(charInfo.get("Conjuration Bonus") ?? 0) : -20)}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Destruction</div>
                        <div>{rankNames[String(charInfo.get("Destruction Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Destruction Rank") ? String(charInfo.get("Destruction Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b>{Number(charInfo.get("Wp")) + (charInfo.get("Destruction Rank") ? Number(charInfo.get("Destruction Bonus") ?? 0) : -20)}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Illusion</div>
                        <div>{rankNames[String(charInfo.get("Illusion Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Illusion Rank") ? String(charInfo.get("Illusion Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Illusion Rank") ? Number(charInfo.get("Illusion Bonus") ?? 0) : -20)}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Mysticism</div>
                        <div>{rankNames[String(charInfo.get("Mysticism Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Mysticism Rank") ? String(charInfo.get("Mysticism Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b>{Number(charInfo.get("Wp")) + (charInfo.get("Mysticism Rank") ? Number(charInfo.get("Mysticism Bonus") ?? 0) : -20)}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Necromancy</div>
                        <div>{rankNames[String(charInfo.get("Necromancy Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Necromancy Rank") ? String(charInfo.get("Necromancy Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Necromancy Rank") ? Number(charInfo.get("Necromancy Bonus") ?? 0) : -20)}</b></span>
                        </div>
                    </div>
                    <div className="srow">
                        <div className="sname">Restoration</div>
                        <div>{rankNames[String(charInfo.get("Restoration Rank") ?? "")] ?? "Untrained"}</div>
                        <div>{charInfo.get("Restoration Rank") ? String(charInfo.get("Restoration Bonus") ?? "0") : "-20"}</div>
                        <div className="stests">
                            <span>Willpower <b>{Number(charInfo.get("Wp")) + (charInfo.get("Restoration Rank") ? Number(charInfo.get("Restoration Bonus") ?? 0) : -20)}</b></span>
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
                <h1>{charInfo.get("Name")}</h1>

                <div className="top">
                    <div className="tile">
                        <div className="band head">Race</div>
                        <div className="band val"><input type="text" id="race" defaultValue={String(charInfo.get("Race") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Size</div>
                        <div className="band val"><input type="text" id="size" defaultValue={String(charInfo.get("Size") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Birthsign</div>
                        <div className="band val"><input type="text" id="birthsign" defaultValue={String(charInfo.get("Birthsign") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Elite Advance</div>
                        <div className="band val"><input type="text" id="elite" defaultValue={String(charInfo.get("Elite Adv") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Experience / Total</div>
                        <div className="band val">
                            <input type="text" className="pair" id="xp" defaultValue={String(charInfo.get("Current XP") ?? "")}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="xpTotal" defaultValue={String(charInfo.get("Total XP") ?? "")}/>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Lucky Numbers</div>
                        <div className="band val"><input type="text" id="lucky" defaultValue={String(charInfo.get("Lucky Numbers") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Unlucky Numbers</div>
                        <div className="band val"><input type="text" id="unlucky" defaultValue={String(charInfo.get("Unlucky Numbers") ?? "")}/></div>
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
                                <div><input type="text" id="str" defaultValue={String(charInfo.get("Str") ?? "")}/></div>
                                <div><input type="text" id="end" defaultValue={String(charInfo.get("End") ?? "")}/></div>
                                <div><input type="text" id="ag" defaultValue={String(charInfo.get("Ag") ?? "")}/></div>
                                <div><input type="text" id="int" defaultValue={String(charInfo.get("Int") ?? "")}/></div>
                                <div><input type="text" id="wp" defaultValue={String(charInfo.get("Wp") ?? "")}/></div>
                                <div><input type="text" id="prc" defaultValue={String(charInfo.get("Prc") ?? "")}/></div>
                                <div><input type="text" id="prs" defaultValue={String(charInfo.get("Prs") ?? "")}/></div>
                                <div><input type="text" id="lck" defaultValue={String(charInfo.get("Lck") ?? "")}/></div>
                            </div>
                            <div className="crow">
                                <div className="rl">Favored</div>
                                <label className="check"><input type="checkbox" id="favStr" defaultChecked={!!charInfo.get("Str Favored")}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favEnd" defaultChecked={!!charInfo.get("End Favored")}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favAg" defaultChecked={!!charInfo.get("Ag Favored")}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favInt" defaultChecked={!!charInfo.get("Int Favored")}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favWp" defaultChecked={!!charInfo.get("Wp Favored")}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favPrc" defaultChecked={!!charInfo.get("Prc Favored")}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favPrs" defaultChecked={!!charInfo.get("Prs Favored")}/><span>&#10003;</span></label>
                                <label className="check"><input type="checkbox" id="favLck" defaultChecked={!!charInfo.get("Lck Favored")}/><span>&#10003;</span></label>
                            </div>
                            <div className="crow">
                                <div className="rl">Bonus</div>
                                <div><input type="text" id="sb" defaultValue={String(charInfo.get("SB") ?? "")}/></div>
                                <div><input type="text" id="eb" defaultValue={String(charInfo.get("EB") ?? "")}/></div>
                                <div><input type="text" id="ab" defaultValue={String(charInfo.get("AB") ?? "")}/></div>
                                <div><input type="text" id="ib" defaultValue={String(charInfo.get("IB") ?? "")}/></div>
                                <div><input type="text" id="wb" defaultValue={String(charInfo.get("WB") ?? "")}/></div>
                                <div><input type="text" id="pcb" defaultValue={String(charInfo.get("PcB") ?? "")}/></div>
                                <div><input type="text" id="psb" defaultValue={String(charInfo.get("PsB") ?? "")}/></div>
                                <div><input type="text" id="lb" defaultValue={String(charInfo.get("LB") ?? "")}/></div>
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
                            <input type="text" className="pair" id="spMax"
                                   value={String(charInfo.get("Max SP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max SP", e.target.value))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.min(100, 100 * Number(charInfo.get("Current SP")) / Number(charInfo.get("Max SP")) || 0) + "%"}}></span>
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
                            <input type="text" className="pair" id="apMax"
                                   value={String(charInfo.get("Max AP") ?? "")}
                                   onChange={e => setCharInfo(new Map(charInfo).set("Max AP", e.target.value))}/>
                        </div>
                        <div className="bar">
                            <span style={{width: Math.min(100, 100 * Number(charInfo.get("Current AP")) / Number(charInfo.get("Max AP")) || 0) + "%"}}></span>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Speed</div>
                        <div className="band val">
                            <input type="text" className="pair" id="speed" defaultValue={String(charInfo.get("Current Speed") ?? "")}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="speedCalc" defaultValue={String(charInfo.get("Base Speed") ?? "")}/>
                        </div>
                    </div>
                    <div className="tile">
                        <div className="band head">Wound Threshold</div>
                        <div className="band val"><input type="text" id="wt" defaultValue={String(charInfo.get("WT") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Initiative Rating</div>
                        <div className="band val"><input type="text" id="ir" defaultValue={String(charInfo.get("IR") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Linguistics</div>
                        <div className="band val"><input type="text" id="linguistics" defaultValue={String(charInfo.get("Linguistics") ?? "")}/></div>
                    </div>
                    <div className="tile">
                        <div className="band head">Encumbrance / Carry Rating</div>
                        <div className="band val">
                            <input type="text" className="pair" id="enc" defaultValue={String(charInfo.get("Encumbrance") ?? "")}/>
                            <span className="sep">/</span>
                            <input type="text" className="pair" id="cr" defaultValue={String(charInfo.get("Carry Rating") ?? "")}/>
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
                            {charInfo.get("Bonds 1") && <div className="band val"><input type="text" defaultValue={String(charInfo.get("Bonds 1"))}/></div>}
                            {charInfo.get("Bonds 2") && <div className="band val"><input type="text" defaultValue={String(charInfo.get("Bonds 2"))}/></div>}
                            {charInfo.get("Bonds 3") && <div className="band val"><input type="text" defaultValue={String(charInfo.get("Bonds 3"))}/></div>}
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
                                        <span>Strength <b>{Number(charInfo.get("Str")) + (charInfo.get("Acrobatics Rank") ? Number(charInfo.get("Acrobatics Bonus") ?? 0) : -20)}</b></span>
                                        <span>Agility <b>{Number(charInfo.get("Ag")) + (charInfo.get("Acrobatics Rank") ? Number(charInfo.get("Acrobatics Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Alchemy</div>
                                    <div>{rankNames[String(charInfo.get("Alchemy Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Alchemy Rank") ? String(charInfo.get("Alchemy Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Alchemy Rank") ? Number(charInfo.get("Alchemy Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Athletics</div>
                                    <div>{rankNames[String(charInfo.get("Athletics Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Athletics Rank") ? String(charInfo.get("Athletics Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b>{Number(charInfo.get("Str")) + (charInfo.get("Athletics Rank") ? Number(charInfo.get("Athletics Bonus") ?? 0) : -20)}</b></span>
                                        <span>Endurance <b>{Number(charInfo.get("End")) + (charInfo.get("Athletics Rank") ? Number(charInfo.get("Athletics Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Command</div>
                                    <div>{rankNames[String(charInfo.get("Command Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Command Rank") ? String(charInfo.get("Command Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b>{Number(charInfo.get("Str")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20)}</b></span>
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20)}</b></span>
                                        <span>Personality <b>{Number(charInfo.get("Prs")) + (charInfo.get("Command Rank") ? Number(charInfo.get("Command Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Commerce</div>
                                    <div>{rankNames[String(charInfo.get("Commerce Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Commerce Rank") ? String(charInfo.get("Commerce Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Commerce Rank") ? Number(charInfo.get("Commerce Bonus") ?? 0) : -20)}</b></span>
                                        <span>Personality <b>{Number(charInfo.get("Prs")) + (charInfo.get("Commerce Rank") ? Number(charInfo.get("Commerce Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Deceive</div>
                                    <div>{rankNames[String(charInfo.get("Deceive Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Deceive Rank") ? String(charInfo.get("Deceive Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Deceive Rank") ? Number(charInfo.get("Deceive Bonus") ?? 0) : -20)}</b></span>
                                        <span>Personality <b>{Number(charInfo.get("Prs")) + (charInfo.get("Deceive Rank") ? Number(charInfo.get("Deceive Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Enchant</div>
                                    <div>{rankNames[String(charInfo.get("Enchant Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Enchant Rank") ? String(charInfo.get("Enchant Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Enchant Rank") ? Number(charInfo.get("Enchant Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Evade</div>
                                    <div>{rankNames[String(charInfo.get("Evade Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Evade Rank") ? String(charInfo.get("Evade Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b>{Number(charInfo.get("Ag")) + (charInfo.get("Evade Rank") ? Number(charInfo.get("Evade Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Investigate</div>
                                    <div>{rankNames[String(charInfo.get("Investigate Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Investigate Rank") ? String(charInfo.get("Investigate Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Investigate Rank") ? Number(charInfo.get("Investigate Bonus") ?? 0) : -20)}</b></span>
                                        <span>Perception <b>{Number(charInfo.get("Prc")) + (charInfo.get("Investigate Rank") ? Number(charInfo.get("Investigate Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Logic</div>
                                    <div>{rankNames[String(charInfo.get("Logic Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Logic Rank") ? String(charInfo.get("Logic Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Logic Rank") ? Number(charInfo.get("Logic Bonus") ?? 0) : -20)}</b></span>
                                        <span>Perception <b>{Number(charInfo.get("Prc")) + (charInfo.get("Logic Rank") ? Number(charInfo.get("Logic Bonus") ?? 0) : -20)}</b></span>
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
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Lore Rank") ? Number(charInfo.get("Lore Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Navigate</div>
                                    <div>{rankNames[String(charInfo.get("Navigate Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Navigate Rank") ? String(charInfo.get("Navigate Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Navigate Rank") ? Number(charInfo.get("Navigate Bonus") ?? 0) : -20)}</b></span>
                                        <span>Perception <b>{Number(charInfo.get("Prc")) + (charInfo.get("Navigate Rank") ? Number(charInfo.get("Navigate Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Observe</div>
                                    <div>{rankNames[String(charInfo.get("Observe Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Observe Rank") ? String(charInfo.get("Observe Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Perception <b>{Number(charInfo.get("Prc")) + (charInfo.get("Observe Rank") ? Number(charInfo.get("Observe Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Persuade</div>
                                    <div>{rankNames[String(charInfo.get("Persuade Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Persuade Rank") ? String(charInfo.get("Persuade Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Strength <b>{Number(charInfo.get("Str")) + (charInfo.get("Persuade Rank") ? Number(charInfo.get("Persuade Bonus") ?? 0) : -20)}</b></span>
                                        <span>Personality <b>{Number(charInfo.get("Prs")) + (charInfo.get("Persuade Rank") ? Number(charInfo.get("Persuade Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Ride</div>
                                    <div>{rankNames[String(charInfo.get("Ride Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Ride Rank") ? String(charInfo.get("Ride Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b>{Number(charInfo.get("Ag")) + (charInfo.get("Ride Rank") ? Number(charInfo.get("Ride Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Stealth</div>
                                    <div>{rankNames[String(charInfo.get("Stealth Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Stealth Rank") ? String(charInfo.get("Stealth Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b>{Number(charInfo.get("Ag")) + (charInfo.get("Stealth Rank") ? Number(charInfo.get("Stealth Bonus") ?? 0) : -20)}</b></span>
                                        <span>Perception <b>{Number(charInfo.get("Prc")) + (charInfo.get("Stealth Rank") ? Number(charInfo.get("Stealth Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Subterfuge</div>
                                    <div>{rankNames[String(charInfo.get("Subterfuge Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Subterfuge Rank") ? String(charInfo.get("Subterfuge Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Agility <b>{Number(charInfo.get("Ag")) + (charInfo.get("Subterfuge Rank") ? Number(charInfo.get("Subterfuge Bonus") ?? 0) : -20)}</b></span>
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Subterfuge Rank") ? Number(charInfo.get("Subterfuge Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                <div className="srow">
                                    <div className="sname">Survival</div>
                                    <div>{rankNames[String(charInfo.get("Survival Rank") ?? "")] ?? "Untrained"}</div>
                                    <div>{charInfo.get("Survival Rank") ? String(charInfo.get("Survival Bonus") ?? "0") : "-20"}</div>
                                    <div className="stests">
                                        <span>Intelligence <b>{Number(charInfo.get("Int")) + (charInfo.get("Survival Rank") ? Number(charInfo.get("Survival Bonus") ?? 0) : -20)}</b></span>
                                        <span>Perception <b>{Number(charInfo.get("Prc")) + (charInfo.get("Survival Rank") ? Number(charInfo.get("Survival Bonus") ?? 0) : -20)}</b></span>
                                    </div>
                                </div>
                                {charInfo.get("Profession 1") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 1"))}</div>
                                        <div>{rankNames[String(charInfo.get("Profession 1 Rank") ?? "")] ?? "Untrained"}</div>
                                        <div>{charInfo.get("Profession 1 Rank") ? String(charInfo.get("Profession 1 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p1Char] ?? p1Char} <b>{Number(charInfo.get(p1Char) ?? 0) + (charInfo.get("Profession 1 Rank") ? Number(charInfo.get("Profession 1 Bonus") ?? 0) : -20)}</b></span>
                                        </div>
                                    </div>
                                )}
                                {charInfo.get("Profession 2") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 2"))}</div>
                                        <div>{rankNames[String(charInfo.get("Profession 2 Rank") ?? "")] ?? "Untrained"}</div>
                                        <div>{charInfo.get("Profession 2 Rank") ? String(charInfo.get("Profession 2 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p2Char] ?? p2Char} <b>{Number(charInfo.get(p2Char) ?? 0) + (charInfo.get("Profession 2 Rank") ? Number(charInfo.get("Profession 2 Bonus") ?? 0) : -20)}</b></span>
                                        </div>
                                    </div>
                                )}
                                {charInfo.get("Profession 3") && (
                                    <div className="srow">
                                        <div className="sname">{String(charInfo.get("Profession 3"))}</div>
                                        <div>{rankNames[String(charInfo.get("Profession 3 Rank") ?? "")] ?? "Untrained"}</div>
                                        <div>{charInfo.get("Profession 3 Rank") ? String(charInfo.get("Profession 3 Bonus") ?? "0") : "-20"}</div>
                                        <div className="stests">
                                            <span>{charNames[p3Char] ?? p3Char} <b>{Number(charInfo.get(p3Char) ?? 0) + (charInfo.get("Profession 3 Rank") ? Number(charInfo.get("Profession 3 Bonus") ?? 0) : -20)}</b></span>
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
                                            <div className="band head">Drakes</div>
                                            <div className="band val"><input type="text" defaultValue={String(charInfo.get("Drakes") ?? "")}/></div>
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
                                        <div className="arow"><div className="al">AR</div><div><input type="text" defaultValue={String(charInfo.get("Head AR") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" defaultValue={String(charInfo.get("Head ENC") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" defaultValue={String(charInfo.get("Head Type") ?? "")}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Body</b><span>(1-5)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" defaultValue={String(charInfo.get("Body AR") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" defaultValue={String(charInfo.get("Body ENC") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" defaultValue={String(charInfo.get("Body Type") ?? "")}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Right Arm</b><span>(8)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" defaultValue={String(charInfo.get("Right Arm AR") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" defaultValue={String(charInfo.get("Right Arm ENC") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" defaultValue={String(charInfo.get("Right Arm Type") ?? "")}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Left Arm</b><span>(9)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" defaultValue={String(charInfo.get("Left Arm AR") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" defaultValue={String(charInfo.get("Left Arm ENC") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" defaultValue={String(charInfo.get("Left Arm Type") ?? "")}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Right Leg</b><span>(6)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" defaultValue={String(charInfo.get("Right Leg AR") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" defaultValue={String(charInfo.get("Right Leg ENC") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" defaultValue={String(charInfo.get("Right Leg Type") ?? "")}/></div></div>
                                    </div>
                                    <div className="armLoc">
                                        <div className="ahead"><b>Left Leg</b><span>(7)</span></div>
                                        <div className="arow"><div className="al">AR</div><div><input type="text" defaultValue={String(charInfo.get("Left Leg AR") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">ENC</div><div><input type="text" defaultValue={String(charInfo.get("Left Leg ENC") ?? "")}/></div></div>
                                        <div className="arow"><div className="al">Type</div><div><input type="text" defaultValue={String(charInfo.get("Left Leg Type") ?? "")}/></div></div>
                                    </div>
                                </div>

                                <div className="armLoc">
                                    <div className="ahead"><b>Shield</b><span>(BR / Type / ENC)</span></div>
                                    <div className="arow"><div className="al">BR</div><div><input type="text" defaultValue={String(charInfo.get("Languages 2") ?? "").split("/")[0]?.trim() ?? ""}/></div></div>
                                    <div className="arow"><div className="al">Type</div><div><input type="text" defaultValue={String(charInfo.get("Languages 2") ?? "").split("/")[1]?.trim() ?? ""}/></div></div>
                                    <div className="arow"><div className="al">ENC</div><div><input type="text" defaultValue={String(charInfo.get("Languages 2") ?? "").split("/")[2]?.trim() ?? ""}/></div></div>
                                </div>

                                <div className="armLoc">
                                    <div className="ahead"><b>Armor Notes</b></div>
                                    <div className="arow"><div style={{gridColumn: "1/-1"}}><textarea className="notesArea" rows={1} defaultValue={String(charInfo.get("Armor Notes") ?? charInfo.get("Armor Notes 1") ?? "") + String(charInfo.get("Armor Notes 2") ?? "")}/></div></div>
                                </div>
                            </div>

                            <div className="combatR">
                                <h3>Combat Style</h3>

                                <div className="csBlock">
                                    <div className="csTop">
                                        <b><input type="text" defaultValue={String(charInfo.get("Combat Style") ?? "")}/></b>
                                        <span>{rankNames[String(charInfo.get("Combat Style Rank") ?? "")] ?? "Untrained"}</span>
                                        <span>{String(charInfo.get("Combat Style Bonus") ?? "")}</span>
                                        <div className="stests">
                                            <span>Strength <b>{String(charInfo.get("Combat Style (Str)") ?? "")}</b></span>
                                            <span>Agility <b>{String(charInfo.get("Combat Style (Ag)") ?? "")}</b></span>
                                        </div>
                                    </div>
                                    <div className="csLine"><textarea className="notesArea" rows={1} defaultValue={String(charInfo.get("Combat Style 2") ?? "")}/></div>
                                    <div className="csLine"><textarea className="notesArea" rows={1} defaultValue={String(charInfo.get("Combat Style 3") ?? "")}/></div>
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
                                <button type="button" className="addSpell" onClick={() => setMelee([...melee, {name: "", dmg: "", hand: "", reach: "", enc: "", notes: ""}])}>+ add weapon</button>

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
                                <button type="button" className="addSpell" onClick={() => setRanged([...ranged, {name: "", dmg: "", hand: "", reach: "", enc: "", notes: ""}])}>+ add weapon</button>

                                <div className="armLoc">
                                    <div className="ahead"><b>Wounds</b></div>
                                    <div className="arow"><div style={{gridColumn: "1/-1"}}><textarea className="notesArea" rows={1} defaultValue={[charInfo.get("Wounds 1"), charInfo.get("Wounds 2"), charInfo.get("Wounds 3")].filter(w => w).join("\n")}/></div></div>
                                </div>

                                <div className="armLoc">
                                    <div className="ahead"><b>Conditions</b></div>
                                    <div className="arow"><div style={{gridColumn: "1/-1"}}><textarea className="notesArea" rows={1} defaultValue={[charInfo.get("Conditions 1"), charInfo.get("Conditions 2"), charInfo.get("Conditions 3")].filter(c => c).join("\n")}/></div></div>
                                </div>
                            </div>

                        </div>

                        <button type="button" className="roundOver" onClick={() => setCharInfo(new Map(charInfo).set("Current AP", String(charInfo.get("Max AP") ?? "")))}>Round Over &#8212; refresh Action Points</button>

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
                                <div className="rules"><p>TBD</p></div>
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