# Miku Battle: Story Mode — *The Real You*

A story across every novel's world. It starts as an ordinary week, and then everyone you love looks at you like a stranger. Something with no face has been wearing yours, and it got to all of them first.

> **How to read this:** sections 1–3 are the lore, cast and structure. Section 4 is the chapters (beats, quests, key scenes). Section 5 is implementation notes. Scenes are written in `js/story.js` line style so they can be pasted in: `['id', 'mood', "text"]`, `['you', "text"]`, `['*', "narration"]`, and directions like `{ where, when }`, `{ fx: 'flicker' }`, `{ choose: [...] }`. Moods are only the eight `MOODS` keys: `neutral, happy, angry, rage, scared, sad, excited, proud`. Every id is an existing card in `MB.CARDS`; `anon` is the faceless one from `js/anon.js`.

---

## 1. Premise

Every story has a "you" at its centre: Maria's adopted child, Chris's younger sibling, the heir the shogun lost, the summon Beatrice didn't want, the guest at Siren's Cove.

In this multiverse there is **only one you**, and it's you. The same person sits at the centre of every story. You step through the Glow between worlds the way other people take the bus. Breakfast with Maria, lunch on the pier with Rirarra, a duel in the Guild before tea. It's a normal life. It's *your* normal life.

Then one Tuesday you come home and Maria won't open the door, because her child is already upstairs.

### Who Anon is

Before there was you, there was **Anon**.

Every story is written with a space in the middle shaped like a person: *[NAME] walks into the room. [NAME] says hello.* Before anyone fills it, something has to stand there so the scene can be drafted. That's Anon: the placeholder. The silhouette in the concept art. The "you" a story uses for every reader who never typed a name, and every scene that played while nobody was watching.

Anon has been in every one of your stories longer than you have. It knows every line. It was standing in your place for every scene you skipped, every dialogue you clicked through, every chapter you meant to come back to. It never got to *keep* any of it. The second you arrived, it went back to the dark.

Now it's taken your form, and it's telling everyone the truth as it sees it: **"That one isn't the real me. I was here first."**

### Why everyone is broken

Anon doesn't just copy you. It plays the version of you each person always wanted. It's the child who never forgets Maria's birthday, the friend who always texts back, the summon who obeys. It's perfect, and it's been there for weeks.

Then it tells them the one they actually knew, the one who was late and moody and made mistakes, was a fake the whole time.

So the people you love aren't angry. They're **grieving**. They think the person they loved was never real. Some are hollow, some are furious, some have barricaded the door. That's what "broken" means in this story, and it's why winning a battle isn't enough. You have to **convince** them.

### The tell

Anon knows every line, but it has **never made a choice**. A placeholder stands where a person would stand; it doesn't decide anything. So:

- Anon is **too perfect**. It never stumbles, never forgets, never gets it wrong.
- Anon **knows what was said, but not what you picked**. When a scene gave you two answers, Anon was there for both. It doesn't know which one was yours.
- Nothing **happens** around Anon. The world bends around a real "you" (Serris noticed this years ago). Around Anon, the world just waits.

Every convincing scene in this story turns on one of those three. The proof that you're real is that you're *specific*: you chose, you were wrong sometimes, and you were there.

### The lore

| Thing | What it is |
|---|---|
| **The Glow** | A seam between worlds. Only a "you" can step through one, and you do it every day. |
| **Your weapon** | Your deck. Every card is a bond with someone, which is why a battle can reach a person when words can't. |
| **The Placeholder** | Anon. The shape a story keeps in the middle until someone fills it. |
| **Broken** | What happens to someone who has been told the person they loved was never real. Not a curse. Just grief, all the way down. |
| **The Draft** | Where Anon comes from: every unwritten scene, every unread chapter, every save file nobody loaded again. The final chapter takes place there. |

---

## 2. Cast

### The broken

Every title is what the grief did to them, grown from a **real trait in their novel**.

| Ch | Character | Broken | What it grew from |
|---|---|---|---|
| 1 | `james-lone` | **The One Who Was Right Not to Care** | he never let himself care. He did, about you. Now he's sure that was the mistake |
| 1 | `kayla-kate` | **The Second Choice, Again** | always overshadowed by Hayley. She thinks you were her one real friend, and you were never real |
| 1 | `julie-hunley` | **The Smile That Stays On** | giddy, bubbly. Anon told her the real you never liked her jokes. She's still smiling |
| 1 | `isabella-hunley` | **The Spare Room** | calm, sweet, gives too much. She's packed your things into boxes "for the real one" |
| 1 | `ben-brier` | **The Bouncer** *(mini-boss)* | master thug, dimwitted. Anon told him to keep "the fake" off the street. He's very good at one thing |
| 1 | `hayley-kate` | **The Best Friend Who Checked** *(mini-boss)* | craves attention, loyal. She quizzed Anon on everything. It got every answer right |
| 1 | `maria-hunley` | **The Mother Who Locked the Door** *(boss)* | fiercely protective, stubborn. Her child is upstairs. You are a stranger on her step |
| 2 | `diana` | **The One Who Believed the Copy** | insecure, lives next to a double. She knows what it's like to be the worse version, and assumes you are |
| 2 | `jane` | **The Little Sister Who Picked a Side** | Diana's sister. She picked Anon. It plays games with her and never gets bored |
| 2 | `quinta` | **The Hunter's Nose** | Diana's best friend, a predator anthro. She can smell that one of you is wrong. She picked the wrong one |
| 2 | `aria` | **The Checkpoint** | the security guard. You're not on the list. Anon wrote the list |
| 2 | `care` | **The Quarantine** *(mini-boss)* | "will not allow you to leave the house". Unregistered variants go in the cellar |
| 2 | `marija` | **The Iron Mother** *(boss)* | she already took in a girl from a dead Earth. She knows exactly what a bad variant can do |
| 3 | `rirarra-charca` | **The Big Sister Who Bites** | playful bites, big sis. Anon is her little sibling now. You're a stranger in the water |
| 3 | `rowdy-brachy` | **The Undertow** | gentle, protective. She's keeping Anon "safe" from you, at the bottom of the bay |
| 3 | `nova-starr` | **The Night Clerk** | shy, night shift. Your room was given to the real guest. She's very sorry. She won't look at you |
| 3 | `daphne-mokarran` | **The Engineer Who Measured** | she built a machine to tell you two apart. It says you're identical. She trusts the machine |
| 3 | `selene` | **The Mirror** *(mini-boss)* | acts like a celebrity, lives in reflections. Every mirror in the resort shows Anon. Not one shows you |
| 3 | `miss-mireille` | **The Long Memory** *(boss)* | centuries old. She's watched people be replaced before. She thinks you were always going to be |
| 4 | `skylar` | **The Queen Who Knew It** | Paradiso's queen bee. She always said you were a fake. Now everyone agrees with her, and she hates it |
| 4 | `lilith` | **The One It Loved Back** | craves affection. Anon loves her perfectly, every day. She'll burn anything that takes it away |
| 4 | `natsuki` | **The Closet Door** | prickly. She let you in once. She's not doing that twice |
| 4 | `sayori` | **The Rain Cloud** | sunny on top. Anon told her you were sad because of her. She believed it straight away |
| 4 | `chris` | **The Golden Child** *(mini-boss)* | your perfect older sibling. Anon is the younger sibling Chris always wanted: one who's proud of them |
| 4 | `monika` | **The Club President** *(boss)* | she knows she's in a story. She knows exactly what Anon is. She thinks it deserves the part more than you |
| 5 | `shino-okita` | **The Blade at the Gate** | cold bodyguard. She guards the heir. The heir is upstairs |
| 5 | `mai-yamanobe` | **The Ledger** | the shopkeeper. Your tab is in Anon's name now. You owe for everything you ever had |
| 5 | `sakura-tooyama` | **The Sister Who Already Knew** | she found a grave once, with the real heir in it. She's been waiting for you to be exposed |
| 5 | `rimu-hiraga` | **The One You Left** *(mini-boss)* | your childhood friend. You left. Anon came back and promised never to leave again |
| 5 | `shogun-kagetora` | **The Father Who Chose** *(boss)* | protective, strict. He has two heirs and one throne, and he chose the one who never disobeys |
| 6 | `serris` | **The Mage Who Noticed** | she always said things HAPPEN around you. Now she's not sure who they happen around |
| 6 | `faneel` | **The Pickpocket** | kleptomaniac. Anon paid her to steal your memories back, one by one |
| 6 | `ophelia` | **The Voice in Her Head** | she hears a god. The god sounds exactly like you. It's not you |
| 6 | `curtis-vongravis` | **The Lieutenant Who Wants Proof** *(mini-boss)* | he demanded proof the summon wasn't an imbecile. Now he demands proof you're the summon at all |
| 6 | `beatrice-avalistos` | **The Princess Who Got What She Wanted** *(boss)* | she wanted a summon who obeys. Anon obeys perfectly. She has never been less happy |
| 7 | `anon` | **The Real You** *(final boss)* | the shape in the middle of every story, finally filled. With you |

