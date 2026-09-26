// Story mode: one story across every novel's world, told on the maps of four acts. Each act is a map (a picture in
// the game-assets bucket under maps/, copied there from the "map-images" bucket by tools/sync_maps.py) with quests on
// it: the main quests are played in order and draw the path across the map; side quests open when the quest named in
// `from` is done. A quest is a fight (`foe`: a rival of MB.STORY) or a scene only (`scene`).
//
// Quest fields: id (defaults to the foe), foe, side, from, at: [x, y] in % of the map, via: [[x, y], ...] (bends of
// the path on its way here from the main quest before), title, text (the map's quest description), and scenes:
// `before` (played before the fight until it's won) and `after` (once, after the first win), or `scene` for a quest
// without a fight. A scene is a list of lines, or { bg, music, lines }; without bg/music it takes the fight's
// background and music (or the act's). A line is [who, text] or [who, mood, text]: who is a character id, 'you'
// (the player) or '*' (narration); moods are the keys of MOODS. A line can also be a stage direction instead:
// { bg: 'name' }, { music: 'id' }, { fx: 'flash' | 'shake' | 'rift' }, { sfx: 'name' }, { hide: 'character id' }.
// {name} in a text is the player's name.
//
// Levels: the main fights get harder from the first to the last (LEVEL); a side quest is a little harder than the
// main quest that opened it. The rivals' HP and AI skill in MB.STORY are set from this when the game loads.
// Works on a save's { quests, storyActs, packs } only, so tools/check_game.js can simulate it.
window.MB = window.MB || {};
(function () {
  MB.ACTS = [
    // ================================================================ Act 1
    { id: 'hometown', title: 'A New Life', map: 'maps/adoptive_life.webp', w: 1024, h: 1024, size: 1800, color: '#ffb347',
      music: 'main-theme', bg: 'Our Home from the outside',
      quests: [
        { id: 'moving-day', at: [41, 87], title: 'Moving Day', text: 'A new town, a new house, a new family. And a neighbor who brought her deck.',
          scene: { bg: 'Our Home from the outside', music: 'oh-close-home', lines: [
            ['*', 'A new town. A new house. A new family.'],
            ['maria-hunley', 'happy', "Here we are, sweetie. Home! Your room is upstairs, second door. I put a plant in it. It's probably still alive."],
            ['julie-hunley', 'excited', "IS THAT THEM?! Hi hi hi! I'm Julie! I'm your sister now! Do you play cards?!"],
            ['maria-hunley', 'happy', 'Julie, let them get through the door first.'],
            ['hayley-kate', 'excited', "Oh my gosh, the new neighbor! Hi! Hayley Kate, from next door! I brought cupcakes. And my deck. Mostly my deck."],
            ['you', '...Your deck?'],
            ['hayley-kate', 'happy', "Miku Battle! Everybody plays it here. The whole town, the school, probably the mailman. Stick with me, I'll teach you everything!"],
            { bg: "Your's bedroom (night)", music: 'sleep-tight' },
            ['*', "That night you can't sleep. Through the window, the sky over the park looks... wrong. Like a page someone tore."],
            { fx: 'flash', sfx: 'glitch' },
            ['*', 'A line of light splits the stars, hums, and snaps shut. Something small and bright falls toward the school.'],
          ] } },
        { foe: 'julie-hunley', at: [54, 89], title: 'House Rules', text: 'Julie wants a card game before school. Just one. Probably.',
          before: { music: 'goodmorning-baby-boy', lines: [
            ['julie-hunley', 'excited', 'Morning! Mom says no cards at breakfast, so we have to play REALLY fast!'],
            ['hayley-kate', 'happy', '*through the window* I heard cards! Go easy on them, Julie!'],
            ['julie-hunley', 'proud', 'Nope!'],
          ] },
          after: [
            ['julie-hunley', 'sad', "Aww... you're good. Hayley, they're GOOD."],
            ['hayley-kate', 'excited', "Told you! Come on, first day of school, I'll walk you. Also, did you see that weird light last night?"],
            ['you', 'You saw it too?'],
            ['hayley-kate', 'neutral', "Half the town did. My mom says it was fireworks. Fireworks don't hum."],
          ] },
        { foe: 'james-lone', at: [30, 79], title: 'First Day', text: 'New school, new desk. The boy in the back row looks bored enough to play.',
          before: [
            ['hayley-kate', 'happy', "This is James. He's grumpy, but, like, a cute grumpy."],
            ['james-lone', 'neutral', '...I can hear you.'],
            ['james-lone', 'neutral', "There's a room on the third floor that wasn't there yesterday. Nobody's talking about it. Weird. Anyway. Cards?"],
          ],
          after: [
            ['james-lone', 'sad', "Hm. Fine. You're not boring."],
            ['james-lone', 'neutral', 'That new room has a sign on it. "Literature Club." We don\'t have a literature club.'],
            ['hayley-kate', 'excited', 'A mystery! On your first day! Okay, we HAVE to check.'],
          ] },
        { foe: 'sayori', at: [12, 78], title: "The Club That Wasn't There", text: "A classroom appeared overnight. Inside, a girl with a messy bow acts like she's known you forever.",
          before: { bg: 'Club', lines: [
            ['sayori', 'excited', "THERE you are! You're late! Wait. Are you late? I don't remember inviting you. But I feel like I did!"],
            ['hayley-kate', 'scared', "Um. Hi? This room wasn't in our school yesterday."],
            ['sayori', 'happy', "Ehehe~ it wasn't in MY school yesterday either! Everything outside the window is different. But you're here, so it's okay!"],
            ['sayori', 'happy', 'Play a game with me? When I get nervous, cards help!'],
          ] },
          after: [
            ['sayori', 'happy', "Ehehe, you won! See? Everything's okay now."],
            ['sayori', 'neutral', "...Monika says it's NOT okay, though. She wants to talk to you. She says you're \"the one the story keeps pointing at.\""],
          ] },
        { foe: 'monika', at: [38, 63], title: 'Just Monika', text: 'The club president knows more than she lets on. She wants a word, and a match, in that order.',
          before: { music: 'okay-everyone', lines: [
            ['monika', 'happy', "Welcome to the Literature Club! Sit. I'll be honest with you, since I think you can take it."],
            ['monika', 'neutral', 'My world is a story. So is yours. So is every world out there. And every one of those stories has a "you" at its center.'],
            ['monika', 'neutral', 'Last night someone started stitching the stories together. My club landed in your school. And every seam I can find runs straight through you.'],
            ['hayley-kate', 'scared', 'That is... a LOT for a Tuesday.'],
            ['monika', 'proud', "Then let's keep it simple. Beat me, and I'll believe you can handle what's coming."],
          ] },
          after: [
            ['monika', 'happy', "Ahaha... you really are the main character, aren't you?"],
            ['monika', 'neutral', "Listen. The tear last night was over the park. If someone did it on purpose, they'll do it again. Be there when they do."],
          ] },
        { id: 'crack-in-the-sky', at: [60, 55], title: 'A Crack in the Sky', text: 'Sunset in the park. The sky starts humming again.',
          scene: { bg: 'Park', music: 'the-unknown-tear', lines: [
            ['hayley-kate', 'neutral', "Okay. Sunset, park, and... quiet. Maybe Monika was wr—"],
            { fx: 'rift', sfx: 'warp' },
            ['*', 'The sky rips open above the gazebos. Wind roars. Two girls tumble out, still yelling at each other.'],
            ['lilith', 'angry', "—and THAT'S why you don't touch a demon's punch bowl, you feathery— Where are we?!"],
            ['celeste', 'happy', "Oh my. A new world, darling! And look who's here... my precious human. Your guardian angel has arrived~"],
            ['lilith', 'angry', "YOUR human?! I saw them first! ...Wait. I've never seen them before. Why do I feel like I have?!"],
            { fx: 'flash', sfx: 'boom' },
            ['*', 'All over town, buildings flicker into place: a school with a prom banner on the hill, a gated cul-de-sac in the north. The rift snaps shut.'],
            ['*', 'Something glitters in the grass where it closed. A shard of light, warm to the touch. It hums, louder whenever you face the new buildings.'],
            ['hayley-kate', 'excited', "Is it... a compass? It's pointing at that new street up north! Okay. Okay okay okay. We're doing this."],
          ] } },
        { foe: 'chris', at: [28, 30], title: 'The Cul-de-sac from Nowhere', text: 'A gated street appeared at the north end of town. Chris, a quiet boy with a phone, waits by the gate.',
          before: { bg: 'Town', lines: [
            ['chris', 'neutral', "Hm. You good? ...You're the new kid. Everyone here is new, actually. Our whole street just moved without asking."],
            ['chris', 'neutral', "Skylar says she runs this town now. Yours too. Heard she's after you."],
            ['chris', 'neutral', "Beat me first. Then I know you'll be fine."],
          ] },
          after: [
            ['chris', 'happy', "...Yeah. You'll be fine. She's at the end of the street. Don't compliment her outfit. It makes it worse."],
          ] },
        { foe: 'skylar', at: [8, 24], title: 'Queen Bee', text: 'Skylar has decided that two towns means twice the people to rule.',
          before: [
            ['skylar', 'happy', "Oh, the NEW kid! Love that you just... wear whatever. So brave."],
            ['hayley-kate', 'angry', 'Hey! Their outfit is cute!'],
            ['skylar', 'proud', "Aww, and you brought a friend. Adorable. Let's play, sweetie. Loser moves out of MY town."],
          ],
          after: [
            ['skylar', 'sad', "Ugh. FINE. Whatever. It's a small town anyway."],
            ['skylar', 'neutral', "...And that prom on the hill? The demon girl running it keeps yelling for you. It's SO annoying."],
          ] },
        { foe: 'jay-lester', at: [40, 16], title: 'A Friend from Another Prom', text: "A school on the hill is throwing a prom. Jay, a painter with paint on everything, is very confused and very glad to see you.",
          before: [
            ['jay-lester', 'happy', "Dude! There you are! ...Wait, you're not from here. But you're also totally my friend? My brain hurts."],
            ['jay-lester', 'scared', 'Lilith took over the prom. She says the new world is her dance floor. Celeste is trying to stop her, which is making it worse.'],
            ['jay-lester', 'happy', 'Play me first? I think better when I lose. Which is a lot.'],
          ],
          after: [
            ['jay-lester', 'happy', "Ha! Okay, you're ready. Lilith's in the gym. Follow the smell of sulfur and glitter."],
          ] },
        { foe: 'lilith', at: [62, 30], title: 'Hellfire Prom', text: "Lilith has claimed the new world's prom. The dance floor is on fire. Literally.",
          before: { bg: 'Outside the prom', music: 'hello-lilith', lines: [
            ['lilith', 'proud', "Finally, my favorite human! H-hey, don't get the wrong idea! I just need a dance partner who won't burst into flames."],
            ['celeste', 'happy', "Don't listen to her, darling. Beat her and she'll behave. Probably."],
            ['lilith', 'angry', 'I heard that, bird-brain!'],
          ] },
          after: [
            ['lilith', 'sad', 'Hmph. Fine. You win. The prom can go back to being boring.'],
            ['lilith', 'neutral', '...Hey. That shard of yours smells like somewhere far away. Somewhere with labs and lab coats. Gross.'],
            ['celeste', 'happy', "She's right, darling. Whoever tore the sky left fingerprints on it. Keep it close: the lady in the mansion has been sending her butler to ask about it."],
          ] },
        { foe: 'catherine-jones', at: [76, 38], title: 'Everything Has a Price', text: "Catherine Jones wants the humming shard for her art collection. She doesn't take no for an answer.",
          before: [
            ['catherine-jones', 'proud', 'Darling. That little shard of yours is the most interesting thing to happen to this town since me.'],
            ['catherine-jones', 'happy', 'Name a price. Any price. Artistic Endeavors will pay it.'],
            ['you', "It's not for sale."],
            ['catherine-jones', 'proud', "Everything is for sale, sweetie. But fine. We'll play for it."],
          ],
          after: [
            ['catherine-jones', 'sad', "Hmph. Keep your little rock. It's gauche anyway."],
            ['hayley-kate', 'scared', "Um. {name}? The shard's really glowing now. It's pointing... away. Out of town. Like, really far out of town."],
          ] },
        { foe: 'maria-hunley', at: [60, 79], via: [[88, 51], [76, 65]], title: "Show Me How Much You've Grown", text: "Mom has heard everything. She's waiting on the porch.",
          before: { music: 'maria-hunley', lines: [
            ['maria-hunley', 'neutral', "Hayley's mom called. And the Jones lady. And a girl with horns who said \"sorry about the gym.\""],
            ['maria-hunley', 'sad', "You're going after it, aren't you? Whatever is tearing up the sky."],
            ['you', 'The shard points down the coast, to New Haven. Someone there knows what is happening.'],
            ['maria-hunley', 'proud', "...Then show me. Show me how much you've grown, kiddo. If you can beat your mom, you can beat anything."],
          ] },
          after: { music: 'my-mom', lines: [
            ['maria-hunley', 'sad', 'Oh, you... Come here, sweetie.'],
            ['*', "She hugs you like she's trying to memorize you."],
            ['maria-hunley', 'happy', 'Call every night. Eat real food. And Hayley? You keep them safe.'],
            ['hayley-kate', 'excited', "Yes ma'am! ROAD TRIP!"],
          ] } },
        { id: 'road-out', at: [67, 95], title: 'The Road to New Haven', text: 'The shard points down the coast road. Time to go.',
          scene: { bg: 'Street sunset', music: 'bussin-home', lines: [
            ['*', 'The whole town comes to see you off. Julie cries. James pretends not to.'],
            ['monika', 'happy', "Here's my number. If the story gets strange, call me. I'm good at strange."],
            ['lilith', 'proud', 'And if anybody tears the sky again, tell them the Queen of Hell wants a word!'],
            ['celeste', 'happy', "We'll watch over the town, darling. Go on."],
            ['hayley-kate', 'excited', 'New Haven, here we come! ...How far is New Haven?'],
            ['*', 'The shard hums down the coast road, toward a city of glass towers and one word on the tallest of them: NHIS.'],
          ] } },
        // side quests
        { foe: 'maiko-ghan', side: true, from: 'james-lone', at: [5, 62], title: 'Honest to a Fault', text: "Maiko doesn't think you stand a chance. She'll tell you so. To your face." },
        { foe: 'kayla-kate', side: true, from: 'james-lone', at: [79, 85], title: 'Goth in the Woods', text: "Hayley's big sister is sulking in the woods at sunset. She agrees to one game. Whatever." },
        { foe: 'ben-brier', side: true, from: 'james-lone', at: [34, 43], title: 'Alley Toll', text: 'Ben blocks the shortcut behind the shops. Nobody walks through without a fight.' },
        { foe: 'protagonist', side: true, from: 'sayori', at: [22, 58], title: "Sayori's Best Friend", text: "Sayori's childhood friend is standing at a crosswalk, very unsure which town this is." },
        { foe: 'natsuki', side: true, from: 'sayori', at: [45, 69], title: 'Manga Closet', text: 'Natsuki guards the club\'s manga closet. Touch her Parfait Girls and you\'re dead.' },
        { foe: 'yuri', side: true, from: 'monika', at: [30, 96], title: 'Like a Story', text: "Yuri is reading under a streetlight in a town she doesn't know. She'd like some company." },
        { foe: 'janice-garmund', side: true, from: 'jay-lester', at: [42, 6], title: 'By the Book', text: 'Janice read the whole rulebook. Twice. She would like to test that.' },
        { foe: 'clara-click', side: true, from: 'jay-lester', at: [68, 62], title: 'Lemonade Standoff', text: "Clara from class 2B is running a lemonade stand in the park. It's not like she WANTS to play with you." },
        { foe: 'mr-dino', side: true, from: 'jay-lester', at: [68, 6], title: 'Pop Quiz', text: 'Mr. Dino, math teacher and future president, thinks you need tutoring.' },
        { foe: 'charlie-and-jenny', side: true, from: 'jay-lester', at: [52, 37], title: 'After-Party', text: "Charlie and Jenny found the punch bowl. Bet you can't beat BOTH of them." },
        { foe: 'celeste', side: true, from: 'lilith', at: [70, 45], title: 'Guardian Angel', text: 'Celeste insists on protecting you. From Lilith. From everything. With a card game.' },
        { foe: 'ethan', side: true, from: 'chris', at: [5, 8], title: 'Gated Community', text: 'Skritz says the cul-de-sac is his turf. You gotta battle to pass.' },
        { foe: 'evelyn', side: true, from: 'chris', at: [24, 7], title: 'Scary Story', text: "Evelyn wrote a scary story. It's a card game. She's very proud of it." },
        { foe: 'reina', side: true, from: 'chris', at: [12, 55], title: 'Live from the Mall', text: 'Reina is streaming the new town to her followers. You are the content now.' },
        { foe: 'peter-reeves', side: true, from: 'chris', at: [11, 92], title: 'Napoleon Would Have Won', text: 'Mr. Reeves has unrolled a battle map in the history room. Pop quiz, soldier!' },
        { foe: 'olivia-paradiso', side: true, from: 'chris', at: [90, 72], title: 'Ring Rookie', text: 'Olivia found a place to box and wants to see who can win faster.' },
        { foe: 'sophia', side: true, from: 'skylar', at: [18, 43], title: 'Bake Sale Stakes', text: 'Sophia from the student council wants a friendly game. Winner plans the next bake sale.' },
      ] },

    // ================================================================ Act 2
    { id: 'new-haven', title: 'New Haven', map: 'maps/new_haven.webp', w: 1536, h: 1024, size: 2300, color: '#4ab8ff',
      music: 'welcome-to-the-city-day', bg: 'New Haven - Day',
      quests: [
        { id: 'new-haven', at: [34, 90], title: 'Welcome to the City', text: 'Glass towers, a beach, a university... and a very excited deer girl.',
          scene: { bg: 'New Haven - market street', music: 'welcome-to-the-city-day', lines: [
            ['hayley-kate', 'excited', "WHOA. It's so big! And everyone is... a deer? A cat? Is that a WOLF holding a latte?!"],
            ['jane', 'excited', "*excited bleat* New faces! Hi! I'm Jane! Are you lost? You look lost. You're holding a glowing rock, which is VERY lost."],
            ['jane', 'happy', 'My sister Diana works at the Institute. The big tower! She LOVES glowing rocks. But first, have you seen the university? I can show you!'],
            ['*', 'The shard wobbles. By the beach and over the campus, the air shimmers like heat on a road.'],
          ] } },
        { foe: 'jane', at: [58, 60], title: 'Campus Tour', text: 'Jane insists on a campus tour. And a card game. Mostly the card game.',
          before: [
            ['jane', 'happy', "And THIS is the university! That's the library, that's the field, and that, um, is a whole other university that fell out of the sky this morning."],
            ['hayley-kate', 'scared', "It's happening here too..."],
            ['jane', 'excited', "Science is SO exciting! Okay: game first, then I'll take you to Diana. Promise!"],
          ],
          after: [
            ['jane', 'happy', '*happy bleat* You\'re really good! Oh, somebody over there is yelling for you. Well, not your name. "WINGMAN!"'],
          ] },
        { foe: 'andrea-lyle', at: [71, 64], title: 'Wingman Wanted', text: "Andrea's whole school came through a rift. She has one priority, and it isn't the rift.",
          before: { bg: 'Sidewalk', lines: [
            ['andrea-lyle', 'excited', "YOU! You're my wingman! I don't know how I know that, but I KNOW it."],
            ['andrea-lyle', 'happy', 'New world, new campus, new girls. This is my chance! Help me find a girlfriend and I owe you forever.'],
            ['hayley-kate', 'happy', 'Aww. I love her.'],
            ['andrea-lyle', 'proud', "But first, cards. Prove you're wingman material."],
          ] },
          after: [
            ['andrea-lyle', 'excited', "Wingman material CONFIRMED. Okay. Her name is Linda. She's in the library. She's perfect. She terrifies me."],
          ] },
        { foe: 'linda-penn', at: [80, 42], title: 'Required Reading', text: 'Linda Penn does not date. Linda Penn does not even look up from her book. Andrea is counting on you.',
          before: [
            ['linda-penn', 'neutral', "Andrea sent you. She's been hiding behind that shelf for twenty minutes."],
            ['andrea-lyle', 'scared', "*from behind the shelf* NO I HAVEN'T."],
            ['linda-penn', 'proud', "Show me she has good taste in friends. Then maybe I'll believe she has good taste in general."],
          ],
          after: [
            ['linda-penn', 'happy', "...Fine. Tell her Friday. Seven. She's paying."],
            ['andrea-lyle', 'excited', 'SHE SAID FRIDAY! Wingman of the YEAR!'],
            ['hayley-kate', 'happy', "Cutest thing I've ever seen. Okay. Rifts. Focus. The shard is pulling toward the beach now..."],
          ] },
        { foe: 'rowdy-brachy', at: [16, 22], via: [[60, 20], [30, 16]], title: 'Shark Week', text: 'Lifeguards from the Coorong washed up on the beach, tower and all. They are sharks. They are very friendly. Mostly.',
          before: { bg: 'New Haven Coast', lines: [
            ['hayley-kate', 'scared', '{name}. {name}. Those are sharks. Shark GIRLS. In a lifeguard tower.'],
            ['rowdy-brachy', 'happy', "Oh! Humans! Um, hello. Our beach moved. We didn't. Well, we did, but with the beach."],
            ['rowdy-brachy', 'neutral', "Rirarra's upset. She says someone stole the ocean and she wants it back. Do humans like card games? I read that they do."],
          ] },
          after: [
            ['rowdy-brachy', 'happy', "You're nice! Rirarra will like you. She likes things she can pick up."],
            ['hayley-kate', 'scared', 'What does that MEAN.'],
          ] },
        { foe: 'rirarra-charca', at: [8, 45], title: 'Feeding Time', text: "Rirarra is the biggest, loudest lifeguard on the beach, and she's decided you are hers.",
          before: [
            ['rirarra-charca', 'excited', 'A NEW HUMAN! MINE! Mine mine mine.'],
            ['*', 'She scoops you up under one arm like a surfboard.'],
            ['rirarra-charca', 'proud', 'Beat big sis and you can go home. ...Probably. Maybe. Nah!'],
          ],
          after: [
            ['rirarra-charca', 'sad', 'Awww. Fine. You can have yourself back.'],
            ['rirarra-charca', 'neutral', 'Hey, little human. That rock smells like the big tower. The night the sky broke, a deer lady was up on its roof. Laughing.'],
            ['hayley-kate', 'scared', "A deer lady? Jane's sister is a deer lady..."],
          ] },
        { foe: 'aria', at: [42, 59], via: [[22, 60]], title: 'Visitor Badge', text: "The New Haven Institute of Science. Aria, head of security, hasn't left the door in six hours.",
          before: [
            ['aria', 'neutral', 'Badge, please.'],
            ['you', "We're here to see Diana. Her sister sent us."],
            ['aria', 'neutral', "Everybody's sister sent them. This building has been shaking since the sky broke. Nobody goes up without a badge."],
            ['aria', 'proud', 'No badge? Then you play me.'],
          ],
          after: [
            ['aria', 'happy', "...Hm. Fine. Lab A-3, fourth floor. Don't touch anything that glows. Except, apparently, your rock."],
          ] },
        { foe: 'diana', at: [29, 40], title: 'Lab A-3', text: 'Diana studies the multiverse. She takes one look at the shard and drops her coffee.',
          before: { bg: 'Lab A-3 Daytime', music: 'the-lingering-question-of-what-if', lines: [
            ['diana', 'scared', "¡Ay! Where did you get that?! That's part of a rift compass. From another Earth!"],
            ['diana', 'neutral', "We number every Earth we can reach. This one isn't on any of our charts, and it's tuned to our gateway in Lab B-2."],
            ['diana', 'angry', 'Someone is using our gateway at night to tear holes between worlds. And not just worlds. Stories.'],
            ['hayley-kate', 'neutral', 'Monika said the same thing. Every world has a "you" at the center. And it\'s always {name}.'],
            ['diana', 'happy', "Then you're the only one who can follow the trail! But Mamá runs the Institute, and she'll only let you near B-2 if you're ready. Show me what you learned, friend!"],
          ] },
          after: [
            ['diana', 'happy', "¡Increíble! Okay. Mamá's office is on the top floor. Good luck. She's... thorough."],
          ] },
        { foe: 'marija', at: [37, 27], title: 'The Director', text: 'Marija runs the Institute. The gateway is hers, and so is the final word.',
          before: [
            ['marija', 'neutral', "My daughters speak highly of you. And my security chief says you beat her, which she has never said about anyone."],
            ['marija', 'neutral', 'Lab B-2 is the most dangerous room on this Earth. If someone from another Earth is using it, I want them found.'],
            ['marija', 'proud', 'In my institute, you earn your place. Show me.'],
          ],
          after: [
            ['marija', 'happy', '...Good. Very good. Tonight, then. Diana will run the gateway, and you will find out who has been playing with my laboratory.'],
          ] },
        { id: 'lab-b2', at: [37, 8], title: 'Lab B-2', text: 'Midnight. The gateway hums. Someone is already inside.',
          scene: { bg: 'Lab B-2 before rift', music: 'another-earth', lines: [
            ['diana', 'neutral', "Gateway at forty percent... fifty... ¡Ay, the readings are going crazy!"],
            { fx: 'rift', sfx: 'warp', bg: 'Lab B-2 Earth 7 Rift' },
            ['doe', 'excited', '¡Hola! Another Earth, another cute visitor~'],
            ['diana', 'scared', 'She... she looks like ME?!'],
            ['doe', 'proud', "Better, cariño. I'm Doe, from an Earth you will never find on your little charts. And you..."],
            ['doe', 'happy', 'You must be the main character. Every world I visit, there you are. The "you" of every story. Isn\'t that SO unfair?'],
            ['doe', 'angry', "Everyone looks at YOU. Nobody ever looks at ME. So I'm stitching every story into one. And in that story, the main character is me."],
            ['hayley-kate', 'angry', "That's not how stories work!"],
            ['doe', 'happy', "It is if you hold the pen~ Oh, and I'll take that back, gracias."],
            { fx: 'flash', sfx: 'boom' },
            ['*', 'She grabs the shard. It flares. The gateway howls, and a piece of the compass cracks off in her hand.'],
            ['doe', 'angry', "¡Ay, no! Fine. Keep your crumbs. I'll be waiting where all the worlds meet: the top of the Peaks. Catch me if you can~"],
            { fx: 'shake', sfx: 'vortex' },
            ['*', 'The rift swallows her. Then it swallows the room. The last thing you hear is Diana shouting your name, and the last thing you feel is Hayley holding your hand very, very tight.'],
          ] } },
        // side quests
        { foe: 'bucky', side: true, from: 'jane', at: [49, 47], title: 'Roll for Initiative', text: 'Bucky at the Institute front desk will write you a visitor pass. Right after you roll for initiative.' },
        { foe: 'saria', side: true, from: 'jane', at: [66, 50], title: 'Home Field', text: "Saria, captain of New Haven's cheerleaders, wants the Welsh squad off HER field. And you with them." },
        { foe: 'seren-lockster', side: true, from: 'jane', at: [90, 30], title: 'No Fighting!', text: 'Seren from the Welsh cheer squad wants to play. No fighting though!' },
        { foe: 'alice-orejin', side: true, from: 'jane', at: [96, 41], title: 'Candy Stakes', text: 'Alice will play you for her candy. She has a LOT of candy.' },
        { foe: 'alys-porter', side: true, from: 'jane', at: [88, 50], title: 'An Adult Match', text: 'Alys is an ADULT, and she will beat you like one.' },
        { foe: 'eira-randers', side: true, from: 'jane', at: [96, 57], title: 'The Snow Flower', text: 'Eira is, like, the most popular girl in her university. And in this one, obviously.' },
        { foe: 'carys-crowner', side: true, from: 'jane', at: [84, 22], title: 'Pom-Pom Duel', text: "Carys wants to be friends! Wait, you're playing AGAINST each other? ...Yay!" },
        { foe: 'jack-lockster', side: true, from: 'seren-lockster', at: [93, 18], title: 'Game Day', text: "Jack, Seren's brother and the football star, doesn't talk much. He cracks his knuckles instead." },
        { foe: 'megan-dilourice', side: true, from: 'carys-crowner', at: [89, 65], title: 'Squad Vote', text: 'The squad voted: you have to win a match to stay on their field.' },
        { foe: 'owain-owegrain', side: true, from: 'megan-dilourice', at: [95, 72], title: 'Rules Are Rules', text: 'Owain, the squad manager, has one rule: no boys on HIS squad. You walked onto the field. That counts.' },
        { foe: 'eva-vinn', side: true, from: 'andrea-lyle', at: [68, 33], title: 'Study Buddy', text: "Eva, Andrea's geeky friend, is bouncing off the walls of the study room." },
        { foe: 'ashley-lennette', side: true, from: 'andrea-lyle', at: [78, 73], title: 'Loser Buys Poutine', text: 'Ashley spins a basketball on one finger. Cards, eh? Loser buys the poutine.' },
        { foe: 'brizz-bigeyed', side: true, from: 'rowdy-brachy', at: [4, 30], title: 'CPR Drills', text: 'Brizz the beach medic wants a quick game first. Loser does the CPR drills.' },
        { foe: 'melanika-carchara', side: true, from: 'rowdy-brachy', at: [3, 56], title: 'Surf Lesson', text: 'Melanika saw you last three whole seconds on a surfboard. Now let\'s see your cards.' },
        { foe: 'daphne-mokarran', side: true, from: 'rowdy-brachy', at: [13, 62], title: "Hammerhead's Workshop", text: 'Daphne the engineer is busy smashing a sink. Play fast.' },
        { foe: 'rinco-typus', side: true, from: 'rirarra-charca', at: [24, 13], title: 'Gentle Giant', text: 'Rinco, all nine feet of her, is feeding the birds by the shore. She would like to play... gently.' },
        { foe: 'joseph', side: true, from: 'aria', at: [48, 34], title: 'Lunch Rush', text: 'Joseph works in the Institute cafeteria. One game before your lunch goes cold.' },
        { foe: 'natalie', side: true, from: 'aria', at: [22, 38], title: 'Oh Deer', text: "Natalie, an Institute scientist, has an endless supply of puns. They're sleigh-ing." },
        { foe: 'quinta', side: true, from: 'diana', at: [20, 28], title: 'Stream Challenger', text: "Quinta, Diana's best friend, streams her lab work. Chat wants a card battle." },
        { foe: 'luxuria', side: true, from: 'aria', at: [88, 84], title: 'Sister Lucy', text: 'A nun with a tail waves from an old chapel that appeared at the edge of the woods. A visitor~' },
        { foe: 'ignis', side: true, from: 'luxuria', at: [95, 93], title: 'The Ritual Room', text: 'Candles flare in the chapel basement. Ignis did not want you to find this room.' },
        { foe: 'doloria', side: true, from: 'ignis', at: [85, 95], title: 'Twenty Years in a Veil', text: 'The ritual woke something in Sister Doloria. She remembers who she was.' },
      ] },

    // ================================================================ Act 3
    { id: 'cherry', title: 'The Cherry Blossom Rift', map: 'maps/bloodline.webp', w: 1280, h: 720, size: 2200, color: '#ff8fc6',
      music: 'calm', bg: 'sakura',
      quests: [
        { id: 'petals', at: [33, 90], title: 'Petals', text: 'You wake under a giant cherry tree. Someone is very happy to see you.',
          scene: { bg: 'sakura', music: 'calm', lines: [
            ['*', "Petals. Soft grass. A cherry tree older than anything you've ever seen."],
            ['hayley-kate', 'scared', '{name}? You okay? I think we fell through about six skies.'],
            ['rimu-hiraga', 'excited', "THERE you are! The whole village has been looking for you! Wait, why are you dressed so weird? And who's the ginger?"],
            ['hayley-kate', 'angry', 'The ginger has a NAME.'],
            ['rimu-hiraga', 'happy', "The shogun sent for you. His heir! You! We've been best friends since we were five, remember? ...You remember, right?"],
            ['*', "You don't. And somehow, you also do. The shard is warm again, with two faint beams now."],
            ['*', 'One points to a palace on the far hills. The other, to a very modern school that does NOT belong in old Japan.'],
          ] } },
        { foe: 'rimu-hiraga', at: [45, 79], title: 'Childhood Friend', text: 'Rimu wants to make sure the future shogun can still hold his own. Also, she missed you.',
          before: [
            ['rimu-hiraga', 'excited', "Before the palace: practice! The next shogun can't lose to his best friend. That would be embarrassing. For you!"],
          ],
          after: [
            ['rimu-hiraga', 'happy', "Hehe, you're still you. I'm with you, always! So, the palace? Or... that castle made of windows? Girls in uniforms keep coming out of it."],
            ['hayley-kate', 'neutral', "That's a school, Rimu."],
            ['rimu-hiraga', 'scared', 'A SCHOOL? For GIRLS? Made of GLASS?'],
          ] },
        { foe: 'yumi', at: [55, 66], title: 'A Dolphin in Disguise?', text: 'Shirayuki Academy for Girls appeared in the rice fields. A dreamy student wanders out to meet you.',
          before: { bg: 'Shirayuki Front gates', lines: [
            ['yumi', 'happy', 'Oh! A boy? At Shirayuki? Are you a dolphin in disguise?'],
            ['hayley-kate', 'happy', '...I actually kind of love that question.'],
            ['yumi', 'neutral', "The headmistress found a shiny rock in the garden. It sings at night. Like dolphins. Let's play cards and find out if you're one~"],
          ] },
          after: [
            ['yumi', 'excited', "Not a dolphin! But close. The headmistress is inside. She doesn't like visitors. Or feelings."],
          ] },
        { foe: 'helga', at: [66, 59], title: 'Detention', text: "Shirayuki's headmistress keeps a second shard. She doesn't hand things to boys.",
          before: [
            ['helga', 'neutral', '...A boy. From another world. Holding a piece of the stone from my garden.'],
            ['helga', 'neutral', 'This stone arrived with the academy. It pulls toward yours. I will not give it to a stranger.'],
            ['helga', 'proud', '...You wish to take it. Then play.'],
          ],
          after: [
            ['helga', 'neutral', '...Proceed.'],
            ['*', 'She sets the second shard in your palm. The two pieces click together like they missed each other.'],
            ['hayley-kate', 'excited', "It's pointing up now! Past the palace, to the mountains!"],
          ] },
        { foe: 'shino-okita', at: [74, 84], title: 'Bodyguard', text: "The shogun's swordswoman has been ordered to protect the heir. She has doubts.",
          before: [
            ['shino-okita', 'neutral', '...So you are the heir. You vanish for three days and come back with a foreign girl and a glowing stone.'],
            ['shino-okita', 'neutral', 'If I am to guard you, show me you are worth it.'],
          ],
          after: [
            ['shino-okita', 'happy', '...I will protect you.'],
            ['shino-okita', 'neutral', 'Lady Sakura waits at the palace gate. She is... less calm than I am.'],
          ] },
        { foe: 'sakura-tooyama', at: [86, 75], title: 'Father Chose YOU?', text: "The shogun's daughter is furious that some stranger is the heir.",
          before: [
            ['sakura-tooyama', 'angry', "Father chose YOU? You can't even hold chopsticks right!"],
            ['hayley-kate', 'neutral', "That's fair, actually."],
            ['sakura-tooyama', 'proud', "Hmph! Beat me, or I'll never accept it!"],
          ],
          after: [
            ['sakura-tooyama', 'sad', "...Hmph. Fine. Keep up, heir. Father's waiting."],
          ] },
        { foe: 'shogun-kagetora', at: [93, 63], title: 'The Bloodline', text: 'The shogun waits at the palace gate. One last trial.',
          before: [
            ['shogun-kagetora', 'neutral', 'Rise, heir of the bloodline. My scouts say the sky over the mountains is torn, and something laughs inside it.'],
            ['shogun-kagetora', 'neutral', 'A shogun does not run from what threatens his people. Neither will his heir.'],
            ['shogun-kagetora', 'proud', 'One last trial before the bloodline is yours.'],
          ],
          after: [
            ['shogun-kagetora', 'happy', 'The bloodline has its heir. Go. Bring the sky back in one piece.'],
          ] },
        { id: 'torn-sky', at: [83, 54], title: 'The Torn Sky', text: 'Above the mountains, the sky is ripped wide open.',
          scene: { bg: 'mountain path', music: 'melancholy', lines: [
            ['*', "The two shards, joined, point straight at a tear above the mountains. It's huge. It's growing."],
            ['rimu-hiraga', 'sad', "You're leaving again, aren't you. ...Come back. The heir has to come back."],
            ['hayley-kate', 'happy', 'We will! We always do. Right, {name}?'],
            { fx: 'rift', sfx: 'warp' },
            ['*', 'You step into the tear. Petals follow you in.'],
          ] } },
        // side quests
        { foe: 'mai-yamanobe', side: true, from: 'rimu-hiraga', at: [36, 72], title: 'Dango on the House', text: 'Mai the shopkeeper will give you dango for free. If you win.' },
        { foe: 'aoi-kananori', side: true, from: 'rimu-hiraga', at: [22, 93], title: 'The Heir in the Stories', text: 'Aoi has read every story about heirs. They always have to prove themselves.' },
        { foe: 'ayaka-yamanami', side: true, from: 'rimu-hiraga', at: [50, 92], title: "Big Sister's Lesson", text: 'Ayaka adjusts her glasses. Her little lord needs a lesson.' },
        { foe: 'bandit', side: true, from: 'shino-okita', at: [96, 88], title: 'Ransom', text: 'A pipe glows in the night forest. A bandit wants the heir as ransom. Or a card game.' },
        { foe: 'eri', side: true, from: 'yumi', at: [46, 64], title: 'Not Because I Care', text: 'Eri will test the boy at Shirayuki herself. Not because she cares, baka!' },
        { foe: 'suzu', side: true, from: 'yumi', at: [62, 76], title: 'Written in the Stars', text: "Suzu's stars said she'd meet a strange new girl today. You'll have to do." },
        { foe: 'ai', side: true, from: 'yumi', at: [58, 88], title: 'Biggest Fan', text: "Ai is the world's biggest fan-girl, and she's decided you're her rival for sensei." },
        { foe: 'misaki', side: true, from: 'yumi', at: [70, 70], title: 'Cousin Sensei', text: 'Your cousin teaches here, apparently. Beat her and she grades your homework.' },
        { foe: 'evil-villainess-chan', side: true, from: 'eri', at: [76, 62], title: 'OHOHOHO!', text: 'The most devious girl at Shirayuki has built a coliseum in the auditorium, desu!' },
        { foe: 'arisa', side: true, from: 'helga', at: [58, 58], title: 'Student Council Tea', text: 'Arisa-chan just wants to be friends~ Of course, friends do what Arisa-chan says.' },
      ] },

    // ================================================================ Act 4
    { id: 'peaks', title: 'Where All Worlds Meet', map: 'maps/legend_of_you.webp', w: 1920, h: 1080, size: 2500, color: '#8a7cff',
      music: 'hills-and-meadows-dragon-quest-9', bg: 'Fantastic Landscape [Mountains]',
      quests: [
        { id: 'foothills', at: [43, 93], title: 'The Foothills', text: 'A stone trail at the foot of the Peaks. A mountain town is just down the road.',
          scene: { bg: 'Outskirts of city', music: 'village-1', lines: [
            ['hayley-kate', 'excited', 'Mountains! Stars! A cute little town! Where ARE we?'],
            ['*', 'A sign: WELCOME TO ASHEVILLE. Under it, someone has scratched: "and the Core, and Dalmavilla, and whatever this is."'],
            ['*', 'Up the trail, worlds are stacked like books on a shelf: a mountain town, a guild hall, a castle. At the very top, the sky swirls like a drain.'],
            ['hayley-kate', 'neutral', "She's up there. Doe. And she's pulling everything toward her."],
          ] } },
        { foe: 'lisa-reed', at: [34, 80], title: "Someone's in Your Bed", text: 'In Asheville you have a room. In your room there is Lisa. Lisa does not move.',
          before: [
            ['lisa-reed', 'neutral', "...Oh. You're back. I was keeping your bed warm. For three days."],
            ['hayley-kate', 'angry', 'WHO is THIS?'],
            ['lisa-reed', 'neutral', "Lisa. LLL Club. Lazy, Lounging... I forget the third one. Beat me at cards and maybe I'll move. Maybe."],
          ],
          after: [
            ['lisa-reed', 'sad', "Ugh. Fine. Moving. ...Hey. The mayor's son found a glowing rock on the mountain yesterday. He's wearing it like a crown. Just saying."],
          ] },
        { foe: 'deiste-junko', at: [45, 66], title: 'The Dragon King', text: "Deiste, the mayor's son, found a shard on the mountain and crowned himself king of Asheville.",
          before: [
            ['deiste-junko', 'proud', 'Livin\' it like a dragon! The king is I! This shiny rock chose ME!'],
            ['hayley-kate', 'neutral', "It's a piece of a multiverse compass."],
            ['deiste-junko', 'excited', "A KING'S multiverse compass! Kneel, or play!"],
          ],
          after: [
            ['deiste-junko', 'sad', 'My crown... Fine. Take it. Kings share. Sometimes.'],
            ['*', 'The third shard clicks into place. The compass is almost whole. It hums a note that makes the stars shiver.'],
          ] },
        { foe: 'miracle', at: [62, 58], title: 'Guild Registration', text: 'Further up, the trail runs into an adventurers\' guild. The receptionist has been waiting for you. Specifically you.',
          before: [
            ['miracle', 'excited', 'Welcome back~ I knew you would come. I always know. ♥'],
            ['hayley-kate', 'scared', 'Do you... know her?'],
            ['miracle', 'happy', 'Every adventurer who climbs the Peaks registers with me. Your next quest is a match with me. Just us two. ♥'],
          ],
          after: [
            ['miracle', 'happy', 'Registered! S-rank, obviously. ♥ Careful up there. The Saintess went up the trail to "love" the laughing lady in the sky, and now she\'s blocking the way.'],
          ] },
        { foe: 'valse', at: [80, 56], title: 'Gentle Mercy', text: "Valse the Saintess blocks the upper trail. She wants to join Doe's one-story world, out of love.",
          before: [
            ['valse', 'happy', "Welcome, dear. You're climbing to the summit. To stop her."],
            ['valse', 'neutral', "But she offers one world. One story. Nobody lonely ever again. Isn't that love?"],
            ['you', 'Not if nobody gets to be themselves.'],
            ['valse', 'proud', 'Then let me love you too. Gently. Everything I do is out of love.'],
          ],
          after: [
            ['valse', 'sad', "...Perhaps a love that erases people isn't love at all. Go, dear. I'll pray for the lonely one up there."],
          ] },
        { foe: 'flora-aquila', at: [36, 47], via: [[64, 46]], title: 'Touch Some Grass', text: 'The trail runs through the Dalmavilla woods. A plant girl leaps out of a bush.',
          before: [
            ['flora-aquila', 'excited', 'A challenger in MY woods?! PREPARE THYSELF!'],
            ['hayley-kate', 'happy', "Hi! We're just passing thro—"],
            ['flora-aquila', 'proud', 'NONE SHALL PASS without a duel most leafy!'],
          ],
          after: [
            ['flora-aquila', 'happy', "Ha! Thou art worthy! Beware the castle ahead. Princess Beatrice wants the sky-hole's power, and she has gone totally loopy about it."],
          ] },
        { foe: 'beatrice-avalistos', at: [27, 34], title: 'CEDERE', text: "Princess Beatrice wants Doe's power for herself, and your compass is the key.",
          before: [
            ['beatrice-avalistos', 'proud', 'Fufufu... my little pawn came back. With the key to the sky, no less.'],
            ['beatrice-avalistos', 'happy', 'That deer thinks she will rule every story. How quaint. Essentia that strong belongs to royalty. To ME.'],
            ['beatrice-avalistos', 'proud', 'Now, look into my eyes. HORA-HORA-HORA!'],
          ],
          after: [
            ['beatrice-avalistos', 'angry', 'Tch! Fine! Go get flattened by the deer. See if I care.'],
            ['beatrice-avalistos', 'neutral', '...If you do win, though, bring me a souvenir.'],
          ] },
        { id: 'the-summit', at: [26, 21], title: 'Where All Worlds Meet', text: 'The top of the Peaks. Every rift ends here.',
          scene: { bg: 'mountain top', music: 'doomsday-clock-midnight', lines: [
            ['*', 'At the summit the sky is a whirlpool of worlds. You can see them all: your town, New Haven, the cherry tree, the guild. Spinning into one.'],
            ['doe', 'excited', "¡Hola! The main character is here~ Oh wait. That's ME now."],
            ['doe', 'proud', 'Look at them, cariño. Every story together, on one stage. And every light pointed at me.'],
            ['hayley-kate', 'angry', "You're crushing them! The worlds are falling apart!"],
            ['doe', 'sad', "...They'll be fine. They'll be MINE. That's better than fine."],
            { fx: 'flash', sfx: 'fanfare' },
            ['*', 'Then you hear voices behind you. The compass flares, and the rifts open the other way.'],
            ['maria-hunley', 'proud', "Nobody tears up MY kid's sky."],
            ['monika', 'happy', "Told you. I'm good at strange."],
            ['lilith', 'proud', 'The Queen of Hell RSVP\'d!'],
            ['diana', 'excited', "The gateway's holding, friend! Go!"],
            ['*', "Everyone you've met is here. The whole deck."],
          ] } },
        { foe: 'doe', at: [29, 8], title: 'Everyone Looks at Me', text: 'Doe, at the heart of the rift. The last battle.',
          before: [
            ['doe', 'angry', "You brought FRIENDS? That's cheating! Main characters don't need friends!"],
            ['you', "That's the only reason they get to be main characters."],
            ['doe', 'rage', "Then let's see whose story this is!"],
          ],
          after: { music: 'the-story-continues', lines: [
            ['doe', 'sad', "...Nobody ever looks at me. On every Earth I'm the side character. The weird deer in the lab coat."],
            ['hayley-kate', 'happy', "We're looking at you right now."],
            ['diana', 'happy', 'And you built a rift compass. From scratch! ¡Increíble!'],
            ['doe', 'scared', '...You think so?'],
            ['*', "The whirlpool slows. The worlds drift back to where they belong, but the rifts don't close. They settle into something softer. Doors."],
          ] } },
        { id: 'epilogue', at: [47, 23], title: 'Home', text: 'Every story back where it belongs. With a few new doors.',
          scene: { bg: 'Our Home from the outside', music: 'reunion', lines: [
            ['*', "Back home, Mom has cooked for forty. It isn't enough."],
            ['maria-hunley', 'happy', 'Come here, sweetie!'],
            ['julie-hunley', 'excited', 'THE SHARK LADY IS IN THE KITCHEN!'],
            ['rirarra-charca', 'happy', 'Hi, little humans!'],
            ['doe', 'neutral', '...Thank you for inviting me. Nobody ever invites me.'],
            ['monika', 'happy', 'Every story has a "you" at its center. It\'s just nicer when that "you" has all of us.'],
            ['hayley-kate', 'excited', "So! Who's up for cards?"],
            ['*', 'THE END. For now. The doors between the worlds stay open: side quests and rematches wait on every map.'],
          ] } },
        // side quests
        { foe: 'claire-larone', side: true, from: 'lisa-reed', at: [22, 88], title: 'Six Languages', text: "Claire knows the rules in six languages. You're new too? Let's play." },
        { foe: 'betty-glee', side: true, from: 'lisa-reed', at: [14, 74], title: 'Scarred Club', text: 'Betty, president of the Scarred Club, blocks the gym doors. You get past her first.' },
        { foe: 'olivia', side: true, from: 'lisa-reed', at: [55, 88], title: 'Lucky Latte', text: "First latte's free at the Lucky Latte. If you win a round, sweetie." },
        { foe: 'mason-moose', side: true, from: 'lisa-reed', at: [60, 76], title: 'Signature Required', text: 'Mason at the post office has a package for you. Signature required, in the form of a card game.' },
        { foe: 'dan-birk', side: true, from: 'lisa-reed', at: [25, 64], title: 'Skipping Shift', text: "Dan should be working at his dad's store. Instead he's on a rooftop." },
        { foe: 'benjamin-birk', side: true, from: 'dan-birk', at: [12, 58], title: 'We Settle This Properly', text: 'Benjamin found out who helped his boy skip his shift.' },
        { foe: 'serris', side: true, from: 'miracle', at: [70, 70], title: 'Things Keep Happening', text: 'Serris the white mage keeps running into you. Things keep HAPPENING around you.' },
        { foe: 'faneel', side: true, from: 'miracle', at: [76, 82], title: 'Coin Purse', text: 'Faneel is holding your coin purse. She found it. Totally.' },
        { foe: 'ruby', side: true, from: 'miracle', at: [88, 72], title: 'Good Deal, Yes?', text: 'Ruby the merchant has a deal: you win, you buy. You lose, you also buy.' },
        { foe: 'melise', side: true, from: 'miracle', at: [93, 50], title: 'Lesser Being', text: 'Melise the elf "archer" found a lesser being wandering the ancient ruins. How cute.' },
        { foe: 'ophelia', side: true, from: 'valse', at: [70, 44], title: 'The Voice', text: "Ophelia hears a voice. It wants to know if you're naughty." },
        { foe: 'shirayukihime', side: true, from: 'valse', at: [86, 36], title: 'A Duel Most Glorious', text: 'A kitsune swordswoman on the mountainside is desperate for a worthy foe.' },
        { foe: 'hed', side: true, from: 'flora-aquila', at: [18, 46], title: 'Five Bucks', text: 'A floating head wants to play for five bucks. You pay first, tho.' },
        { foe: 'pepita-pazzarella', side: true, from: 'flora-aquila', at: [12, 34], title: 'Per Favore!', text: 'Pepita the castle chef wants you OUT of her kitchen. After one game.' },
        { foe: 'kuku-hanetsu', side: true, from: 'flora-aquila', at: [40, 36], title: "Next Round's on the House", text: 'Kuku the fairy bartender: beat her and the next round is on the house, sugar.' },
        { foe: 'julia-aquacrucis', side: true, from: 'flora-aquila', at: [46, 45], title: 'S-Sorry!', text: "Sister Julia has been told to test you. She's very sorry about it." },
        { foe: 'priest-pristo', side: true, from: 'julia-aquacrucis', at: [40, 26], title: 'Light of Lies', text: 'Father Pristo has pointed teeth, and in his church time works how he says.' },
        { foe: 'curtis-vongravis', side: true, from: 'beatrice-avalistos', at: [16, 22], title: 'Not an Imbecile', text: "The princess's lieutenant knight demands proof that you are not an imbecile." },
        { foe: 'lily', side: true, from: 'valse', at: [60, 68], title: 'The Lost Young Master', text: 'A tiny fairy offers to show the lost young master the way. For a game.' },
        { foe: 'emily', side: true, from: 'lily', at: [66, 80], title: 'In the Vines', text: 'Emily hides behind the vines. A g-game? If you want to...' },
        { foe: 'nina', side: true, from: 'lily', at: [86, 88], title: 'Story Time', text: 'Nina sets down a basket of grapes. A little game, then a story.' },
        { foe: 'kira', side: true, from: 'lily', at: [58, 42], title: 'My Forest', text: 'Something growls from the riverbank.' },
        { foe: 'nerida', side: true, from: 'lily', at: [76, 30], title: 'By the Water', text: 'A mermaid on the pier invites the noble one to play.' },
        { foe: 'charlotte', side: true, from: 'lily', at: [92, 62], title: 'Dinner Is Served', text: 'The maid says Madam insists you win a game before dinner.' },
        { foe: 'sophia-vinelace', side: true, from: 'charlotte', at: [96, 78], title: "Not Like I Waited", text: "Your sister closes the piano. She definitely didn't wait for you." },
        { foe: 'anna-vinelace', side: true, from: 'sophia-vinelace', at: [95, 26], title: 'The Vinelace Name', text: 'The lady of the house descends the staircase. Show her you are worthy of the name.' },
      ] },
  ];

  // a line's mood -> the sprite role showing it (the manifest names them by battle role)
  const MOODS = { neutral: 'idle', happy: 'play', angry: 'attack', rage: 'special', scared: 'hurt', sad: 'lose', excited: 'win', proud: 'taunt' };
  const LEVEL = { hp: [20, 44], ai: [0.25, 1] };
  const BOSS_HP = 2; // a boss rival's extra HP

  // ---------------------------------------------------------------- the quest list
  const QUESTS = [], byId = new Map();
  MB.ACTS.forEach((act, a) => act.quests.forEach((q) => {
    q.id = q.id || q.foe;
    q.act = a;
    q.main = !q.side;
    q.stage = q.foe ? MB.STORY.findIndex((st) => st.foe === q.foe) : null;
    QUESTS.push(q);
    byId.set(q.id, q);
  }));
  const MAIN = QUESTS.filter((q) => q.main);
  const byStage = new Map(QUESTS.filter((q) => q.stage != null).map((q) => [q.stage, q]));

  // a quest fought by a rival of a hidden chapter (NSFW mode off)
  const hidden = (q) => q.stage != null && q.stage >= 0 && !!MB.CHAPTERS[MB.STORY[q.stage].chapter].hidden;
  const isDone = (s, q) => !!q && s.quests.includes(q.id);
  // playable: done already, or the main quest before it is done (main), or the quest it follows is (side)
  function isOpen(s, q) {
    if (hidden(q)) return false;
    if (isDone(s, q)) return true;
    if (q.main) { const k = MAIN.indexOf(q); return k === 0 || isDone(s, MAIN[k - 1]); }
    return isDone(s, byId.get(q.from));
  }
  // the next main quest to play (null once the story is done)
  const next = (s) => MAIN.find((q) => !isDone(s, q)) || null;
  const actOpen = (s, a) => MB.ACTS[a].quests.some((q) => isOpen(s, q));
  const lastOf = (a) => MAIN.filter((q) => q.act === a).pop();

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

  // the Story stages (indexes into MB.STORY) a save has cleared
  const clearedStages = (s) => QUESTS.filter((q) => q.stage != null && q.stage >= 0 && isDone(s, q)).map((q) => q.stage);

  // how far along the main story a quest sits, 0..1: main fights in order, a side quest just past what opened it
  const battles = MAIN.filter((q) => q.foe);
  function progressOf(q, depth = 0) {
    if (q.main) {
      const k = battles.filter((b) => MAIN.indexOf(b) <= MAIN.indexOf(q)).length - (q.foe ? 1 : 0);
      return Math.max(0, Math.min(1, k / (battles.length - 1)));
    }
    const from = byId.get(q.from);
    return from ? progressOf(from, depth + 1) + 0.02 * (depth + 1) : 0;
  }
  // HP and AI skill of every Story rival from where its quest sits in the story
  QUESTS.forEach((q) => {
    if (q.stage == null || q.stage < 0) return;
    const t = Math.min(1, progressOf(q)), st = MB.STORY[q.stage];
    st.hp = Math.round(LEVEL.hp[0] + (LEVEL.hp[1] - LEVEL.hp[0]) * t) + (MB.BOSSES[st.foe] ? BOSS_HP : 0) + (q.side ? 1 : 0);
    st.ai = Math.round((LEVEL.ai[0] + (LEVEL.ai[1] - LEVEL.ai[0]) * t + (q.side ? 0.05 : 0)) * 100) / 100;
    st.ai = Math.min(1, st.ai);
  });

  // a scene as { bg, music, lines }; bg/music default to the quest's fight, then the act
  function sceneOf(q, part) {
    const raw = q[part];
    if (!raw) return null;
    const sc = Array.isArray(raw) ? { lines: raw } : raw, st = q.stage != null && q.stage >= 0 ? MB.STORY[q.stage] : null, act = MB.ACTS[q.act];
    return { bg: sc.bg || (st ? st.bg : act.bg), music: sc.music || (st ? st.music : act.music), lines: sc.lines };
  }
  // a line as { who, role, text } or a stage direction { bg | music | fx | sfx | hide }
  function lineOf(l) {
    if (!Array.isArray(l)) return l;
    const [who, a, b] = l;
    return b === undefined ? { who, role: 'idle', text: a } : { who, role: MOODS[a] || 'idle', mood: a, text: b };
  }

  // old saves counted cleared stages per chapter, in order; their cleared stages become done quests
  function migrate(s) {
    const progress = Array.isArray(s.progress) ? s.progress : [], seen = {};
    const cleared = MB.STORY.map((st, i) => ((seen[st.chapter] = (seen[st.chapter] || 0) + 1) <= (progress[st.chapter] | 0) ? i : -1)).filter((i) => i >= 0);
    s.quests = cleared.map((i) => byStage.get(i)).filter(Boolean).map((q) => q.id);
    s.storyActs = [];
    delete s.progress;
  }

  MB.Story = { quests: QUESTS, main: MAIN, byId: (id) => byId.get(id), byStage: (i) => byStage.get(i), hidden, isDone, isOpen, next, actOpen, lastOf,
    complete, clearedStages, sceneOf, lineOf, migrate, progressOf, MOODS, LEVEL };
})();
