// Generated, transparent anime props shared by battle and card-preview effects.
// Keep the original glyphs in attack data as stable prop IDs; render supported ones as artwork.
(function () {
  // Measured transparent gutters: generated sheets are slightly less regular than an exact grid.
  // Sample between silhouettes so a book edge or a bomb fuse never leaks into its neighbor.
  const sheets = [
    { name: 'magic', x: [0, 314, 627, 940, 1254], y: [0, 314, 627, 940, 1254] },
    { name: 'props', x: [0, 326, 627, 940, 1254], y: [0, 320, 620, 920, 1254] },
    { name: 'everyday', x: [0, 320, 640, 940, 1254], y: [0, 330, 630, 920, 1254] },
  ];
  const urls = sheets.map(({ name }) => `assets/attacks/${name}.png`);
  const yumi = {
    rise: 'assets/attacks/yumi/dolphin-rise.png',
    ride: 'assets/attacks/yumi/yumi-ride.png',
    fall: 'assets/attacks/yumi/yumi-fall.png',
  };
  urls.push(...Object.values(yumi));
  const eri = { rise: yumi.rise, ride: 'assets/attacks/yumi/eri-ride.png', fall: 'assets/attacks/yumi/eri-fall.png' };
  urls.push(eri.ride, eri.fall);
  const jay = {
    frames: 'assets/attacks/jay/jay-painting-frames.png',
    proud: 'assets/attacks/jay/jay-proud.png',
    sketch: 'assets/attacks/jay/spike-sketch.png',
    spike: 'assets/attacks/jay/painted-spike.png',
  };
  urls.push(...Object.values(jay));
  const artBooks = {
    jay: 'assets/attacks/art-books/jay-stairs.png',
    janice: 'assets/attacks/art-books/janice-climb.png',
  };
  urls.push(...Object.values(artBooks));
  const pristo = { poses: 'assets/attacks/pristo/guitar-poses.png' };
  urls.push(...Object.values(pristo));
  const metalMass = { julia: 'assets/attacks/metal-mass/julia-singing-poses.png',
    width: 1270, height: 1239, x: [0, 650, 1270], y: [0, 610, 1239] };
  urls.push(metalMass.julia);
  const entries = [
    ['sparkle', '✨ ✦ ✧'], ['star', '⭐ 🌟 💫 ★'], ['heart', '💗 💖 💕 💞 💘 ❤️ ❤ ♥'], ['broken-heart', '💔'],
    ['feather', '🪶'], ['blossom', '🌸 💮'], ['note', '🎵 🎶 ♪ ♫'], ['kiss', '💋'],
    ['flame', '🔥'], ['lightning', '⚡'], ['snowflake', '❄️ ❄'], ['splash', '💦 💧'],
    ['moon', '🌙'], ['leaf', '🍃 🌿'], ['bat', '🦇'], ['wing', '🪽'],
    ['book', '📖'], ['pan', '🍳'], ['tea', '🍵 ☕'], ['hammer', '🔨'],
    ['coin', '🪙'], ['diamond', '💎'], ['gift', '🎁'], ['potion', '🧪 ⚗️'],
    ['rocket', '🚀'], ['axe', '🪓'], ['sword', '🗡️ ⚔️'], ['boxing-glove', '🥊'],
    ['gear', '⚙️'], ['bolt', '🔩'], ['bell', '🔔 🛎️'], ['bow', '🎀'],
    ['apple', '🍎'], ['toast', '🍞'], ['cupcake', '🧁'], ['candy', '🍬'],
    ['pizza', '🍕'], ['garlic', '🧄'], ['pill', '💊'], ['syringe', '💉'],
    ['bandage', '🩹'], ['rose', '🌹'], ['paw', '🐾'], ['fist', '👊 🤜 🤛'],
    ['wind', '💨'], ['bomb', '💣'], ['crown', '👑'], ['phone', '📱'],
  ];
  const glyphs = new Map();
  const clean = (s) => s.replace(/\uFE0F/g, '');
  entries.forEach(([name, aliases], index) => {
    aliases.split(' ').forEach((glyph) => glyphs.set(clean(glyph), { name, index }));
  });
  // Preserve the colors of heart-themed attacks without duplicating the source sprite.
  for (const [glyph, filter] of Object.entries({
    '💚': 'hue-rotate(120deg)', '💙': 'hue-rotate(240deg)', '💜': 'hue-rotate(285deg)',
    '💛': 'hue-rotate(65deg)', '🖤': 'grayscale(1) brightness(.4)',
    '🤍': 'grayscale(1) brightness(1.35)', '🤎': 'sepia(1) brightness(.7)',
  })) glyphs.set(glyph, { name: 'heart', index: 2, filter });

  // Longer sequences first; optional variation selector also covers text-presentation glyphs.
  const pattern = new RegExp([...glyphs.keys()].sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\uFE0F?').join('|'), 'gu');

  function sprite(glyph) {
    const entry = glyphs.get(clean(glyph));
    if (!entry) return null;
    // A dedicated tag avoids broad legacy selectors such as '.slot-machine i' and '.petal-orb span'.
    const node = document.createElement('mb-attack-art');
    node.className = 'attack-art';
    node.dataset.prop = entry.name;
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', entry.name.replace(/-/g, ' '));
    const cell = entry.index % 16;
    const sheetIndex = Math.floor(entry.index / 16), sheet = sheets[sheetIndex];
    const col = cell % 4, row = Math.floor(cell / 4);
    const x = sheet.x[col], y = sheet.y[row];
    const width = sheet.x[col + 1] - x, height = sheet.y[row + 1] - y;
    node.style.backgroundImage = `url("${urls[sheetIndex]}")`;
    node.style.backgroundSize = `${1254 / width * 100}% ${1254 / height * 100}%`;
    node.style.backgroundPosition = `${x / (1254 - width) * 100}% ${y / (1254 - height) * 100}%`;
    node.style.height = `${1.15 * height / width}em`;
    if (entry.filter) node.style.filter = entry.filter;
    return node;
  }

  function decorate(root) {
    // Only text nodes: leave SVG geometry, images, attributes and character/token sprites intact.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement.closest('svg, .emoji-sprite, .attack-art, script, style')) continue;
      const text = node.nodeValue;
      pattern.lastIndex = 0;
      const matches = [...text.matchAll(pattern)];
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        fragment.append(text.slice(offset, match.index), sprite(match[0]));
        offset = match.index + match[0].length;
      }
      fragment.append(text.slice(offset));
      node.replaceWith(fragment);
    }
    return root;
  }

  function setText(root, text) { root.textContent = text; return decorate(root); }
  MB.AttackArt = { urls, yumi, eri, jay, artBooks, pristo, metalMass, sprite, decorate, setText };
})();