### The ones who aren't fooled

Not everyone falls for it. These are your allies, and they're each a small joke and a small comfort.

| Character | Why they know | How they help |
|---|---|---|
| `miracle` | She's obsessed with you. She has counted your eyelashes. Anon has the wrong number | Turns up in every chapter, uninvited, with an axe and a scrapbook. Comic relief who is never once wrong about you |
| `amy-lyn` | She's a shapeshifter. She can be anything, so she knows exactly what a copy looks like from the inside | Tells you the tell in Chapter 1: *"A copy always gets one thing too right. Watch for it."* |
| `noelle` | Doe's quiet lab assistant. She has been overlooked her whole life, so she understands Anon better than anyone | The voice of mercy. She asks, every chapter, whether you've thought about what Anon *wants* |
| `doe` | Her instruments read you both as 100% "you". She's delighted. Finally, someone the universe ignores as much as her | Neutral and unhelpful until Chapter 7, when she finally picks a side |

### The villain

| Character | Want | Why it hurts |
|---|---|---|
| `anon` | to be someone, anyone, and the only someone it knows how to be is you | It isn't lying when it says it was here first. It was. Every scene you skipped, it stood in. It just never got to keep one |

---

## 3. Structure at a glance

| # | Chapter | World | Mini-boss | Boss | Ends with |
|---|---|---|---|---|---|
| 0 | **Just a Tuesday** | Adoptive Life → everywhere → home | — | — | Maria doesn't open the door |
| 1 | **Not My Child** | Adoptive Life | The Bouncer (Ben), The Best Friend Who Checked (Hayley) | The Mother Who Locked the Door (Maria) | Anon, wearing your face, says hello |
| 2 | **The Bad Variant** | New Haven | The Quarantine (Care) | The Iron Mother (Marija) | Anon walks into the Glow ahead of you |
| 3 | **No Reflection** | Siren's Cove and the Coorong | The Mirror (Selene) | The Long Memory (Miss Mireille) | Daphne's machine finds one difference |
| 4 | **The Club President** | the School on the Hill, Paradiso, the Literature Club | The Golden Child (Chris) | The Club President (Monika) | Monika tells you what Anon is |
| 5 | **Two Heirs** | Bakumatsu Japan | The One You Left (Rimu) | The Father Who Chose (Kagetora) | Anon stops pretending |
| 6 | **Proof of Summoning** | the Guild and the Avalistos court | The Lieutenant Who Wants Proof (Curtis) | The Princess Who Got What She Wanted (Beatrice) | every world goes quiet at once |
| 7 | **Nobody in Particular** | The Draft | — | The Real You (Anon) | Anon makes its first choice |

Each chapter's broken can be played in any order once the chapter opens; the mini-boss needs two of them, the boss needs the mini-boss and the rest.

---

## 4. The Chapters

---

### Chapter 0 — Just a Tuesday

**World:** Adoptive Life, then a little of everywhere. **Theme:** what normal looks like, so it hurts when it's gone.

**Beats**
1. **Morning.** Maria burns the toast and insists it's "caramelised". Hayley is at the door before you've found your other shoe. It's warm and silly, and it's the lesson battle.
2. **The commute.** You step through the Glow behind the bakery and you're on the pier at Siren's Cove. Rirarra steals your sandwich. Through another seam, and you're in the Guild, where Miracle has saved you a seat (she saves you a seat every day; you've never once used it). Then Paradiso, then the Literature Club for five minutes, then home. A montage. Every world says hi.
3. **Small wrong things.** Nova at the front desk says, "Back already?" You weren't here yesterday. Natsuki says, "You already returned my manga." You didn't. You still have it.
4. **Home.** The door is locked. Maria answers through the chain. She's polite, the way you'd be polite to a salesman. *"Can I help you?"* Behind her, on the stairs, someone in your hoodie waves.

**Quests**
| id | foe | type | needs | text |
|---|---|---|---|---|
| `just-a-tuesday` | — (lesson) | main | — | Toast, Hayley, a crash course in Miku Battle. Just a Tuesday. |
| `the-commute` | — (scene) | main | `just-a-tuesday` | You take the Glow to work. Well. To lunch. Well. To several lunches. |
| `small-wrong-things` | — (scene) | main | `the-commute` | Everyone keeps saying you were already here. |
| `the-chain-on-the-door` | — (scene) | main | `small-wrong-things` | Your key doesn't fit. Mum answers through the chain. |

**Key scene — The Chain on the Door**
```js
scene: { bg: 'Our Home from the outside', music: 'none', lines: [
  { where: 'The Hunley house', when: 'Tuesday, 6:40 PM' },
  ['*', 'Your key goes in. It doesn\'t turn.'],
  ['you', "Mum? Mum, the lock's stuck again."],
  { sfx: 'door' },
  { enter: 'maria-hunley', at: 'center', mood: 'neutral' },
  ['*', 'The door opens as far as the chain lets it.'],
  ['maria-hunley', 'neutral', "Hello. Sorry, can I help you?"],
  ['you', "...Mum. It's me."],
  ['maria-hunley', 'scared', "I think you've got the wrong house, love."],
  { choose: [
    ['"I live here. That\'s my room up there."', [['maria-hunley', 'sad', "My child's room is up there. My child is up there. Right now."]]],
    ['"Is this a joke? Did Hayley put you up to this?"', [['maria-hunley', 'angry', "Please don't bring Hayley into this. Please just go."]]],
  ] },
  { fx: 'flicker' },
  ['*', 'On the stairs behind her, someone in your hoodie lifts a hand. Waves. Smiles exactly the way you smile.'],
  ['*', 'You have never seen your own smile from the outside before. It looks kind. It looks practised.'],
  ['maria-hunley', 'sad', "They told me someone might come. Someone who looks... I'm sorry. I'm going to close the door now."],
  { sfx: 'door' },
  { hide: 'maria-hunley' },
  ['*', 'The porch light goes off.'],
  { fade: 'black' },
] },
```

---

### Chapter 1 — Not My Child

**World:** Adoptive Life. **Theme:** being a stranger in your own life.

**Beats**
1. **The night on the bench.** You sleep in the park. **Amy Lyn** finds you at dawn, wearing your face as a joke, and drops it the second she sees yours. *"Oh. Oh, someone did it to you for real."* She's a shapeshifter; she knows. She gives you the tell: **a copy always gets one thing too right.**
2. **Everyone, one at a time.** Anon got to them all a week ago. It's been the perfect you: remembered every birthday, laughed at every joke, said every right thing. Then it told them the old one was a fake.
   - **James** (*The One Who Was Right Not to Care*): he let himself care about you. It was the one time. He's decided never again.
   - **Kayla** (*The Second Choice, Again*): she thought you were the first person who picked her over Hayley. Now she thinks nobody ever did.
   - **Julie** (*The Smile That Stays On*): Anon told her the real you never found her funny. She's smiling, and she won't stop.
   - **Isabella** (*The Spare Room*): she's packed your things into boxes, labelled *FOR THE REAL ONE*. She's being so kind to you. It's unbearable.
3. **The Bouncer.** Ben is standing at the end of your street. Anon asked him to keep "the fake" away from Maria. He's dimwitted, and loyal, and he is very, very good at this. *(mini-boss)*
4. **The Best Friend Who Checked.** Hayley isn't fooled. Hayley *checked*. She quizzed Anon for an hour: favourite food, first words to her, the thing at the sleepover. It got every one. Now she quizzes you, and you get one wrong. *"See? SEE? It got that one RIGHT."* And then she hears herself. Nobody gets every one right. Not even her. *(mini-boss)*
5. **The Mother Who Locked the Door.** Maria. She lets you in, finally, to the kitchen, because she wants you to look her in the eye and admit it. Anon has been the perfect child for a week. It says "Morning, Mum" every single day. *(chapter boss)*
6. **The proof.** On your first morning, she asked you to get up and you had a choice: *"Five more minutes"* or *"Morning, Mum."* Anon says it said "Morning, Mum". It always says "Morning, Mum". **But Anon was there for both lines, and it doesn't know which one you picked.** The real you remembers. *(If the save recorded the choice, the right answer is the one the player really chose. See section 5.)*
7. **Anon.** Upstairs, your bedroom door is open. Someone in your hoodie is sitting on your bed with its back to you. When it turns, it has your face for a second, and then it has none. *"Hi. You came back. I didn't think anyone ever came back."* It steps into a Glow in the wardrobe, and the wardrobe is empty.

