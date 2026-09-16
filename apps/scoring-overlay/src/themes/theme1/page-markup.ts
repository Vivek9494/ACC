/** Theme 1 page shell — premium strip, career dock, graphics stage host. */
export const THEME1_PAGE_MARKUP = `
      <div id="strip-wrap" class="t1-strip-wrap" hidden>
        <div id="strip" class="t1-strip" role="img" aria-label="Live score strip">
          <div class="t1-strip-id t1-strip-section" data-strip-section="id">
            <p id="strip-id-line" class="t1-strip-id-line">—</p>
          </div>

          <div class="t1-strip-main t1-strip-section" data-strip-section="main">
            <div class="t1-logo-puck t1-logo-bat" aria-label="Batting team">
              <img id="bat-logo" class="t1-logo-img" alt="" hidden />
              <span id="bat-fallback" class="t1-logo-mono" aria-hidden="true">
                <span class="t1-mono-star" aria-hidden="true">★</span>
                <span id="bat-initials" class="t1-mono-abbr">?</span>
                <span class="t1-mono-stripe" aria-hidden="true"></span>
              </span>
            </div>

            <div class="t1-score-block">
              <p id="team-line" class="t1-team-name">—</p>
              <p id="score-line" class="t1-score-total">0-0</p>
              <p class="t1-score-meta">
                <span id="overs-line">0.0</span>
                <span class="t1-meta-sep">·</span>
                <span id="rr-line">CRR 0.00</span>
              </p>
              <p id="sub-line" class="t1-sub-line" hidden></p>
            </div>

            <div class="t1-batters">
              <div id="batter-0" class="t1-batter-row">
                <span id="batter-0-strike" class="t1-strike-diamond" hidden aria-hidden="true"></span>
                <span id="batter-0-name" class="t1-batter-name">—</span>
                <span class="t1-batter-fig">
                  <span id="batter-0-runs">0</span><span class="t1-batter-paren">(</span><span id="batter-0-balls">0</span><span class="t1-batter-paren">)</span>
                </span>
              </div>
              <div id="batter-1" class="t1-batter-row">
                <span id="batter-1-strike" class="t1-strike-diamond" hidden aria-hidden="true"></span>
                <span id="batter-1-name" class="t1-batter-name">—</span>
                <span class="t1-batter-fig">
                  <span id="batter-1-runs">0</span><span class="t1-batter-paren">(</span><span id="batter-1-balls">0</span><span class="t1-batter-paren">)</span>
                </span>
              </div>
            </div>

            <div id="bowler-stack" class="t1-bowler-stack">
              <div id="bowler-normal" class="t1-bowler-normal">
                <div class="t1-bowler-top">
                  <span id="bowler-name" class="t1-bowler-name">—</span>
                  <span id="bowler-figs" class="t1-bowler-figs">0-0</span>
                  <span id="bowler-overs" class="t1-bowler-overs">0.0</span>
                </div>
                <div id="over-tracker" class="t1-over-balls" aria-label="This over"></div>
                <p id="over-empty" class="t1-over-empty" hidden>Awaiting first delivery</p>
              </div>
              <p id="bowler-toss-line" class="t1-bowler-toss" hidden></p>
            </div>

            <div class="t1-logo-puck t1-logo-bowl" aria-label="Bowling team">
              <img id="bowl-logo" class="t1-logo-img" alt="" hidden />
              <span id="bowl-fallback" class="t1-logo-mono" aria-hidden="true">
                <span class="t1-mono-star" aria-hidden="true">★</span>
                <span id="bowl-initials" class="t1-mono-abbr">?</span>
                <span class="t1-mono-stripe" aria-hidden="true"></span>
              </span>
            </div>
          </div>

          <div class="t1-strip-footer t1-strip-section" data-strip-section="footer">
            <p id="strip-footer-line" class="t1-strip-footer-line">● Dot  ·  4/6 Boundary  ·  W Wicket  ·  Extras</p>
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
