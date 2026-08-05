import './App.css'
import {fileHandler} from './index.ts'
import {useState} from "react";

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

function App() {
    const [charInfo, setCharInfo] = useState<CharInfo | null>(null)
    const [languages, setLanguages] = useState<string[]>([])
    const [mode, setMode] = useState<string | null>(null)

    async function handleFile(event) {
        const file = event.target.files?.[0]
        if (!file) return
        const PDFInput : ArrayBuffer = await file.arrayBuffer()
        const parsed = await fileHandler(PDFInput)
        setCharInfo(parsed)
        // the pdf gives all the languages as one string so split it into rows here
        setLanguages(String(parsed.get("Languages") ?? "").split(",").map(l => l.trim()))
    }

    if (charInfo) {
        const p1Char = String(charInfo.get("Profession 1 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
        const p2Char = String(charInfo.get("Profession 2 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
        const p3Char = String(charInfo.get("Profession 3 TN") ?? "").split("(")[1]?.replace(")", "").trim() ?? ""
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

                    <div className="tile langs">
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
                    </>
                )}

                {mode === "combat" && (
                    <>
                        <h2>Combat</h2>
                        <div className="bonds">
                            <div className="band">nothing here yet</div>
                        </div>
                    </>
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
            {/*
      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>  */}
        </>
    )
}

export default App