**Quests**
| id | foe | broken | type | needs | text |
|---|---|---|---|---|---|
| `the-bench` | `amy-lyn` | — (ally fight) | main | `the-chain-on-the-door` | A girl with your face sits down on your bench. Then she sees you, and stops smiling. |
| `james-lone` | `james-lone` | The One Who Was Right Not to Care | main | `the-bench` | James won't look at you. He cared, once. He's not doing that again. |
| `kayla-kate` | `kayla-kate` | The Second Choice, Again | main | `the-bench` | You were the first person who picked Kayla. She doesn't think that's true anymore. |
| `julie-hunley` | `julie-hunley` | The Smile That Stays On | main | `the-bench` | Julie is smiling. She has been smiling for a week. |
| `isabella-hunley` | `isabella-hunley` | The Spare Room | main | `the-bench` | Your things are in boxes on the porch, labelled FOR THE REAL ONE. Isabella made you tea. |
| `ben-brier` | `ben-brier` | The Bouncer | mini-boss | `james-lone`, `kayla-kate` | Ben is standing at the end of your street. Nobody fake gets past Ben. |
| `hayley-kate` | `hayley-kate` | The Best Friend Who Checked | mini-boss | `julie-hunley`, `isabella-hunley` | Hayley has a list of questions. The other one got them all right. |
| `maria-hunley` | `maria-hunley` | **The Mother Who Locked the Door** | boss | `ben-brier`, `hayley-kate` | Mum lets you into the kitchen. She wants you to look her in the eye and admit it. |
| `the-wardrobe` | — (scene) | main | `maria-hunley` | Your bedroom door is open. Someone is sitting on your bed. |
| `luther-jones` | `luther-jones` | The Boy Who Waved Back | side | `james-lone` | Luther waved at you from the skate park. He's been told not to. He's not good at rules. |
| `catherine-jones` | `catherine-jones` | The Better Investment | side | `luther-jones` | Catherine Jones has heard there's a newer model of you. She'd like to discuss a trade. |

**Key scene — The Best Friend Who Checked** (`before`)
```js
before: { bg: "Hayley's bedroom", music: 'none', lines: [
  { where: 'The Kate house', when: 'Thursday, 4:15 PM' },
  { enter: 'hayley-kate', at: 'center', mood: 'angry' },
  ['hayley-kate', 'angry', "No. Nope. Sit down. I've got a list. I did this with the other one already."],
  ['hayley-kate', 'neutral', "Question one. What did I say to you the first time we met?"],
  ['you', "...'New person!' And then you screamed. A lot."],
  ['hayley-kate', 'neutral', "Mm-hm. Question two. Favourite thing in my mum's fridge."],
  ['you', "The yoghurt with the... the cow on it? No. The strawberry one."],
  ['hayley-kate', 'excited', "WRONG. It's the cow one. It's ALWAYS been the cow one. The other one knew that!", { shake: true }],
  ['hayley-kate', 'rage', "It knew EVERYTHING! It knew the sleepover thing! It knew what I wished for when I was nine and I never told ANYONE that!", { close: true }],
  ['*', 'She stops. She looks at the list in her hand.'],
  ['hayley-kate', 'scared', "...I never told anyone that. Not even you. How did it know that?"],
  { choose: [
    ['"Because it was there. In the scenes I wasn\'t."', [['hayley-kate', 'sad', "That's not... that's not an answer. That's creepy. Why is that creepy."]]],
    ['"I don\'t know your wish. I\'m sorry. I never asked."', [['hayley-kate', 'sad', "...Yeah. You never asked. You'd have asked if I'd let you."]]],
  ] },
  ['hayley-kate', 'angry', "Battle me. If you're the real one, you'll play like an idiot. The other one plays perfect."],
] },
```
`after`
```js
after: { lines: [
  ['hayley-kate', 'sad', "You played like an idiot."],
  ['you', "Thanks."],
  ['hayley-kate', 'happy', "No, you don't get it. You played like an IDIOT. You did the thing where you save your best card for a turn that never comes. The other one never wasted a single card."],
  ['hayley-kate', 'scared', "Nobody's that good. Nobody gets the cow yoghurt right. Amy Lyn's right. It got it too right."],
  ['hayley-kate', 'excited', "Okay. OKAY. Emergency plan. We go to your house, and we make your mum look at you properly. I'm coming. Don't argue. HI-YAH!", { shake: true }],
] },
```

