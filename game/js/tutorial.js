// The first Story quest's lesson: a practice battle against Hayley Kate, with Maria standing in as your leader. The two of
// them coach you through your first turns (MB.TUTORIAL.turns). Played by js/storymap.js for a quest with `lesson`.
//
// A turn's steps run in order when that turn of yours starts. A step is { who, mood, text, point, if, until }:
//   who/mood   the speaker and their face (moods as in Story scenes: js/story.js); text can be (b) => text
//   point      what the coach points at: a selector, or (b) => the unit it's about ('L0'/'L1' are the leaders)
//   if         (b) => whether to say it at all
//   until      what the player has to do next: 'play', 'attack', 'power' or 'endTurn'. Without it the step waits for a
//              click and the battle waits with it; with it the battle goes on and the next step waits for that move.
// Ending your turn skips the moves still asked for; what was still to be said is said at the start of your next turn.
// A move asked for that can't be made any more (`if` no longer holds) is skipped after your next move.
window.MB = window.MB || {};
(function () {
  const $ = (s) => document.querySelector(s);
  const KW = (k) => `${MB.KEYWORDS[k].icon} <b>${MB.KEYWORDS[k].name}</b>`;
  const playable = (b) => b.me(0).hand.some((c) => b.canPlay(0, c));
  const attacker = (b) => b.units(0).find((u) => b.canAttack(u));

  MB.TUTORIAL = {
    foe: 'hayley-kate', leader: 'maria-hunley', foeHp: 8, ai: 0,
    bg: 'Street to school', music: 'hello-hayley',
    // Hayley plays the starter deck too; yours is stacked so the first draws are cheap: [cost, type] in draw order
    opening: [[1, 'unit'], [2, 'unit'], [1, 'spell'], [3, 'unit'], [2, 'unit']],
    turns: [
      [ // turn 1: the board, gold, playing a card, ending the turn
        { who: 'hayley-kate', mood: 'excited', point: 'L1', text: "Okay! That's me over there. See my HP? Get it down to <b>zero</b> and you win. Easy!" },
        { who: 'maria-hunley', mood: 'happy', point: 'L0', text: "And this is me, sweetie. I'm your <b>leader</b> today. If <i>my</i> HP hits zero, we lose. So let's not." },
        { who: 'maria-hunley', mood: 'neutral', point: '#player-gold', text: 'These gems are your <b>gold</b>. You get one more every turn, and they all fill back up when your turn starts.' },
        { who: 'hayley-kate', mood: 'happy', point: '#hand', if: playable, until: 'play',
          text: 'The number in a card\'s corner is what it costs. Glowing cards are ones you can afford. <b>Drag one onto the board!</b>' },
        { who: 'maria-hunley', mood: 'proud', if: (b) => b.units(0).length > 0, point: (b) => b.units(0)[0],
          text: (b) => `Lovely! Monsters need a turn to settle in before they can attack${b.units(0)[0].kw.has('haste') ? `... except ones with ${KW('haste')}, like that one. It can go right away!` : '.'} Hover over anything to read what it does.` },
        { who: 'hayley-kate', mood: 'neutral', point: '#end-turn', until: 'endTurn', text: 'Done? Press <b>END TURN</b> (or <b>E</b>). Then it\'s MY go. Hehe.' },
      ],
      [ // turn 2: attacking, trading, taunt
        { who: 'hayley-kate', mood: 'happy', point: '#player-gold', text: 'New turn! You drew a card and got another gold. Two now!' },
        { who: 'hayley-kate', mood: 'excited', if: attacker, point: attacker, until: 'attack',
          text: '<b>Drag from your monster</b> to something of mine: a monster, or me! Well, my leader. Be gentle.' },
        { who: 'maria-hunley', mood: 'neutral', if: (b) => b.units(0).length > 0,
          text: `When two monsters fight, <b>both</b> hit each other, so pick your fights. And a monster with ${KW('taunt')} has to be attacked before anything else.` },
        { who: 'hayley-kate', mood: 'happy', point: '#hand', if: playable, until: 'play', text: 'Still got gold? Spend it! Gold you don\'t use is gone next turn.' },
        { who: 'hayley-kate', mood: 'proud', point: '#end-turn', until: 'endTurn', text: 'Nothing left to do? <b>End your turn!</b>' },
      ],
      [ // turn 3: the leader's power, reading the rival
        { who: 'maria-hunley', mood: 'happy', point: '#power-btn', text: "Now, my favourite part. This is my <b>power</b>. Every leader has one. It costs a little gold and works once a turn." },
        { who: 'maria-hunley', mood: 'proud', point: '#power-btn', if: (b) => b.canPower(0), until: 'power',
          text: 'Click it, then click one of your monsters, and Mum gives them a big hug.' },
        { who: 'hayley-kate', mood: 'neutral', point: '#enemy-panel',
          text: "Oh, and peek at MY panel sometimes. It says what my power does. Knowing what the other side can do is half the game!" },
        { who: 'maria-hunley', mood: 'excited', text: "That's everything you need. The rest is practice. Go on, sweetie, <b>win it!</b>" },
        { who: 'hayley-kate', mood: 'angry', text: "Hey! Whose side are you on?! ...Oh. Right. Theirs. BRING IT!" },
      ],
    ],
  };

  // moves the deck's cards named by `opening` to the top, so they are drawn first (the deck is drawn from its end)
  function stack(deck, opening) {
    const top = [];
    opening.forEach(([cost, type]) => {
      const i = deck.findIndex((c) => c.cost === cost && c.type === type) + 1 || deck.findIndex((c) => c.cost <= cost && c.type === type) + 1;
      if (i) top.push(deck.splice(i - 1, 1)[0]);
    });
    deck.push(...top.reverse());
  }

  // ---------------------------------------------------------------- the coach
  let b = null, queue = [], carry = [], waiting = null, turn = 0, skipped = false, pulse = null;
  let release = null; // lets the battle go on past a blocking step

  // follows battle b: the player's turns start the steps, their moves move them along
  function coach(battle) {
    b = battle; queue = []; carry = []; waiting = null; turn = 0; skipped = false;
    stack(b.me(0).deck, MB.TUTORIAL.opening);
    const wrap = (name, after) => {
      const orig = b[name].bind(b);
      b[name] = async (...args) => { const r = await orig(...args); if (!b.over && !skipped) await after(r, ...args); return r; };
    };
    wrap('startTurn', (r, side) => (side === 0 ? startTurn() : null));
    wrap('playCard', (r, side) => (r && side === 0 ? moved('play') : null));
    wrap('usePower', (r, side) => (r && side === 0 ? moved('power') : null));
    wrap('attack', (r, u) => (r && u.side === 0 ? moved('attack') : null));
    const end = b.endTurn.bind(b);
    b.endTurn = async () => { if (b.active === 0) { carry = queue.filter((st) => !st.until); queue = []; waiting = null; hide(); } return end(); };
  }

  async function startTurn() {
    queue = [...carry, ...(MB.TUTORIAL.turns[turn++] || [])];
    carry = [];
    await next();
  }
  async function moved(what) {
    const st = queue[0];
    if (!waiting || (waiting !== what && !(st.if && !st.if(b)))) return;
    waiting = null;
    queue.shift();
    hide();
    await next();
  }
  // says the steps up to the next one that waits for a move
  async function next() {
    while (queue.length && !b.over && !skipped) {
      const st = queue[0];
      if (st.if && !st.if(b)) { queue.shift(); continue; }
      if (st.until) { waiting = st.until; show(st, false); return; }
      await new Promise((done) => show(st, true, done));
      queue.shift();
    }
    hide();
  }

  // the coach's bubble: blocking (dims the screen, click to go on) or a hint while you play
  function show(st, block, done) {
    const box = $('#coach'), ch = MB.charById(st.who);
    box.className = (block ? 'block ' : 'tip ') + (st.who === MB.TUTORIAL.foe ? 'rival' : 'ally');
    box.querySelector('.co-face').src = MB.spriteUrl(st.who, MB.Story.MOODS[st.mood] || 'idle');
    box.querySelector('.co-name').textContent = ch ? ch.name : st.who;
    box.querySelector('.co-text').innerHTML = typeof st.text === 'function' ? st.text(b) : st.text;
    box.querySelector('.co-go').textContent = block ? 'Click to continue ▶' : '';
    spotlight(st.point);
    MB.audio.sfx('pop');
    gsap.fromTo(box.querySelector('.co-bubble'), { y: -20, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' });
    release = block ? done : null;
    box.onclick = block ? (e) => { if (e.target.closest('.co-skip')) return; MB.audio.sfx('click'); go(); } : null;
  }
  function go() { const r = release; release = null; if (r) r(); }
  function hide() {
    const box = $('#coach');
    box.className = 'hidden';
    box.onclick = null;
    spotlight(null);
  }
  // a pulsing ring around what the step is about
  function spotlight(point) {
    const ring = $('#coach-ring');
    if (pulse) { pulse.kill(); pulse = null; }
    const target = typeof point === 'function' ? point(b) : point;
    let node = null;
    if (target === 'L0' || target === 'L1') node = MB.view.ents.get(target) && MB.view.ents.get(target).figure;
    else if (typeof target === 'string') node = $(target);
    else if (target) node = MB.view.ents.get(target.uid) && MB.view.ents.get(target.uid).figure;
    // the hand fills the screen; ring its cards instead
    if (target === '#hand') node = hull([...node.querySelectorAll('.card:not(.leaving)')]);
    if (!node) { ring.classList.add('hidden'); return; }
    const r = node.getBoundingClientRect ? node.getBoundingClientRect() : node;
    const a = MB.view.toUi(r.left, r.top), z = MB.view.toUi(r.right, r.bottom), pad = 12;
    ring.classList.remove('hidden');
    gsap.set(ring, { left: a.x - pad, top: a.y - pad, width: z.x - a.x + pad * 2, height: z.y - a.y + pad * 2 });
    pulse = gsap.fromTo(ring, { scale: 1, opacity: 1 }, { scale: 1.06, opacity: 0.55, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  const hull = (els) => {
    if (!els.length) return null;
    const rs = els.map((e) => e.getBoundingClientRect());
    return { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) };
  };

  // the lesson is over (battle end, forfeit), or the player skipped it
  function stop() { skipped = true; queue = []; waiting = null; hide(); go(); }

  function bind() {
    $('#coach .co-skip').onclick = (e) => { e.stopPropagation(); MB.audio.sfx('click'); stop(); };
  }

  MB.Tutorial = { coach, stop, bind };
})();
