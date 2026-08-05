import './App.css'
import {fileHandler} from './index.ts'
import {useState} from "react";

type CharInfo = Map<string, string | boolean | undefined>

function App() {
  const [charInfo, setCharInfo] = useState<CharInfo | null>(null)

  async function handleFile(event) {
      const file = event.target.files?.[0]
      if (!file) return
      const PDFInput : ArrayBuffer = await file.arrayBuffer()
      setCharInfo(await fileHandler(PDFInput))

  }

  if (charInfo) {
    return (
        <section id='center'>
            <h1>{charInfo.get("Name")}</h1>

            <div className="grid">
                <div className="tile">
                    <div className="band head">Experience / Total</div>
                    <div className="band val">
                        <input type="text" className="pair" id="xp" defaultValue={String(charInfo.get("Current XP") ?? "")}/>
                        <span className="sep">/</span>
                        <input type="text" className="pair" id="xpTotal" defaultValue={String(charInfo.get("Total XP") ?? "")}/>
                    </div>
                </div>
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
                <div className="tile c4">
                    <div className="band head">Elite Advance</div>
                    <div className="band val"><input type="text" id="elite" defaultValue={String(charInfo.get("Elite Adv") ?? "")}/></div>
                </div>
            </div>

            <h2>Characteristics</h2>

            <div className="charsWrap">

                <div className="cblock">
                    <div className="crow head">
                        <div className="rl"></div>
                        <div>Strength</div><div>Endurance</div><div>Agility</div><div>Intelligence</div>
                    </div>
                    <div className="crow">
                        <div className="rl">Score</div>
                        <div><input type="text" id="str" defaultValue={String(charInfo.get("Str") ?? "")}/></div>
                        <div><input type="text" id="end" defaultValue={String(charInfo.get("End") ?? "")}/></div>
                        <div><input type="text" id="ag" defaultValue={String(charInfo.get("Ag") ?? "")}/></div>
                        <div><input type="text" id="int" defaultValue={String(charInfo.get("Int") ?? "")}/></div>
                    </div>
                    <div className="crow">
                        <div className="rl">Favored</div>
                        <label className="check"><input type="checkbox" id="favStr" defaultChecked={!!charInfo.get("Str Favored")}/><span>&#10003;</span></label>
                        <label className="check"><input type="checkbox" id="favEnd" defaultChecked={!!charInfo.get("End Favored")}/><span>&#10003;</span></label>
                        <label className="check"><input type="checkbox" id="favAg" defaultChecked={!!charInfo.get("Ag Favored")}/><span>&#10003;</span></label>
                        <label className="check"><input type="checkbox" id="favInt" defaultChecked={!!charInfo.get("Int Favored")}/><span>&#10003;</span></label>
                    </div>
                    <div className="crow">
                        <div className="rl">Bonus</div>
                        <div><input type="text" id="sb" defaultValue={String(charInfo.get("SB") ?? "")}/></div>
                        <div><input type="text" id="eb" defaultValue={String(charInfo.get("EB") ?? "")}/></div>
                        <div><input type="text" id="ab" defaultValue={String(charInfo.get("AB") ?? "")}/></div>
                        <div><input type="text" id="ib" defaultValue={String(charInfo.get("IB") ?? "")}/></div>
                    </div>
                </div>

                <div className="cblock">
                    <div className="crow head">
                        <div className="rl"></div>
                        <div>Willpower</div><div>Perception</div><div>Personality</div><div>Luck</div>
                    </div>
                    <div className="crow">
                        <div className="rl">Score</div>
                        <div><input type="text" id="wp" defaultValue={String(charInfo.get("Wp") ?? "")}/></div>
                        <div><input type="text" id="prc" defaultValue={String(charInfo.get("Prc") ?? "")}/></div>
                        <div><input type="text" id="prs" defaultValue={String(charInfo.get("Prs") ?? "")}/></div>
                        <div><input type="text" id="lck" defaultValue={String(charInfo.get("Lck") ?? "")}/></div>
                    </div>
                    <div className="crow">
                        <div className="rl">Favored</div>
                        <label className="check"><input type="checkbox" id="favWp" defaultChecked={!!charInfo.get("Wp Favored")}/><span>&#10003;</span></label>
                        <label className="check"><input type="checkbox" id="favPrc" defaultChecked={!!charInfo.get("Prc Favored")}/><span>&#10003;</span></label>
                        <label className="check"><input type="checkbox" id="favPrs" defaultChecked={!!charInfo.get("Prs Favored")}/><span>&#10003;</span></label>
                        <label className="check"><input type="checkbox" id="favLck" defaultChecked={!!charInfo.get("Lck Favored")}/><span>&#10003;</span></label>
                    </div>
                    <div className="crow">
                        <div className="rl">Bonus</div>
                        <div><input type="text" id="wb" defaultValue={String(charInfo.get("WB") ?? "")}/></div>
                        <div><input type="text" id="pcb" defaultValue={String(charInfo.get("PcB") ?? "")}/></div>
                        <div><input type="text" id="psb" defaultValue={String(charInfo.get("PsB") ?? "")}/></div>
                        <div><input type="text" id="lb" defaultValue={String(charInfo.get("LB") ?? "")}/></div>
                    </div>
                </div>

            </div>

            <h2>Attributes</h2>

            <div className="grid">
                <div className="tile">
                    <div className="band head">Hit Points</div>
                    <div className="band val">
                        <input type="text" className="pair" id="hp" defaultValue={String(charInfo.get("Current HP") ?? "")}/>
                        <span className="sep">/</span>
                        <input type="text" className="pair" id="hpMax" defaultValue={String(charInfo.get("Max HP") ?? "")}/>
                    </div>
                </div>
                <div className="tile">
                    <div className="band head">Magicka Points</div>
                    <div className="band val">
                        <input type="text" className="pair" id="mp" defaultValue={String(charInfo.get("Current MP") ?? "")}/>
                        <span className="sep">/</span>
                        <input type="text" className="pair" id="mpMax" defaultValue={String(charInfo.get("Max MP") ?? "")}/>
                    </div>
                </div>
                <div className="tile">
                    <div className="band head">Wound Threshold</div>
                    <div className="band val"><input type="text" id="wt" defaultValue={String(charInfo.get("WT") ?? "")}/></div>
                </div>
                <div className="tile">
                    <div className="band head">Stamina Points</div>
                    <div className="band val">
                        <input type="text" className="pair" id="sp" defaultValue={String(charInfo.get("Current SP") ?? "")}/>
                        <span className="sep">/</span>
                        <input type="text" className="pair" id="spMax" defaultValue={String(charInfo.get("Max SP") ?? "")}/>
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
                    <div className="band head">Luck Points</div>
                    <div className="band val">
                        <input type="text" className="pair" id="lp" defaultValue={String(charInfo.get("Current LP") ?? "")}/>
                        <span className="sep">/</span>
                        <input type="text" className="pair" id="lpMax" defaultValue={String(charInfo.get("Max LP") ?? "")}/>
                    </div>
                </div>
                <div className="tile">
                    <div className="band head">Initiative Rating</div>
                    <div className="band val"><input type="text" id="ir" defaultValue={String(charInfo.get("IR") ?? "")}/></div>
                </div>
                <div className="tile">
                    <div className="band head">Action Points</div>
                    <div className="band val">
                        <input type="text" className="pair" id="ap" defaultValue={String(charInfo.get("Current AP") ?? "")}/>
                        <span className="sep">/</span>
                        <input type="text" className="pair" id="apMax" defaultValue={String(charInfo.get("Max AP") ?? "")}/>
                    </div>
                </div>
                <div className="tile c2">
                    <div className="band head">Linguistics</div>
                    <div className="band val"><input type="text" id="linguistics" defaultValue={String(charInfo.get("Linguistics") ?? "")}/></div>
                </div>
                <div className="tile c2">
                    <div className="band head">Encumbrance / Carry Rating</div>
                    <div className="band val">
                        <input type="text" className="pair" id="enc" defaultValue={String(charInfo.get("Encumbrance") ?? "")}/>
                        <span className="sep">/</span>
                        <input type="text" className="pair" id="cr" defaultValue={String(charInfo.get("Carry Rating") ?? "")}/>
                    </div>
                </div>
            </div>

            <h2>Fortune</h2>

            <div className="grid">
                <div className="tile c2">
                    <div className="band head">Lucky Numbers</div>
                    <div className="band val"><input type="text" id="lucky" defaultValue={String(charInfo.get("Lucky Numbers") ?? "")}/></div>
                </div>
                <div className="tile c2">
                    <div className="band head">Unlucky Numbers</div>
                    <div className="band val"><input type="text" id="unlucky" defaultValue={String(charInfo.get("Unlucky Numbers") ?? "")}/></div>
                </div>
                <div className="tile c4">
                    <div className="band head">Languages</div>
                    <div className="band val"><input type="text" id="languages" defaultValue={String(charInfo.get("Languages") ?? "")}/></div>
                </div>
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
