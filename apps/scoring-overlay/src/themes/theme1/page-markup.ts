/** Theme 1 page shell — premium strip (reference layout), career dock, graphics stage. */
export const THEME1_PAGE_MARKUP = `
      <div id="strip-wrap" class="t1-strip-wrap" hidden>
        <div id="strip" class="t1-strip" role="img" aria-label="Live score strip">
          <div class="t1-id-bar t1-strip-section" data-strip-section="id">
            <div class="t1-id-left">
              <span class="t1-id-diamond" aria-hidden="true"></span>
              <span class="t1-id-live">LIVE</span>
            </div>
            <p id="strip-banner" class="t1-id-center">—</p>
            <p id="strip-matchup" class="t1-id-right">—</p>
          </div>

          <div class="t1-scorebar t1-strip-section" data-strip-section="main">
            <div class="t1-end-panel t1-end-bat">
              <div class="t1-mono-shield" aria-label="Batting team">
                <span class="t1-mono-star" aria-hidden="true">★</span>
                <span id="bat-initials" class="t1-mono-abbr">?</span>
                <span class="t1-mono-stripe" aria-hidden="true"></span>
              </div>
            </div>

            <div class="t1-total-block">
              <div class="t1-total-head">
                <span id="team-line" class="t1-total-abbr">—</span>
                <span class="t1-total-role">BATTING</span>
              </div>
              <p id="score-line" class="t1-total-score">0 / 0</p>
              <p id="sub-line" class="t1-sub-line" hidden></p>
            </div>

            <div class="t1-vdiv" aria-hidden="true"></div>

            <div class="t1-overs-block">
              <span class="t1-overs-label">OVERS</span>
              <span id="overs-line" class="t1-overs-value">0.0</span>
              <span id="rr-line" class="t1-rr-value">RR 0.00</span>
            </div>

            <div class="t1-vdiv" aria-hidden="true"></div>

            <div class="t1-batters">
              <div id="batter-0" class="t1-batter-row">
                <span id="batter-0-name" class="t1-batter-name">—</span>
                <span class="t1-batter-fig">
                  <span id="batter-0-strike" class="t1-strike-mark" hidden aria-hidden="true"></span>
                  <span id="batter-0-runs" class="t1-batter-runs">0</span>
                  <span class="t1-batter-balls">(<span id="batter-0-balls">0</span>)</span>
                </span>
              </div>
              <div id="batter-1" class="t1-batter-row">
                <span id="batter-1-name" class="t1-batter-name">—</span>
                <span class="t1-batter-fig">
                  <span id="batter-1-strike" class="t1-strike-mark" hidden aria-hidden="true"></span>
                  <span id="batter-1-runs" class="t1-batter-runs">0</span>
                  <span class="t1-batter-balls">(<span id="batter-1-balls">0</span>)</span>
                </span>
              </div>
            </div>

            <div class="t1-vdiv" aria-hidden="true"></div>

            <div id="bowler-stack" class="t1-bowler-block">
              <div id="bowler-normal" class="t1-bowler-normal">
                <div class="t1-bowler-head">
                  <span class="t1-bowler-role">BOWLING</span>
                  <span id="bowler-overs" class="t1-bowler-ov">(0.0 ov)</span>
                </div>
                <div class="t1-bowler-main">
                  <span id="bowler-name" class="t1-bowler-name">—</span>
                  <span id="bowler-figs" class="t1-bowler-figs">0 / 0</span>
                </div>
                <div id="over-tracker" class="t1-over-balls" aria-label="This over"></div>
                <p id="over-empty" class="t1-over-empty" hidden>Awaiting first delivery</p>
              </div>
              <p id="bowler-toss-line" class="t1-bowler-toss" hidden></p>
            </div>

            <div class="t1-end-panel t1-end-bowl">
              <div class="t1-mono-shield" aria-label="Bowling team">
                <span class="t1-mono-star" aria-hidden="true">★</span>
                <span id="bowl-initials" class="t1-mono-abbr">?</span>
                <span class="t1-mono-stripe" aria-hidden="true"></span>
              </div>
            </div>
          </div>

          <div class="t1-footer-bar t1-strip-section" data-strip-section="footer">
            <p class="t1-footer-legend" aria-hidden="true">
              <span class="t1-leg">DOT <span class="t1-leg-dot">•</span></span>
              <span class="t1-leg">BOUNDARY <span class="t1-leg-4">4</span> / <span class="t1-leg-6">6</span></span>
              <span class="t1-leg t1-leg-wkt">WICKET W</span>
              <span class="t1-leg">WIDE WD</span>
              <span class="t1-leg">NO-BALL NB</span>
            </p>
            <p class="t1-footer-brand">CRICKET <span class="t1-footer-slash">/</span> ASC</p>
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