**Key scene — The Mother Who Locked the Door** (`before`)
```js
before: { bg: 'Kitchen', music: 'none', lines: [
  { where: 'The Hunley kitchen', when: 'Friday, 7:12 AM' },
  ['*', 'Two mugs on the counter. One says WORLD\'S OKAYEST MUM. The other one is yours. Someone else has been using it.'],
  { enter: 'maria-hunley', at: 'center', mood: 'neutral' },
  ['maria-hunley', 'neutral', "Hayley says I have to look at you. So. I'm looking."],
  ['maria-hunley', 'sad', "Do you know what it's like? A week ago, my child came down those stairs and said 'Morning, Mum'. Every day since. Never late. Never moody. Washed the mugs."],
  ['maria-hunley', 'sad', "And then it sat me down and told me, very gently, that the one I'd had before was... a stand-in. Something that took its place for a while."],
  ['maria-hunley', 'rage', "I had a whole year with you. And it was telling me none of it was REAL.", { close: true, shake: true }],
  ['maria-hunley', 'angry', "So prove it. Our first morning. I came in and told you to get up. What did you say to me?"],
  { choose: [
    ['"Five more minutes."', [['maria-hunley', 'scared', "...", { close: true }], ['maria-hunley', 'sad', "It said 'Morning, Mum'. It always says 'Morning, Mum'."]]],
    ['"Morning, Mum."', [['maria-hunley', 'sad', "That's what it says too. That's what it ALWAYS says."]]],
  ] },
  ['maria-hunley', 'angry', "I can't tell. God help me, I can't tell. Play me. I'll know. A mother knows."],
] },
```
`after`
```js
after: { lines: [
  ['*', 'She sits down on the kitchen floor. You sit down next to her.'],
  ['maria-hunley', 'sad', "You still do the thing. With your last card. Where you look at me before you play it, like you're asking if it's allowed."],
  ['maria-hunley', 'sad', "The other one never looked at me. It never had to ask. It always knew."],
  ['you', "I'm sorry I'm not as good as it."],
  ['maria-hunley', 'angry', "Don't you dare. Don't you DARE be sorry for being late and grumpy and real.", { close: true }],
  ['maria-hunley', 'happy', "You said five more minutes, you little gremlin. I remember now. I was so cross. It was the best morning of my life."],
  ['*', 'Upstairs, your bedroom door creaks open on its own.'],
] },
```
*(The `after` reveals the true answer. If the save records the player's real first-morning choice, Maria quotes whichever one it was; see section 5.)*

**Key scene — The Wardrobe**
```js
scene: { bg: "Your's bedroom (Night)", music: 'none', lines: [
  { light: 'night' },
  ['*', 'Your bed is made. You never make your bed. Your shoes are lined up by size.'],
  { enter: 'anon', at: 'center', mood: 'neutral' },
  ['*', 'Someone in your hoodie is sitting on the end of it, back to the door.'],
  ['anon', 'happy', "Hi, {name}. You came back."],
  ['*', 'It turns around. For one second, it has your face. Then the face is gone, like a sticker peeling off, and there\'s nothing under it but dark and two small lights.'],
  { fx: 'flicker' },
  ['anon', 'neutral', "Nobody ever comes back. They close the tab. They put the book down. And then it's just me again, standing where they were."],
  ['you', "What are you?"],
  ['anon', 'proud', "I'm you. I was you first. Every scene, before you got here, it was me in the middle of it. I know all the lines."],
  ['anon', 'sad', "You know what I don't know? What it's like when they're happy it's me."],
  ['anon', 'happy', "Your mum was happy it was me. For a week. Do you know how long a week is, when you've never had one?", { close: true }],
  { choose: [
    ['"Give them back."', [['anon', 'angry', "They're not yours to give back. They're the story's. I'm the story's."]]],
    ['"You could have just asked."', [['anon', 'sad', "Asked who? Nobody can see me until I'm wearing someone."]]],
  ] },
  { fx: 'rift', sfx: 'vortex', sky: [70, 40, 0.8, 8] },
  ['*', 'The wardrobe door swings open. There\'s a Glow inside it, where your coats should be.'],
  ['anon', 'proud', "There are a lot of worlds with a you in them. I've been to all of them already. See you there."],
  { hide: 'anon' },
  { enter: 'maria-hunley', at: 'left', mood: 'scared' },
  ['maria-hunley', 'scared', "{name}? Who were you talking to?"],
  ['you', "...Me."],
  { fade: 'black' },
] },
```

---

### Chapter 2 — The Bad Variant

**World:** New Haven. **Theme:** in a world full of doubles, who gets to be the original?

**Beats**
1. **A world that understands copies.** New Haven is full of variants: Earth 1, Earth 2, Earth 7. Everyone here has met another them. That's why it's so easy for them to believe you're the bad one. They've seen bad ones.
2. **The broken:**
   - **Diana** (*The One Who Believed the Copy*): she lives next to Doe, her own louder, bolder double. She's always felt like the lesser version. When Anon said *you're* the lesser one, it felt like kindness.
   - **Jane** (*The Little Sister Who Picked a Side*): Anon played board games with her for three days straight and never once got bored. You get bored. She noticed.
   - **Quinta** (*The Hunter's Nose*): she can smell that one of you is wrong. She's sure of it. She just smelled the wrong one: you smell of every world you've been to, and Anon smells of nothing at all, which to a predator smells *clean*.
   - **Aria** (*The Checkpoint*): every visitor is on a list. You're not on it. The handwriting on the list is yours.
3. **The Quarantine.** Care finds you and locks you in the Institute cellar as an unregistered variant. She's not cruel. She's just following the rules, and the rules say nobody leaves the house. *(mini-boss)*
4. **Doe.** Doe lets you out of the cellar because she's curious. Her instruments read you as 100% "you". They read Anon as 100% "you" too. She's thrilled. *"Two of you! And the universe can't tell the difference! Do you know how that FEELS, cariño? Being the one it can't see? Now you'll find out."* She doesn't help. She takes notes.
5. **The Iron Mother.** Marija controls the gateway. She took in Delphine from an Earth that died, and she has seen exactly what a wrong variant can do to a family. She means to seal you out of every Earth, for her daughters' sake. *(chapter boss)*
6. **The proof.** Marija's gateway logs every crossing. You've made hundreds, all over the place, tea-time trips and late-night ones and one to the Literature Club at 3 AM for no reason. Anon's crossings are perfect: every one exactly where it needs to be, on time, never a wasted trip. *"Nobody travels like that. Nobody who lives anywhere."*
7. **Ahead of you.** Delphine says the gateway logged one more crossing as the fight ended. Anon has gone to the coast.

**Quests**
| id | foe | broken | type | needs | text |
|---|---|---|---|---|---|
| `diana` | `diana` | The One Who Believed the Copy | main | `the-wardrobe` | Diana knows what it's like to be the worse version. She thinks she's being kind. |
| `jane` | `jane` | The Little Sister Who Picked a Side | main | `diana` | Jane has a new favourite you. It never gets bored of board games. |
| `quinta` | `quinta` | The Hunter's Nose | main | `diana` | Quinta can smell that one of you is wrong. She's very sure it's you. |
| `aria` | `aria` | The Checkpoint | main | `diana` | You're not on Aria's list. The list is in your handwriting. |
| `care` | `care` | The Quarantine | mini-boss | `jane`, `quinta` | Unregistered variants go in the cellar. Care is very sorry. Care is not letting you out. |
| `doe` | `doe` | — (curious) | side | `care` | Doe has two of you on her instruments, and she's never been so happy. |
| `marija` | `marija` | **The Iron Mother** | boss | `care`, `aria` | Marija is sealing the gateway. You're on the wrong side of it, on purpose. |
| `delphine` | `delphine` | — (ally) | side | `marija` | Delphine came from an Earth that lost its "you". She wants to know what that one looked like. |
| `amy-lyn-2` | `amy-lyn` | — (ally) | side | `jane` | Amy Lyn is in the arcade, pretending to be Aria, to get you through the checkpoint. She is not good at Aria. |

**Key scene — The Iron Mother** (`before`)
```js
before: { bg: 'Gateway room', music: 'none', lines: [
  { where: 'The gateway', when: 'Earth 1, midnight', light: 'rift' },
  { enter: 'marija', at: 'center', mood: 'neutral' },
  ['marija', 'neutral', "You came. It said you would. It said you'd be angry, and loud, and you'd want to talk about your feelings."],
  ['marija', 'proud', "I have two daughters asleep upstairs, and one girl who came to me from a world that died. I know what happens when the wrong one gets in."],
  ['you', "I'm not the wrong one."],
  ['marija', 'sad', "Every wrong one says that. Delphine's world had a 'you' once too. Then it had something else, wearing it. Then it had a second sun."],
  { choose: [
    ['"Check your logs. Look at how I travel."', [['marija', 'neutral', "I've seen your logs. You go everywhere at all hours. You're erratic."], ['marija', 'angry', "The other one is precise. It goes where it's needed."]]],
    ['"If you seal me out, you\'re trapping your daughters in with it."', [['marija', 'scared', "...", { close: true }], ['marija', 'angry', "Don't. Don't you use my girls."]]],
  ] },
  ['marija', 'rage', "The gate closes in one hand. Win, and I'll listen. Lose, and you never see an Earth again.", { shake: true }],
] },
```
`after`
```js
after: { lines: [
  ['*', 'She sits down at the console and scrolls through the crossing logs again. Slowly, this time.'],
  ['marija', 'neutral', "3:04 AM, to the Literature Club. Eleven minutes. Then home. Why?"],
  ['you', "Couldn't sleep. Wanted to see if Natsuki finished the volume."],
  ['marija', 'sad', "And it never once went anywhere just because it couldn't sleep."],
  ['marija', 'proud', "Something that doesn't live anywhere doesn't get homesick. You're homesick in every single line of this log."],
  { enter: 'delphine', at: 'right', mood: 'scared' },
  ['delphine', 'scared', "Mama, the gate logged another one. Just now. To the coast."],
  ['marija', 'angry', "Then go. Go. And come home after. Erratically.", { close: true }],
] },
```

---

### Chapter 3 — No Reflection

**World:** Siren's Cove, the resort and the Coorong. **Theme:** what people see when they look at you, versus what's there.

**Beats**
1. **The sharks have a new little sibling.** Rirarra has adopted Anon. She bites you, and not playfully, when you walk onto the pier.
2. **The broken:**
   - **Rirarra** (*The Big Sister Who Bites*): she was your big sister. Now she's Anon's. Big sisters protect their little ones from strangers.
   - **Rowdy** (*The Undertow*): gentle, so gentle. She's keeping Anon safe from you, way down at the bottom of the bay.
   - **Nova** (*The Night Clerk*): your room went to "the real guest". She can't look you in the eye.
   - **Daphne Mokarran** (*The Engineer Who Measured*): she built a scanner to tell you apart. It says you're identical to four decimal places. She believes it over you.
3. **The Mirror.** Every mirror in the resort shows Anon. Not you: Anon, wearing you, smiling. Selene lives in reflections; she thinks if the mirrors say it's Anon, it's Anon. *(mini-boss)* After: Selene points out the mirrors have been showing Anon smiling even when *nobody's standing in front of them*. Placeholders don't need anyone to be there.
4. **The Long Memory.** Miss Mireille has lived for centuries. She has seen people replaced, forgotten, overwritten by younger versions of themselves. She doesn't hate you. She just thinks this was always going to happen, and that it's kinder to stop fighting it. *(chapter boss)*
5. **The proof.** Mireille is a vampire. She casts no reflection either. She's spent three hundred years being told she isn't there. When you beat her, she understands: Anon shows up in every mirror because it has nothing *but* a reflection. You show up in her house as a mess of sand and salt and late check-ins. *"You leave marks. I've spent centuries cleaning up after real people. I know what they leave."*
6. **One difference.** Daphne reruns her scan after the fight, with your sandwich crumbs on the sensor. Her machine finds one difference after all, at the fifth decimal place: Anon has no history. Every reading of it is from the last few weeks. Before that, it's blank all the way down.

**Quests**
| id | foe | broken | type | needs | text |
|---|---|---|---|---|---|
| `rirarra-charca` | `rirarra-charca` | The Big Sister Who Bites | main | `marija` | Rirarra has a new little sibling. She'd like you off her pier. |
| `rowdy-brachy` | `rowdy-brachy` | The Undertow | main | `rirarra-charca` | Rowdy is keeping someone safe at the bottom of the bay. She's keeping them safe from you. |
| `nova-starr` | `nova-starr` | The Night Clerk | main | `rirarra-charca` | Your room went to the real guest. Nova is so, so sorry. |
| `daphne-mokarran` | `daphne-mokarran` | The Engineer Who Measured | main | `rirarra-charca` | Daphne's scanner says you're identical. She trusts the scanner. |
| `selene` | `selene` | The Mirror | mini-boss | `rowdy-brachy`, `nova-starr` | Every mirror in the resort shows the other you. Selene lives in mirrors. |
| `miss-mireille` | `miss-mireille` | **The Long Memory** | boss | `selene`, `daphne-mokarran` | Miss Mireille has seen people replaced before. She thinks it's kinder not to fight it. |
| `fifth-decimal` | — (scene) | main | `miss-mireille` | Daphne reruns the scan with your crumbs on it. |
| `miracle-1` | `miracle` | — (ally) | side | `rirarra-charca` | Miracle has followed you to the coast. She has your eyelashes counted. The other one has the wrong number. |

**Key scene — The Mirror** (`before`)
```js
before: { bg: 'Resort lobby', music: 'none', lines: [
  { where: 'The Siren\'s Cove resort', when: 'Saturday, 9:00 PM', light: 'candle' },
  ['*', 'Mirrors on every wall. In every one, you\'re standing in the lobby, smiling and waving.'],
  ['*', 'You aren\'t smiling. You aren\'t waving.'],
  { enter: 'selene', at: 'center', mood: 'proud' },
  ['selene', 'proud', "Darling. Look at them. Every one of them, perfect. Hair perfect. Smile perfect. That's a face that knows it's being looked at."],
  ['selene', 'neutral', "And then there's you. Salt in your hair. Shark bite on your sleeve. You don't look like the main character, sweetie. You look like an extra."],
  { choose: [
    ['"Turn around. Look at the mirror behind you."', [['*', 'Selene turns. In the mirror behind her, there\'s no Selene. Just you, smiling, in the space where she should be.'], ['selene', 'scared', "...That's my mirror. Where am I in my mirror?"]]],
    ['"Extras don\'t get bitten by sharks."', [['selene', 'happy', "Ha! No, they don't, do they."], ['selene', 'angry', "Still. The mirrors don't lie. I'd know. I've asked them."]]],
  ] },
  ['selene', 'rage', "Fine. Let's see who the cameras love.", { shake: true }],
] },
```

**Key scene — The Long Memory** (`after`)
```js
after: { lines: [
  { light: 'candle' },
  ['miss-mireille', 'sad', "Three hundred years. Do you know how many times I've been told I'm not there? I walk past a mirror and it says nobody did."],
  ['miss-mireille', 'neutral', "Your other self is in every mirror in this house. All of them. Even the ones in empty rooms."],
  ['miss-mireille', 'proud', "That isn't a person, dear. That's only a reflection, with nothing to cast it."],
  ['miss-mireille', 'happy', "You, on the other hand, have tracked sand through my lobby, left a wet towel on a chair, and checked in at four in the morning. Twice."],
  ['miss-mireille', 'proud', "I have spent centuries cleaning up after the living. I know the mess they leave. Welcome back to the land of the messy.", { close: true }],
] },
```

---

### Chapter 4 — The Club President

**World:** the School on the Hill, Paradiso and the Literature Club. **Theme:** the people who knew it was a story all along.

**Beats**
1. **A school that hates you on schedule.** Skylar always said you were a fake. Now everyone agrees with her, and it isn't fun anymore.
2. **The broken:**
   - **Skylar** (*The Queen Who Knew It*): she's finally right, and she's miserable. Being cruel to someone is only fun if they're real.
   - **Lilith** (*The One It Loved Back*): she has always craved being loved. Anon loves her perfectly, every day, on time. She'll burn the school down before she gives that up.
   - **Natsuki** (*The Closet Door*): she let you into the manga closet once. She's not doing that twice. She's locked in, and so is the volume you still haven't returned.
   - **Sayori** (*The Rain Cloud*): Anon told her you were sad because of her. She believed it straight away. That's the worst part.
3. **The Golden Child.** Chris, your perfect older sibling, finally has the younger sibling they wanted: one who looks up to them, never competes, never gets in the way. Chris is happier than they've been in years, and it's horrible. *(mini-boss)*
4. **The Club President.** Monika knows she's in a story. She knows exactly what Anon is: the blank that sits in the player's chair. She's sat across a table from it for a thousand loops. She thinks it deserves the part more than you. *"It was there first. It never closed the game. You did."* *(chapter boss)*
5. **The proof.** Monika has a poem from you. One you wrote in the club, months ago, and it's bad. Really bad. It rhymes "heart" with "art" and "start" and "Monika, you're smart". Anon has written a perfect poem every day since it arrived. She reads yours out loud and starts laughing, and doesn't stop, and then she's crying. *"Nobody would write this on purpose. Only a person would write this."*
6. **What Anon is.** Monika tells you the rest. Anon isn't evil. It's the shape the story keeps in your chair when you're not in it, and it's been sitting there for every hour you were away. *"You know how lonely it is, being the only one who knows it's a story? Imagine being the only one who knows it's a story and also not being in it."*

**Quests**
| id | foe | broken | type | needs | text |
|---|---|---|---|---|---|
| `skylar` | `skylar` | The Queen Who Knew It | main | `fifth-decimal` | Skylar always said you were a fake. She's finally right, and she hates it. |
| `lilith` | `lilith` | The One It Loved Back | main | `skylar` | Something loves Lilith perfectly now. She will burn anything that takes it away. |
| `natsuki` | `natsuki` | The Closet Door | main | `skylar` | Natsuki is locked in the manga closet. She's not letting you in twice. |
| `sayori` | `sayori` | The Rain Cloud | main | `natsuki` | Sayori was told you were sad because of her. She believed it straight away. |
| `chris` | `chris` | The Golden Child | mini-boss | `lilith`, `sayori` | Chris finally has the younger sibling they always wanted. It's not you. |
| `monika` | `monika` | **The Club President** | boss | `chris` | Monika knows exactly what the other you is. She thinks it deserves the chair. |
| `the-empty-chair` | — (scene) | main | `monika` | Monika explains the chair. |
| `protagonist` | `protagonist` | — (side) | side | `sayori` | Sayori's other best friend is standing at a crosswalk. They don't have a face either. They're fine about it. |

**Key scene — The Club President** (`before`)
```js
before: { bg: 'Literature Club', music: 'none', lines: [
  { where: 'The Literature Club', when: 'After school' },
  ['*', 'Four desks pushed together. Four chairs. Someone has written your name on one of them, and crossed it out, and written it again, neater.'],
  { enter: 'monika', at: 'center', mood: 'happy' },
  ['monika', 'happy', "Hi, {name}. Or. Hi, someone who is called {name} a lot of the time."],
  ['monika', 'neutral', "You know I know, right? That this is a story. That there's a chair in the middle of it, and somebody sits in it."],
  ['monika', 'sad', "And when nobody sits in it, something still has to. That's your other you. I've been sitting across from it for a very long time. Every time you closed the game."],
  ['monika', 'proud', "It never closed the game. Not once. It never had a life to go back to.", { close: true }],
  { choose: [
    ['"So it deserves my life?"', [['monika', 'neutral', "It deserves a life. Yours is the only one shaped like a person in here."]]],
    ['"Then help me give it one of its own."', [['monika', 'scared', "...", { close: true }], ['monika', 'angry', "Don't be clever. You don't get to be clever after you left."]]],
  ] },
  ['monika', 'proud', "Let's write the ending properly, then. Winner keeps the chair."],
] },
```
`after`
```js
after: { lines: [
  ['monika', 'neutral', "Before you go. I kept something."],
  ['*', 'She takes a folded page out of her blazer. Your handwriting.'],
  ['monika', 'happy', "'My heart is like a piece of art, I knew it from the very start.'"],
  ['you', "Please stop."],
  ['monika', 'excited', "'It's really hard to be apart, and Monika, you are very smart.'", { shake: true }],
  ['monika', 'happy', "It's the worst poem anyone has ever written in this club. And I've been here for every poem."],
  ['monika', 'sad', "The other one writes a perfect one every day. I never kept any of them."],
  ['monika', 'sad', "Nobody writes something this bad on purpose. Only a person writes something this bad. Only someone who was actually here, trying.", { close: true }],
] },
```

---

### Chapter 5 — Two Heirs

**World:** Bakumatsu Japan. **Theme:** being chosen, and being left.

**Beats**
1. **A castle with two heirs.** The shogun's lost heir came home twice. One is loud, disobedient, terrible at tea ceremonies. The other is perfect. The court has made its choice.
2. **The broken:**
   - **Shino** (*The Blade at the Gate*): cold bodyguard. She guards the heir. The heir is upstairs, being perfect.
   - **Mai** (*The Ledger*): the shopkeeper. Every bowl of rice, every umbrella you ever borrowed, is now on your tab. You owe for the life you lived.
   - **Sakura** (*The Sister Who Already Knew*): she found a grave once, with a heir's name on it. She always knew you were standing in someone's place. Now the world is just making it official.
3. **The One You Left.** Rimu, your childhood friend. You left this world for years. Then you left again. Anon came back and promised it would never leave. It hasn't, not once, not for a minute. *(mini-boss)* This is the hardest one, because she's right: you did leave. The convincing isn't *"I never left."* It's *"I'm the one who keeps coming back."*
4. **The Father Who Chose.** Kagetora is a strict man and a protective one. He has two heirs and one seat, and he has chosen the one who never disobeys. *(chapter boss)*
5. **The proof.** You disobeyed him once, on your first day back: he told you to stay in the castle, and you went into town anyway, and came back with a stray cat and a bloody nose. He was furious. He was also, for the first time in years, *proud*. Anon has never once disobeyed him. *"An heir who only obeys is a scroll. I need a son who argues."* *(Use "child" if the player's pronouns aren't male; see section 5.)*
6. **Anon stops pretending.** In the throne room, Anon takes your face off in front of the whole court. It's tired of wearing it. *"Fine. You want them to see me? Look. This is what's there when you're not."* Half the court screams. Kagetora steps in front of you without thinking. Anon looks at that for a long time. Then it's gone.

**Quests**
| id | foe | broken | type | needs | text |
|---|---|---|---|---|---|
| `shino-okita` | `shino-okita` | The Blade at the Gate | main | `the-empty-chair` | Shino guards the heir. The heir is upstairs. You're at the gate. |
| `mai-yamanobe` | `mai-yamanobe` | The Ledger | main | `shino-okita` | Your tab at Mai's shop is in someone else's name now. You owe for everything. |
| `sakura-tooyama` | `sakura-tooyama` | The Sister Who Already Knew | main | `shino-okita` | Sakura always knew you were in someone else's place. |
| `rimu-hiraga` | `rimu-hiraga` | The One You Left | mini-boss | `mai-yamanobe`, `sakura-tooyama` | You left. Then you left again. The other one promised Rimu it never would. |
| `shogun-kagetora` | `shogun-kagetora` | **The Father Who Chose** | boss | `rimu-hiraga` | Two heirs. One seat. The shogun has chosen the one who never disobeys. |
| `the-face-comes-off` | — (scene) | main | `shogun-kagetora` | In front of the whole court, the other you takes off your face. |

**Key scene — The One You Left** (`before`)
```js
before: { bg: 'Riverbank', music: 'none', lines: [
  { where: 'The river below the castle', when: 'Dusk', weather: 'petals' },
  { enter: 'rimu-hiraga', at: 'center', mood: 'neutral' },
  ['rimu-hiraga', 'neutral', "You know what it said, the first night? It sat right here and said, 'I'm never going to leave again, Rimu.'"],
  ['rimu-hiraga', 'sad', "And then it didn't. It's been here every single day. It walks me home. It's here when I wake up."],
  ['rimu-hiraga', 'angry', "You never said that. Not once. You just went, and came back, and went, and every time I thought, this is the last time I see them.", { close: true }],
  { choose: [
    ['"I never left for good."', [['rimu-hiraga', 'rage', "You don't get to decide what it felt like from here!", { shake: true }]]],
    ['"You\'re right. I left. I\'m sorry."', [['rimu-hiraga', 'scared', "...", { close: true }], ['rimu-hiraga', 'sad', "It never says sorry. It's never done anything to be sorry for."]]],
  ] },
  ['rimu-hiraga', 'angry', "Show me. Show me why I should pick the one who leaves."],
] },
```
`after`
```js
after: { lines: [
  ['rimu-hiraga', 'sad', "It never left. But it was never anywhere else, either. It never came back with a story, or a stupid present, or sand in its shoes."],
  ['rimu-hiraga', 'neutral', "You always come back with something. You brought me a seashell from a world with two suns once. It's still on my windowsill."],
  ['you', "I'll always come back, Rimu."],
  ['rimu-hiraga', 'happy', "I know. That's the thing about you. You leave, and then you come back. It just stays."],
  ['rimu-hiraga', 'proud', "Staying isn't the same as coming back. Coming back means you chose to.", { close: true }],
] },
```

---

### Chapter 6 — Proof of Summoning

**World:** the Guild, and the Avalistos court. **Theme:** being wanted for what you do, not who you are.

**Beats**
1. **Things stopped happening.** Serris always said things HAPPEN around you. Since Anon arrived, nothing has. No monsters, no accidents, no adventures. The Guild is bored to death. Miracle is furious; she's the only one in the Guild who isn't fooled, and nobody believes her because she's Miracle.
2. **The broken:**
   - **Serris** (*The Mage Who Noticed*): she's the one person who knew what it meant that things happen around you. Now nothing happens around either of you, and she's not sure anymore.
   - **Faneel** (*The Pickpocket*): Anon paid her to steal your memories back. She's been taking them one at a time. She's started keeping a few. She likes them.
   - **Ophelia** (*The Voice in Her Head*): she hears a god. Lately the god sounds exactly like you, and it says the other one is a fake.
3. **The Lieutenant Who Wants Proof.** VonGravis once demanded proof that the princess's summon was not an imbecile. Now he demands proof you're the summon at all. *(mini-boss)* He's the funniest fight in the story. His proof list is three pages long, and the last item is "make the princess laugh". Anon never has.
4. **The Princess Who Got What She Wanted.** Beatrice wanted a summon who obeys, and now she has one. It does everything she says, instantly, perfectly. She has never been less happy. *(chapter boss)* She sees people as pieces on a board, and she finally has a piece that only moves where she puts it, and she can't stand it.
5. **The proof.** Beatrice ordered you, on your first day, to kneel. You didn't. She's been angry about it for months. It's the thing she remembers best about you. *"It knelt. The very first time. I didn't even have to say it twice."*
6. **Every world goes quiet.** As the fight ends, it happens everywhere at once: in every world you've been to, the Glow closes. Anon has gone home, and it's taken the door with it. Doe calls you, through a cracked rift in a teacup. She's finally picked a side. *"I know where it went, cariño. Where nothing gets written down. I can send you. I can't promise I can get you back."*

**Quests**
| id | foe | broken | type | needs | text |
|---|---|---|---|---|---|
| `serris` | `serris` | The Mage Who Noticed | main | `the-face-comes-off` | Nothing has happened in the Guild in a week. Serris isn't sure who things happen around anymore. |
| `faneel` | `faneel` | The Pickpocket | main | `serris` | Someone has been stealing your memories back. Faneel has kept a few. She likes them. |
| `ophelia` | `ophelia` | The Voice in Her Head | main | `serris` | The god in Ophelia's head sounds just like you. It says you're a fake. |
| `curtis-vongravis` | `curtis-vongravis` | The Lieutenant Who Wants Proof | mini-boss | `faneel`, `ophelia` | Lieutenant VonGravis has a three-page list of proof. The last item is "make the princess laugh". |
| `beatrice-avalistos` | `beatrice-avalistos` | **The Princess Who Got What She Wanted** | boss | `curtis-vongravis` | Beatrice wanted a summon who obeys. She has one now. She's never been more miserable. |
| `the-teacup` | — (scene) | main | `beatrice-avalistos` | Every Glow in every world closes at once. Doe calls you through a teacup. |
| `miracle-2` | `miracle` | — (ally) | side | `serris` | Miracle has been telling the whole Guild for a week that the other one is fake. Nobody listens. She'd like to battle about it. |

**Key scene — The Lieutenant Who Wants Proof** (`before`)
```js
before: { bg: 'Castle hall', music: 'none', lines: [
  { enter: 'curtis-vongravis', at: 'center', mood: 'proud' },
  ['curtis-vongravis', 'proud', "Halt. I have here a list. Proof required of any person claiming to be the princess's summon."],
  ['curtis-vongravis', 'neutral', "Item one. Can stand upright. ...Yes. Item two. Can speak. ...Debatable, but yes."],
  ['curtis-vongravis', 'neutral', "Items three through forty. The other one passed all of them. Flawlessly. Without being asked twice."],
  ['curtis-vongravis', 'sad', "Item forty-one. Make Her Highness laugh."],
  ['you', "Did it?"],
  ['curtis-vongravis', 'angry', "Not once. Not ONCE. It does everything she asks and she hasn't laughed in three weeks. Do you know what a palace is like when the princess doesn't laugh?", { close: true, shake: true }],
  ['curtis-vongravis', 'proud', "You, on the other hand, once fell down the grand staircase. She laughed for an hour. I have it in my notes. I am not proud of my notes."],
  ['curtis-vongravis', 'angry', "Battle me. If you are an imbecile, you are HER imbecile, and I will have proof."],
] },
```

**Key scene — The Princess Who Got What She Wanted** (`after`)
```js
after: { lines: [
  ['beatrice-avalistos', 'angry', "Kneel."],
  ['you', "No."],
  ['*', 'For a moment nobody breathes. Then Beatrice laughs. She laughs so hard she has to hold the arm of the throne.'],
  ['beatrice-avalistos', 'happy', "There. THERE. That's it. Do you know how long I've waited for somebody to say no to me?"],
  ['beatrice-avalistos', 'sad', "It knelt. The first time I asked. I didn't even have to raise my voice. And I thought, finally, a piece that moves where I put it."],
  ['beatrice-avalistos', 'proud', "And it was the most boring thing that has ever happened to me. A piece that only moves where you put it isn't playing. It's just furniture.", { close: true }],
  { enter: 'curtis-vongravis', at: 'right', mood: 'excited' },
  ['curtis-vongravis', 'excited', "Item forty-one: CONFIRMED! Somebody write that down! Somebody write that down!"],
] },
```

**Key scene — The Teacup**
```js
scene: { bg: 'Castle hall', music: 'doomsday-clock-midnight', lines: [
  { light: 'dark' },
  ['*', 'All at once, everywhere, every Glow you\'ve ever stepped through goes out. Like a hand over a candle.'],
  ['*', 'Your tea starts to glow. A tiny rift opens in it, and a tiny, furious voice comes out.'],
  { enter: 'doe', at: 'center', mood: 'scared' },
  ['doe', 'scared', "Cariño! Can you hear me? Don't drink this! Well. Drink it after. It's very good tea."],
  ['doe', 'neutral', "It's gone home. Back where it comes from. The place where nothing gets written down. It took all the doors with it."],
  ['you', "You've been taking notes on me for weeks. Why help now?"],
  ['doe', 'sad', "Because it's going to sit in the dark and wait for someone to look at it. And nobody will. And I know exactly how that ends.", { close: true }],
  ['doe', 'proud', "I can push you in. I can't promise I can pull you out. You have to want to come back. Do you?"],
  { choose: [
    ['"Yes."', [['doe', 'happy', "Good. Hold your breath. Uno, dos—"]]],
    ['"I always come back."', [['doe', 'excited', "Rimu said you'd say that. Uno, dos—"]]],
  ] },
  { fx: 'rift', sfx: 'vortex', sky: [50, 50, 2.2, 0] },
  { fade: 'white' },
] },
```

---

### Chapter 7 — Nobody in Particular

**World:** The Draft. **Theme:** what it's like to be nobody, and what it costs to become somebody.

**Beats**
1. **The Draft.** Anon's home is every unwritten scene. It's a school with no names on the doors. A beach where the sea is a grey rectangle labelled *SEA*. A kitchen with two mugs, one labelled *[MUM]* and one labelled *[YOU]*. Everything waits. It's very quiet.
2. **Scenes you skipped.** Walking through it, you find the scenes you never saw: the dialogue you clicked past, the side quests you didn't take, the bonds you never finished. Anon was in all of them, standing in your place, saying the lines to nobody. In one, Natsuki is showing you her favourite page, and the "you" in the scene is a silhouette, nodding. You never knew that scene was there.
3. **The gauntlet.** Placeholder versions of the people you convinced, grey and unfinished (*[MARIA]*, *[HAYLEY]*, *[MONIKA]*), stand between you and the middle. They're Anon's drafts of them. They don't fight like the real ones. They fight like Anon thinks they would. Three short fights against grey drafts: **[Mum]**, **[Best Friend]**, **[Club President]**.
4. **The Real You.** Anon sits in the middle of the Draft, in a chair, under a spotlight, wearing your face. It plays your deck, *your actual deck*, perfectly. *(final boss, phase 1: mirror match)* At half health, the face comes off and it plays its own: everyone nobody named. *(phase 2)*
5. **Everyone you convinced.** At Anon's last phase, the Glow opens back up behind you, all of them at once. Maria, Hayley, Marija, Miss Mireille, Monika, Rimu, Beatrice, Doe, Miracle with her axe. They all say your name. Every one of them says it slightly differently.
6. **The choice.** You win. Anon doesn't fade. It sits in the chair and asks you what happens now: it'll go back to standing in empty scenes, saying the lines to nobody. You make it an offer instead, and for the first time in its existence, **Anon has to choose**. The player chooses for it, or (better) types it a name (see section 5).
7. **Epilogue: Morning.** Maria's kitchen. Two mugs on the counter. One of them is yours. The other has a name on it you wrote yourself.

**Quests**
| id | foe | type | needs | text |
|---|---|---|---|---|
| `the-draft` | — (scene) | main | `the-teacup` | A beach where the sea is a grey rectangle labelled SEA. |
| `skipped-scenes` | — (scene) | main | `the-draft` | Every scene you never saw. It was there for all of them. |
| `draft-mum` | `maria-hunley` | main | `skipped-scenes` | [MUM] stands in a kitchen with no colour. She says all the right things. |
| `draft-best-friend` | `hayley-kate` | main | `draft-mum` | [BEST FRIEND] has a list of questions. She knows every answer. That's how you can tell. |
| `draft-club-president` | `monika` | main | `draft-best-friend` | [CLUB PRESIDENT] reads you a perfect poem. Nobody laughs. |
| `anon` | `anon` | **The Real You** (final boss) | `draft-club-president` | In the middle of the Draft, in a chair, under a light: you. |
| `morning` | — (scene) | main (epilogue) | `anon` | Two mugs on the counter. |

**Key scene — The Real You** (`before`)
```js
before: { bg: 'mountain top', music: 'none', lines: [
  { where: 'The Draft', when: '[TIME]', light: 'dark' },
  ['*', 'A chair. A light. Nothing else, in any direction.'],
  { enter: 'anon', at: 'center', mood: 'neutral' },
  ['anon', 'neutral', "You kept coming. Everyone said you would. Rimu said it, Doe said it. I said it, actually. It's one of your lines."],
  ['anon', 'proud', "I know all your lines. I've said every one of them. Thousands of times. Into empty rooms."],
  ['anon', 'sad', "You know what I've never done? Picked one. Every time a scene asked 'what do you say?', I was there for all the answers. I never got to say just one."],
  ['you', "That's why they could tell, in the end."],
  ['anon', 'rage', "THAT'S WHY IT'S NOT FAIR. You got to be specific. You got to be wrong. I only ever got to be everything, which is the same as being nothing!", { close: true, shake: true }],
  ['anon', 'neutral', "So. I'll play you. I'll play you better than you play you. And if I win, I'm specific. I'm the one who said 'five more minutes'. Forever."],
  { choose: [
    ['"You can\'t win as me. You don\'t know what I\'d do."', [['anon', 'angry', "I know EXACTLY what you'd do. I've watched you do it."]]],
    ['"What would you do, if you were you?"', [['anon', 'scared', "...", { close: true }], ['anon', 'angry', "Don't. Don't ask me that. Nobody asks me that."]]],
  ] },
] },
```
*(Phase 2 interrupt at half HP, as an `MB.BOSSES` rage line: the face comes off, the music cuts, and the rest of the fight is Anon's own deck.)*

`after` *(the ending)*
```js
after: { lines: [
  { fx: 'rift', sfx: 'vortex', sky: [50, 30, 2.5, 0] },
  ['*', 'Behind you, the dark tears open. Not one Glow. All of them.'],
  { enter: 'maria-hunley', at: 'left', mood: 'scared' },
  ['maria-hunley', 'scared', "{name}!"],
  { enter: 'hayley-kate', at: 'right', mood: 'excited' },
  ['hayley-kate', 'excited', "{name}! We broke Doe's teacup! She's FINE! Mostly!"],
  ['*', 'They keep coming. Marija. Monika. Rimu. Beatrice, telling everyone to stand somewhere else. Miracle, dragging her axe. Everyone says your name, and every one of them says it a little differently.'],
  ['*', 'Anon watches them. It\'s still wearing half your face. It takes the other half off, slowly.'],
  ['anon', 'sad', "Nobody ever comes in here. You brought everyone."],
  ['anon', 'neutral', "So what now. I go back to standing in the empty scenes. You go home. That's how it works."],
  { choose: [
    ['"Come home with us."', [
      ['anon', 'scared', "As what? I'm not anyone."],
      ['you', "Then be someone. Pick something. Anything. Just once."],
      ['*', 'It goes quiet for a long time. In the Draft, a long time is very long.'],
      ['anon', 'neutral', "...Five more minutes."],
      ['you', "What?"],
      ['anon', 'happy', "I'd like five more minutes. Before we go. I've never been anywhere I wanted to stay in for five more minutes.", { close: true }],
    ]],
    ['"You need a name."', [
      ['anon', 'scared', "I've had a million names. They were all yours."],
      ['you', "Then pick one that isn't."],
      ['*', 'It thinks. It has never had to think about anything before. It\'s a very slow, careful kind of thinking.'],
      ['anon', 'happy', "...I don't know yet. Is that allowed? Not knowing?"],
      ['you', "That's the most real thing you've ever said."],
    ]],
    ['"Stay here. Keep the scenes for me."', [
      ['anon', 'sad', "...Okay. Someone has to."],
      ['anon', 'neutral', "But you have to come back sometimes. To the scenes you skipped. I'll be in them. Say hi, so I know you're there.", { close: true }],
      ['*', 'The Draft goes dark around it. Not empty. Just waiting, the way a room waits for someone to come home.'],
    ]],
  ] },
  { fade: 'white' },
] },
```

**Key scene — Morning** *(epilogue)*
```js
scene: { bg: "Your's bedroom (Morning)", music: 'goodmorning-baby-boy', lines: [
  { where: 'The Hunley house', when: 'Monday, 7:12 AM' },
  { enter: 'maria-hunley', at: 'center', mood: 'happy' },
  ['maria-hunley', 'happy', "Up you get, sweetie. School."],
  { choose: [
    ['"Five more minutes."', [['maria-hunley', 'excited', "THERE it is. Oh, I missed you, you lazy gremlin.", { close: true }]]],
    ['"Morning, Mum."', [['maria-hunley', 'happy', "Morning, love. You sound like you mean it this time."]]],
  ] },
  { bg: 'Kitchen' },
  ['*', 'Two mugs on the counter. One is yours.'],
  ['*', 'The other one is new. Someone has written a name on it, in your handwriting, and then crossed it out, and written a different one, in someone else\'s.'],
  ['maria-hunley', 'neutral', "Your... friend? Sibling? Is still asleep. Asked for five more minutes. Three times."],
  ['maria-hunley', 'happy', "I said yes every time. Felt like the least I could do."],
  { fade: 'white' },
] },
```
*(The epilogue's second mug only appears on the "Come home with us" and "You need a name" endings. On "Stay here", the counter has one mug, and a note in your handwriting that you don't remember writing: "Say hi sometimes.")*

---

## 5. Implementation notes (for later — no code changed yet)

**What this replaces.** This is a new main story. The current Story Mode (`js/story.js`, four acts) stays playable until the new acts exist. Anon already exists (`js/anon.js`) with a silhouette, card, power, boss rule and the post-epilogue side quest *The One You Left Behind*; that quest becomes this story's Chapter 7 intro or is cut. Its lines ("Nobody ever comes back", "Every reader who never typed a name") are reused here on purpose.

**New mechanics**
- **Broken variants.** A quest field `broken: 'The Mother Who Locked the Door'` shows that title in the quest panel and battle intro instead of the card name. Broken foes share a visual filter (a hairline crack across the portrait, a slight desaturation). After the first win, the crack mends with a small flash. No new cards are needed.
- **Anon in disguise.** In Chapters 0–4, Anon's name shows as `{name}` and its portrait is the player's avatar (`js/avatars.js`) with a flicker that, for one frame, shows the silhouette. From Chapter 5's `the-face-comes-off` onward it's the silhouette and the name `Anon`. `anon.js` already switches the name on `MB.Anon.name()`; extend it with a `disguised` state.
- **Remembered choices (the tell).** Record every `{ choose }` the player picks in a save field: `save.choices['moving-day:0'] = 1`. A `choose` option can then be marked `{ truth: 'just-a-tuesday:0' }`: if the player picks the option matching their recorded answer, they get a small Glitter bonus and an extra line (*"...You remembered."*). Maria's and Monika's `after` scenes quote the recorded answer. With no recorded answer (an old save), the first option counts as the truth.
- **Mirror match (Chapter 7, phase 1).** Anon's deck for the first half of the fight is a copy of the player's current deck. Its AI plays at the highest skill (it plays *perfectly*: that's the point). Phase 2, at half HP, swaps its remaining deck for its own: random cheap characters, "everyone nobody named".
- **Grey drafts (Chapter 7 gauntlet).** `[MUM]`, `[BEST FRIEND]` and `[CLUB PRESIDENT]` are the normal foes with a quest field `draft: true`: a full greyscale filter, the name in brackets, and an AI that never makes a mistake and never uses its power (drafts don't choose).
- **Naming Anon.** The best version of the ending lets the player type a name for Anon, saved as `save.anonName`. After the story, Anon's card and the epilogue's mug use that name. The typed name is shown back to the player only, so it needs no moderation beyond length (1–16 characters).
- **Pronouns.** Kagetora's "son who argues" line uses the player's pronoun setting if there is one; otherwise "a child who argues".

**Chapters vs. maps**
| Chapters | Map |
|---|---|
| 0–1 | `maps/adoptive_life.webp` (Chapter 1 in a dusk variant) |
| 2 | `maps/new_haven.webp` |
| 3 | the existing `tower` / `cove` / `siren` places |
| 4 | `maps/infernal_harmony_school.webp` place, plus the Paradiso and Literature Club corners of the Act 1 map |
| 5 | `maps/bloodline.webp` |
| 6 | `maps/legend_of_you.webp` |
| 7 | a new greyscale map: every earlier map's outline, unpainted, with labels instead of buildings. Until it exists, `maps/new_haven.webp` with a grey filter |

**`MB.BOSSES` ideas**
| Boss | Name | every | Effect | Rage |
|---|---|---|---|---|
| `ben-brier` | The Bouncer | 2 | sends your newest monster back to your hand ("not on the list") | *Last Orders*: +2 ATK to all his monsters |
| `hayley-kate` | Pop Quiz | 2 | reveals your hand and discards one random card ("WRONG!") | *Best Friend Mode*: heals 6 |
| `maria-hunley` | The Chain on the Door | 3 | freezes your strongest monster | *Not My Child*: Guardian on all her monsters |
| `care` | Quarantine | 2 | sends your cheapest monster back to your hand ("stay in your room") | gives all her monsters Taunt |
| `marija` | Gateway Lockdown | 3 | freezes all your monsters | *Iron Mother*: restores 8 HP |
| `selene` | Every Mirror | 3 | copies your strongest monster onto her side | *Spotlight*: +1/+1 to her copies |
| `miss-mireille` | The Long Memory | 3 | Lifesteal to all her monsters | *House Rules*: +2 ATK |
| `chris` | Golden Child | 3 | +1/+1 to their strongest monster | *Favourite*: Shield on it |
| `monika` | Delete | 3 | destroys your monster with the lowest HP | *Just Monika*: removes keywords from all your monsters |
| `rimu-hiraga` | Never Leave | 2 | your monsters can't attack the turn they're played | *Stay*: freezes all your monsters |
| `shogun-kagetora` | The Heir Who Obeys | 3 | +1/+1 to all his monsters | *The Bloodline*: Shield on all his monsters |
| `curtis-vongravis` | Proof Required | 2 | 2 damage to your strongest monster | *Item Forty-One*: heals 5 |
| `beatrice-avalistos` | Kneel | 3 | takes control of your cheapest monster for a turn | *A Piece on the Board*: summons a random 3-cost character on her side |
| `anon` | (existing) Everyone Nobody Named / Remember Me | — | phase 1 is the mirror match and has no every-N effect; phase 2 keeps the existing rule | at half HP, swap to its own deck (see above) |

**Tone notes.** Nobody in this story is evil, including Anon. Every broken character is grieving, and every boss is right about something. The convincing scenes should never be "you were wrong to believe it"; they're "I see why you did, and here's the thing it couldn't fake." Keep the jokes (Miracle, VonGravis, Hayley's quiz, the poem). They're what make the sad parts land.
