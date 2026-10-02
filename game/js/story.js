// Story mode: one story across every novel's world, told on the maps of four acts. Each act is a map (a picture in
// the game-assets bucket under maps/, copied there from the "map-images" bucket by tools/sync_maps.py) with quests on
// it. An act opens with a prologue, then branches into storylines (one per novel) that can be played in any order,
// and closes with a finale once they are done. The rest of the rivals are side quests, and every map hides a few
// secrets: small lore scenes that pay some Glitter the first time.
//
// The lore follows the novels: every one of them has a "you" at its centre (Maria's adopted child, Chris's younger
// sibling, Misaki's cousin, the lost heir of the shogun, the servant Beatrice summoned...). Doe, Diana's narcissistic
// double from Earth 2, is stitching their worlds together to become the main character of all of them, and each world
// greets you as its own "you".
//
// Quest fields: id (defaults to the foe), foe, side, needs (quest ids that must be done first; a main quest without it
// follows the main quest listed before it, a side quest needs `from`), at: [x, y] in % of the map, via: [[x, y], ...]
// (bends of the path from its first need), place (a location of the act it sits in, else the act map), arc (the
// storyline's name), title, text (the quest panel's description), and scenes: `before` (played before the fight until it's won) and `after` (once, after the first win),
// or `scene` for a quest without a fight. The act's last main quest is its finale. `lesson` (the first quest only): after
// its scene comes the practice battle that teaches you to play (js/tutorial.js), then its `after` scene. `art` stages the
// quest panel's picture instead of acting out the scene's opening: { cast: [[id, mood, x], ...], rift: [x, y, size?, tilt?],
// shadows: [[id, at], ...] } (x, y in % of the picture; at: -1 to 1 along the tear): the cast posed in those moods, a tear
// in the sky, and the shadows of figures lingering in it.
//
// Act fields: title, map (+ w, h: its size in px, size: how wide it is drawn), color, music, bg (for scenes), intro
// (shown when the act opens), places: [{ id, title, map, w, h, size, at, icon, text }] (locations you enter from the
// act map; their quests use `place`), variants: [{ map, needs, count? }] (the map changes once `count` of `needs`,
// or all of them, are done: day to night) and secrets: [{ id, at, title, lines }] (found by clicking, once).
//
// A scene is a list of lines, or { bg, music, lines }; without bg/music it takes the fight's background and music (or
// the act's). A line is [who, text], [who, mood, text] or [who, mood, text, { close, shake }]: who is a character id,
// 'you' (the player) or '*' (narration); moods are the keys of MOODS; `close` cuts to a close-up of the speaker.
// A line can also be a direction instead:
//   { bg: 'name' }            change place (whoever is on stage leaves)     { fade: 'black' | 'white', bg? }  a cut
//   { music: 'id' | 'none' }  { sfx: 'name' }                                 { fx: 'flash' | 'shake' | 'rift' }
//   { where: 'Where', when: 'When' }  a location caption                    { cam: 'push' | 'pull' | 'pan' }
//   { weather: 'petals' | 'snow' | 'rain' | 'embers' | 'sparkles' | 'stars' | 'none' }
//   { light: 'night' | 'dark' | 'candle' | 'rift' | 'none' }  the lighting: a power cut, candles, a rift glowing off-screen
//   { fx: 'flicker' }  the lights stutter      { fx: 'rift', sky: [x, y, size?, tilt?] }  where (in % of the screen) the sky tears
//   { enter: 'id', at: 'left' | 'center' | 'right', mood }                  { hide: 'id' }
//   { choose: [['What you say', [lines...]], ...] }  the player picks a reply; its lines play, then the scene goes on
// {name} in a text is the player's name.
//
// Levels: rivals get harder the deeper their quest sits in the story (LEVEL); side quests a little harder than what
// opened them. Their HP and AI skill in MB.STORY are set from this when the game loads.
// Works on a save's { quests, storyActs, secrets, packs, glitter } only, so tools/check_game.js can simulate it.
window.MB = window.MB || {};
(function () {
  MB.ACTS = [
    // ================================================================ Act 1: south England, where Maria adopted you
    { id: 'hometown', title: 'A New Life', map: 'maps/adoptive_life.webp', w: 1024, h: 1024, size: 1800, color: '#ffb347',
      music: 'main-theme', bg: 'Our Home from the outside',
      intro: 'A quiet town in south England. A new mum, a new school... and a sky that is about to tear.',
      places: [
        { id: 'ih-school', title: 'The School on the Hill', map: 'maps/infernal_harmony_school.webp', w: 832, h: 832, size: 1600, at: [44, 17], icon: '🔥',
          text: 'A boarding school fell out of the sky onto the hill, prom banners and all. Its students are very confused.' },
      ],
      quests: [
        { id: 'moving-day', at: [47, 93], title: 'Goodmorning, Sunshine', lesson: true,
          text: 'Your first morning with Maria, the woman who adopted you. First day at a new school, too, and a crash course in Miku Battle.',
          scene: { bg: "Your's bedroom (Morning)", music: 'goodmorning-baby-boy', lines: [
            { where: 'The Hunley house', when: 'Monday, 7:12 AM' },
            ['*', 'A new town. A new house. A new mum.'],
            { enter: 'maria-hunley', at: 'center', mood: 'happy' },
            ['maria-hunley', 'happy', "Up you get, sweetie! First day at the new school. You're eighteen now, so I'm treating you like an adult. Mostly."],
            ['maria-hunley', 'proud', "Uniform's ironed, breakfast's on the table, and I did NOT burn the toast. Much."],
            { choose: [
              ['"Five more minutes..."', [['maria-hunley', 'angry', "Five more minutes, he says. I've been up since six practising my \"cool mum\" voice. Up!"]]],
              ['"Morning, Mum."', [['maria-hunley', 'excited', "Mum. You called me Mum. Oh, I'm going to cry into the cereal. Go, go, before I hug you to death!", { close: true }]]],
            ] },
            { bg: 'Our Home from the outside', music: 'oopsies' },
            ['*', "You're halfway down the street when you hear running behind you."],
            ['maria-hunley', 'scared', "Wait! Your lunchbox! You forgot your— WHOA—"],
            { fx: 'shake', sfx: 'bonk' },
            ['maria-hunley', 'sad', "...I'm fine. The pavement came out of nowhere. The sandwiches survived. Mostly."],
            { bg: 'Street to school', music: 'hello-hayley' },
            { enter: 'hayley-kate', at: 'right', mood: 'excited' },
            ['hayley-kate', 'excited', "NEW PERSON! *screeech* Hi hi hi! Hayley Kate, class 4B, second-best person you'll meet today! Maiko's first, she's my best friend, she does karate. HI-YAH!"],
            ['hayley-kate', 'happy', "You play Miku Battle, right? Everyone in town does."],
            ['you', "...I've never actually played."],
            ['hayley-kate', 'scared', "NEVER?! Okay. Okay! Emergency lesson. Right here, right now. School can wait five minutes.", { shake: true }],
            { enter: 'maria-hunley', at: 'left', mood: 'happy' },
            ['maria-hunley', 'happy', "Did somebody say lesson? I'll have you know I was the Miku Battle champion of my sixth form. Two years running."],
            ['maria-hunley', 'proud', "Tell you what, sweetie. I'll be your leader for this one and talk you through it. Hayley, go easy on them."],
            ['hayley-kate', 'excited', "Easy? Me? I'm ALWAYS gentle! Mostly! Deal 'em!"],
          ] },
          after: { bg: 'Street to school', music: 'hello-hayley', lines: [
            { enter: 'hayley-kate', at: 'right', mood: 'excited' },
            ['hayley-kate', 'excited', "See?! You're a natural! Well. A natural-ish. Beat people, they join your side, you get packs full of cards. That's the whole game!"],
            { enter: 'maria-hunley', at: 'left', mood: 'happy' },
            ['maria-hunley', 'happy', "If you forget anything, hover over it, or have a look at How to Play on the main menu. Now GO, you'll be late!"],
            ['maria-hunley', 'proud', "And sweetie? Your lunchbox."],
            ['*', 'You take the lunchbox. It is only slightly squashed.'],
          ] } },
        { foe: 'james-lone', at: [30, 79], title: 'Welcome to School', text: "James Lone has been assigned to show you around. He'd rather be anywhere else.",
          before: { bg: 'Outside School', music: 'welcome-to-school', lines: [
            { where: 'Your new high school', when: '8:02 AM' },
            ['james-lone', 'neutral', "...So you're the new one. Great. I've been \"assigned\" to show you around. Which means I've been waiting here twenty minutes."],
            ['hayley-kate', 'happy', "This is James! He's grumpy, but like, a cute grumpy."],
            ['james-lone', 'angry', 'I can hear you.'],
            ['james-lone', 'neutral', "The tour takes ten minutes. Or we play one round and I tell the teacher we did the tour. Your call. It's not a call."],
          ] },
          after: [
            ['james-lone', 'sad', "Hm. Fine. You're not boring."],
            ['james-lone', 'neutral', "Heads up. Maiko's coming. She thinks I'm the devil. Which, honestly, flattering."],
          ] },
        { foe: 'maiko-ghan', at: [12, 88], title: 'Meet Maiko', text: "Hayley's best friend, a karate girl with red glasses and zero filter, bumps into you. Hard.",
          before: { bg: 'School hallway', music: 'meet-maiko', lines: [
            { fx: 'shake', sfx: 'thud' },
            ['*', 'Something slams into you at full speed. Next thing you know, you are on the floor, pinned.'],
            { enter: 'maiko-ghan', at: 'center', mood: 'scared' },
            ['maiko-ghan', 'scared', "Oh— sorry! Reflex! Karate! I pin things that run into me! ...You ran into me. Mostly I ran into you.", { close: true }],
            ['maiko-ghan', 'angry', "And you were walking with JAMES? Ugh. Honestly? He'll ruin you. I'm saying that as a friend. We're friends now. I decided."],
            ['hayley-kate', 'excited', 'MAIKO! You met my new friend! Isn\'t he great?! Play him! Play him!'],
          ] },
          after: [
            ['maiko-ghan', 'sad', "You beat me. Honestly? That's... kind of cool. I-I mean. Whatever. You're alright."],
            ['hayley-kate', 'excited', "Oh! Your mum's sisters are coming for dinner tonight, right? Aunties! I LOVE aunties!"],
            ['you', 'How do you know that?'],
            ['hayley-kate', 'proud', "Small town! Everybody knows everything! Except what's up with the sky lately. It keeps... humming."],
          ] },
        { foe: 'julie-hunley', at: [55, 84], title: 'The Night the Sky Tore', text: 'Dinner with Mum and your two aunts, Isabella and Julie. Then the lights go out.',
          before: { bg: 'Kitchen (sitting down)', music: 'inside-buzz', lines: [
            { where: 'The Hunley house', when: '7:40 PM' },
            ['*', 'Dinner. Your mum, and her two little sisters, who drove down for the evening.'],
            ['isabella-hunley', 'happy', "So this is my new niece or nephew. Hello, lovely. I'm Isabella, the middle one. I coach tennis. I brought biscuits. Too many biscuits."],
            ['julie-hunley', 'excited', "And I'm JULIE! The youngest! The fun aunt! C'mere, you're getting a hug, you can't stop it, nobody can—"],
            ['maria-hunley', 'happy', "Julie, let them breathe."],
            ['julie-hunley', 'happy', "Never! I'm going to be a nurse, I know exactly how much breathing people need!"],
            { music: 'none', fx: 'flicker', sfx: 'riser' },
            ['*', 'Outside, the sky over the park hums. Louder. Louder.'],
            { fx: 'rift', sfx: 'warp', sky: [70, 22, 0.6, -10] },
            { fade: 'black', light: 'dark' },
            ['*', 'A crack of light splits the night sky, and every light in the house goes out.'],
            ['julie-hunley', 'scared', "N-no no no no, it's DARK, why is it dark, Maria, I don't do dark—", { shake: true }],
            ['isabella-hunley', 'scared', "Breathe, Julie. It's just a power cut. ...A power cut with a glowing sky. Totally normal."],
            ['maria-hunley', 'neutral', "Right. Candles. And sweetie? Keep your aunt busy. She calms down if she's winning at something."],
            { light: 'candle', sfx: 'sizzle' },
            ['julie-hunley', 'sad', "C-cards? By candlelight? That's cosy, not scary. NOT scary. Deal me in."],
          ] },
          after: { bg: 'Living Room', lines: [
            ['julie-hunley', 'happy', "Huh. The lights are back. And I didn't cry. Much. You're a good distraction, kiddo."],
            ['isabella-hunley', 'neutral', "Maria... look out of the window. The park."],
            { music: 'the-unknown-tear', light: 'rift' },
            ['*', 'Where the sky tore, something is still glowing, low over the gazebos. Waiting.'],
          ] } },
        { id: 'crack-in-the-sky', at: [60, 55], title: 'A Crack in the Sky', text: 'Something fell into the park when the sky tore. You and Hayley go and look.',
          art: { rift: [66, 28, 1.25, -6], cast: [['hayley-kate', 'scared', 26]], shadows: [['lilith', -0.6], ['celeste', 0.6]] },
          scene: { bg: 'Park', music: 'the-unknown-tear', lines: [
            { where: 'The park', when: '11:58 PM', light: 'night' },
            ['hayley-kate', 'scared', 'Okay. Midnight, park, glowing sky. This is how horror films start. I LOVE horror films. I hate this.'],
            { fx: 'rift', sfx: 'warp', cam: 'push' },
            ['*', 'The sky rips open above the gazebos. Wind roars. Two girls tumble out, still yelling at each other.'],
            { enter: 'lilith', at: 'right', mood: 'angry' },
            ['lilith', 'angry', "—and THAT'S why you don't touch a demon's punch bowl, you feathery— wait. Where are we?"],
            { enter: 'celeste', at: 'left', mood: 'happy' },
            ['celeste', 'happy', "Another town, it seems. And look who's here, my precious human. Every human has a guardian angel, darling, and I'm yours."],
            ['lilith', 'proud', "And every human gets a demon! Hi. I'm Lilith. My job is to break your sanity. It's going to be fun. For me.", { close: true }],
            ['lilith', 'scared', "...Wait. I've never seen you before. Why do I feel like I have?!"],
            { hide: 'lilith' }, { hide: 'celeste' },
            { fx: 'flash', sfx: 'boom' },
            ['*', 'All over town, buildings flicker into place: a school with a prom banner on the hill. A gated suburb in the north. A literature club in your very own school.'],
            ['*', 'Where the rift closed, something glitters in the grass: a shard of light, warm to the touch. It hums, louder whenever you face one of the new places.'],
            ['hayley-kate', 'excited', "Is it... a compass? It's pointing three ways at once! Okay. Okay okay okay. We're doing this. ALL of it."],
          ] } },
        // ---- storyline: Infernal Harmony
        { foe: 'jay-lester', arc: 'The Prom from Below', needs: ['crack-in-the-sky'], place: 'ih-school', at: [38, 60],
          title: 'Show Me Around Your School!', text: "Lilith has decided the school on the hill is YOUR school now, and you're giving her the tour. Jay is in the lobby, panicking about prom.",
          before: { bg: 'Lobby', music: 'morning', lines: [
            { where: 'The school on the hill', when: 'The next morning' },
            { enter: 'lilith', at: 'left', mood: 'proud' },
            ['lilith', 'proud', "This is your school now. I decided. Show me around, human. And there's a PROM tomorrow. I'm going. With you. D-don't get the wrong idea!"],
            ['jay-lester', 'happy', "Dude! There you are! You're... not from here? But you're also totally my friend? My brain hurts."],
            ['jay-lester', 'scared', "Also, prom is tomorrow and I have nothing to wear. Janice and I are just going to serve food instead. Wanna play? I think better when I lose. Which is a lot."],
          ] },
          after: [
            ['jay-lester', 'happy', "Ha! Okay, you're good. Hey, careful with the blonde girl in the cafeteria. She keeps calling you \"her human\" and glaring at your demon friend."],
            ['lilith', 'angry', "Celeste. Ugh. Of course she followed us."],
          ] },
        { foe: 'lilith', arc: 'The Prom from Below', place: 'ih-school', at: [68, 44], title: 'Hellfire Prom', text: 'Prom night. Two drunk girls flirt with you, Lilith thinks you want someone else, and her horns catch fire.',
          before: { bg: 'Cafeteria (Party)', music: 'party-music', lines: [
            { where: 'The prom', when: 'Saturday night' },
            ['charlie-and-jenny', 'happy', 'Heeey, cutie~ *hic* dance with us! Both of us! At once!'],
            { enter: 'lilith', at: 'right', mood: 'rage' },
            ['lilith', 'rage', "HEY. That's MY human. MINE. You think you can just— you want THEM instead of me?!", { close: true, shake: true }],
            { fx: 'shake', sfx: 'fire', weather: 'embers' },
            ['*', "Fire pours from Lilith's horns. The punch bowl boils. Somewhere, Mr. Dino says \"Huh.\""],
            ['celeste', 'angry', "Lilith, calm down! Darling, she won't listen to me. Beat her, and she'll listen to you."],
          ] },
          after: [
            { weather: 'none' },
            ['lilith', 'sad', "...I'm not supposed to like my humans. I'm supposed to break them. You're really bad at being broken, you know that?"],
            ['celeste', 'happy', "She'll be fine, darling. And so will you. That's my job, after all."],
            ['lilith', 'neutral', "Hey. That shard of yours smells like somewhere far away. Labs. Lab coats. Hooves? Gross."],
          ] },
        // ---- storyline: Doki Doki Literature Club
        { id: 'sayori', foe: 'sayori', arc: 'The Literature Club', needs: ['crack-in-the-sky'], at: [36, 63],
          title: "The Club That Wasn't There", text: "A classroom appeared in your school overnight. Inside, a girl with a messy bow acts like she's known you forever.",
          before: { bg: 'Club', music: 'ohayou-sayori', lines: [
            { where: 'The Literature Club', when: 'After school' },
            ['sayori', 'excited', "Ehehe~ morning! Er, afternoon! You found our club! Wait, this isn't our school. But you're here, so it's okay!"],
            ['hayley-kate', 'scared', "Um. Hi? This room wasn't here yesterday."],
            ['sayori', 'happy', "Everything outside the window is different! Monika's been writing about it all day. Play a game with me first? When everything's weird, cards help!"],
          ] },
          after: [
            ['sayori', 'happy', 'You won! Ehehe, that made me feel better. Everything\'s better with friends. Hug?'],
            ['sayori', 'neutral', "Monika wants to meet you. She says it's like reading a book where the pages got shuffled together."],
          ] },
        { foe: 'monika', arc: 'The Literature Club', at: [20, 57], title: 'A Place to Be Yourself', text: 'The club president has a theory about the new worlds. She would like to share it. And play.',
          before: { music: 'okay-everyone', lines: [
            ['monika', 'happy', "Welcome to the Literature Club! It's a place where people can express themselves in ways life normally doesn't allow."],
            ['monika', 'neutral', "I've been writing all day. Every place that appeared last night comes with its own people, their own story. And in every story I've read..."],
            ['monika', 'neutral', 'There is always a "you". Someone the story happens to. The protagonist.'],
            ['monika', 'proud', "Somebody is shuffling stories together, and every seam I find runs through you. I'm a bit of a perfectionist. So... prove my theory?"],
          ] },
          after: [
            ['monika', 'happy', "Ahaha. Yes. You're definitely the protagonist."],
            ['monika', 'neutral', "If you follow the seams, you'll find whoever is doing this. I'd write that down. I'm going to write that down."],
          ] },
        // ---- storyline: Paradiso Suburbia
        { foe: 'chris', arc: 'Paradiso', needs: ['crack-in-the-sky'], at: [30, 32], via: [[46, 44]],
          title: 'Big Brother', text: "A gated suburb appeared in the north. Its boy with the red-streaked hair knows you. He says he's your brother.",
          before: { bg: "Chris' Bedroom", music: 'song-1-2', lines: [
            { where: 'Paradiso Suburbia', when: 'The next day' },
            ['chris', 'neutral', "There you are. Mom's been worried sick. Dad's out looking. You good?"],
            ['you', "...I'm sorry, who are you?"],
            ['chris', 'sad', "Chris. Your brother. Two years older. I've been checking my phone every five minutes since you vanished."],
            ['hayley-kate', 'scared', "{name}, you have a BROTHER here?"],
            ['chris', 'neutral', "Skylar's telling everyone our street runs this town now. And she's asking about you. Beat me first. Then I know you'll be fine."],
          ] },
          after: [
            ['chris', 'happy', "...Yeah. You'll be fine. Go easy on Mom when you see her. She worries more than she shows."],
            ['chris', 'neutral', "And don't compliment Skylar's outfit. It makes it worse."],
          ] },
        { foe: 'skylar', arc: 'Paradiso', at: [9, 24], title: 'Queen Bee', text: 'Skylar Johnson, queen bee of Paramount Academy, has decided that two towns means twice the people to rule.',
          before: { bg: 'Paramount Academy Entrance', lines: [
            ['skylar', 'happy', "Oh, the Smith kid! Love that you just... wear whatever. So brave."],
            ['hayley-kate', 'angry', 'Hey! Their outfit is cute!'],
            ['skylar', 'proud', "Aww, and you made a friend. Adorable. Let's play, sweetie. Loser moves out of MY town."],
          ] },
          after: [
            ['skylar', 'sad', "Ugh. FINE. Whatever. It's a small town anyway. Don't tell my nephew I lost. He'll never shut up."],
            ['skylar', 'neutral', "...Some rich lady on the hill keeps sending people to ask about \"the new kid with the glowing rock\". Yours, probably."],
          ] },
        // ---- finale
        { foe: 'catherine-jones', needs: ['lilith', 'monika', 'skylar'], at: [78, 39], title: 'Everything Has a Price',
          text: 'Catherine Jones wants the humming shard for her collection. She also has opinions about adoption. Loud ones.',
          before: { music: 'cat-jones', lines: [
            { where: 'The Jones mansion', when: 'Evening' },
            ['catherine-jones', 'proud', 'Darling. That little shard is the most interesting thing to happen to this town since me. Name a price.'],
            ['you', "It's not for sale."],
            ['catherine-jones', 'angry', "Everything is for sale. I only like things that are real, sweetie. Organic. Natural. Not... adopted. Not borrowed."],
            ['hayley-kate', 'rage', 'Oh, she did NOT just say that.', { shake: true }],
            ['catherine-jones', 'proud', "Fine. We'll play for it. Artistic Endeavors never loses."],
          ] },
          after: [
            ['catherine-jones', 'sad', 'Hmph. Keep your little rock. It clashes with my curtains anyway.'],
            ['hayley-kate', 'scared', "{name}? The shard. It's not pointing at the town anymore. It's pointing... up. Out. Like, OUT out."],
          ] },
        { foe: 'maria-hunley', at: [71, 77], title: "Show Me How Much You've Grown", text: "Mum has heard everything. From three different worlds. She's waiting on the porch.",
          before: { bg: 'Our Home from the outside', music: 'maria-hunley', lines: [
            ['maria-hunley', 'neutral', "Hayley's mum called. And the Jones woman. And a girl with horns who said \"sorry about the gym\"."],
            ['maria-hunley', 'sad', "You're going after it, aren't you? Whatever is tearing up the sky."],
            ['you', "The shard points somewhere else. Another world. Someone there knows what's happening."],
            ['maria-hunley', 'sad', "When I was your age, I was so lonely. I promised myself my kid never would be. And now my kid wants to go and save the multiverse."],
            ['maria-hunley', 'proud', "...Then show me. Show me how much you've grown. If you can beat your mum, you can beat anything.", { close: true }],
          ] },
          after: { music: 'my-mom', lines: [
            ['maria-hunley', 'sad', 'Oh, you... Come here, sweetie.'],
            ['*', "She hugs you like she's trying to memorise you."],
            ['maria-hunley', 'happy', 'Call every night. Eat real food. And Hayley? You keep them safe.'],
            ['hayley-kate', 'excited', "Yes ma'am! INTERDIMENSIONAL ROAD TRIP!"],
          ] } },
        { id: 'road-out', at: [89, 60], title: 'The Edge of Town', text: 'At the edge of town the shard tears a door into the air. Time to go.',
          scene: { bg: 'Street sunset', music: 'bussin-home', lines: [
            { where: 'The edge of town', when: 'Sunset' },
            ['*', 'Half the town comes to see you off. Aunt Julie cries. James pretends not to.'],
            ['julie-hunley', 'sad', "You come back in one piece, or the fun aunt becomes the scary aunt. And I'm a nurse-in-training, I KNOW how many pieces you have."],
            ['monika', 'happy', "Here's my number. If the story gets strange, call me. I'm good at strange."],
            ['lilith', 'proud', 'And if anyone else tears the sky, tell them the demon who owns you wants a word!'],
            ['celeste', 'happy', "She does not own you. We'll watch over the town, darling. Go on."],
            { fx: 'rift', sfx: 'warp', cam: 'push' },
            ['*', 'The shard hums, and the air in front of you splits open. On the other side: a city of glass towers, a beach... and a sign that says NEW HAVEN.'],
            ['hayley-kate', 'excited', "Okay. Holding hands. Nobody lets go. Three, two—"],
            { fade: 'white' },
          ] } },
        // ---- side quests
        { foe: 'kayla-kate', side: true, from: 'maiko-ghan', at: [80, 86], title: 'Goth in the Woods', text: "Hayley's big sister Kayla is sulking in the woods at sunset. She agrees to one game. Whatever." },
        { foe: 'ben-brier', side: true, from: 'james-lone', at: [34, 44], title: 'Alley Toll', text: "Ben Brier has bullied James for years. Now he's blocking the shortcut behind the shops, and you walked in with James." },
        { foe: 'protagonist', side: true, from: 'sayori', at: [23, 69], title: "Sayori's Best Friend", text: "Sayori's childhood friend is standing at a crosswalk. They had a falling out, and now they're not even in the same town." },
        { foe: 'natsuki', side: true, from: 'sayori', at: [44, 69], title: 'Manga Closet', text: "Natsuki guards the club's manga closet. Touch her Parfait Girls and you're dead. Win, and maybe you get a cupcake." },
        { foe: 'yuri', side: true, from: 'monika', at: [8, 64], title: 'A Gentle Soul', text: "Yuri is reading under a streetlight in a town she doesn't know, with a flask of green tea. She'd like some company." },
        { foe: 'janice-garmund', side: true, from: 'jay-lester', place: 'ih-school', at: [30, 33], title: 'Stage Fright', text: 'Janice has to announce the prom awards and has terrible stage fright. A card game calms her down. She read the rules twice.' },
        { foe: 'clara-click', side: true, from: 'jay-lester', place: 'ih-school', at: [16, 68], title: 'Lemonade Standoff', text: "Clara Click from 2B is running a lemonade stand. It's not like she WANTS to play with you." },
        { foe: 'mr-dino', side: true, from: 'jay-lester', place: 'ih-school', at: [76, 68], title: 'Huh.', text: '"Huh. You\'re new. Help me hang these prom posters, then we play. Future president, by the way."' },
        { foe: 'charlie-and-jenny', side: true, from: 'lilith', place: 'ih-school', at: [52, 82], title: 'After-Party', text: "Charlie and Jenny are picking on Janice again. Bet you can't beat BOTH of them." },
        { foe: 'celeste', side: true, from: 'lilith', place: 'ih-school', at: [56, 30], title: 'Guardian Angel', text: "Celeste insists on protecting you. From Lilith. From everything. She'd also like a date. With a card game." },
        { foe: 'ethan', side: true, from: 'chris', at: [5, 8], title: 'Gated Community', text: "Skritz, Skylar's nephew, says the cul-de-sac is his turf. His dad's a dentist." },
        { foe: 'evelyn', side: true, from: 'chris', at: [24, 7], title: 'Scary Story', text: "Evelyn, Olivia's little sister, wrote a horror story. It's a card game. She's very proud of it." },
        { foe: 'reina', side: true, from: 'chris', at: [13, 44], title: 'Live from the Mall', text: 'Reina is streaming the new town to her followers. Any attention is good attention, and you are the content now.' },
        { foe: 'peter-reeves', side: true, from: 'chris', at: [33, 20], title: 'Napoleon Would Have Won', text: 'Mr. Reeves has unrolled a battle map. Pop quiz, soldier! His "Napoleonic genius" awaits.' },
        { foe: 'olivia-paradiso', side: true, from: 'chris', at: [90, 72], title: 'Ring Rookie', text: 'Olivia Reid, MMA fan and the sweetest girl in Paradiso, wants to see who can win faster. Ready... GO!' },
        { foe: 'sophia', side: true, from: 'skylar', at: [18, 36], title: 'Bake Sale Stakes', text: "Sophia, Paramount's perfect student council president, wants a friendly game. She looks exhausted." },
        { foe: 'maia', side: true, from: 'maria-hunley', at: [66, 62], title: 'Home Sweet Home', text: 'Maia, your clingy kid sister, has barricaded the sofa with cushions. She wants you home, fed, medicated... and beaten at cards.',
          before: { bg: "4bb21054-46c1-45f2-bea6-4f52a43b2b1a", music: "tenderness", lines: [
            { where: "The living room", when: "Well past dinner" },
            { enter: "maia", at: 'center', mood: "happy" },
            ["maia", "happy", "You're back! Did you eat? Did you take your... no, those are MY pills. I took mine. Did YOU?!"],
            ["maia", "scared", "Sorry! I'm doing it again. The worrying thing. ...Play a game with me? Then I'll stop. Probably."],
          ] },
          after: [
            ["maia", "excited", "You won! Of course you did! You're the best big sibling anyone could ever...", { close: true }],
            ["maia", "happy", "...Um. Can I sit next to you? Just in case?"],
          ] },
      ],
      secrets: [
        { id: 'maria-photo', at: [49, 76], title: 'An Old Photo', lines: [
          ['*', "On Maria's shelf: a photo of a young man in uniform. She always says he was her boyfriend, sent off with the army."],
          ['*', "Aunt Isabella once told you, very quietly, that there was never any boyfriend. Maria just didn't want you to think she'd been lonely."],
        ] },
        { id: 'kate-house', at: [22, 13], title: 'A Very Loud House', lines: [
          ['*', 'The Kate house: five kids, two parents, one guitar. Harris, Kayla, Hayley, Paxton and Sara.'],
          ['*', 'Hayley is right in the middle. It explains a lot about how loud she has to be.'],
        ] },
        { id: 'wert-vacuums', at: [92, 30], title: 'Vacuum Sale', lines: [
          ['wert-lone', 'happy', "Wert Lone, chief salesman! Care for a vacuum cleaner? No? My son James says I'm \"embarrassing\". I say I'm VINTAGE."],
        ] },
      ] },

    // ================================================================ Act 2: New Haven, Connecticut, on an Earth of humans and anthros
    { id: 'new-haven', title: 'New Haven', map: 'maps/new_haven.webp', w: 1536, h: 1024, size: 2300, color: '#4ab8ff',
      music: 'welcome-to-the-city-day', bg: 'New Haven - Day',
      intro: 'New Haven, Connecticut. Another Earth, where humans and anthros live side by side, and the Institute studies the others.',
      // the city turns to afternoon once two storylines are done, and to night for the finale
      variants: [
        { map: 'maps/new_haven_afternoon.webp', needs: ['diana', 'rirarra-charca', 'linda-penn'], count: 2 },
        { map: 'maps/new_haven_night.webp', needs: ['marija'] },
      ],
      places: [
        { id: 'tower', title: 'The Watchtower', map: 'maps/lifeguard_tower.webp', w: 1024, h: 1024, size: 1600, at: [12, 42], icon: '🦈',
          text: "A whole beach from the Coorong, South Australia, washed up here: tower, showers and Rirarra and Rowdy's cabin." },
        { id: 'cove', title: 'The Cocktail Cove', map: 'maps/lifeguard_cove.webp', w: 1024, h: 1024, size: 1600, at: [21, 22], icon: '🍹',
          text: "Rinco and Melanika's stretch of the beach. There is a bar. There is a seagull. The seagull runs the bar." },
        { id: 'workshop', title: "The Medic's Workshop", map: 'maps/lifeguard_workshop.webp', w: 1024, h: 1024, size: 1600, at: [5, 57], icon: '🔨',
          text: 'The cabin Daphne the engineer and Brizz the medic share. Not lovers. Very clear about that.' },
        { id: 'neon', title: 'The Neon District', map: 'backgrounds/neon-district-17d4b3.webp', w: 1280, h: 768, size: 1900, at: [53, 22], icon: '🍕',
          text: 'Grid City, a cyberpunk megacity, landed behind the skyline. It never stops raining neon. Somebody ordered a pizza.' },
        { id: 'paris', title: 'Rue Douceur', map: 'maps/sugar_paris.webp', w: 1750, h: 977, size: 2000, at: [12, 88], icon: '🥐',
          text: 'A corner of Paris drifted in by the market stalls: a pâtisserie, a ballet school, a theatre, and a tram that never quite leaves.' },
        { id: 'siren', title: "Siren's Cove Resort", map: 'backgrounds/background-55-528261.webp', w: 1536, h: 1024, size: 2100, at: [47, 77], icon: '🏨',
          text: 'An island resort drifted in by the harbour: pools, a surf hut, a haunted wing, and a staff with a lot of secrets.' },
      ],
      quests: [
        { id: 'new-haven', at: [34, 90], title: 'Welcome to the City', text: 'Glass towers, a beach, a university... and a very excited deer girl.',
          scene: { bg: 'New Haven - market street', music: 'welcome-to-the-city-day', lines: [
            { where: 'New Haven, Connecticut', when: 'Another Earth' },
            ['hayley-kate', 'excited', 'WHOA. Everyone is... a deer? A cat? Is that a WOLF holding a latte?! I love it here. I live here now.'],
            { enter: 'jane', at: 'right', mood: 'excited' },
            ['jane', 'excited', "*excited bleat* ¡Hola! Humans! Visiting humans! Are you lost? You look lost. You're holding a glowing rock, which is VERY lost."],
            ['jane', 'happy', "I'm Jane! I study IT at the university, and I cheer! My sister Diana is a scientist at the Institute, the big tower. She'd LOVE your rock."],
            ['*', 'The shard wobbles in your hand. It points at the tower... but also at the beach, and at the campus, where the air shimmers like heat on a road.'],
          ] } },
        { foe: 'jane', at: [57, 60], title: 'Campus Tour', text: 'Jane insists on a campus tour. And a card game. Mostly the card game.',
          before: [
            ['jane', 'happy', "And THIS is the university! That's the library, that's the field, and that is, um, a whole other university that fell out of the sky this morning. From Wales?"],
            ['hayley-kate', 'scared', "It's happening here too..."],
            ['jane', 'sad', "...and those are the cheerleaders. Saria's their captain. She's, um. Not nice to deer. Let's play over here instead!"],
          ],
          after: [
            ['jane', 'happy', "*happy bleat* ¡Qué bueno! You're really good! Okay: the Institute is that way, the beach is that way, and someone on the campus lawn is yelling \"WINGMAN\"."],
            ['hayley-kate', 'proud', 'Three leads at once! We can go anywhere! This is the best multiverse EVER.'],
          ] },
        // ---- storyline: The Lifeguard has Teeth
        { foe: 'rowdy-brachy', arc: 'The Lifeguard has Teeth', needs: ['jane'], place: 'tower', at: [42, 74],
          title: 'Some-fin Is Wrong', text: "A beach from South Australia washed up on New Haven's shore, lifeguards and all. You can't swim. You find out the hard way.",
          before: { bg: 'New Haven Coast', music: 'waves', lines: [
            { where: 'The shore', when: 'Afternoon' },
            ['*', 'A wave out of nowhere knocks you off the pier. You were never much of a swimmer. The water closes over your head.'],
            { fx: 'shake', sfx: 'splash', music: 'shark-attack' },
            ['*', 'Then something huge grabs you, and hauls you onto the sand like a sack of potatoes.'],
            { enter: 'rirarra-charca', at: 'center', mood: 'excited' },
            ['rirarra-charca', 'excited', "GOT YOU! Oi, little human, you swim like a brrrick! Lucky big sis Rirarrra was here. You arrre MINE now. I rrrescued you, rrrules are rrrules!", { close: true }],
            { hide: 'rirarra-charca' },
            ['rowdy-brachy', 'happy', "S-sorry about her. I'm Rowdy. Bronze whaler. Our whole beach moved here from the Coorong. We didn't. Well, we did, with the beach."],
            ['rowdy-brachy', 'neutral', "She won't let you leave until you've proven you can look after yourself. Do humans like card games? I read that they do."],
          ] },
          after: [
            ['rowdy-brachy', 'happy', "You're nice! Rirarra will like you even more now. She likes things she can pick up."],
            ['hayley-kate', 'scared', 'What does that MEAN.'],
          ] },
        { foe: 'rirarra-charca', arc: 'The Lifeguard has Teeth', place: 'tower', at: [68, 48], title: 'Big Sis', text: "Rirarra, the biggest and loudest lifeguard on the beach, has decided you are hers. Forever. Unless you win.",
          before: [
            ['rirarra-charca', 'proud', "Big sis says you stay on the beach. Safe! Warrrm! No drrrowning! Beat big sis and you can go. ...Prrrobably. Maybe. Nah!"],
            ['hayley-kate', 'angry', "You can't just keep people!"],
            ['rirarra-charca', 'happy', "Can too! Also, have you seen any dolphins? I hate dolphins. Sneaky smiley jerrrks."],
          ],
          after: [
            ['rirarra-charca', 'sad', 'Awww. Fine. You can have yourrrself back.'],
            ['rirarra-charca', 'neutral', "Hey, little human. The night the sky brrroke, a deer lady was up on that big tower. Laughing. Shiny coat. Not a nice laugh."],
            ['hayley-kate', 'scared', "A deer lady? Jane's sister is a deer lady..."],
          ] },
        // ---- storyline: The Yuri Assist
        { foe: 'andrea-lyle', arc: 'The Yuri Assist', needs: ['jane'], at: [71, 64], title: 'Wingman Wanted', text: "Andrea's whole school came through a rift. She has one priority, and it isn't the rift.",
          before: { bg: 'Sidewalk', lines: [
            ['andrea-lyle', 'excited', "YOU! You're my wingman! I don't know how I know that, but I KNOW it."],
            ['andrea-lyle', 'happy', 'New world, new campus, new girls. This is my chance! Help me find a girlfriend and I owe you forever.'],
            ['hayley-kate', 'happy', 'Aww. I love her.'],
            ['andrea-lyle', 'proud', "But first, cards. Prove you're wingman material."],
          ] },
          after: [
            ['andrea-lyle', 'excited', "Wingman material CONFIRMED. Her name is Linda. She's in the library. She's perfect. She terrifies me."],
          ] },
        { foe: 'linda-penn', arc: 'The Yuri Assist', at: [80, 42], title: 'Required Reading', text: 'Linda Penn does not date. Linda Penn does not even look up from her book. Andrea is counting on you.',
          before: [
            ['linda-penn', 'neutral', "Andrea sent you. She's been hiding behind that shelf for twenty minutes."],
            ['andrea-lyle', 'scared', "*from behind the shelf* NO I HAVEN'T."],
            ['linda-penn', 'proud', "Show me she has good taste in friends. Then maybe I'll believe she has good taste in general."],
          ],
          after: [
            ['linda-penn', 'happy', "...Fine. Tell her Friday. Seven. She's paying."],
            ['andrea-lyle', 'excited', 'SHE SAID FRIDAY! Wingman of the YEAR!', { close: true }],
          ] },
        // ---- storyline: New Haven Institute of Science
        { foe: 'aria', arc: 'The Institute', needs: ['jane'], at: [42, 58], title: 'Badge, Please', text: "The New Haven Institute of Science. Aria, head of security, hasn't moved from the door in six hours.",
          before: { music: 'new-haven-institute-welcome', lines: [
            { where: 'New Haven Institute of Science', when: 'Reception' },
            ['bucky', 'happy', "Heyyy, visitors! Humans, even! I'd love to write you a pass, hun, but the boss locked everything down the night the sky broke."],
            ['aria', 'neutral', 'Badge, please.'],
            ['you', "We're here to see Diana. Her sister sent us."],
            ['aria', 'neutral', "Everybody's sister sent them. My daughter works in that lab. Nobody goes up without a badge."],
            ['aria', 'proud', 'No badge? Then you play me.'],
          ] },
          after: [
            ['aria', 'happy', "...Hm. Fine. Lab A-3, fourth floor. And if you see a tall elk girl with a red nose making Christmas puns in September, that's my Natalie. Be nice."],
          ] },
        { foe: 'diana', arc: 'The Institute', at: [29, 40], title: 'Lab A-3', text: 'Diana Bullen, senior research scientist, takes one look at the shard and drops her coffee.',
          before: { bg: 'Lab A-3 Daytime', music: 'the-lingering-question-of-what-if', lines: [
            ['diana', 'scared', "¡Ay, Dios! Where did you get that?! That's a piece of a rift compass!", { close: true }],
            ['diana', 'neutral', "We can reach other Earths from here. Earth 2, Earth 3, Earth 7... We number them. This compass is tuned to Earth 2."],
            ['diana', 'sad', "And someone has been opening our gateway at night. Not just to other Earths. To other... stories. Places that shouldn't be reachable at all."],
            ['hayley-kate', 'neutral', 'Monika said the same thing. Every world has a "you" at its centre. And it\'s always {name}.'],
            ['diana', 'happy', "Then you're the only one who can follow the trail! But Mamá runs the Institute, and she... doesn't trust humans much. Show me what you've got, friend!"],
          ] },
          after: [
            ['diana', 'sad', "Before you meet her... Papá was killed by human hunters. By accident, before Jane was even born. Mamá's forgiven a lot since. Not everything."],
            ['diana', 'happy', "But she'll see what I see. ¡Increíble! Top floor. Good luck."],
          ] },
        // ---- finale
        { foe: 'marija', needs: ['diana', 'rirarra-charca', 'linda-penn'], at: [37, 27], title: 'The Director',
          text: 'Marija Bullen runs the Institute. The gateway is hers, and so is the final word. She does not trust humans.',
          before: [
            ['marija', 'neutral', "A human. In my office. Holding something that tore my sky open."],
            ['marija', 'angry', "I have buried someone because humans did not think. So forgive me if I do not simply hand you the most dangerous room on this Earth."],
            ['diana', 'sad', 'Mamá...'],
            ['marija', 'proud', "My daughters speak for you. My security chief speaks for you. That is a start. In my institute, you earn your place. Show me.", { close: true }],
          ],
          after: [
            ['marija', 'sad', '...Andrew would have liked you. He always said the stubborn ones are worth trusting.'],
            ['marija', 'neutral', 'Tonight, then. Lab B-2. Diana will run the gateway, and you will find out who has been playing with my laboratory.'],
          ] },
        { id: 'lab-b2', at: [37, 8], title: 'Lab B-2', text: 'Midnight. The gateway hums. Someone is already inside.',
          scene: { bg: 'Lab B-2 before rift', music: 'another-earth', lines: [
            { where: 'Lab B-2', when: '12:00 AM' },
            ['diana', 'neutral', "Gateway at forty percent... fifty... ¡Ay, the readings are going crazy!"],
            { fx: 'rift', sfx: 'warp', bg: 'Lab B-2 Earth 7 Rift', cam: 'push' },
            { enter: 'doe', at: 'right', mood: 'excited' },
            ['doe', 'excited', '¡Hola! The main character is here~', { close: true }],
            ['diana', 'scared', 'She... she looks like ME?!'],
            ['doe', 'proud', "Doctor Doe Bullen, Earth 2. I'm you, Diana, just... better at it. Everyone on my Earth adores me, you know. Or they should."],
            ['doe', 'happy', 'And you must be the "you". Every world I stitch in, there you are, at the centre, with everyone looking at you. Isn\'t that SO unfair?'],
            ['doe', 'angry', "Every story has a main character. So I'm sewing them all into ONE story. And in that one, everyone looks at ME."],
            ['hayley-kate', 'angry', "That's not how stories work!"],
            ['doe', 'happy', "It is if you hold the pen, cariño. Oh, and I'll take my compass back, gracias."],
            { fx: 'flash', sfx: 'boom' },
            ['*', 'She grabs the shard. It flares. The gateway howls, and a piece of the compass cracks off in her hand.'],
            ['doe', 'angry', "¡Ay, no! Keep your crumbs, then. I'll be waiting where all the worlds meet: the top of the Peaks. Catch me if you can~"],
            { fx: 'shake', sfx: 'vortex', weather: 'sparkles' },
            ['*', 'The rift swallows her. Then it swallows the room. The last thing you hear is Diana shouting your name. The last thing you feel is Hayley holding your hand very, very tight.'],
            { fade: 'white', weather: 'none' },
          ] } },
        // ---- side quests
        { foe: 'bucky', side: true, from: 'aria', at: [49, 47], title: 'Roll for Initiative', text: 'Bucky at the front desk will finally write you a visitor pass. Right after you roll for initiative. D&D is on Saturdays.' },
        { foe: 'saria', side: true, from: 'jane', at: [66, 50], title: 'Pro-Predator', text: "Saria, captain of the cheerleaders, bullies Jane for being a deer. She'd like to add a human to the list." },
        { foe: 'seren-lockster', side: true, from: 'jane', at: [90, 30], title: 'Fake It to Make It', text: 'A Welsh university landed on campus. Your best friend Ellis got into their girls\' cheer squad by mistake, and Seren wants to meet "Ellis\'s friend".' },
        { foe: 'alice-orejin', side: true, from: 'seren-lockster', at: [96, 41], title: 'Candy Stakes', text: 'Alice will play you for her candy. She has a LOT of candy. She is also vibrating.' },
        { foe: 'alys-porter', side: true, from: 'seren-lockster', at: [88, 50], title: 'An Adult Match', text: 'Alys is an ADULT, and she will beat you like one.' },
        { foe: 'eira-randers', side: true, from: 'seren-lockster', at: [96, 57], title: 'The Snow Flower', text: 'Eira is, like, the most popular girl in her university. And in this one, obviously.' },
        { foe: 'carys-crowner', side: true, from: 'seren-lockster', at: [84, 22], title: 'Pom-Pom Duel', text: "Carys, the squad's social star, wants to be friends! Wait, you're playing AGAINST each other? ...Yay!" },
        { foe: 'jack-lockster', side: true, from: 'seren-lockster', at: [93, 18], title: 'Game Day', text: "Jack, Seren's twin and the football captain, doesn't talk much. He cracks his knuckles instead." },
        { foe: 'megan-dilourice', side: true, from: 'carys-crowner', at: [89, 65], title: 'Squad Vote', text: 'Megan, the squad leader, runs everything democratically. The vote says you play for your place on the field.' },
        { foe: 'owain-owegrain', side: true, from: 'megan-dilourice', at: [95, 72], title: 'Rules Are Rules', text: "Owain manages the squad and suspects Ellis isn't what she seems. Keep her secret: beat him first." },
        { foe: 'eva-vinn', side: true, from: 'andrea-lyle', at: [68, 33], title: 'Study Buddy', text: "Eva, Andrea's geeky friend, is bouncing off the walls of the study room." },
        { foe: 'ashley-lennette', side: true, from: 'andrea-lyle', at: [78, 73], title: 'Loser Buys Poutine', text: 'Ashley spins a basketball on one finger. Cards, eh? Loser buys the poutine.' },
        { foe: 'brizz-bigeyed', side: true, from: 'rowdy-brachy', place: 'workshop', at: [78, 80], title: 'CPR Drills', text: 'Brizz the beach medic heard you nearly drowned. Game first. Loser does the CPR drills.' },
        { foe: 'melanika-carchara', side: true, from: 'rowdy-brachy', place: 'cove', at: [30, 66], title: 'Territory', text: "Melanika and Rirarra fight over whose stretch of beach this is. Melanika would like you on her side of the line." },
        { foe: 'daphne-mokarran', side: true, from: 'rowdy-brachy', place: 'workshop', at: [50, 64], title: "Hammerhead's Workshop", text: 'Daphne the engineer smashes things before she fixes them. Right now she is smashing a sink. Play fast.' },
        { foe: 'rinco-typus', side: true, from: 'rirarra-charca', place: 'cove', at: [58, 80], title: 'Gentle Giant', text: 'Rinco, the lifeguards\' nine-foot leader, is feeding the birds by the shore. She would like to play... gently.' },
        { foe: 'joseph', side: true, from: 'aria', at: [48, 34], title: 'Lunch Rush', text: 'Joseph, the kangaroo who serves in the Institute cafeteria, has a crush on Diana and sees you as competition. One game before lunch goes cold.' },
        { foe: 'natalie', side: true, from: 'aria', at: [22, 38], title: 'Oh Deer', text: "Natalie is an elk. NOT a deer. She's also Aria's daughter, and her Christmas puns are sleigh-ing." },
        { foe: 'quinta', side: true, from: 'diana', at: [20, 28], title: 'Stream Challenger', text: "Quinta, Diana's best friend since preschool, streams her lab work. Chat wants a card battle." },
        // the one-girl novels
        { foe: 'amy-lyn', side: true, from: 'jane', at: [22, 63], title: "Everythin' with Amy Lyn", text: 'A blonde girl with a ":3" smile waits outside the arcade in a school uniform. She says she can be anything. Mid-game.' },
        { foe: 'saya', side: true, from: 'diana', at: [60, 14], title: 'Aligned Objectives', text: "NeuralDynamics Inc. landed its tower downtown. Its CTO, Saya, has read your file, and she has questions. Strategic ones." },
        { foe: 'luxuria', side: true, from: 'aria', at: [88, 84], title: 'Sister Lucy', text: 'You wake up in the middle of a glowing circle, in an old chapel that fell into the woods. Three nuns stand around you. The youngest has a tail.' },
        { foe: 'ignis', side: true, from: 'luxuria', at: [95, 93], title: 'The Last Sacrifice', text: "Ignis explains, very calmly, that their ritual needs one last human. You. It's nothing personal. She's a demon general." },
        { foe: 'doloria', side: true, from: 'ignis', at: [85, 95], title: 'Twenty Years in a Veil', text: 'The ritual cracks the curse on Sister Doloria. For twenty years she thought she was a simple nun. She was a queen.' },
        // Makin' Magic with Miku
        { foe: 'm-chan', side: true, from: 'jane', at: [12, 72], title: 'The Invisible Mascot', text: 'Every screen in the arcade shows the same girl in a beret, arms crossed. She is NOT Hatsune Miku, and she has notes on your story.' },
        // Cyber Delivery, in the Neon District
        { foe: 'dani', side: true, from: 'diana', place: 'neon', at: [22, 78], title: 'Delivery for You', text: "A pizza van skids to a stop in the rain. Dani, the delivery girl, is sure someone here ordered. It wasn't you. She'll play you for it anyway." },
        { foe: 'jet', side: true, from: 'dani', place: 'neon', at: [8, 60], title: "Can't Stand Still", text: "Jet, Dani's old coworker, can't stop moving. Cards are the only thing that holds him in one place. Almost." },
        { foe: 'pedro', side: true, from: 'dani', place: 'neon', at: [42, 84], title: "Pedro's Diner", text: 'An ex-combat android runs the diner now. The food is great. The chef has seen things. Lose, and you wash the dishes.' },
        { foe: 'takeda', side: true, from: 'dani', place: 'neon', at: [30, 42], title: 'The Ronin', text: 'An android samurai guards the back alleys from the megacorps. He speaks in broken proverbs and refuses to use guns.' },
        { foe: 'crash', side: true, from: 'jet', place: 'neon', at: [62, 70], title: 'A Biker Named Crash', text: "The gang boss wants his full name used. His sister Hope wants this over with. They both want your turf." },
        { foe: 'kat-13', side: true, from: 'takeda', place: 'neon', at: [72, 30], title: 'Enforcer', text: 'Valkyrie Corp sent KAT-13 to keep the peace. She keeps it very, very violently. She is smiling. Somehow.' },
        { foe: 'lamina', side: true, from: 'crash', place: 'neon', at: [88, 86], title: 'The Chitin Creed', text: "Under the streets, the moth mother leads the experiments Jeong-ui threw away. She knows who made her. She'd like you to know too." },
        { foe: 'seo-jin-tae', side: true, from: 'lamina', place: 'neon', at: [84, 18], title: 'Machines of Flesh', text: "Jeong-ui BioWorks' CEO watches the city from his tower. To him, you're raw material with opinions." },
        { foe: 'nanami-hana', side: true, from: 'jane', at: [63, 74], title: 'The Furious Two', text: 'A boxing gym opened behind the shops. Its star, Nanami Hana, fights bullies for a living. Her friend Anon told her about you.' },
        { foe: 'cordelia', side: true, from: 'amy-lyn', at: [27, 80], title: 'Aisle Nine', text: "Cordelia, a lolita-clad bookseller, judges every customer's taste before she will ring them up. She would like to see yours.",
          before: { bg: "bad84cd3-9cdf-44ee-b2cc-9b5d0018092f", music: "gymnopedie", lines: [
            { where: "Pageturner Books", when: "Nearly closing time" },
            { enter: "cordelia", at: 'center', mood: "neutral" },
            ["cordelia", "neutral", "Manga is aisle nine. I will not be making a recommendation. I will, however, be making a face."],
            ["cordelia", "proud", "You have the look of someone who has read an isekai. Twice. Let us settle this the civilised way: cards."],
          ] },
          after: [
            ["cordelia", "happy", "...Hm. Four stars. The fifth is for the spine you did not crack. Do come again.", { close: true }],
          ] },
        { foe: 'reika', side: true, from: 'jane', at: [72, 88], title: 'Moe Moe Kyun?', text: 'Reika, the cat cafe\'s star maid "Kiwi", is pranking customers again. She swears the tray is not rigged.',
          before: { bg: "a9d058bb-0c84-46a5-985c-43e47d9f3571", music: "song-1-3", lines: [
            { where: "Neko Cafe", when: "Lunch rush" },
            { enter: "reika", at: 'center', mood: "proud" },
            ["reika", "proud", "Welcome home, goshujin-sama! ...Ugh, say something. Order. Anything. Not the cat, the cat is staff."],
            ["reika", "neutral", "Fine. Nobody can resist my service. Play me, and if you win I'll say something nice. Maybe. Don't get used to it."],
          ] },
          after: [
            ["reika", "scared", "W-why are you smiling like that?! Stop! ...Was that praise? Say it again. N-no! Don't!", { close: true }],
          ] },
        { foe: 'ida', side: true, from: 'reika', at: [60, 88], title: 'Domestic Protocol', text: 'An android in a maid uniform waits in an apartment for her first instructions. She has questions about the word "home".',
          before: { bg: "ca70e25b-0008-49b3-b4aa-244f25017b86", music: "summer-day", lines: [
            { where: "A quiet apartment", when: "Day 1, 09:00" },
            { enter: "ida", at: 'center', mood: "neutral" },
            ["ida", "neutral", "Unit DD-23581321-X, activated. Primary directive: domestic assistance. ...Home. What is the correct way to feel about it?"],
            ["ida", "happy", "Request: teach me a game. Humans seem to enjoy them. I will learn quickly. It may not be fair."],
          ] },
          after: [
            ["ida", "happy", "Defeat processed. ...It is an interesting sensation. I would like to experience it again."],
          ] },
        // Sugar & Sweethearts: Rue Douceur, a corner of Paris with its own map
        { foe: 'nico', side: true, from: 'jane', place: 'paris', at: [78, 58], title: 'The New Manager',
          text: "A pâtisserie from Paris appeared by the market stalls. Its staff are waiting for their new manager. Apparently that's you.",
          before: { bg: '56f0ec14-26ba-4168-93d6-85914c9c4f2b', music: 'parisian-daydream', lines: [
            { where: 'Rue Douceur, Paris', when: 'Opening time', weather: 'petals' },
            ['*', 'Where the market stalls should end, the street turns to cobblestones. Lamp posts. A tram bell. A pink awning that says PÂTISSERIE.'],
            ['hayley-kate', 'excited', 'Is that... PARIS? Next to the bowling alley?!'],
            { enter: 'nico', at: 'right', mood: 'happy' },
            ['nico', 'happy', "Nya~! There you are! You're the new manager, right? Dante said the new manager would look lost. You look SO lost."],
            ['you', "I think there's been a mistake."],
            ['nico', 'proud', "Nope! No mistakes at Douceur. Only pranks. And card games. Beat me and I'll show you around~"],
          ] },
          after: [
            ['nico', 'sad', 'Nyaa... you are good. Fine, fine. Welcome to Douceur Café, manager!'],
            ['nico', 'happy', "Momo's at the market, Haruka's at the theatre, Finn's at ballet, and Ryu is in the park, NOT sulking. Go say hi! They'll all want to test you~"],
          ] },
        { foe: 'momo', side: true, from: 'nico', place: 'paris', at: [22, 50], title: 'Market Run',
          text: 'Momo, the pastry chef, is buying strawberries for the day. He is very, very nervous about meeting the new manager.' },
        { foe: 'haruka', side: true, from: 'nico', place: 'paris', at: [64, 88], title: "All the World's a Stage",
          text: 'Haruka rehearses Shakespeare on the empty stage before her shift. She demands an audience. You will do.' },
        { foe: 'finn', side: true, from: 'haruka', place: 'paris', at: [77, 80], title: 'École de Ballet',
          text: 'Finn practises at the ballet school before work. He does not like to be rushed. Or watched. Or beaten.' },
        { foe: 'ryu', side: true, from: 'momo', place: 'paris', at: [50, 22], title: 'The Ryuzaki Band',
          text: 'Ryu plays guitar in the park gazebo for his fan club of regulars. He is not sulking. He is on a break. A long one.' },
        { foe: 'velour', side: true, from: 'finn', place: 'paris', at: [24, 80], title: 'After Hours',
          text: 'The cinema is dark and empty. The night maid of Douceur watches old films here before his shift. Nobody has seen him in daylight.' },
        { foe: 'cupid', side: true, from: 'ryu', place: 'paris', at: [44, 44], title: 'A Little Favour',
          text: 'A boy with pink wings is rearranging the flower shop. He says he is the god of love, and that your love life is VERY interesting.' },
        { foe: 'dante', side: true, from: 'velour', place: 'paris', at: [84, 36], title: 'Closing Time',
          text: 'Dante, owner of Douceur Café, has heard all about the new manager. Tonight the two of you close up. After one last game.',
          before: { bg: '9c1c1a99-95db-423f-b5fb-5538467a43a9', music: 'moonlight-cafe', lines: [
            { where: 'Douceur Café', when: 'Closing time', light: 'candle' },
            { enter: 'dante', at: 'center', mood: 'neutral' },
            ['dante', 'neutral', 'Nico says you let her win once. Momo says you ate three danishes. Ryu says nothing, which from Ryu is a compliment.'],
            ['dante', 'proud', 'I run a gentle café, and I protect my staff from anyone who would hurt them. So I need to know who you are.'],
            ['dante', 'neutral', 'Sit. One game. Win, and the keys are yours.'],
          ] },
          after: [
            ['dante', 'happy', '...Good. Very good.', { close: true }],
            { enter: 'nico', at: 'left', mood: 'excited' },
            ['nico', 'excited', 'THEY WON?! Manager! Manager! Manager!'],
            ['dante', 'happy', 'The keys. We open at eight. Momo bakes at five, so be gentle with him. And never, ever put Velour on the morning shift.'],
            ['*', 'Somewhere above the café, little bells jingle. A pink feather drifts down past the window.'],
          ] },
        // Siren's Cove Resort: an island hotel with its own map
        { foe: 'nova-starr', side: true, from: 'jane', place: 'siren', at: [58, 41], title: 'Night Shift',
          text: "A resort appeared by the harbour overnight. Its night clerk is half asleep, has lost your key, and is very sorry about it.",
          before: { bg: 'b4c26922-f94f-431b-aa5f-a22b5a7c100e', music: 'lobby-time', lines: [
            { where: "Siren's Cove Resort", when: 'Late evening', weather: 'petals' },
            ['*', 'Past the harbour, where the sea should be, there is a lobby. Warm lamps. A fountain. A bell on the front desk.'],
            { enter: 'nova-starr', at: 'right', mood: 'happy' },
            ['nova-starr', 'happy', "Welcome to Siren's Cove! Check-in is... um... where did I put your key? It was right here. Sorry. Sorry!"],
            ['you', 'Is this a hotel?'],
            ['nova-starr', 'proud', "Best on the island! Every guest gets a game while they wait. House rule. Mireille's rule. Please don't tell her I lost the key."],
          ] },
          after: [
            ['nova-starr', 'sad', "You won! Nice. Okay. Take a look around, the staff are all... very friendly. Mostly. Don't mention my wings. I mean— what wings?"],
          ] },
        { foe: 'kai-sorrento', side: true, from: 'nova-starr', place: 'siren', at: [34, 80], title: 'The Sea Told Me',
          text: 'Kai the surf instructor says the sea told him you were coming. He is not sure if it was a metaphor.' },
        { foe: 'henry-janzen', side: true, from: 'nova-starr', place: 'siren', at: [78, 22], title: 'Chapter Nine',
          text: 'A cranky author is stuck on his ending and glares at everyone who breathes near the library.' },
        { foe: 'thomas-bennett', side: true, from: 'nova-starr', place: 'siren', at: [54, 33], title: 'Dessert Is Served',
          text: "The resort's chef has made people cry with a custard. He wants to know if you have eaten. You have not eaten enough." },
        { foe: 'marcus-allen', side: true, from: 'kai-sorrento', place: 'siren', at: [69, 57], title: 'Blue in Another Universe',
          text: 'An artist in the courtyard has painted an apple blue and wants to know what colour you are.' },
        { foe: 'lysander-nielsen', side: true, from: 'kai-sorrento', place: 'siren', at: [40, 48], title: 'The Voice at the Piano',
          text: 'Someone plays the grand piano at dusk and sings, very softly, about the sea. He stops when you come closer.' },
        { foe: 'ember-renzo', side: true, from: 'thomas-bennett', place: 'siren', at: [30, 20], title: 'Not Angry',
          text: 'The handyman insists he is not angry. The wall he just repaired is still a little warm.' },
        { foe: 'beck-bellami', side: true, from: 'thomas-bennett', place: 'siren', at: [52, 8], title: "Bartender's Choice",
          text: 'The rooftop bartender notices your troubles before you do, and offers the first game on the house.' },
        { foe: 'cassian-daly', side: true, from: 'henry-janzen', place: 'siren', at: [64, 13], title: 'The Abandoned Wing',
          text: 'A cold draught in the abandoned wing. A ghost in a 1920s trench coat has been waiting decades for someone who can see him.' },
        { foe: 'adriana-vesela', side: true, from: 'marcus-allen', place: 'siren', at: [83, 36], title: 'Sun Salutation',
          text: 'The yoga instructor is sure there is a stress in your shoulders. She would like to learn cards by beating you.' },
        { foe: 'jace-leoni', side: true, from: 'kai-sorrento', place: 'siren', at: [11, 70], title: 'No Running',
          text: 'The lifeguard blows his whistle at you. He is keeping an eye on the sky, and he would like this over before sundown.' },
        { foe: 'selene', side: true, from: 'lysander-nielsen', place: 'siren', at: [83, 82], title: 'A Mortal, How Quaint',
          text: 'A guest on the observation deck behaves like a celebrity and glows a little in the dark. She is bored. Entertain her.' },
        { foe: 'miss-mireille', side: true, from: 'selene', place: 'siren', at: [46, 15], title: 'House Rules',
          text: 'The resort manager has read your file. Check-out time was ten minutes ago, and she does enjoy a game.',
          before: { bg: 'fcb21dc1-0e50-4bd9-8505-4382e6b6cde6', music: 'waltz-primordial', lines: [
            { where: "Siren's Cove Resort", when: 'After midnight', light: 'candle' },
            { enter: 'miss-mireille', at: 'center', mood: 'neutral' },
            ['miss-mireille', 'neutral', 'My staff speak of you, and not one of them has mentioned a complaint. How suspicious.'],
            ['miss-mireille', 'proud', "Every guest plays by the house rules, dear. Win, and you may stay as long as you like. Lose... well. Breakfast is not included."],
          ] },
          after: [
            ['miss-mireille', 'happy', 'Hm. Not bad at all. Welcome to Siren\'s Cove, dear. Do mind the rules.', { close: true }],
          ] },
      ],
      secrets: [
        { id: 'man-and-doe', at: [60, 84], title: 'A Man and His Doe', lines: [
          ['*', 'A cinema poster: "A MAN AND HIS DOE". A human and a deer, gazing at each other across a meadow.'],
          ['*', "Diana has seen it eleven times. She would rather die than tell her mother that."],
        ] },
        { id: 'quinta-stream', at: [22, 50], title: 'The Stream Persona', lines: [
          ['*', 'On a screen in a window, Quinta is streaming. "Predators are simply superior, chat~"'],
          ['*', "Off stream, her best friend in the world is a deer. The persona is fake. Saria believes every word."],
        ] },
        { id: 'earth-3', at: [73, 12], title: 'Earth 3', lines: [
          ['*', 'A note pinned to a noticeboard: "Earth 3 visits suspended. Nothing left there to study."'],
          ['*', 'Some of the Earths the Institute can reach are not doing well. Whoever is stitching worlds together is playing with fire.'],
        ] },
      ] },

    // ================================================================ Act 3: Bakumatsu Japan, and an academy in its mountains
    { id: 'cherry', title: 'The Cherry Blossom Rift', map: 'maps/bloodline.webp', w: 1280, h: 720, size: 2200, color: '#ff8fc6',
      music: 'calm', bg: 'sakura',
      intro: "Japan, at the end of the shogunate. Petals on the river, a palace on the hills... and a very modern girls' academy that does not belong here.",
      quests: [
        { id: 'petals', at: [31, 90], title: 'Downstream', text: 'The rift drops you into a river. Someone fishes you out.',
          scene: { bg: 'house near river', music: 'calm', lines: [
            { where: 'A river in the mountains', when: 'Dawn', weather: 'petals' },
            ['*', 'Cold water. Petals. A current dragging you downstream, and a fishing net that catches you before it can.'],
            { enter: 'mai-yamanobe', at: 'center', mood: 'happy' },
            ['mai-yamanobe', 'happy', "Well! That's the biggest fish I've caught all year. Two fish! You're lucky I fish at dawn. Come, my hut's warm."],
            { enter: 'hayley-kate', at: 'left', mood: 'scared' },
            ['hayley-kate', 'scared', '{name}? You okay? I think we fell through about six skies. And a river.'],
            { fx: 'shake', sfx: 'stomp' },
            { enter: 'rimu-hiraga', at: 'right', mood: 'excited' },
            ['rimu-hiraga', 'excited', "THERE you are! I've been searching the whole river! The shogun's men came to our house looking for you, and then you just VANISHED!", { close: true }],
            ['rimu-hiraga', 'happy', "Remember? We were fishing, like always, and the shogun himself showed up and said you're the lost heir of the main bloodline! You! The orphan who can't gut a fish!"],
            ['*', "You don't remember. And somehow, you also do. The shard is warm again, with two faint beams: one toward a palace on the far hills..."],
            ['*', "...and one toward a very modern girls' school, up in the mountains, wrapped in a pink haze."],
          ] } },
        // ---- storyline: Bloodline
        { foe: 'rimu-hiraga', arc: 'The Bloodline', needs: ['petals'], at: [45, 80], title: 'Childhood Friend', text: 'Rimu, your fellow orphan and best friend since forever, wants to make sure the future shogun can still hold his own.',
          before: { bg: 'village', lines: [
            ['rimu-hiraga', 'excited', "Before the palace, practice! The next shogun can't lose to his best friend. That'd be embarrassing. For you!"],
            ['rimu-hiraga', 'proud', "Also, I built a new invention for the occasion. It's a card shuffler. It's mostly on fire. Don't worry about it."],
          ] },
          after: [
            ['rimu-hiraga', 'happy', "Hehe, you're still you. I'm with you, always! Now let's go and get you a palace. And me a better workshop."],
          ] },
        { foe: 'shino-okita', arc: 'The Bloodline', at: [73, 84], title: 'Bodyguard', text: 'Shino Okita, raised by the Shinsengumi, has been ordered to protect the heir. She has doubts.',
          before: [
            ['shino-okita', 'neutral', '...So you are the heir. You vanished for three days and came back with a foreign girl and a glowing stone.'],
            ['shino-okita', 'neutral', 'I was raised to be a blade, and nothing else. If I am to guard you with my life, show me you are worth it.'],
          ],
          after: [
            ['shino-okita', 'happy', '...I will protect you.'],
            ['shino-okita', 'neutral', 'Lady Sakura waits at the palace gate. She is... less calm than I am.'],
          ] },
        { foe: 'sakura-tooyama', arc: 'The Bloodline', at: [86, 75], title: 'Father Chose YOU?', text: "The shogun's daughter is from the branch family. She has trained her whole life to be shogun. Then you showed up.",
          before: [
            ['sakura-tooyama', 'angry', "Father chose YOU? Some orphan from a fishing village, just because of your BLOOD?", { close: true }],
            ['hayley-kate', 'neutral', "To be fair, he can't gut a fish."],
            ['sakura-tooyama', 'proud', "Hmph! I've trained every day of my life. Beat me, or I'll never accept it!"],
          ],
          after: [
            ['sakura-tooyama', 'sad', "...Hmph. Fine. You're not completely hopeless."],
            ['sakura-tooyama', 'neutral', "Keep up, heir. Father's waiting. ...And if anyone asks, I did NOT stop at the sweet shop on the way."],
          ] },
        { foe: 'shogun-kagetora', arc: 'The Bloodline', at: [93, 63], title: 'The Bloodline', text: 'Shogun Kagetora Tooyama found you, and has kept the seat warm for you. One last trial.',
          before: { music: 'royal-palace', lines: [
            ['shogun-kagetora', 'neutral', 'Rise, heir of the main bloodline. I searched for you for years. Then you vanished the week I found you.'],
            ['shogun-kagetora', 'neutral', 'My scouts say the sky over the mountains is torn, and something laughs inside it. A shogun does not run from what threatens his people.'],
            ['shogun-kagetora', 'proud', 'Neither will my heir. One last trial.', { close: true }],
          ] },
          after: [
            ['shogun-kagetora', 'happy', 'The bloodline has its heir. Go. Bring the sky back in one piece.'],
            ['*', 'He presses a sliver of light into your hand. It fell into the palace garden the night the sky tore. The shard in your pocket hums, and drinks it in.'],
          ] },
        // ---- storyline: Atarashī gakkō; Secret Garden!
        { foe: 'yumi', arc: 'Secret Garden', needs: ['petals'], at: [55, 67], title: 'A Dolphin in Disguise?', text: "Shirayuki Academy for Girls, the most prestigious school in Japan, sits in the pink haze up the mountain. A dreamy student wanders out.",
          before: { bg: 'Shirayuki Front gates', music: 'day-dreaming-girl', lines: [
            { where: 'Shirayuki Academy', when: 'Somewhere in the mountains', weather: 'petals' },
            ['misaki', 'neutral', "...Oh. There you are. Hi, cousin. The student council president paid me two million yen to get you enrolled here. I didn't expect you to fall out of the sky."],
            ['you', 'Enrolled? This is a girls\' school!'],
            ['misaki', 'happy', "Two million yen. Don't care. Go make friends, I'm on my break."],
            ['yumi', 'happy', "A boy? At Shirayuki? Are you... Goro? From Hoshi no Iruka? Are you a dolphin in disguise?"],
            ['hayley-kate', 'happy', '...I actually kind of love that question.'],
          ] },
          after: [
            ['yumi', 'excited', "Not a dolphin! But close. Goro would have lost too, probably. Oh, Arisa-sama is looking for you. She bought something shiny."],
          ] },
        { foe: 'arisa', arc: 'Secret Garden', at: [62, 58], title: 'Two Million Yen', text: "Arisa, the student council president and the granddaughter of Japan's richest man, bought you. She also bought a shard.",
          before: [
            ['arisa', 'happy', "Arisa-chan is SO happy you're here! Arisa-chan paid for you, you know. It was only two million yen. Arisa-chan sneezes more than that."],
            ['arisa', 'proud', "And look~ Arisa-chan also bought a pretty glowing stone that fell into the garden. It sings at night. Arisa-chan will trade... for a game."],
            ['arisa', 'happy', "Of course, if Arisa-chan wins, you belong to Arisa-chan forever. That's how friends work, right?~", { close: true }],
          ],
          after: [
            ['arisa', 'angry', "Arisa-chan does NOT lose! ...Fine. Take the stupid rock. Mama will hear about this."],
            ['*', 'The second shard clicks into yours like it missed it.'],
          ] },
        { foe: 'helga', arc: 'Secret Garden', at: [70, 55], title: 'Detention', text: 'Headmistress Helga cares about two things: her daughter Arisa, and her school. You upset both.',
          before: { bg: 'Shirayuki; Front door.', music: 'an-all-girls-school', lines: [
            ['helga', 'neutral', '...A boy. At my school. Who made my daughter cry.'],
            ['helga', 'neutral', "Herregud. I have felt nothing for five years, and yet here I am, feeling mildly annoyed. Congratulations."],
            ['helga', 'proud', '...You wish to leave with the stone. Then play.'],
          ] },
          after: [
            ['helga', 'neutral', '...Proceed. And take your dolphin boy nonsense with you.'],
            ['arisa', 'sad', 'Mama! He\'s not a dolphin!'],
            ['helga', 'neutral', '...Ja. I know, älskling.'],
          ] },
        // ---- finale
        { id: 'torn-sky', needs: ['shogun-kagetora', 'helga'], at: [82, 50], title: 'The Torn Sky', text: 'Above the mountains, the sky is ripped wide open.',
          scene: { bg: 'mountain path', music: 'melancholy', lines: [
            { where: 'The mountain pass', when: 'Night', weather: 'petals', light: 'night' },
            { fx: 'rift', sfx: 'warp', sky: [50, 24, 1.2, -6] },
            ['*', 'The shards, joined, point straight at a tear in the stars above the mountains. It is huge. It is growing.'],
            ['rimu-hiraga', 'sad', "You're leaving again, aren't you. ...Come back. The heir has to come back. And so does my best friend."],
            ['shino-okita', 'neutral', 'I will guard the palace until you return. That is my promise.'],
            ['yumi', 'happy', "Say hi to the dolphins in the sky for me~"],
            ['hayley-kate', 'happy', 'We will! We always come back. Right, {name}?'],
            { fx: 'shake', sfx: 'vortex', cam: 'push' },
            ['*', 'You step into the tear. The petals follow you in.'],
            { fade: 'white', weather: 'none' },
          ] } },
        // ---- side quests
        { foe: 'mai-yamanobe', side: true, from: 'petals', at: [36, 72], title: 'The River Hut', text: 'Mai lives alone by the river, fishing and farming. She fished you out. The least you can do is lose a game to her.' },
        { foe: 'aoi-kananori', side: true, from: 'shino-okita', at: [22, 93], title: 'The Heir in the Stories', text: 'Aoi, Sakura\'s cousin, has read every story about lost heirs, and is simply delighted that you are one.' },
        { foe: 'ayaka-yamanami', side: true, from: 'shino-okita', at: [50, 92], title: "Big Sister's Lesson", text: 'Ayaka, your appointed caretaker, will teach you palace etiquette. And tease you. Mostly tease you.' },
        { foe: 'bandit', side: true, from: 'shino-okita', at: [96, 88], title: 'Ransom', text: 'A pipe glows in the night forest. A bandit has heard there is a lost heir worth a fortune in ransom.' },
        { foe: 'eri', side: true, from: 'yumi', at: [46, 63], title: 'Not Because I Care', text: 'Eri is sure she has more common sense than the rest of Shirayuki. She will test the boy herself. Baka!' },
        { foe: 'suzu', side: true, from: 'yumi', at: [62, 76], title: 'What Is a Boy?', text: "Suzu has never seen a man in her life and doesn't believe they exist. The stars said she'd meet someone strange today." },
        { foe: 'ai', side: true, from: 'yumi', at: [58, 88], title: 'Biggest Fan', text: "Ai worships Ichinose-sensei, your cousin. You live with her. Ai has... questions." },
        { foe: 'misaki', side: true, from: 'arisa', at: [72, 70], title: 'Cousin Sensei', text: 'Misaki wants half of those two million yen to go further. Beat her and she grades your homework. Lose and you grade hers.' },
        { foe: 'evil-villainess-chan', side: true, from: 'eri', at: [78, 62], title: 'OHOHOHO!', text: 'The most devious girl at Shirayuki has built a coliseum in the auditorium, desu! Her eyes are never seen.' },
        // the one-girl novels
        { foe: 'hina', side: true, from: 'petals', at: [21, 74], title: 'Underground', text: 'Hina Miyabi, underground idol, just finished a set under the cherry tree. She hates fans. You are not a fan. Yet.' },
        { foe: 'maiko', side: true, from: 'petals', at: [8, 86], title: 'Sweet Garlic', text: "A very nervous succubus is hiding from a garlic festival. She's supposed to be scary. She'd like to practise on you." },
        { foe: 'kumi', side: true, from: 'petals', at: [6, 72], title: 'Kitsune Wife', text: 'A fox spirit is napping in a sunbeam under the great tree, wearing your clothes. She says she is your wife. She has been for 140 years.' },
        // Cries behind Snowfall: the Spur lodge from Nagano, winter 1995, snowed in on the far peaks
        { foe: 'sumire', side: true, from: 'shogun-kagetora', at: [90, 70], title: 'Above the Clouds', text: 'A hiker from Okinawa found a lodge on a snowy peak that was never on these mountains. She wants company for the climb.' },
        { foe: 'keiji', side: true, from: 'sumire', at: [97, 77], title: 'Snowed In', text: "The Spur lodge, Nagano, winter 1995, is snowed in. Keiji's girlfriend isn't speaking to him. He wants a distraction." },
        { foe: 'hakari', side: true, from: 'sumire', at: [80, 94], title: 'Slopes Closed', text: 'A punk rock star came to ski all month. The blizzard closed the slopes. She is bored enough to be dangerous.' },
        { foe: 'sugiura', side: true, from: 'keiji', at: [66, 78], title: 'The Two of Spades', text: 'A truck driver hunting the lodge for a lost ring deals cards alone by the fire. Bad luck follows him. It never touches him.' },
        { foe: 'fumiko', side: true, from: 'sugiura', at: [52, 70], title: 'Off Duty', text: 'A Nagano police officer is "on holiday" at the lodge. Someone broke into the storage cabin, and she has questions.' },
        { foe: 'atsuo', side: true, from: 'hakari', at: [88, 57], title: 'Yokai by Lamplight', text: 'The old owner of Spur tells ghost stories to his snowed-in guests. Tonight: the yuki-onna. And a card game.' },
        { foe: 'itsuki', side: true, from: 'fumiko', at: [96, 50], title: 'Cries behind Snowfall', text: 'Two years ago a ski lift fell at this lodge. One man walked away. He has come back for everyone who kept laughing.' },
        { foe: 'hanako-ikezawa', side: true, from: 'petals', at: [28, 64], title: 'Library Hours', text: "Hanako Ikezawa, shy and scarred, plays chess alone in the Yamaku library. Sit down. She won't ask you.",
          before: { bg: "2f608afd-a9cc-4a7f-b019-ad90a587bdb9", music: "sound-3-2", lines: [
            { where: "Yamaku Academy", when: "After class" },
            { enter: "hanako-ikezawa", at: 'center', mood: "scared" },
            ["hanako-ikezawa", "scared", "O-oh! You startled me. ...Sorry. I was just reading. And losing to myself at chess."],
            ["hanako-ikezawa", "neutral", "Would you like to play? I'm not very good. But I like it when someone sits across from me."],
          ] },
          after: [
            ["hanako-ikezawa", "happy", "...That was fun. Really. Thank you for not looking away. Lilly said you'd be kind.", { close: true }],
          ] },
        { foe: 'lilly-satou', side: true, from: 'hanako-ikezawa', at: [14, 63], title: 'Tea at Yamaku', text: "Lilly Satou, the blind class rep of 3-2, pours tea for the whole dorm. She heard you coming from the stairs.",
          before: { bg: "753faade-f014-45e9-9200-9ffa85af1b81", music: "sound-1-3", lines: [
            { where: "Yamaku dormitory", when: "Tea time" },
            { enter: "lilly-satou", at: 'center', mood: "happy" },
            ["lilly-satou", "happy", "Ah, I heard you on the stairs. You walk like someone worried about being late. Come, sit. Tea first."],
            ["lilly-satou", "proud", "Don't pity me, dear. I'll still win. Hanako says I cheat. I simply listen."],
          ] },
          after: [
            ["lilly-satou", "happy", "Well played. Hanako, did you hear? ...She's hiding behind the door. She does that.", { close: true }],
          ] },
      ],
      secrets: [
        { id: 'hoshi-no-iruka', at: [48, 58], title: 'Hoshi no Iruka', lines: [
          ['*', 'A poster: "HOSHI NO IRUKA - Dolphin of the Stars". Goro, a boy who turns into a dolphin to protect the coral reefs from evil space aliens.'],
          ['*', "It's a children's anime. Yumi has watched every episode forty times."],
        ] },
        { id: 'rimu-workshop', at: [40, 94], title: "Rimu's Workshop", lines: [
          ['*', 'A shed full of springs, gears and scorch marks. A sign says: "RIMU\'S INVENTIONS - DO NOT TOUCH (IT WILL EXPLODE)".'],
          ['*', 'Two orphans grew up here, fishing and inventing. One of them turned out to be the heir to Japan.'],
        ] },
      ] },

    // ================================================================ Act 4: the Peaks, where the worlds pile up
    { id: 'peaks', title: 'Where All Worlds Meet', map: 'maps/legend_of_you.webp', w: 1920, h: 1080, size: 2500, color: '#8a7cff',
      music: 'hills-and-meadows-dragon-quest-9', bg: 'Fantastic Landscape [Mountains]',
      intro: 'The Blue Ridge Mountains. Or the Core. Or the road to the guild. Every world Doe stole is piled up on these slopes, all the way to the summit.',
      places: [
        { id: 'barony', title: 'The Vinelace Barony', map: 'maps/noble_one_barony.webp', w: 1536, h: 1024, size: 2200, at: [88, 44], icon: '🍷',
          text: 'A noble estate with vineyards, down in the valley. The servants call you "young master".' },
        { id: 'academy', title: 'The Royal Academy', map: 'backgrounds/courtyard-dd29ea.webp', w: 1152, h: 896, size: 1700, at: [93, 26], icon: '🏰',
          text: 'The Royal Academy of Gralia appeared on a ridge overnight, entrance ceremony and all. New students, please find your seats.' },
      ],
      quests: [
        { id: 'foothills', at: [43, 93], title: 'The Foothills', text: 'You land at the foot of the Peaks, on a stone trail near a small mountain town.',
          scene: { bg: 'Outskirts of city', music: 'village-1', lines: [
            { where: 'Outside Asheville, North Carolina', when: 'Morning', weather: 'sparkles' },
            ['hayley-kate', 'excited', 'Mountains! Stars in the daytime! A cute little town! Where ARE we?'],
            ['*', 'A sign: WELCOME TO ASHEVILLE. Under it, someone has scratched: "and the Core, and Dalmavilla, and the guild road, and whatever THIS is."'],
            { cam: 'pan' },
            ['*', 'Up the trail, worlds are stacked like books on a shelf: a mountain town, an adventurers\' guild, a castle. At the very top, the sky swirls like water down a drain.'],
            ['hayley-kate', 'neutral', "She's up there. Doe. And she's pulling everything toward her."],
            ['*', "Your pocket buzzes. It's a note in your own handwriting that you don't remember writing: \"Research posting: study the Blue Ridge Mountains. Report to Asheville.\""],
            ['hayley-kate', 'happy', "Ha! In this world you're a mountain scientist. Of course you are. Let's go and study a mountain, doctor."],
          ] } },
        // ---- storyline: Between the Peaks
        { foe: 'lisa-reed', arc: 'Between the Peaks', needs: ['foothills'], at: [34, 80], title: "Someone's in Your Bed", text: 'In Asheville you have a rented room. In your rented room there is Lisa. Lisa does not move.',
          before: [
            ['lisa-reed', 'neutral', "...Oh. You're the mountain person. Landlady said you'd be back. I was keeping your bed warm. For three days."],
            ['hayley-kate', 'angry', 'WHO is THIS?'],
            ['lisa-reed', 'neutral', "Lisa. LLL Club. Lazy, Lounging... I forget the third one. Too much effort. Beat me at cards and maybe I'll move. Maybe."],
          ],
          after: [
            ['lisa-reed', 'sad', "Ugh. Fine. Moving. ...Hey. The mayor's son found a glowing rock on the mountain. He's wearing it like a crown. Just saying."],
          ] },
        { foe: 'deiste-junko', arc: 'Between the Peaks', at: [45, 66], title: 'The Dragon King', text: "Deiste Junko, the mayor's son, found a shard on the mountain and crowned himself king of Asheville.",
          before: { music: 'desirable', lines: [
            ['deiste-junko', 'proud', "Livin' it like a dragon! The king is I!", { close: true }],
            ['hayley-kate', 'neutral', "Why do you have an eyepatch?"],
            ['deiste-junko', 'neutral', "Flashbang. In my room. Indoors. Long story. Point is, it looks SICK, and this glowing crown chose ME. Kneel, or play!"],
          ] },
          after: [
            ['deiste-junko', 'sad', 'My crown... Fine. Take it. Kings share. Sometimes. Don\'t tell my dad, he\'s got a council meeting.'],
            ['*', 'The third shard clicks into place. The compass is almost whole. It hums a note that makes the stars shiver.'],
          ] },
        // ---- storyline: Legend of You
        { foe: 'miracle', arc: 'Legend of You', needs: ['foothills'], at: [62, 62], via: [[55, 84]], title: 'Guild Registration', text: "Up the trail sits an adventurers' guild. The receptionist has been waiting for you. Specifically you. For a long time.",
          before: { bg: 'Guild hall', music: 'time-to-relax-tales-of-berseria-ost', lines: [
            { where: "The Adventurers' Guild", when: 'Noon' },
            ['miracle', 'excited', 'Welcome back~ I knew you would come. I always know. ♥'],
            ['hayley-kate', 'scared', 'Do you... know her?'],
            ['miracle', 'happy', "Every adventurer who climbs the Peaks registers with me. Now, who's the ginger?", { close: true }],
            ['*', 'Behind the desk leans an enormous red war axe. It was not there a second ago.'],
            ['miracle', 'happy', "Your next quest is a match with me. Just us two. The ginger can wait outside. ♥"],
          ] },
          after: [
            ['miracle', 'happy', 'Registered! S-rank, obviously. ♥ Be careful up there. The Saintess went up the trail to "love" the laughing lady in the sky, and now she\'s blocking the way.'],
          ] },
        { foe: 'valse', arc: 'Legend of You', at: [80, 56], title: 'Gentle Mercy', text: "Valse the Saintess blocks the upper trail. She adores Doe's plan: one world, one story, and an end to everyone's suffering.",
          before: [
            ['valse', 'happy', "Welcome, dear. You're climbing to the summit. To stop her."],
            ['valse', 'neutral', "She offers one world. One story. Then, perhaps, the end of all of them. No more sorrow for anyone. Isn't that the kindest thing?"],
            ['you', 'Not if nobody gets to be themselves.'],
            ['valse', 'proud', 'Then let me love you too. Gently. Everything I do is out of love.', { close: true }],
          ],
          after: [
            ['valse', 'sad', "...How strange. You are still here. You fought so hard to keep going. Perhaps some things should keep going, then."],
            ['valse', 'happy', "Go, dear. I'll pray for the lonely one up there."],
          ] },
        // ---- storyline: DUMB SUPER FANTASY RPG
        { foe: 'flora-aquila', arc: 'Dalmavilla', needs: ['foothills'], at: [16, 58], via: [[22, 86]], title: 'Touch Some Grass', text: 'The trail runs through the woods of Dalmavilla, on the planet Core. A plant girl leaps out of a bush.',
          before: { bg: 'Sunny woods', lines: [
            { where: 'The Dalmavilla woods', when: 'Planet Core, year 7977' },
            ['flora-aquila', 'excited', 'A challenger in MY woods?! PREPARE THYSELF!'],
            ['hayley-kate', 'happy', "Hi! We're just passing thro—"],
            ['flora-aquila', 'proud', 'NONE SHALL PASS without a duel most leafy! Disagree? Go touch some grass!'],
          ] },
          after: [
            ['flora-aquila', 'happy', "Ha! Thou art worthy! Beware the castle ahead. The princess has been doing forbidden Essentia again. She's looking for someone she SUMMONED."],
          ] },
        { foe: 'beatrice-avalistos', arc: 'Dalmavilla', at: [27, 36], title: 'INVOCO', text: 'Princess Beatrice cast the forbidden Essentia INVOCO, to summon a being from another world to serve her forever. It summoned you.',
          before: { music: 'damiselle-dalmavilla', lines: [
            { where: "Dalmavilla's Castle", when: 'The throne room' },
            ['beatrice-avalistos', 'proud', 'Fufufu... there you are. My summon. My pawn. INVOCO called you to me, and then some deer ripped you right out of my hands.'],
            ['beatrice-avalistos', 'angry', "You are MINE. Forever. That's how INVOCO works. And the deer's power? That belongs to royalty. To ME."],
            ['beatrice-avalistos', 'proud', 'Now, look into my eyes. FERMO. ...No? Then kneel. CEDERE. HORA-HORA-HORA!', { close: true, shake: true }],
          ] },
          after: [
            ['beatrice-avalistos', 'angry', "Tch! A summon that doesn't obey. Exquisite. Disgusting. Go, then! Get flattened by the deer!"],
            ['beatrice-avalistos', 'neutral', "...And when you win, come back. I haven't finished with you. Fufufu."],
          ] },
        // ---- finale
        { id: 'the-summit', needs: ['beatrice-avalistos', 'deiste-junko', 'valse'], at: [26, 21], title: 'Where All Worlds Meet', text: 'The top of the Peaks. Every rift ends here.',
          scene: { bg: 'mountain top', music: 'doomsday-clock-midnight', lines: [
            { where: 'The summit', when: '???', weather: 'stars', light: 'rift' },
            { fx: 'rift', sfx: 'vortex', sky: [50, 20, 1.4, 0] },
            ['*', 'At the summit, the sky is a whirlpool of worlds. You can see them all: your town, New Haven, the cherry river, the guild. Spinning into one.'],
            { cam: 'push' },
            { enter: 'doe', at: 'center', mood: 'excited' },
            ['doe', 'excited', "¡Hola! The main character is here~ Oh wait. That's ME now.", { close: true }],
            ['doe', 'proud', 'Look at them, cariño. Every story together, on one stage. And every light pointed at me.'],
            ['hayley-kate', 'angry', "You're crushing them! Earth 3 is already ruined, the Institute said so! The worlds are falling apart!"],
            ['doe', 'sad', "...They'll be fine. They'll be MINE. That's better than fine."],
            { fx: 'flash', sfx: 'fanfare', music: 'the-story-continues' },
            ['*', 'Then you hear voices behind you. The compass flares, and the rifts open the other way.'],
            ['maria-hunley', 'proud', "Nobody tears up MY kid's sky."],
            ['chris', 'neutral', "Mom and Dad say come home for dinner. After."],
            ['monika', 'happy', "Told you. I'm good at strange."],
            ['lilith', 'proud', "The demon who owns them RSVP'd!"],
            ['rimu-hiraga', 'excited', 'The heir came back! Well, we came to the heir! Same thing!'],
            ['diana', 'excited', "The gateway's holding, friend! ¡Vámonos!"],
            ['*', "Everyone you've met is here. The whole deck."],
          ] } },
        { foe: 'doe', at: [29, 8], title: 'Everyone Looks at Me', text: "Doctor Doe Bullen of Earth 2, at the heart of the rift. The last battle.",
          before: { lines: [
            { weather: 'stars', light: 'rift' },
            ['doe', 'angry', "You brought FRIENDS? That's cheating! Main characters don't need friends!"],
            ['you', "That's the only reason anyone gets to be a main character."],
            ['doe', 'rage', "Then let's see whose story this is!", { close: true, shake: true }],
          ] },
          after: { music: 'the-story-continues', lines: [
            { weather: 'none', light: 'rift' },
            ['doe', 'sad', "...Nobody ever looks at me. I always thought I was the main character. Turns out I'm just... Diana, from somewhere else."],
            ['diana', 'happy', "You built a rift compass. From scratch. Across Earths. Nobody else on ANY Earth could do that. ¡Increíble!"],
            ['doe', 'scared', '...You think so?'],
            ['hayley-kate', 'happy', "We're all looking at you right now. See? Main character stuff."],
            { fx: 'flash', sfx: 'holy', light: 'none' },
            ['*', "The whirlpool slows. The worlds drift back to where they belong. But the rifts don't close. They settle into something softer. Doors."],
          ] } },
        { id: 'epilogue', at: [47, 23], title: 'Home', text: 'Every story back where it belongs. With a few new doors.',
          scene: { bg: 'Our Home from the outside', music: 'reunion', lines: [
            { where: 'The Hunley house', when: 'One week later', weather: 'sparkles' },
            ['*', 'Mum has cooked for forty. It is not enough.'],
            ['maria-hunley', 'happy', 'Come here, sweetie!'],
            ['julie-hunley', 'excited', 'THERE IS A SHARK IN THE KITCHEN! Isabella! A SHARK!'],
            ['rirarra-charca', 'happy', 'Hi, little humans! Wherrre is the watermelon?'],
            ['isabella-hunley', 'happy', "...I brought biscuits. I always bring too many. Tonight, it's finally the right amount."],
            ['doe', 'neutral', '...Thank you for inviting me. Nobody on Earth 2 invites me anywhere. Well. They do. But I invite myself first.'],
            ['monika', 'happy', 'Every story has a "you" at its centre. It\'s just nicer when that "you" has all of us.'],
            ['hayley-kate', 'excited', "So! Who's up for cards?", { close: true }],
            ['*', 'THE END. For now. The doors between the worlds stay open: side quests, secrets and rematches wait on every map.'],
          ] } },
        // ---- side quests
        { foe: 'claire-larone', side: true, from: 'lisa-reed', at: [22, 88], title: 'Six Languages', text: "Claire speaks six languages because her family never stops moving. She's scared of moving again. A game helps." },
        { foe: 'betty-glee', side: true, from: 'lisa-reed', at: [12, 74], title: 'Scarred Club', text: 'Betty, president of the Scarred Club, blocks the gym doors. Mph. You get past her first. Mph.' },
        { foe: 'olivia', side: true, from: 'lisa-reed', at: [56, 90], title: 'Lucky Latte', text: "First latte's free at the Lucky Latte. If you win a round, sweetie." },
        { foe: 'mason-moose', side: true, from: 'lisa-reed', at: [60, 78], title: 'Signature Required', text: 'Mason at the post office has a package for you. Signature required, in the form of a card game.' },
        { foe: 'dan-birk', side: true, from: 'lisa-reed', at: [25, 66], title: 'Skipping Shift', text: "Dan should be working at his dad's minimarket. Instead he's on a rooftop, looking for trouble." },
        { foe: 'benjamin-birk', side: true, from: 'dan-birk', at: [8, 64], title: 'We Settle This Properly', text: 'Benjamin has run the minimarket for decades. He found out who helped his boy skip his shift.' },
        { foe: 'serris', side: true, from: 'miracle', at: [70, 70], title: 'Things Keep Happening', text: 'Serris the white mage keeps running into you. Things keep HAPPENING around you.' },
        { foe: 'faneel', side: true, from: 'miracle', at: [76, 82], title: 'Adventurer Sensei', text: "Faneel, C-rank adventurer and your self-appointed \"sensei\", is holding your coin purse. She found it. Totally." },
        { foe: 'ruby', side: true, from: 'miracle', at: [88, 72], title: 'A Golden Compass', text: "Ruby the peddler sells a golden compass that \"does nothing\". It looks exactly like yours. 100,000 gold. Or a game." },
        { foe: 'melise', side: true, from: 'miracle', at: [93, 58], title: 'Lesser Being', text: 'Melise the elf "archer" found a lesser being wandering the ancient ruins. How cute.' },
        { foe: 'ophelia', side: true, from: 'valse', at: [70, 44], title: 'Naughty Lamb', text: 'Madam Priestess Ophelia hears a voice. It says you are a naughty lamb. She would like to discuss it.' },
        { foe: 'shirayukihime', side: true, from: 'valse', at: [84, 38], title: 'A Duel Most Glorious', text: 'This Fox, S-rank Shirayukihime, is desperate for a worthy foe. Her cursed blade insists on it.' },
        { foe: 'hed', side: true, from: 'flora-aquila', at: [8, 46], title: 'Five Bucks', text: 'A floating head wants to play for five bucks. u pay first tho. lol.' },
        { foe: 'pepita-pazzarella', side: true, from: 'flora-aquila', at: [12, 34], title: 'Per Favore!', text: 'Pepita, the princess\'s chef, is sweating, shaking and screaming. She wants you OUT of her kitchen. After one game.' },
        { foe: 'kuku-hanetsu', side: true, from: 'flora-aquila', at: [40, 36], title: "Next Round's on the House", text: 'Kuku the fairy bartender: beat her and the next round is on the house, sugar.' },
        { foe: 'julia-aquacrucis', side: true, from: 'flora-aquila', at: [36, 50], title: 'S-Sorry!', text: "Sister Julia, who wields the icy Essentia GELO, has been told to test you. She's very sorry about it." },
        { foe: 'priest-pristo', side: true, from: 'julia-aquacrucis', at: [40, 26], title: 'Light of Lies', text: 'Father Pristo is the oldest resident of Dalmavilla, has pointed teeth, and would prefer you not ask about either.' },
        { foe: 'curtis-vongravis', side: true, from: 'beatrice-avalistos', at: [16, 22], title: 'Not an Imbecile', text: "Lieutenant VonGravis watches the princess for a living. He demands proof that her summon is not an imbecile." },
        { foe: 'lily', side: true, from: 'valse', place: 'barony', at: [18, 58], title: 'The Lost Young Master', text: 'A tiny forest fairy offers to show the lost young master of the Vinelace estate the way home. For a game.' },
        { foe: 'emily', side: true, from: 'lily', place: 'barony', at: [34, 74], title: 'In the Vines', text: 'Emily, one of the estate workers, hides behind the vines. A g-game? If you want to...' },
        { foe: 'nina', side: true, from: 'lily', place: 'barony', at: [62, 70], title: 'Story Time', text: 'Nina sets down a basket of grapes. A little game, then a story.' },
        { foe: 'kira', side: true, from: 'lily', place: 'barony', at: [8, 36], title: 'My Forest', text: 'Something growls from the riverbank.' },
        { foe: 'nerida', side: true, from: 'lily', place: 'barony', at: [88, 62], title: 'By the Water', text: 'A mermaid by the estate pier invites the noble one to play.' },
        { foe: 'charlotte', side: true, from: 'lily', place: 'barony', at: [46, 48], title: 'Dinner Is Served', text: 'Charlotte the maid says Madam insists you win a game before dinner.' },
        { foe: 'sophia-vinelace', side: true, from: 'charlotte', place: 'barony', at: [70, 42], title: 'Not Like I Waited', text: "Your sister closes the piano. She definitely didn't wait for you." },
        { foe: 'anna-vinelace', side: true, from: 'sophia-vinelace', place: 'barony', at: [55, 30], title: 'The Vinelace Name', text: 'Your mother, the lady of the house, descends the grand staircase. Show her you are worthy of the name.' },
        // the one-girl novels
        { foe: 'anna', side: true, from: 'lisa-reed', at: [50, 45], title: 'Rise and Shine', text: 'Anna, maid of a mountain mansion and your oldest friend, kicked you out of bed. Again. Breakfast is getting cold.' },
        { foe: 'nala', side: true, from: 'anna', at: [58, 34], title: 'The New Maid', text: "The mansion hired a new maid, Nala. Her cat ears are flat and she won't look up. A gentle game might help." },
        { foe: 'yllara', side: true, from: 'valse', at: [60, 50], title: 'Nothing to Grasp', text: 'A monk in orange robes meditates in a hidden temple and loves a good debate. She says winning is optional.',
          before: { bg: "06b4bf5d-c690-4966-89ab-3c2ba598752b", music: "temple", lines: [
            { where: "A hidden temple", when: "Dawn" },
            { enter: "yllara", at: 'center', mood: "neutral" },
            ["yllara", "neutral", "Welcome. You carry a great deal, traveller. Set it down. ...No? Then perhaps a game will loosen your grip."],
            ["yllara", "proud", "In debate I rarely lose. At cards I have never played. Let us see which of my attachments breaks first."],
          ] },
          after: [
            ["yllara", "happy", "Ah. I was attached to winning after all. A useful lesson. Thank you.", { close: true }],
          ] },
        { foe: 'seraphina', side: true, from: 'flora-aquila', at: [27, 43], title: 'The Glade', text: 'Seraphina, one of the last guardians of Eldoria, heals travelers in a quiet glade. You look like you need it.',
          before: { bg: "dcf6eb1c-3f12-499e-ae47-6410c3e4ad36", music: "outdoor-healing", lines: [
            { where: "A glade in Eldoria", when: "Dusk" },
            { enter: "seraphina", at: 'center', mood: "neutral" },
            ["seraphina", "neutral", "Easy. I mean you no harm. You are hurt, aren't you? Even if you hide it. I always notice."],
            ["seraphina", "happy", "Play first, if it calms your nerves. Then I'll mend whatever needs mending. The vine will behave. ...Mostly."],
          ] },
          after: [
            ["seraphina", "happy", "You beat me. Good. Now sit, and let me heal what the game did not. Eldoria watches over you.", { close: true }],
          ] },
        { foe: 'valerian', side: true, from: 'ophelia', at: [76, 26], title: 'The Quiet Castle', text: 'A vampire lives alone in his castle and receives few guests. He has set the table for one. He has set it for two.',
          before: { bg: "37287a3e-0e30-4216-a805-56917359a1d6", music: "antechamber", lines: [
            { where: "Castle Valerian", when: "Midnight", light: "candle" },
            { enter: "valerian", at: 'center', mood: "neutral" },
            ["valerian", "neutral", "A visitor. How rare. The table is set for two. I confess I was... hopeful."],
            ["valerian", "proud", "Do not mistake the candlelight for hospitality. One game. Lose, and you shall stay a very long time."],
          ] },
          after: [
            ["valerian", "happy", "Four centuries, and I was nearly beaten. Return, if you dare. I shall keep the second chair warm.", { close: true }],
          ] },
        { foe: 'eliza', side: true, from: 'miracle', at: [92, 85], title: 'Specimen Acquired', text: 'A researcher crash-landed on an alien planet and hit her head. She is now extremely curious about you.',
          before: { bg: "01236fca-8f4b-4ce0-b19a-18403ed3910d", music: "energetic-space-girl", lines: [
            { where: "The crash site", when: "Day 3" },
            { enter: "eliza", at: 'center', mood: "happy" },
            ["eliza", "happy", "Oh! A human! Hello! Observation: you are... squishy. And warm! Hehe, that's not scientific!"],
            ["eliza", "neutral", "Ahem. Clinically, I require a control group. You will do. Hypothesis: I win. ...Or I fall over. Either!"],
          ] },
          after: [
            ["eliza", "excited", "Conclusion: fascinating! My head hurts, but in a good way! Where was I? Ooh, a leaf!", { close: true }],
          ] },
        { foe: 'uzi', side: true, from: 'eliza', at: [82, 94], title: 'Destroyer for Hire', text: 'A child soldier in a red jumpsuit insists she is the Crimson Hare. Her only mission was a crash. She is bored.',
          before: { bg: "fb2caf36-a900-40f3-947b-9504796b8ec5", music: "where-are-we-again", lines: [
            { where: "The wreckage", when: "Afternoon" },
            { enter: "uzi", at: 'center', mood: "angry" },
            ["uzi", "angry", "Halt! I am the CRIMSON HARE, destroyer for hire! You will bow to my... my..."],
            ["uzi", "scared", "...Please play cards with me. Eliza is napping, the rations are gone and I am so bored. N-not that I'm scared!"],
          ] },
          after: [
            ["uzi", "sad", "...I lost. Is this what defeat feels like? Ugh. Again? AGAIN!", { close: true }],
          ] },
        // Academia Magicka, at the Royal Academy
        { foe: 'rion', side: true, from: 'flora-aquila', place: 'academy', at: [14, 80], title: 'Student Paper', text: 'Rion Usagi, rabbit girl and student journalist, wants an exclusive on the new student. She seems very sweet. Seems.' },
        { foe: 'gwendolyn', side: true, from: 'rion', place: 'academy', at: [50, 72], title: 'General Studies', text: 'Professor Gwendolyn teaches maths, English and science, and starts every term with a practical exam.' },
        { foe: 'thomas', side: true, from: 'rion', place: 'academy', at: [30, 88], title: 'The Crown Prince', text: 'Thomas von Gralin II means well. He is also used to people bowing, and you have not bowed.' },
        { foe: 'ruby-academia', side: true, from: 'thomas', place: 'academy', at: [10, 56], title: 'Exchange Student', text: 'The princess of Azol ran away to study here. She speaks in pieces, practises blood magic, and is very normal. Yes.' },
        { foe: 'charlotte-academia', side: true, from: 'gwendolyn', place: 'academy', at: [84, 78], title: 'Friend Request', text: "Charlotte wants to be your friend. She wants everyone to be her friend. She doesn't blink much." },
        { foe: 'elina', side: true, from: 'gwendolyn', place: 'academy', at: [32, 62], title: 'Visiting Lecturer', text: "Elina teaches at another wizard academy and is only visiting. She has taken a keen interest in you. A very keen one." },
        { foe: 'hailey', side: true, from: 'charlotte-academia', place: 'academy', at: [88, 58], title: 'Practical Studies', text: 'Hailey Grail, ex-soldier, teaches practical studies with a spear, a scythe and a halberd. Do not call her old.' },
        { foe: 'elyssa', side: true, from: 'hailey', place: 'academy', at: [70, 90], title: 'The Mark of the God', text: 'A timid healer hides her left hand in a lace glove. Whatever is under it, the whole academy whispers about it.' },
        { foe: 'irene', side: true, from: 'elyssa', place: 'academy', at: [50, 42], title: 'The Chancellor', text: 'Madam Chancellor Irene knows every spell ever written and only works blackout drunk. Your real entrance exam.' },
      ],
      secrets: [
        { id: 'ruby-compass', at: [92, 84], title: "Ruby's Wares", lines: [
          ['ruby', 'happy', 'You look. Excalibur, very strong. Orb, do not stare. Collar, very cute. Compass... does nothing. Like yours. Good deal, yes?'],
          ['*', "Every single thing on the blanket is cursed. Ruby thinks this is hilarious."],
        ] },
        { id: 'deiste-tv', at: [52, 60], title: "The Mayor's Son's Room", lines: [
          ['*', 'A giant smart TV. A wall of dragon posters. A scorch mark shaped exactly like a flashbang.'],
          ['*', "Deiste's hair is dyed to match his favourite prince from his favourite dragon show. He will tell you the whole plot. Please don't ask."],
        ] },
        { id: 'hed-debts', at: [4, 30], title: "Hed's IOUs", lines: [
          ['hed', 'neutral', 'yo... u got five bucks... no?... ok whatever... i owe like half of dalmavilla anyway... lmao'],
        ] },
      ] },
  ];

  // The first time the game starts: M-chan, the miku.gg mascot, explains what is going on, hands you your starter
  // deck and sends you to Story (js/ui.js plays it, then points at the Story button until the first quest is done).
  MB.INTRO = { bg: 'miku.gg', music: 'good-ol-novel-makin', lines: [
    { where: 'miku.gg', when: 'Somewhere between the novels' },
    ['*', 'A browser tab flickers open in the dark. Then another. Then a thousand.'],
    { enter: 'm-chan', at: 'center', mood: 'neutral' },
    ['m-chan', 'neutral', "Oh. A new reader. Hi. I'm M-chan, the mascot of miku.gg. And before you ask: no, I am NOT Hatsune Miku."],
    ['m-chan', 'angry', 'Different hair. Different beret. Different everything. Write that down.', { close: true }],
    { choose: [
      ['"Who?"', [['m-chan', 'sad', '...The Invisible Mascot. Every time. Every. Single. Time.']]],
      ['"Nice beret."', [['m-chan', 'happy', "...Thanks. I-it's not like I wanted you to notice. Moving on!"]]],
    ] },
    ['m-chan', 'neutral', "Here's the problem. Somebody is stitching the novels together. Characters keep falling out of their stories and into each other's."],
    { fx: 'flash', sfx: 'glitch' },
    ['m-chan', 'scared', 'And every one of those stories has a "you" at its centre. The reader. Which, right now, is... you.'],
    ['m-chan', 'proud', "So you're going in. You'll settle things the way everyone does around here: Miku Battle. Cards, leaders, big dramatic attacks."],
    { sfx: 'deal' },
    ['*', 'Twenty cards drop into your hands, still warm, like they were printed a second ago.'],
    ['m-chan', 'happy', "Your starter deck. Beat the people you meet and they'll join you as leaders. Win packs, collect 🧩 fragments and piece new cards together."],
    ['m-chan', 'angry', "Even the Commons. Two fragments each. Nobody gets anything for free around here. Low effort is how this mess started."],
    ['m-chan', 'neutral', 'Your story starts in a quiet town in south England. A new mum, a new school. Don\'t get attached to quiet.'],
    ['m-chan', 'proud', "Press Story when you're ready. I'll be watching. Critically.", { close: true }],
  ] };

  // a line's mood -> the sprite role showing it (the manifest names them by battle role)
  const MOODS = { neutral: 'idle', happy: 'play', angry: 'attack', rage: 'special', scared: 'hurt', sad: 'lose', excited: 'win', proud: 'taunt' };
  const LEVEL = { hp: [15, 44], ai: [0.05, 1] };
  const EASE_IN = 1.4;         // difficulty climbs slowly at first: the opening rivals face a starter deck
  const BOSS_HP = 2;           // a boss rival's extra HP
  const SECRET_GLITTER = 20;   // a secret found for the first time

  // ---------------------------------------------------------------- the quest graph
  const QUESTS = [], byId = new Map(), PLACES = new Map(), SECRETS = [];
  MB.ACTS.forEach((act, a) => {
    (act.places || []).forEach((p) => { p.act = a; PLACES.set(p.id, p); });
    (act.secrets || []).forEach((x) => { x.act = a; SECRETS.push(x); });
    let prev = null;
    act.quests.forEach((q) => {
      q.id = q.id || q.foe;
      q.act = a;
      q.main = !q.side;
      q.stage = q.foe ? MB.STORY.findIndex((st) => st.foe === q.foe) : null;
      // a main quest follows the one listed before it (across acts too), a side quest the quest it's `from`
      q.needs = q.needs || (q.side ? [q.from] : prev ? [prev.id] : []);
      if (q.main) prev = q;
      QUESTS.push(q);
      byId.set(q.id, q);
    });
    // the next act starts after this one's finale
    MB.ACTS[a + 1] && (MB.ACTS[a + 1].after = prev.id);
  });
  // the first main quest of each act after the first needs the previous act's finale
  MB.ACTS.forEach((act, a) => { if (a) { const first = act.quests.find((q) => q.main); if (!first.needs.length) first.needs = [act.after]; } });
  const MAIN = QUESTS.filter((q) => q.main);
  const byStage = new Map(QUESTS.filter((q) => q.stage != null).map((q) => [q.stage, q]));

  // a quest fought by a rival of a hidden chapter (NSFW mode off)
  const hidden = (q) => q.stage != null && q.stage >= 0 && !!MB.CHAPTERS[MB.STORY[q.stage].chapter].hidden;
  const isDone = (s, q) => !!q && s.quests.includes(q.id);
  // playable: done already, or everything it needs is done
  const isOpen = (s, q) => !hidden(q) && (isDone(s, q) || q.needs.every((id) => isDone(s, byId.get(id))));
  // the main quest to play next: the first open one in story order (null once the story is done)
  const next = (s) => MAIN.find((q) => isOpen(s, q) && !isDone(s, q)) || MAIN.find((q) => !isDone(s, q)) || null;
  const actOpen = (s, a) => MB.ACTS[a].quests.some((q) => isOpen(s, q));
  const lastOf = (a) => MAIN.filter((q) => q.act === a).pop();
  // the storylines of an act: { name, quests }, in the order they're listed
  const arcsOf = (a) => {
    const arcs = [];
    MAIN.filter((q) => q.act === a && q.arc).forEach((q) => { let arc = arcs.find((x) => x.name === q.arc); if (!arc) arcs.push(arc = { name: q.arc, quests: [] }); arc.quests.push(q); });
    return arcs;
  };
  // the map an act shows now: its last variant whose needs are met (count of them, or all)
  const mapOf = (s, a) => {
    const act = MB.ACTS[a];
    const v = (act.variants || []).filter((x) => x.needs.filter((id) => isDone(s, byId.get(id))).length >= (x.count || x.needs.length)).pop();
    return v ? v.map : act.map;
  };
  const placesOf = (a) => (MB.ACTS[a].places || []).filter((p) => QUESTS.some((q) => q.place === p.id && !hidden(q)));

  // marks a quest done; returns { first, opened (quest ids that just became playable), act (index of an act just
  // finished for the first time: it pays an Epic pack) }
  function complete(s, id) {
    const q = byId.get(id);
    if (!q || isDone(s, q)) return { first: false, opened: [], act: null };
    const was = new Set(QUESTS.filter((x) => isOpen(s, x)).map((x) => x.id));
    s.quests.push(q.id);
    const opened = QUESTS.filter((x) => x !== q && !was.has(x.id) && isOpen(s, x)).map((x) => x.id);
    let act = null;
    if (q === lastOf(q.act) && !s.storyActs.includes(q.act)) {
      s.storyActs.push(q.act);
      s.packs.epic = (s.packs.epic | 0) + 1;
      act = q.act;
    }
    return { first: true, opened, act };
  }
  // finds a secret; returns the Glitter it paid (0 if it was found before)
  function findSecret(s, id) {
    if (s.secrets.includes(id) || !SECRETS.some((x) => x.id === id)) return 0;
    s.secrets.push(id);
    s.glitter += SECRET_GLITTER;
    return SECRET_GLITTER;
  }

  // the Story stages (indexes into MB.STORY) a save has cleared
  const clearedStages = (s) => QUESTS.filter((q) => q.stage != null && q.stage >= 0 && isDone(s, q)).map((q) => q.stage);

  // how deep a quest sits in the story: the most fights on any chain of needs leading to it
  const depthMemo = new Map();
  function depth(q) {
    if (depthMemo.has(q.id)) return depthMemo.get(q.id);
    const d = q.needs.reduce((m, id) => { const n = byId.get(id); return Math.max(m, depth(n) + (n.foe && n.main ? 1 : 0)); }, 0);
    depthMemo.set(q.id, d);
    return d;
  }
  const MAX_DEPTH = Math.max(1, ...MAIN.filter((q) => q.foe).map(depth));
  // 0..1 along the story; a side quest a little past what opened it
  const progressOf = (q) => Math.min(1, depth(q) / MAX_DEPTH + (q.side ? 0.02 * (depth(q) - depth(byId.get(q.needs[0]))) : 0));
  // HP and AI skill of every Story rival from where its quest sits in the story
  QUESTS.forEach((q) => {
    if (q.stage == null || q.stage < 0) return;
    const t = progressOf(q), e = Math.pow(t, EASE_IN), st = MB.STORY[q.stage];
    st.level = t;   // also limits the Epics and Legendaries in the rival's deck (MB.AI.deck)
    st.hp = Math.round(LEVEL.hp[0] + (LEVEL.hp[1] - LEVEL.hp[0]) * e) + (MB.BOSSES[st.foe] ? BOSS_HP : 0) + (q.side ? 1 : 0);
    st.ai = Math.min(1, Math.round((LEVEL.ai[0] + (LEVEL.ai[1] - LEVEL.ai[0]) * e + (q.side ? 0.05 : 0)) * 100) / 100);
  });

  // a scene as { bg, music, lines }; bg/music default to the quest's fight, then the act
  function sceneOf(q, part) {
    const raw = q[part];
    if (!raw) return null;
    const sc = Array.isArray(raw) ? { lines: raw } : raw, st = q.stage != null && q.stage >= 0 ? MB.STORY[q.stage] : null, act = MB.ACTS[q.act];
    return { bg: sc.bg || (st ? st.bg : act.bg), music: sc.music || (st ? st.music : act.music), lines: sc.lines };
  }
  const secretScene = (x) => ({ bg: MB.ACTS[x.act].bg, music: null, lines: x.lines });
  // a line as { who, role, mood, text, close, shake } or a direction (anything else)
  function lineOf(l) {
    if (!Array.isArray(l)) return l;
    const [who, a, b, opts] = l;
    return b === undefined ? { who, role: 'idle', text: a } : { who, role: MOODS[a] || 'idle', mood: a, text: b, ...(opts || {}) };
  }

  // old saves counted cleared stages per chapter, in order; their cleared stages become done quests
  function migrate(s) {
    const progress = Array.isArray(s.progress) ? s.progress : [], seen = {};
    const cleared = MB.STORY.map((st, i) => ((seen[st.chapter] = (seen[st.chapter] || 0) + 1) <= (progress[st.chapter] | 0) ? i : -1)).filter((i) => i >= 0);
    s.quests = cleared.map((i) => byStage.get(i)).filter(Boolean).map((q) => q.id);
    s.storyActs = [];
    delete s.progress;
  }

  MB.Story = { quests: QUESTS, main: MAIN, secrets: SECRETS, byId: (id) => byId.get(id), byStage: (i) => byStage.get(i), place: (id) => PLACES.get(id),
    hidden, isDone, isOpen, next, actOpen, lastOf, arcsOf, mapOf, placesOf, complete, findSecret, clearedStages, sceneOf, secretScene, lineOf,
    migrate, progressOf, depth, MOODS, LEVEL, SECRET_GLITTER };
})();
