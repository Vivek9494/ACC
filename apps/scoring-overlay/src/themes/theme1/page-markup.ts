/** Theme 1 page shell — strip, career dock, graphics stage host. */
export const THEME1_PAGE_MARKUP = `
      <div id="strip-wrap" class="t1-strip-wrap" hidden>
        <div id="strip" class="t1-strip" role="img" aria-label="Live score strip">
          <div class="side left t1-checker">
            <div class="rows">
              <div id="batter-0" class="b-row">
                <span class="strike-slot" aria-hidden="true"
                  ><span id="batter-0-strike" class="strike" hidden>▸</span></span
                >
                <span id="batter-0-name" class="b-name">—</span>
                <span class="b-fig"
                  ><span id="batter-0-runs">0</span>
                  <span id="batter-0-balls" class="b-ball">0</span></span
                >
              </div>
              <div id="batter-1" class="b-row">
                <span class="strike-slot" aria-hidden="true"
                  ><span id="batter-1-strike" class="strike" hidden>▸</span></span
                >
                <span id="batter-1-name" class="b-name">—</span>
                <span class="b-fig"
                  ><span id="batter-1-runs">0</span>
                  <span id="batter-1-balls" class="b-ball">0</span></span
                >
              </div>
            </div>
          </div>

          <div class="side right t1-checker">
            <div class="rows">
              <div class="bowler-stack">
                <div class="b-row bowler-top-row">
                  <span id="bowler-name" class="b-name">—</span>
                  <span class="b-fig"
                    ><span id="bowler-figs">0-0</span>
                    <span id="bowler-overs" class="b-ball">0.0</span></span
                  >
                </div>
                <div class="b-row b-row-over">
                  <div id="over-tracker" class="over-balls" aria-label="This over"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="notch">
            <div class="n-main">
              <span id="team-line" class="n-team">—</span>
              <span id="score-line" class="n-score">0-0</span>
              <span id="overs-line" class="n-ov">0.0</span>
            </div>
            <div id="sub-line" class="n-sub" hidden></div>
          </div>

          <div class="logo left" aria-label="ASC">
            <img id="asc-logo" class="logo-img" alt="ASC" hidden />
            <span id="asc-fallback" class="logo-fallback">ASC</span>
          </div>
          <div class="logo right" aria-label="Bowling team">
            <img id="bowl-logo" class="logo-img" alt="" hidden />
            <span id="bowl-initials" class="logo-fallback">?</span>
          </div>
        </div>
        <div id="conn" class="t1-strip-conn" hidden>Reconnecting…</div>
      </div>

      <div id="career-wrap" class="career-wrap" hidden>
        <div class="career-card">
          <div class="career-name-band">
            <p id="bc-name" class="career-name" aria-label="Bowler name">
              <span id="bc-name-initial" class="career-name-initial"></span
              ><span id="bc-name-surname" class="career-name-surname">—</span>
            </p>
          </div>
          <div class="career-stats" role="group" aria-label="Career bowling stats">
            <div class="career-stat">
              <span id="bc-matches" class="career-value">—</span>
              <span class="career-label">Matches</span>
            </div>
            <div class="career-stat">
              <span id="bc-wickets" class="career-value">—</span>
              <span class="career-label">Wickets</span>
            </div>
            <div class="career-stat">
              <span id="bc-avg" class="career-value">—</span>
              <span class="career-label">Average</span>
            </div>
            <div class="career-stat">
              <span id="bc-econ" class="career-value">—</span>
              <span class="career-label">Economy</span>
            </div>
            <div class="career-stat">
              <span id="bc-best" class="career-value">—</span>
              <span class="career-label">Best</span>
            </div>
          </div>
        </div>
      </div>

      <div id="graphics-stage" class="graphics-stage-layer stage" aria-live="polite"></div>

      <div id="idle" class="idle" hidden></div>
`.trim();
