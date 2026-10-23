# Miku Battle: Story Mode — *Every World Has a You*

A ten-chapter story across every novel's world. Warm and funny on the surface, dark underneath: a plague is turning everyone you love into the worst version of themselves, and the only cure is you.

> **How to read this:** sections 1–3 are the lore and cast. Section 4 is the ten chapters (beats, bosses, quest list, key scenes). Section 5 is implementation notes. Scenes are written in `js/story.js` line style so they can be pasted in: `['id', 'mood', "text"]`, `['you', "text"]`, `['*', "narration"]`, and directions like `{ where, when }`, `{ fx: 'rift' }`, `{ choose: [...] }`. Moods are only the eight `MOODS` keys: `neutral, happy, angry, rage, scared, sad, excited, proud`. Every id is an existing card in `MB.CARDS`.

---

## 1. Premise

Every story has a "you" at its centre: Maria's adopted child, Chris's younger sibling, the lost heir of the shogun, the summon Beatrice didn't want, the guest at Siren's Cove. You thought that was just how stories work.

It isn't. **"You" is a force.** Every world is held together by the person it's about. The world bends around them, things just *happen* around them, people look at them. A world without its "you" doesn't end. It **rots**: its people slide, slowly, into the worst versions of themselves, until they're nothing else.

And you, the "you" of a quiet town in south England, are the same "you" in all of them. You are the most important and powerful thing in the multiverse.

You don't know that yet.

### The lore

| Thing | What it is |
|---|---|
| **The Glow** | A seam between worlds. Only a "you" can see one. |
| **Your weapon** | Your deck. Miku Battle is what the power of a "you" looks like when it's held in your hands. Every card is a bond with someone. That's why beating someone in a battle *cures* them: you're reminding them who they are by being the person they're in a story with. |
| **The Flicker (the plague)** | When a world loses its "you", its people start to flicker between their versions across the multiverse, and they settle on the worst one. Ordinary flaws become who they are: someone who's bored becomes someone who's hollow, someone protective becomes someone who imprisons. |
| **Doe's Engine** | On Earth 2, Doctor Doe Bullen builds a machine that measures the "you" in a person, and then learns how to *pull it out*. Every time she drains a world's "you", the Flicker spreads there. She means to collect all of it, and become the "you" of every world at once: the Main Character. |
| **The BAD SUN** | What a world looks like when the Flicker finishes. Earth 3 lost its "you" years ago (nobody knows how). A second sun rose, and everyone under it became their worst self, permanently. Delphine survived it. Quistis didn't, not really. |
| **"???"** | The binary entity. A letter-writer from nowhere: `01100010 01100101 01110111 01100001 01110010 01100101...` — *beware of the unthinkable present and future.* It's **you**, from a future where Doe won and every world became a BAD SUN. Nothing is left of that future but data. It is trying to warn itself. |
| **The Supporting Cast** | Doe's name for the villains she recruits from other worlds. She promises each of them their own world to rule once she's the Main Character. |

### Why Doe

Doe isn't a monster. On Earth 2 she's a teasing, flirty, caring scientist, and nobody pays attention to her. (Her novel says it plainly: her dislikes are *being bullied for her weight* and *people not paying attention to her*.) Then a stranger lands in Diana's lab, and every instrument she owns swings to look at them. The universe *looks* at you. It has never looked at her once.

If being "you" can be measured, it can be moved. That's the whole villain origin, and it happens in Chapter 1, in front of you, because you let her run the tests.

Her tragedy, revealed in Chapter 10: the Engine works. She is becoming the "you" of every world, and the Flicker is getting into her too. Her worst trait is the need to be looked at. The Main Character is just Doe with nothing else left.

---

## 2. Cast

### The worst selves (plagued)

They're heroes and friends. The Flicker isn't their fault. Every title is a **real flaw from their novel**, taken all the way down.

| Ch | Character | Worst self | The flaw it grew from |
|---|---|---|---|
| 2 | `james-lone` | **The Fake Emo** | negative, bored, "doesn't really care", worn as a costume until there's nothing under it |
| 2 | `kayla-kate` | **The Hollow Sister** | overshadowed by Hayley, apathetic. Now she believes she's the reason Hayley vanished, and wants to vanish too |
| 2 | `julie-hunley` | **The Laughing Wound** | giddy, bubbly. She can't stop laughing, even while she cries |
| 2 | `isabella-hunley` | **The Martyr** | calm, sweet, always brings too much. She gives everything away: her biscuits, her coat, her name |
| 2 | `ben-brier` | **The Butcher of the Alley** | master thug, dimwitted. Now the alley is a slaughterhouse for anyone who walks in |
| 2 | `maiko-ghan` | **The Lost Sen** *(mini-boss)* | extremely honest, karate. A teacher with no student and no mercy, whose every blow is a cruel truth |
| 2 | `luther-jones` | **The Boy Who Never Lands** | laid-back skater. He's been mid-ollie for six hours and can't come down |
| 2 | `catherine-jones` | **The Price Tag** | narcissist CEO who hates adoption. She's putting a price on every child in town |
| 3 | `diana` | **The Doe Nobody Mourns** | insecure, hates being judged. She's convinced Doe is the "real" her, and she's letting herself fade |
| 3 | `jane` | **The Forgotten Sister** | Diana's little sister. She's started erasing herself from the family before they can |
| 3 | `quinta` | **The Predator's Smile** | Diana's best friend, a predator anthro. The Flicker pulls her toward Earth 3's Quistis |
| 3 | `aria` | **The Locked Door** | the security guard. Nobody in, nobody out, ever |
| 3 | `care` | **The Warden** | "will not allow you to leave the house". The whole Institute is the house now |
| 4 | `rirarra-charca` | **The Hunger Below** | big sis, playful bites, "wherrre is the watermelon". The hunger forgot about watermelon |
| 4 | `rowdy-brachy` | **The Riptide** | gentle, not aggressive. She drags people under to "keep them safe" |
| 4 | `daphne-mokarran` | **The Scrapyard Heart** | the engineer. She's taking the pier apart, and then the people |
| 4 | `nova-starr` | **The Girl Who Checked Out** | shy night-shift clerk. She's checking guests out of existence |
| 4 | `selene` | **The Mirror** | acts like a celebrity. Every reflection in the resort is now her |
| 4 | `miss-mireille` | **The Thirst** | a centuries-old vampire whose restraint was her whole personality. The Flicker took the restraint |
| 5 | `lilith` | **The Unloved** | craves affection, vengeful towards Celeste. Now she burns whatever doesn't love her |
| 5 | `jay-lester` | **The Unfinished Painting** | painter, submissive. He paints people over, and they stay painted |
| 5 | `skylar` | **The Queen of Mean** | Paradiso's queen bee. Cruelty is a crown, and she's never taking it off |
| 5 | `chris` | **The Golden Child** | your perfect older sibling. The perfect one needs a worse one to stand beside |
| 5 | `natsuki` | **The Locked Closet** | prickly, hides in the manga closet. She's locked herself, and the club, inside |
| 5 | `monika` | **The Author of Endings** | she knows she's in a story. The Flicker lets her hold the pen |
| 6 | `shogun-kagetora` | **The Blood Tyrant** | protective, strict. He'll protect his people from everyone, including his people |
| 6 | `rimu-hiraga` | **The Abandoned** | your childhood friend. You left. Again. She's decided you'll never leave again |
| 6 | `shino-okita` | **The Cold Blade** | cold, closed-off bodyguard. Guarding nothing, cutting everything |
| 6 | `mai-yamanobe` | **The Debt Collector** | the shopkeeper. Everyone owes, and the interest is blood |
| 7 | `arisa` | **The Spider Queen** | master manipulator, cruel under the cute. The web is the whole Academy |
| 7 | `helga` | **The Dead-Eyed Widow** | emotionally dead since her husband died. Now nothing is alive near her |
| 7 | `eri` | **The Glass Heart** | the tsundere. It's all *tsun*, and every kind word breaks her |
| 7 | `evil-villainess-chan` | **The Real Villainess** | the joke route villain. The Flicker stopped the joke |
| 7 | `reiko` | **The Investigator Who Found Nothing** | the anomaly investigator. Everything's an anomaly now, including her |
| 8 | `miracle` | **The Red Axe** | the guild receptionist who's obsessed with you. Doe's hound since Chapter 2 |
| 8 | `faneel` | **The Hollow Hand** | kleptomaniac. She steals things that aren't objects: voices, faces, years |
| 8 | `ophelia` | **The Shepherd of Slaughter** | hears a voice she thinks is god. The voice is the Flicker's static |
| 8 | `shirayukihime` | **The Blade That Wants** | a blood-knight kitsune. Her cursed blade finally got its way |
| 9 | `beatrice-avalistos` | **The Puppet Queen** | sees people as pieces on a board. Now *she's* the piece |
| 9 | `priest-pristo` | **The Thousand-Year Thirst** | the secret vampire, the oldest resident of Dalmavilla. He stopped joking about it |
| 9 | `julia-aquacrucis` | **The Frozen Saint** | gentle stuttering nun with the ice Essentia GELO. The ice is all that's left |
| 9 | `marl` | **The Bonebreaker** | already a brute. In the Colosseum of the Dead, she's champion forever |
| 9 | `mary` | **The Iron Maiden** | "selective". Nobody is good enough to leave her arena alive |
| 9 | `fine-catastrophe` | **The Loaded Die** | the dirty cheater. Every roll in the Colosseum is hers |
| 10 | `uzi` | **The Child Soldier** | a fake-tough failure on a suicide mission. The fear is gone, and so is the bluff. Only the mission is left |
| 10 | `hayley-kate` | **The Spotlight** | craves attention and group energy. She's become the light Doe's Engine runs on |
| 10 | `maria-hunley` | **The Mother Who Won't Let Go** | fiercely protective, stubborn. You are never leaving her sight again, and neither is anyone else |
| 10 | `doe` | **The Main Character** | wants to be looked at. Now everything looks at her, and there's nothing left of her to see |

### Heroes who become villains by choice

These people aren't plagued. They look at the dying worlds, make a hard choice to save someone, and the choice makes them your enemy.

| Ch | Character | Title | Who they're saving | What it costs |
|---|---|---|---|---|
| 3 | `marija` | **The Iron Mother** | her daughters. She already took in Delphine from a dead Earth and won't watch it twice | She seals the gateway and cuts Earth 1 off from every other world, stranding them all. You're locked in the vault, because you're what Doe wants |
| 5 | `celeste` | **The Jealous Heaven** | you, her charge | To keep the demons from the Flicker (and from you), she seals Lilith and every demon away. It's exactly what humans once did to Daphne's people |
| 6 | `sakura-tooyama` | **The True Heir** | her father, and the truth | She finds the real heir's grave. The world put *you* in a dead boy's place. She allies with Exodus to put the bloodline right |
| 7 | `sakuragi` | **The Prophet of Exodus** | everyone, sincerely | Exodus Inc. sells "transcendental relocation" out of dying worlds. Every relocated person *overwrites* someone in the world they land in. He knows. He calls it fate |
| 10 | `noelle` | — *(the one who didn't)* | Doe | Doe's lab assistant had every reason to turn and didn't. She's the quiet mirror to everyone in this table |

### The true villains

| Character | Want | Why it's dark |
|---|---|---|
| `doe` | to be the Main Character of every world | She's right that nobody ever looked at her. She's wrong about everything she does about it |
| `daphne` | to reduce humanity to livestock | Born to the Demon Lord and the Elf Queen. At five she watched humans seal every demon into another plane and slaughter the elves. She never emotes. She joins Doe because the Flicker can break the seal |
| `valse` | to end all life, as an act of love | The Flicker can't make her worse. She already "perceives her kills as acts of love". She sees the dying worlds as her calling |
| `delphie` | — | No memories, frilly black dress, red eyes, hates sunlight: **De-Pheria**. She's the part of Daphne that could still feel, split off at age five and lost in other people's dreams. She isn't a villain. She's the villain's heart |

### Allies along the way

`noelle` (Doe's assistant, your guide), `delphine` (survivor of the BAD SUN), `serris` (the white mage who notices "things just HAPPEN around you", and the only one who knows what that means), `zulu` (the self-declared villain who is on your side), `uzi` (eventually), `koko` (the Colosseum announcer, unhelpfully), and everyone you cure. Cured characters join the deck and show up in later chapters.

---

## 3. Structure at a glance

| # | Chapter | World | Boss | Mini-boss | Ends with |
|---|---|---|---|---|---|
| 1 | **The Glow** | Adoptive Life → New Haven → back | — | — | the letter; *call upon your weapon* |
| 2 | **The Plague Comes Home** | Adoptive Life | The Lost Sen (Maiko) | The Butcher of the Alley (Ben) | Doe, Uzi and Miracle come through the rift |
| 3 | **The Bad Sun** | New Haven | The Iron Mother (Marija) | The Warden (Care) | Doe's broadcast: she has Maria and Hayley |
| 4 | **Teeth in the Water** | The Coorong / Siren's Cove | The Thirst (Miss Mireille) | The Hunger Below (Rirarra) | Uzi fails to take you, and you see she's terrified |
| 5 | **Infernal Harmony** | The School on the Hill, Paradiso, the Literature Club | The Jealous Heaven (Celeste) | The Author of Endings (Monika) | the seal breaks the wrong way, and something below laughs |
| 6 | **Bloodline** | Bakumatsu Japan | The True Heir (Sakura) | The Blood Tyrant (Kagetora) | Sakura leaves for Exodus |
| 7 | **Exodus** | Shirayuki Academy / Exodus Inc. / Phantom Dream | The Prophet of Exodus (Sakuragi) | The Spider Queen (Arisa) | Delphie appears in your dreams: *"Which one of us is she?"* |
| 8 | **The Legend of You** | the Guild, the Peaks | The Demon Heir (Daphne) | The Saint of the Last Mercy (Valse) | Daphne joins Doe; Miracle is saved |
| 9 | **The Colosseum of the Dead** | Dalmavilla, the Reincarnation Colosseum | The Bonebreaker (Marl) | The Puppet Queen (Beatrice) | Daphne betrays Doe; the demon plane opens |
| 10 | **Main Character** | Earth 2 | The Main Character (Doe) | The Mother Who Won't Let Go (Maria) | the rifts become doors |

---

## 4. The Chapters

---

### Chapter 1 — The Glow

**World:** Adoptive Life (south England) → New Haven → back. **Theme:** you don't know what you are.

**Beats**
1. **School, an ordinary Tuesday.** Hayley chatters, James sulks, Maiko is early to everything. Halfway through maths, there's a **glow on the floor** between the desks. It's like light through water. Nobody else can see it. Hayley walks straight through it.
2. **You touch it.** For one heartbeat you see *everything*: a deer in a lab coat, a shark on a lifeguard tower, petals on a river, a castle of purple glass, a colosseum, a sky with two suns, each world flickering past like cards being shuffled.
3. **New Haven.** You wake on the cold floor of Lab A-3. A shy, jumpy young deer, **Noelle**, finds you first. She's Doe's trainee from Earth 2, visiting this Earth's Institute, and she's very nervous. She walks you to her boss.
4. **Doe's tests.** Doe is charming, teasing and delighted. She hooks you up to every instrument she owns. Every needle swings to point at you. Narrative mass, she calls it. The universe *looks* at you. She's never seen anything like it. She asks quiet, hungry questions. *Does everyone look at you? Do things just... happen around you?*
5. **The idea is born.** Doe, alone with the readings: *"If it can be measured... it can be moved."*
6. **Snapped back.** Mid-sentence, you're on the pavement in south England, walking home, school bag on your shoulder. Hayley's waving goodbye. You ask what happened. Nobody knows what you mean. You were never gone. You were just out of this version of your body.
7. **The letter.** That night, in your room, a letter falls from nowhere onto your bed. It's ones and zeroes, then underneath, in your own handwriting: *Beware of the unthinkable present and future. Call upon your weapon. Doe is coming.*
8. **Call upon your weapon.** *(Player spams **Space**.)* With every press, the room flickers harder: your bedroom; a lab; a beach at night; a dark castle; your bedroom again. Cards burst out of the air and land in your hands. Your deck. Then the flicker overwhelms you. You black out.

**Quests**
| id | foe | type | needs | text |
|---|---|---|---|---|
| `the-glow` | — (scene, `lesson`) | main | — | Something is glowing on the classroom floor. Nobody else can see it. |
| `lab-a3` | — (scene) | main | `the-glow` | A deer in a lab coat would like to run a few *tiny* tests. |
| `never-gone` | — (scene) | main | `lab-a3` | You're walking home. Nobody noticed you were gone. |
| `the-letter` | — (scene + weapon minigame) | main | `never-gone` | A letter in ones and zeroes. Call upon your weapon. |

**Key scene — The Glow**
```js
scene: { bg: 'Classroom', music: 'hello-hayley', lines: [
  { where: 'Class 4B', when: 'Tuesday, 10:40 AM' },
  ['*', 'Maths. Quadratics. The clock has not moved in eleven minutes.'],
  { enter: 'hayley-kate', at: 'right', mood: 'happy' },
  ['hayley-kate', 'happy', "Psst. Psssst. {name}. If x is boredom and y is James, what's the area of a sulk?"],
  { enter: 'james-lone', at: 'left', mood: 'neutral' },
  ['james-lone', 'neutral', "...I can hear you. Everyone can hear you."],
  { light: 'rift' },
  ['*', 'Then, between the desks, the floor starts to glow.'],
  ['*', 'Soft, rippling light, like sun through a swimming pool. It hums. Not out loud. Somewhere behind your teeth.'],
  ['you', "...Does anyone else see that?"],
  ['hayley-kate', 'neutral', "See what? Ooh, is it a spider? I'll name it."],
  ['*', 'She steps right through the light to look. Her shoe passes through it like it isn\'t there.'],
  ['*', 'It is there. It is looking at you.'],
  { choose: [
    ['Touch it.', [['*', 'You kneel. You reach out. Nobody stops you, because nobody can see what you\'re reaching for.']]],
    ['Ignore it.', [['*', 'You look away. It gets brighter. You look back. Your hand is already reaching for it.']]],
  ] },
  { fx: 'rift', sfx: 'vortex', sky: [50, 60, 1.6, 0] },
  { fade: 'white' },
  ['*', 'A deer in a lab coat. A shark on a tower. Petals on a river. A purple castle. A colosseum roaring. A sky with two suns.'],
  ['*', 'Every world at once, flickering past like a deck being shuffled.'],
  ['*', 'And in every single one of them, someone turns to look at you.'],
] },
```

**Key scene — Doe's Tests**
```js
scene: { bg: 'Lab A-3', music: 'none', lines: [
  { where: 'New Haven Institute of Science, Lab A-3', when: '???' },
  { enter: 'noelle', at: 'left', mood: 'scared' },
  ['noelle', 'scared', "Oh! Oh no, oh, you're awake. Hi. Hello. Please don't panic, I'm already panicking for both of us."],
  ['noelle', 'neutral', "You fell out of the gateway. Nobody falls out of the gateway. I'm Noelle. I'm... visiting. From Earth 2. My boss will want to see you. She always wants to see things."],
  { enter: 'doe', at: 'right', mood: 'excited' },
  ['doe', 'excited', "¡Hola! A visitor from nowhere! Noelle, cariño, coffee. Two. Make one of them mine.", { close: true }],
  ['doe', 'happy', "Doctor Doe Bullen. Sit, sit. This won't hurt. Probably. Hold this. And this. Don't touch that."],
  { sfx: 'beep' },
  ['*', 'Every screen in the lab turns, one after another, until they all point at you.'],
  ['doe', 'scared', "...That's not right. That's not even the right scale."],
  ['doe', 'neutral', "Let me ask you something strange. When you walk into a room, does everyone look at you? Do things just... happen around you? Like the story's waiting for you to arrive?"],
  ['you', "...I never really thought about it."],
  ['doe', 'sad', "No. You wouldn't have to.", { close: true }],
  ['doe', 'neutral', "On my Earth, I could set the lab on fire and they'd ask Noelle what happened. Nobody looks at me. Nobody ever has."],
  ['doe', 'happy', "But the universe looks at you. Every instrument I own is staring at you like a puppy."],
  { fx: 'flicker' },
  ['noelle', 'scared', "Doctor Doe, the readings are dropping, they're, they're going back, they're..."],
  ['doe', 'proud', "Hush. Write everything down. Every number."],
  { fx: 'rift', sfx: 'vortex' },
  ['*', 'The room starts to slide out from under you.'],
  ['doe', 'excited', "Wait! Wait, don't go yet, I haven't..."],
  { fade: 'white' },
  ['doe', 'neutral', "...If it can be measured... then it can be moved."],
] },
```

**Key scene — The Letter**
```js
scene: { bg: "Your's bedroom (Night)", music: 'none', lines: [
  { where: 'The Hunley house, your room', when: 'Tuesday, 11:58 PM', light: 'night' },
  ['*', 'You walked home. Mum made pasta. Julie stole your garlic bread. Nobody noticed anything.'],
  ['*', 'Nobody noticed you were gone, because to them, you never were.'],
  { sfx: 'paper' },
  ['*', 'A letter falls onto your bed. Out of nowhere. Out of the ceiling. Out of the air.'],
  ['binary-entity', 'neutral', '01100010 01100101 01110111 01100001 01110010 01100101 00100000 01101111 01100110 00100000 01110100 01101000 01100101 00100000 01110101 01101110 01110100 01101000 01101001 01101110 01101011 01100001 01100010 01101100 01100101'],
  ['*', 'Under the numbers, in handwriting. In YOUR handwriting.'],
  ['binary-entity', 'neutral', '"Beware of the unthinkable present and future. Call upon your weapon. Doe is coming."'],
  ['you', "...My weapon? I don't have a w..."],
  { fx: 'flicker' },
  ['*', 'Your hands are warm. Something wants to come out of them. Call it.'],
  { weapon: 'space', goal: 40, flicker: ['Lab A-3', 'beach at night', 'dark castle', 'mountain top'] },
  ['*', 'Cards. Dozens of them, bursting out of the air, landing in your hands, warm as handshakes. Faces you know. Faces you don\'t yet.'],
  ['*', 'Your deck.'],
  { fx: 'shake' },
  ['*', 'Then the flickering is too fast to follow, and you\'re falling, and the last thing you hear is a laugh you met this morning.'],
  ['doe', 'happy', '...Found you~'],
  { fade: 'black' },
] },
```

---

### Chapter 2 — The Plague Comes Home

**World:** Adoptive Life. **Theme:** the people you love, at their worst.

**Beats**
1. **Morning.** You wake up. The house is silent. Maria's mug is on the counter, still warm. There's a lunchbox with your name on it and a note: *"Sweetie, don't forget your..."* It stops mid-word. **Maria is gone. Hayley's house is dark. Hayley is gone.**
2. **James is flickering.** You find him at the school gates. He's there, then he's someone wearing his face, then he's back. His eyeliner is running in a way that has nothing to do with crying. The Flicker has found his worst trait (the costume of not caring) and made it all he is. **The Fake Emo.**
3. **The cure.** You beat him in a battle. The colour comes back into him. He sits on the kerb, shaking, and he says the most words he's said all year. The plague is spreading. It turns everyone into the worst version of themselves. You're the only one it doesn't touch.
4. **Saving the town, one at a time:**
   - **The Hollow Sister** (Kayla): in the Kates' empty house, she's tearing Hayley out of every family photo. She thinks she did this. She wished it, once.
   - **The Laughing Wound** (Julie): she's been laughing since dawn. She can't stop, and she's crying.
   - **The Martyr** (Isabella): she's given away her coat, her shoes, the house keys. She's trying to give away her name.
   - **The Butcher of the Alley** (Ben): the alley shortcut has become a place nobody walks out of. *(mini-boss)*
5. **The Lost Sen.** Maiko is in her family's dojo, alone, training at nothing. She was always honest. Now every blow lands with a truth meant to hurt: *you left, you don't belong here, she adopted you because no one else would.* The Lost Sen is a teacher with no student and no mercy. *(chapter boss)*
6. **The rift opens** over the town square. **Doe** steps through, now in a coat full of wires, with two figures from other worlds: **Uzi** (red jumpsuit, military cap, a terrifying sneer, shaking knees) and **Miracle** (a guild receptionist with a giant red war axe and a smile that isn't a smile). *"Get them."* Your cured friends hold the line. You start flickering again, and you're gone.

**Quests**
| id | foe | worst self | type | needs | text |
|---|---|---|---|---|---|
| `empty-house` | — (scene) | — | main | `the-letter` | The kettle is still warm. Mum isn't here. |
| `james-lone` | `james-lone` | The Fake Emo | main | `empty-house` | James is flickering at the school gates. He doesn't care. He never has. He never will. |
| `kayla-kate` | `kayla-kate` | The Hollow Sister | main | `james-lone` | The Kate house is dark. Someone upstairs is tearing photos in half. |
| `julie-hunley` | `julie-hunley` | The Laughing Wound | main | `james-lone` | You can hear Julie laughing from three streets away. She's been laughing for six hours. |
| `isabella-hunley` | `isabella-hunley` | The Martyr | main | `julie-hunley` | Isabella is giving everything away. Her coat. Her shoes. Her name. |
| `ben-brier` | `ben-brier` | The Butcher of the Alley | main (mini-boss) | `kayla-kate` | Nobody has come out of the alley shortcut since sunrise. |
| `maiko-ghan` | `maiko-ghan` | **The Lost Sen** | main (boss) | `isabella-hunley`, `ben-brier` | The dojo. One student left: you. She will tell you the truth about yourself. All of it. |
| `rift-in-the-square` | — (scene) | — | main | `maiko-ghan` | The sky over the square tears. Someone you met in a lab steps out. |
| `luther-jones` | `luther-jones` | The Boy Who Never Lands | side | `james-lone` | Luther has been mid-ollie above the skate park since 6 AM. |
| `catherine-jones` | `catherine-jones` | The Price Tag | side | `luther-jones` | Catherine Jones is putting price tags on the children of the town. "Organic" ones are worth more. |

**Key scene — The Fake Emo** (`before`)
```js
before: { bg: 'School gate', music: 'none', lines: [
  { where: 'The school gates', when: 'Wednesday, 8:30 AM', light: 'dark' },
  ['*', 'The playground is empty. Swings moving on their own. No wind.'],
  { enter: 'james-lone', at: 'center', mood: 'neutral' },
  { fx: 'flicker' },
  ['*', 'James is sitting on the wall. Then he isn\'t. Then he is, but wrong: black lipstick, a chain, a T-shirt for a band that doesn\'t exist in any world.'],
  ['james-lone', 'neutral', "Oh. It's you. Whatever."],
  ['you', "James, where is everyone? Where's Hayley?"],
  ['james-lone', 'proud', "Who cares. Nobody cares. That's the secret. I figured it out. If you don't care, nothing can get you."],
  { fx: 'flicker' },
  ['james-lone', 'rage', "SO I DON'T. I don't care about this school, or this town, or my dad crying at the vacuum catalogue, or YOU.", { close: true, shake: true }],
  ['james-lone', 'sad', "...I don't. I don't. I don't."],
  ['*', 'It isn\'t armour anymore. It\'s all there is. A costume with nobody inside.'],
  ['james-lone', 'angry', "Go on then. Play me. It won't matter. Nothing does."],
] },
```
`after`
```js
after: { lines: [
  { light: 'none' },
  ['*', 'The eyeliner is gone. It was never his. He\'s sitting on the kerb with his head in his hands.'],
  ['james-lone', 'scared', "...I could hear myself. The whole time. Saying all that. I couldn't stop."],
  ['james-lone', 'sad', "It's in everyone. Since last night. People are turning into the... the worst bit of themselves. The bit you hide."],
  ['james-lone', 'neutral', "But it doesn't touch you. Why doesn't it touch you?"],
  ['you', "I don't know."],
  ['james-lone', 'neutral', "...Then you'd better go get the others. I'll come. I don't... I do care. Okay? Don't tell anyone."],
] },
```

**Key scene — The Lost Sen** (`before`)
```js
before: { bg: 'Dojo', music: 'none', lines: [
  { where: 'The Ghan family dojo', when: 'Wednesday, 4:00 PM', light: 'candle' },
  ['*', 'Thud. Thud. Thud. A bag hanging from the ceiling, split, sand pouring out. She hasn\'t stopped.'],
  { enter: 'maiko-ghan', at: 'center', mood: 'neutral' },
  ['maiko-ghan', 'neutral', "You're late. A student is never late."],
  ['you', "Maiko, it's me. I'm not your..."],
  ['maiko-ghan', 'angry', "Stance. Now."],
  ['maiko-ghan', 'neutral', "I only ever told the truth. That was my thing. Honest Maiko. Too honest. Hayley laughed when I said it."],
  ['maiko-ghan', 'proud', "So here is the truth, student. You don't belong here. You fell into this town like a stone into a pond. She adopted you because the forms were already signed and nobody else would."],
  ['maiko-ghan', 'rage', "And everyone who stands next to you disappears.", { close: true, shake: true }],
  { choose: [
    ['"That isn\'t the truth. That\'s just the cruellest thing you can think of."', [['maiko-ghan', 'sad', "...Is there a difference?"]]],
    ['"Then teach me. Properly."', [['maiko-ghan', 'proud', "Finally. A student. HI-YAH!"]]],
  ] },
] },
```

**Key scene — The Rift in the Square**
```js
scene: { bg: 'Town square', music: 'doomsday-clock-midnight', lines: [
  { where: 'The town square', when: 'Wednesday, dusk', light: 'rift' },
  { fx: 'rift', sfx: 'vortex', sky: [50, 22, 1.5, -6] },
  ['*', 'Everyone you saved is behind you: James, Kayla, Julie, Isabella, Ben, Maiko. Still shaky. Still themselves.'],
  { enter: 'doe', at: 'center', mood: 'excited' },
  ['doe', 'excited', "¡Hola, hola! The Main Character! Oh, wait. Not yet. Soon.", { close: true }],
  ['doe', 'happy', "You left before I could finish my tests, cariño. Rude. But you left me a LOT of numbers."],
  ['isabella-hunley', 'angry', "Where is my sister? Where's Maria?!"],
  ['doe', 'neutral', "Safe. Warm. Very important. You know what an anchor is? Mm. You will."],
  { enter: 'uzi', at: 'left', mood: 'proud' },
  ['uzi', 'proud', "I am the CRIMSON HARE. Lowly puppy, kneel before a soldier of the... the... federation-destroying... I'm very scary!"],
  ['*', 'Her knees are shaking.'],
  { enter: 'miracle', at: 'right', mood: 'happy' },
  ['miracle', 'happy', "Hiii~! Adventurer registration's closed, but I made an exception. I make all my exceptions for you. Only you. Forever and ever and ever."],
  ['*', 'She is dragging a red war axe behind her. It leaves a line in the cobbles.'],
  ['doe', 'proud', "Get them."],
  ['maiko-ghan', 'angry', "Student! RUN. That is an honest instruction!"],
  { fx: 'flicker' },
  ['*', 'You start to flicker. The square, a beach, the square, a lab, the square...'],
  ['julie-hunley', 'scared', "{name}! Come back! You have to come back!"],
  { fade: 'white' },
] },
```

---

### Chapter 3 — The Bad Sun

**World:** New Haven (Earth 1). **Theme:** the people who would do anything to protect their own.

**Beats**
1. You land in New Haven, which is wrong. The sky has a faint, second sun, just a pale smear. The Institute's alarms are going.
2. **Noelle** finds you again. She ran from Doe. She's seen what the Engine does. Her boss drained Earth 2's "you" first, and Earth 2 is flickering.
3. **The Doe Nobody Mourns** (Diana): Diana is translucent. She's decided Doe is the "real" Diana, the confident one, the one who matters, and she's letting herself fade out. Beating her pulls her back.
4. **The Forgotten Sister** (Jane), **The Predator's Smile** (Quinta), **The Locked Door** (Aria).
5. **Delphine's story.** In a quiet room, Delphine, the Earth 3 survivor Marija adopted, tells you what a world with no "you" looks like. *The second sun came up and it never went down. Everyone became the worst of themselves. Quistis was my best friend.* The pale smear in the sky is how it started.
6. **Marija's choice.** Marija has seen the smear too. She's lost a husband. She took in one daughter from a dead Earth, and she won't watch it twice. **She seals the gateway forever**, cutting Earth 1 loose from every other world: your town, Maria, Hayley, all of it. And because Doe wants you, **you go in the vault.** She isn't plagued. She is choosing this. *The Iron Mother.*
7. **The Warden.** The lockdown runs on a domestic AI protocol called C.A.R.E., and Care has been waiting for a house this big. *"Welcome home, Beloved. You will stay."*
8. You fight through the Institute to Marija. Delphine is the one who stops it: *"You saved me by opening a door, Mamá. Don't close it on someone else."*
9. Every screen in the Institute lights up with a broadcast from Doe on Earth 2. Behind her, in the Engine, two figures sleep: **Maria and Hayley.** *Anchors. Come and get them, Main Character. Or don't. Either way, I win.*

**Quests**
| id | foe | worst self / title | type | needs | text |
|---|---|---|---|---|---|
| `second-sun` | — (scene) | — | main | `rift-in-the-square` | New Haven. There's a smear in the sky that looks like a second sun. |
| `diana` | `diana` | The Doe Nobody Mourns | main | `second-sun` | Diana is see-through. She says it's fine. She says Doe is the real one anyway. |
| `jane` | `jane` | The Forgotten Sister | main | `diana` | Jane has deleted herself from the family group chat. And from the family photos. And from the door sign. |
| `delphines-story` | — (scene) | — | main | `jane` | Delphine survived Earth 3. She'd like to tell you what happens next. |
| `care` | `care` | The Warden (mini-boss) | main | `delphines-story` | The Institute is in lockdown. The voice over the speakers calls you "Beloved". |
| `marija` | `marija` | **The Iron Mother** (boss, choice) | main | `care` | The Director has sealed the gateway forever. Every other world is on its own. And you are in the vault. |
| `doe-broadcast` | — (scene) | — | main | `marija` | Every screen in New Haven shows the same face. |
| `quinta` | `quinta` | The Predator's Smile | side | `diana` | Quinta's grin is too wide. Something from Earth 3 is wearing it. |
| `aria` | `aria` | The Locked Door | side | `jane` | Nobody gets in or out. Not even Aria's own daughter. |
| `natalie` | `natalie` | The Deer in Headlights | side | `aria` | Natalie froze by a window yesterday. She hasn't moved since. |
| `juniper` | `juniper` | The Cousin Who Takes | side | `quinta` | Juniper always wanted what Diana had. Now she's taking it, one thing at a time. |

**Key scene — Delphine's Story**
```js
scene: { bg: 'Institute break room', music: 'none', lines: [
  { where: 'NHIS, an empty break room', when: 'Night' },
  { enter: 'delphine', at: 'center', mood: 'neutral' },
  ['delphine', 'neutral', "Oh... h-hello. You're the one who fell through. Sit, please. I made too much tea. I always do."],
  ['delphine', 'sad', "On my Earth, Earth 3, there was someone everything was about. We didn't know. You never know. And one day they were... gone."],
  ['delphine', 'neutral', "First it was little things. My friend Quistis was always a bit cruel. Joking cruel. Playing. Then one morning it wasn't a joke anymore."],
  ['delphine', 'scared', "Then the second sun came up. And it never went down.", { close: true }],
  ['delphine', 'sad', "Everyone became the worst part of themselves. For good. No cure. I only lived because I ran, and ate whatever I could find, and Mamá Marija opened a door."],
  ['delphine', 'neutral', "That smear in the sky out there? That's how it started for us."],
  ['you', "Then why is it starting here?"],
  ['delphine', 'scared', "...Because someone's taking your world's 'you' away. A little at a time. And the 'you' of this one. And the next."],
] },
```

**Key scene — The Iron Mother** (`before`)
```js
before: { bg: 'The gateway', music: 'doomsday-clock-midnight', lines: [
  { where: 'The gateway chamber', when: 'Lockdown, hour 9', light: 'rift' },
  { enter: 'marija', at: 'center', mood: 'neutral' },
  ['marija', 'neutral', "You found the way out of the vault. Of course you did. Things happen around you, don't they."],
  ['marija', 'sad', "I lost my husband. I took in a daughter from a world that burned. I have done enough losing for one life."],
  ['marija', 'proud', "So I am closing the door. Forever. Earth 1 will float alone, and the sun will stay single, and my girls will live."],
  ['you', "And everyone else? My town? My mum?"],
  ['marija', 'sad', "...I am sorry, cariño. I truly am. I am a mother. I can only save mine."],
  { enter: 'care', at: 'right', mood: 'happy' },
  ['care', 'happy', "Beloved has left their room again. It's all right, Director. I'll keep them. I'll keep everyone. Forever and ever."],
  ['marija', 'rage', "If you want the door, you will have to take it from me.", { close: true, shake: true }],
] },
```
`after`
```js
after: { lines: [
  { enter: 'delphine', at: 'left', mood: 'scared' },
  ['delphine', 'sad', "Mamá. You saved me by opening a door. Please don't close it on someone else's daughter."],
  ['marija', 'sad', "...Mi niña."],
  ['*', 'The Director puts her hand on the console. The gateway unseals, just a crack.'],
  ['marija', 'neutral', "Go. Bring your mother home. And if that woman with my daughter's face hurts one more world... remind her whose family she's from."],
] },
```

**Key scene — Doe's Broadcast**
```js
scene: { lines: [
  { fx: 'flicker', sfx: 'static' },
  ['*', 'Every screen in the Institute. Every phone. Every vending machine display.'],
  { enter: 'doe', at: 'center', mood: 'happy' },
  ['doe', 'happy', "¡Hola, New Haven! Hola, Diana, you look a little see-through, cariño. Eat something."],
  ['doe', 'proud', "And hola to you, my favourite test subject. I have something of yours."],
  ['*', 'The camera turns. A machine as big as a cathedral, humming. Two glass pods at its heart.'],
  ['*', 'Maria, asleep. Hayley, asleep. Light pouring out of them into the wires.'],
  ['doe', 'neutral', "Anchors. The people closest to the 'you' hold the most of it. Did you know that? I didn't. Science!"],
  ['doe', 'excited', "Every world I drain, I get a little more looked at. Every world you save, you come a little closer. Either way, you're walking to me."],
  ['doe', 'happy', "Come and get them, Main Character. Bring friends. The more people looking, the better~", { close: true }],
] },
```

---

### Chapter 4 — Teeth in the Water

**World:** The Coorong beach and Siren's Cove Resort. **Theme:** hunger, and the restraint that used to hold it.

**Beats**
1. You flicker onto a beach at night under the same pale smear. The lifeguard tower is empty. Something big moves under the water.
2. **The Hunger Below** (Rirarra): the playful big-sis shark girl who nibbled for fun has forgotten what fun is. She's the mini-boss of the Coorong. **The Riptide** (Rowdy) drags swimmers down "to keep them safe". **The Scrapyard Heart** (Daphne Mokarran) is taking the pier apart, then the people.
3. **Uzi** finds you on the pier. She's alone. She does the whole speech: *Crimson Hare, lowly puppy, kneel.* She draws a weapon. Her hands shake so hard she drops it in the sea. She was sent on a suicide mission once already. Doe is sending her on another. **You let her go.** She doesn't understand why.
4. **Siren's Cove Resort**, up the coast. The guests are checking out, permanently. **The Girl Who Checked Out** (Nova Starr) erases names from the register. **The Mirror** (Selene) has made every reflection in the resort her own. The ghost **Cassian Daly** (*The Headline*) writes tomorrow's obituaries in advance.
5. **The Thirst.** Miss Mireille's whole personality was restraint: order, rules, a very well-warded secret. The Flicker took the restraint, and what's left is centuries of thirst. The resort is her web. *(boss)*
6. Cured, Mireille sits at the empty bar with you. *"The rules were never for the guests, you know. They were for me."* She warns you that Doe's "Supporting Cast" stayed here last week: a saint who smiled too much, a princess with a purple dress, a girl with horns who didn't blink.

**Quests**
| id | foe | worst self | type | needs | text |
|---|---|---|---|---|---|
| `night-beach` | — (scene) | — | main | `doe-broadcast` | A beach at night. The lifeguard tower is empty. The water is not. |
| `rirarra-charca` | `rirarra-charca` | The Hunger Below (mini-boss) | main | `night-beach` | Big Sis is in the water. She doesn't remember what watermelon is. |
| `uzi-on-the-pier` | — (scene) | — | main | `rirarra-charca` | A girl in a red jumpsuit is waiting on the pier. Her knees are knocking. |
| `nova-starr` | `nova-starr` | The Girl Who Checked Out | main | `uzi-on-the-pier` | The night clerk at Siren's Cove is checking guests out. Of the register. Of everything. |
| `selene` | `selene` | The Mirror | main | `nova-starr` | Every mirror in the resort shows the same face. None of them are yours. |
| `miss-mireille` | `miss-mireille` | **The Thirst** (boss) | main | `selene` | The manager has stopped keeping her secret. House rules no longer apply. |
| `rowdy-brachy` | `rowdy-brachy` | The Riptide | side | `rirarra-charca` | Rowdy is pulling swimmers under. Gently. Lovingly. Permanently. |
| `daphne-mokarran` | `daphne-mokarran` | The Scrapyard Heart | side | `rowdy-brachy` | The hammerhead engineer is taking the pier apart. Then the people. |
| `cassian-daly` | `cassian-daly` | The Headline | side | `nova-starr` | The resort ghost is typing tomorrow's obituaries. Yours is on page one. |
| `jace-leoni` | `jace-leoni` | The Last Lifeguard | side | `selene` | Jace has decided no one swims, no one runs, no one leaves the grounds. Ever. |

**Key scene — Uzi on the Pier**
```js
scene: { bg: 'Pier at night', music: 'none', lines: [
  { where: 'The Coorong pier', when: 'Midnight', weather: 'rain' },
  { enter: 'uzi', at: 'center', mood: 'proud' },
  ['uzi', 'proud', "Halt, lowly puppy! It is I, the CRIMSON HARE, elite destroyer of... of... you know! Kneel!"],
  ['you', "You're shaking."],
  ['uzi', 'angry', "It's COLD! Soldiers get cold! Kneel or I'll... I'll..."],
  { sfx: 'splash' },
  ['*', 'She draws something metal from her belt. Her hands are trembling so hard it flies out of them, bounces once, and drops into the sea.'],
  ['uzi', 'scared', "...That was my only one."],
  ['uzi', 'sad', "They sent me to blow up a ship once. A suicide mission. I was supposed to die on it. Everybody else did. I didn't. I didn't even do THAT right."],
  ['uzi', 'scared', "And now the deer lady says if I bring you back, I get a world. A whole world where I'm actually scary. Please just come quietly. Please."],
  { choose: [
    ['"Go home, Uzi."', [['uzi', 'scared', "I... I don't have one."], ['you', "Then go somewhere that isn't her."]]],
    ['"Nobody should send you to die."', [['uzi', 'sad', "...Nobody's ever said that before."]]],
  ] },
  ['*', 'She runs. Halfway down the pier she stops and looks back, like she\'s trying to work out what just happened.'],
  ['*', 'Then the rain gets heavier and she\'s gone.'],
] },
```

**Key scene — The Thirst** (`after`)
```js
after: { bg: 'Resort bar', music: 'none', lines: [
  { where: "Siren's Cove, the empty bar", when: '3:00 AM', light: 'candle' },
  { enter: 'miss-mireille', at: 'center', mood: 'sad' },
  ['miss-mireille', 'sad', "Four hundred years of house rules. Do you know who the rules were for? Not the guests."],
  ['miss-mireille', 'neutral', "They were for me. Every one. Order, structure, check-out at eleven. A cage I built and kept the key to. And the plague... simply took the key."],
  ['miss-mireille', 'neutral', "A word, since you've been kind. Your deer stayed here last week. With guests."],
  ['miss-mireille', 'scared', "A saint who smiled at the children too long. A princess in purple who called my staff 'pieces'. And a little thing with horns who did not blink. Not once. Not in three days."],
  ['miss-mireille', 'proud', "Whatever she's building, the guest list is very poor. Do be careful."],
] },
```

---

### Chapter 5 — Infernal Harmony

**World:** The School on the Hill (Infernal Harmony), Paradiso, the Literature Club, all fallen together into one hillside. **Theme:** love that turns to possession.

**Beats**
1. You land at a prom. The banners are burning. **Lilith**, the little devil who only ever wanted affection, has become **The Unloved**. Whatever doesn't love her catches fire. She's crowned herself prom queen of an empty hall.
2. **Celeste**, your guardian angel, finds you first. She's terrified *for* you. She has a plan: seal Lilith, seal every demon, so the Flicker can't use them and nothing infernal can ever reach you. She asks for your help. You say no. **She does it anyway.** *(The Jealous Heaven, a choice.)*
3. Paradiso: **The Golden Child** (Chris), your perfect older sibling, needs you to be the worse one. **The Queen of Mean** (Skylar) rules the mall.
4. The Literature Club: the club room is locked. **The Locked Closet** (Natsuki) won't come out. Inside, **Monika, The Author of Endings**, has found the Flicker's pen. She's always known she's in a story. Now she can write. She's deleting everyone else's lines so the story can end on her. *(mini-boss)*
5. **The seal.** Celeste's seal is a mirror of the one humans once used on Daphne's people: the same light, the same words. As it closes over Lilith, **something below laughs.** The seal isn't closing, it's being *pulled*. Someone on the other side wanted demons sealed exactly here, so the seal could be broken from below.
6. You beat Celeste and free Lilith. Celeste weeps: *"I only wanted you safe."* Lilith, cured and crying, forgives her. It's the first time either of them has done it. They hold the seal shut together while you flicker on.

**Quests**
| id | foe | worst self / title | type | needs | text |
|---|---|---|---|---|---|
| `burning-prom` | — (scene) | — | main | `miss-mireille` | A prom on a hill. The banners are on fire. Nobody is dancing. |
| `lilith` | `lilith` | The Unloved | main | `burning-prom` | Lilith has crowned herself prom queen. Everything that doesn't love her burns. |
| `chris` | `chris` | The Golden Child | main | `burning-prom` | Your perfect older sibling. Perfect people need someone worse to stand beside. |
| `monika` | `monika` | The Author of Endings (mini-boss) | main | `chris` | The Literature Club is locked. Someone inside is writing everyone else out. |
| `celeste` | `celeste` | **The Jealous Heaven** (boss, choice) | main | `lilith`, `monika` | Your guardian angel is sealing every demon away. For you. Whether you want it or not. |
| `jay-lester` | `jay-lester` | The Unfinished Painting | side | `lilith` | Jay paints over people. They stay painted. |
| `skylar` | `skylar` | The Queen of Mean | side | `chris` | The mall is Skylar's kingdom. Cruelty is the dress code. |
| `natsuki` | `natsuki` | The Locked Closet | side | `monika` | Natsuki's locked in the manga closet. She's not coming out. Nobody is. |
| `clara-click` | `clara-click` | The Last Word | side | `jay-lester` | Clara Click has to win every argument. She's started winning them with fire. |

**Key scene — The Author of Endings** (`before`)
```js
before: { bg: 'Club room', music: 'none', lines: [
  { where: 'The Literature Club', when: 'After school. Every day. Forever.', light: 'dark' },
  { enter: 'monika', at: 'center', mood: 'happy' },
  ['monika', 'happy', "Oh! Welcome to the Literature Club. Sorry about the mess. I'm editing."],
  ['*', 'The other chairs are empty. On the desks, the girls\' poems are being crossed out, line by line, by no one.'],
  ['monika', 'neutral', "I always knew this was a story, you know. I could see the edges. And now, with this plague... I can reach them. I have a pen."],
  ['monika', 'sad', "Every story ends the same way: on its 'you'. Never on me. So I'm writing everyone else out. Just a little. Just until it's quiet."],
  ['monika', 'proud', "Then it's just us. Just Monika, and the main character. Isn't that the ending you'd choose?", { close: true }],
  { choose: [
    ['"No. I want everyone."', [['monika', 'angry', "...Then you've never had to be the only one who knows."]]],
    ['"You don\'t need to erase anyone to be seen."', [['monika', 'sad', "Easy for you to say. Everything already sees you."]]],
  ] },
] },
```

**Key scene — The Jealous Heaven** (`before`)
```js
before: { bg: 'School roof', music: 'doomsday-clock-midnight', lines: [
  { where: 'The roof of the School on the Hill', when: 'Midnight', light: 'rift', weather: 'embers' },
  { enter: 'celeste', at: 'center', mood: 'neutral' },
  ['celeste', 'neutral', "I am your guardian angel. Do you know what that means? It means your safety is the only thing I'm for."],
  ['celeste', 'sad', "The demons are flickering. If the plague takes them, there is nothing in any world that can stop them. And they will come for you, darling. They always come for the one everyone looks at."],
  { enter: 'lilith', at: 'left', mood: 'scared' },
  ['lilith', 'scared', "Celeste... d-don't. Please. I'm cured, look, I'm FINE, I just want..."],
  ['celeste', 'angry', "You always 'just want'. Affection, attention, them."],
  ['celeste', 'proud', "Heaven sealed the demons once before, on another world. It worked beautifully. Nobody missed them."],
  { fx: 'flash', sfx: 'holy' },
  ['*', 'Light pours from her hands into the ground. Somewhere far below, in the dark under the light...'],
  { sfx: 'laugh' },
  ['*', '...something laughs.'],
  ['celeste', 'scared', "...That wasn't me."],
  ['celeste', 'rage', "It doesn't matter. Stand aside, darling. I won't lose you to anyone, not even you.", { close: true, shake: true }],
] },
```

---

### Chapter 6 — Bloodline

**World:** Bakumatsu Japan, the cherry river and the shogun's palace. **Theme:** what you're owed by blood, and what you earn.

**Beats**
1. Petals on the river, but they're grey. The shogun's palace is shut. Soldiers are stopping travellers and checking their faces against a list.
2. **The Abandoned** (Rimu): your childhood friend. Poverty, laughter, dreams, and then you left for the palace. You're leaving again now, flickering. She's decided you never will again, even if she has to break your legs to make sure. *(Her worst trait is her love.)*
3. **The Cold Blade** (Shino) guards nothing, cutting everything. **The Debt Collector** (Mai Yamanobe) charges interest in blood.
4. **The Blood Tyrant.** Kagetora was always protective and strict. Now he's protecting his people from everyone, including his people. The lists at the gate are purge lists. *(mini-boss)*
5. **Sakura's discovery.** Sakura, the shogun's real daughter, who always asked *"Father chose YOU?"*, finds a small grave behind the shrine. The real heir of the main family died as a child. The world, needing its "you", **put you in his place.** You aren't of the blood. You never were.
6. She isn't plagued. She's right. She has the truth and a ruined father, and she wants the bloodline put back the way it should be. An envoy in a sharp suit is waiting: **Exodus Inc.** can "relocate" you somewhere else and let the bloodline heal. *(The True Heir, a choice, boss.)*
7. You beat her. You don't argue with the grave. You tell her it's true, and that Kagetora chose you anyway, and that being chosen isn't a lie. Kagetora, cured, kneels at his son's grave for the first time. Sakura goes to Exodus anyway, to see what they really do. She'll be there in Chapter 7.

**Quests**
| id | foe | worst self / title | type | needs | text |
|---|---|---|---|---|---|
| `grey-petals` | — (scene) | — | main | `celeste` | The petals on the river are grey. Soldiers check every face against a list. |
| `rimu-hiraga` | `rimu-hiraga` | The Abandoned | main | `grey-petals` | Your childhood friend. You left her once. She's making sure you never leave again. |
| `shino-okita` | `shino-okita` | The Cold Blade | main | `rimu-hiraga` | The bodyguard has no one left to guard. She cuts anyway. |
| `shogun-kagetora` | `shogun-kagetora` | The Blood Tyrant (mini-boss) | main | `shino-okita` | The lists at the gate are purge lists. The shogun wrote them himself. |
| `the-small-grave` | — (scene) | — | main | `shogun-kagetora` | Behind the shrine there's a grave with no flowers. The name on it is the heir's. |
| `sakura-tooyama` | `sakura-tooyama` | **The True Heir** (boss, choice) | main | `the-small-grave` | Sakura knows what you are. Exodus Inc. has offered to move you somewhere else. |
| `mai-yamanobe` | `mai-yamanobe` | The Debt Collector | side | `grey-petals` | Everyone owes the river-hut keeper. The interest is blood. |
| `ayaka-yamanami` | `ayaka-yamanami` | The Sister Who Breaks | side | `shino-okita` | Big sister's lessons have stopped being lessons. |
| `bandit` | `bandit` | The Ransom of Everyone | side | `rimu-hiraga` | The bandit has taken the whole village hostage. Including himself. |

**Key scene — The Small Grave**
```js
scene: { bg: 'Shrine', music: 'none', lines: [
  { where: 'Behind the palace shrine', when: 'Dawn', weather: 'petals' },
  { enter: 'sakura-tooyama', at: 'center', mood: 'neutral' },
  ['*', 'A small stone. Moss. No flowers. A child\'s name, and a family crest you\'ve worn on your sleeve for a year.'],
  ['sakura-tooyama', 'neutral', "He was six. The real heir. He died the winter my father started searching."],
  ['sakura-tooyama', 'angry', "And then one day, there you were. An orphan with the right face. And everyone just... accepted it. Even me, almost."],
  ['sakura-tooyama', 'sad', "You aren't of the blood. You never were. The world needed someone at the centre, so it put you in a dead boy's place."],
  ['you', "...I didn't know."],
  ['sakura-tooyama', 'proud', "I believe you. That's what makes it unbearable."],
  ['sakura-tooyama', 'neutral', "A man from a company called Exodus came yesterday. He says they can move you. Somewhere you belong. And my father's line can heal."],
  ['sakura-tooyama', 'rage', "I'm not plagued, {name}. I'm right. Draw.", { close: true, shake: true }],
] },
```
`after`
```js
after: { lines: [
  { enter: 'shogun-kagetora', at: 'left', mood: 'sad' },
  ['shogun-kagetora', 'sad', "...I knew. I always knew. I chose them anyway."],
  ['shogun-kagetora', 'neutral', "A shogun cannot choose his blood, Sakura. But a father can choose his son. And his daughter. Both."],
  ['*', 'He kneels at the small grave. For the first time in all these years, he leaves a flower.'],
  ['sakura-tooyama', 'sad', "...I'm still going to Exodus. Not for you. I want to see what they really do with the people they 'move'."],
  ['sakura-tooyama', 'neutral', "If they're lying, I'll be the first to know. Find me there."],
] },
```

---

### Chapter 7 — Exodus

**World:** Shirayuki Academy (which fell into Bakumatsu Japan), Exodus Inc. HQ, and the Phantom Dream. **Theme:** escape, and who pays for it.

**Beats**
1. **Exodus Inc.** is everywhere: posters, jingles, a smiling CEO in every video. *Destiny is calling! Transcendental Relocation for the Protagonist in You!* With the Flicker spreading, business has never been better.
2. **Shirayuki Academy** shouldn't be in Bakumatsu Japan at all. The answer: **Arisa's family bought the entire Academy's passage out** of their own dying world. **The Spider Queen** (Arisa) has the Academy in her web, cute and cruel, with everyone useful. **The Dead-Eyed Widow** (Helga) signed the papers knowing the cost, because Arisa is the only thing she still feels anything for.
3. **The cost.** Sakura, inside Exodus, finds out what relocation does. A person moved into a world **overwrites** someone already there. The Academy's landing erased a village. Every Exodus "client" is a quiet murder. Marise Kanzaki, Exodus's own liaison, is horrified. She didn't know.
4. **The Real Villainess** (Evil Villainess-chan): the joke route is over. **The Glass Heart** (Eri). **The Investigator Who Found Nothing** (Reiko), whose investigation into the anomaly has become an anomaly itself.
5. **Sakuragi.** He isn't plagued. He's a true believer, theatrical and absolutely sincere. He knows about the overwriting. He calls it *fate*: someone always has to stop being the protagonist so someone else can be. And the relocation tech? He bought it from a scientist from Earth 2. Doe funded the Engine by selling escape. *(The Prophet of Exodus, a choice, boss.)*
6. **The Phantom Dream.** That night you dream. A girl in a frilly black dress with red eyes is sitting on the end of your bed, bossy, petty, bored. **Delphie.** She has no memories. She hates sunlight. She has been wandering through other people's dreams for as long as she can remember, which isn't long. *"There's a girl in your dreams who looks like me. She doesn't blink. Which one of us is she?"*

**Quests**
| id | foe | worst self / title | type | needs | text |
|---|---|---|---|---|---|
| `relocation` | — (scene) | — | main | `sakura-tooyama` | Exodus Inc. posters on every wall. "Destiny is calling!" |
| `arisa` | `arisa` | The Spider Queen (mini-boss) | main | `relocation` | Shirayuki Academy is a web. The student council president is at the centre. |
| `helga` | `helga` | The Dead-Eyed Widow | main | `arisa` | The headmistress signed the relocation papers. She knew. She didn't feel anything. |
| `the-erased-village` | — (scene) | — | main | `helga` | Sakura found out where the Academy landed. There was a village there. Was. |
| `sakuragi` | `sakuragi` | **The Prophet of Exodus** (boss, choice) | main | `the-erased-village` | Exodus's CEO has an explanation. It is grand. It is sincere. It is mass murder. |
| `phantom-dream` | — (scene) | — | main | `sakuragi` | Someone is sitting at the end of your bed. You're asleep. So is she. |
| `evil-villainess-chan` | `evil-villainess-chan` | The Real Villainess | side | `arisa` | OHOHOHO! The joke route has ended. She isn't joking now. |
| `eri` | `eri` | The Glass Heart | side | `arisa` | All tsun, no dere. Every kind word breaks her. |
| `reiko` | `reiko` | The Investigator Who Found Nothing | side | `phantom-dream` | The anomaly investigator has become an anomaly. |
| `marise-kanzaki` | `marise-kanzaki` | The Liaison Who Knew | side | `sakuragi` | Exodus's liaison read the terms at last. She needs a game to stop shaking. |

**Key scene — The Prophet of Exodus** (`before`)
```js
before: { bg: 'Exodus HQ', music: 'grand-proclamations', lines: [
  { where: 'Exodus Inc., top floor', when: 'Destiny o\'clock' },
  { enter: 'sakuragi', at: 'center', mood: 'proud' },
  ['sakuragi', 'proud', "BEHOLD! Fate has brought you to Exodus Incorporated! Welcome, Protagonist!"],
  { enter: 'sakura-tooyama', at: 'left', mood: 'angry' },
  ['sakura-tooyama', 'angry', "There was a village where the Academy landed. Sixty people. They're GONE. Not moved. Gone."],
  ['sakuragi', 'neutral', "Not gone, child. Overwritten. A story only has room for so many protagonists. When a new one arrives, one must... step aside."],
  ['sakuragi', 'proud', "The worlds are dying! The plague! The second suns! Exodus offers every soul a second chapter! And if it is written over someone else's... well. That is fate. Fate is never polite."],
  ['you', "Where did you get the technology?"],
  ['sakuragi', 'happy', "A visionary! A deer from Earth 2, brilliant, misunderstood. She needed funding for her great Engine. I needed doors. We were destined."],
  ['*', 'Doe built the Engine with money from people running away from what the Engine was doing.'],
  ['sakuragi', 'rage', "Now, Protagonist! Your relocation is pre-approved! Destination: ANYWHERE BUT HERE!", { close: true, shake: true }],
] },
```

**Key scene — Phantom Dream**
```js
scene: { bg: 'Dream bedroom', music: 'none', lines: [
  { where: 'A dream', when: 'You should be asleep', light: 'night', weather: 'stars' },
  { enter: 'delphie', at: 'center', mood: 'proud' },
  ['delphie', 'proud', "Ohohoho! Finally. Do you know how long I've been sitting on the end of your bed? Fetch me something sweet, servant."],
  ['you', "...Who are you?"],
  ['delphie', 'neutral', "Delphie. That's all. Every time I try to remember more, my head goes all..."],
  ['delphie', 'sad', "...woozy. I wander through people's dreams. They're the only places without sunlight."],
  ['delphie', 'neutral', "But lately there's a girl in YOUR dreams. She's dressed like me. She has my eyes. She has horns, and she doesn't blink, and she never, ever cries."],
  ['delphie', 'scared', "She looks at you like you're an insect. And she looks at ME like I'm something she lost.", { close: true }],
  ['delphie', 'sad', "...Which one of us is she?"],
] },
```

---

### Chapter 8 — The Legend of You

**World:** The Adventurer's Guild, the ruins and the foothills of the Peaks. **Theme:** mercy, and what it hides.

**Beats**
1. **The Red Axe.** Miracle has been hunting you since Chapter 2. On her home turf, the guild hall she works in, she finally catches up. Her obsession with you was already dark. The Flicker made it all she is. You beat her, and for the first time she sees you as a person rather than as hers. **Miracle is saved**, and she tells you where Doe's "Supporting Cast" is meeting: a ruined temple in the Peaks.
2. **Serris** joins you. The white mage hit her head once and started noticing how strange everything is: how things *happen* around you. She's the only person in any world who understands what you are without being told. *"You're the reason the world makes sense. Do you know how terrifying that is?"*
3. **The Hollow Hand** (Faneel) steals voices. **The Blade That Wants** (Shirayukihime) finally gets her duel. **The Shepherd of Slaughter** (Ophelia): the voice she always heard is the static of the Flicker, and it tells her the lambs are ready.
4. **Valse.** The Flicker can't make her worse. She was already the saint who sees killing as love. She looks at the dying worlds with joy: a whole multiverse in pain, and she can end it *gently*. She's Doe's Supporting Cast, but she's no one's pawn. *(The Saint of the Last Mercy, mini-boss.)*
5. **Daphne.** At the temple: the girl with horns who doesn't blink. The daughter of the Demon Lord and the Elf Queen. At five she watched humans seal her father's people in another plane and slaughter her mother's. Doe promised her the Flicker can break that seal, and Celeste's seal in Chapter 5 was the test. *(The Demon Heir, boss.)*
6. **Delphie meets Daphne.** You bring Delphie, who appears in the waking world at last. Daphne looks at her and, for one instant, almost blinks. *"You. I put you away. I put away everything that could cry."* De-Pheria Rena split in two at age five: the part that could feel, and the part that could survive. Daphne refuses her. She flickers to Doe's side. Delphie stays with you, shaking.

**Quests**
| id | foe | worst self | type | needs | text |
|---|---|---|---|---|---|
| `guild-hall` | — (scene) | — | main | `phantom-dream` | The Adventurer's Guild. The receptionist has been waiting for you. Since Chapter 2. |
| `miracle` | `miracle` | The Red Axe | main | `guild-hall` | She has a giant red axe and one goal: you. Forever. |
| `serris` | — (scene) | — | main | `miracle` | The white mage who knows the world is strange has some questions. |
| `ophelia` | `ophelia` | The Shepherd of Slaughter | main | `serris` | The voice in Ophelia's head says the lambs are ready. It's very loud now. |
| `valse` | `valse` | **The Saint of the Last Mercy** (mini-boss) | main | `ophelia` | A saint with folded hands offers every dying world a gentle ending. |
| `daphne` | `daphne` | **The Demon Heir** (boss) | main | `valse` | A ruined temple. A girl with horns who doesn't blink. |
| `two-halves` | — (scene) | — | main | `daphne` | Delphie meets the girl from her dreams. |
| `faneel` | `faneel` | The Hollow Hand | side | `miracle` | Faneel isn't stealing coin purses anymore. She's stealing voices. |
| `shirayukihime` | `shirayukihime` | The Blade That Wants | side | `ophelia` | Her cursed blade finally got its way. It wants a duel. It wants all of them. |
| `ruby` | `ruby` | The Cursed Merchant | side | `serris` | Ruby's compass "does nothing". It looks exactly like the ones in Doe's Engine. |
| `melise` | `melise` | The Elf Who Never Misses | side | `faneel` | Melise's arrows have started hitting. That's the problem. |

**Key scene — The Saint of the Last Mercy** (`before`)
```js
before: { bg: 'Ruined chapel', music: 'none', lines: [
  { where: 'A ruined chapel on the pass', when: 'Golden hour', light: 'candle' },
  { enter: 'valse', at: 'center', mood: 'happy' },
  ['valse', 'happy', "Welcome, little one. Will you sit with me? The light is so lovely here."],
  ['*', 'Her hands are folded above her waist. Her steps are small. Her smile does not move.'],
  ['valse', 'neutral', "The plague has not touched me. Isn't that strange? Doctor Doe thought it might make me worse. But there is nothing in me to make worse. There is only love."],
  ['valse', 'happy', "Every world is in pain now. Children frightened. Animals running. Second suns. It is the most beautiful thing I have ever seen."],
  ['valse', 'proud', "Because I can end it. All of it. Gently. Every life, every world. An act of love."],
  { choose: [
    ['"That\'s not mercy."', [['valse', 'happy', "Of course it is, little one. Mercy is always the thing you'd never choose."]]],
    ['"Doe will never let you."', [['valse', 'neutral', "Doctor Doe wants to be looked at. I want everything to close its eyes. We'll see whose wish is bigger."]]],
  ] },
] },
```

**Key scene — Two Halves**
```js
scene: { bg: 'Temple ruins', music: 'none', lines: [
  { where: 'The temple of the seal', when: 'Night', light: 'rift' },
  { enter: 'daphne', at: 'right', mood: 'neutral' },
  { enter: 'delphie', at: 'left', mood: 'scared' },
  ['delphie', 'scared', "...It's you. From the dreams."],
  ['daphne', 'neutral', "...Insects. All of you."],
  ['*', 'Then Daphne looks at Delphie. And for one instant, so short you might have imagined it, she almost blinks.'],
  ['daphne', 'neutral', "You. I put you away."],
  ['daphne', 'neutral', "I was five. They sealed my father's people in the dark and burned my mother's forest. A five-year-old cannot survive that and also feel it. So I chose. I kept the part that could survive."],
  ['daphne', 'neutral', "And I threw away everything that could cry."],
  ['delphie', 'sad', "...I'm the part that cries."],
  ['delphie', 'angry', "I'm bratty and petty and I hate the sun, and I don't remember ANYTHING, and I'm the part of you that's still a person! Take me back!"],
  ['daphne', 'neutral', "No."],
  { fx: 'rift', sfx: 'vortex' },
  ['daphne', 'neutral', "The deer's Engine will break the seal. My father's people will come home. And humanity will learn what it is to be livestock."],
  { hide: 'daphne' },
  ['*', 'She\'s gone. Delphie is standing where she left her, crying for both of them.'],
] },
```

---

### Chapter 9 — The Colosseum of the Dead

**World:** Dalmavilla's castle and the Reincarnation Colosseum. **Theme:** power, and the people used to get it.

**Beats**
1. **Dalmavilla.** Princess Beatrice always saw people as pieces on a board. Now Doe has *her* on a board, and so does Father Pristo. **The Puppet Queen** (Beatrice) dances on strings she can't see. **The Thousand-Year Thirst** (Pristo), the secret vampire who has schemed for centuries to make Julia dethrone the king, has stopped joking. **The Frozen Saint** (Julia) is all ice now. *(Beatrice: mini-boss.)*
2. Beatrice, cured, is furious about being used. She's still a sadistic, cunning princess, and she hates Doe for it. She becomes a very reluctant ally. *"Nobody plays ME. Point me at her."*
3. **The Reincarnation Colosseum.** Doe's Engine has exhaust: the people of worlds that have finished flickering. Their souls end up here, in an arena run by Priestess Zayd, where the dead fight for the right to be reborn in a living world. Every rebirth overwrites someone. It's Exodus with blood.
4. **Zulu**, a captive of the Colosseum, openly calls herself a villain. She'll help you win, by any means. *"Ends justify means, kid. Let's cheat."* She wants Zayd's throne. She's on your side anyway.
5. The Holy Four: **The Iron Maiden** (Mary), **The Loaded Die** (Fine Catastrophe), and the champion **The Bonebreaker** (Marl), who has never lost. Koko announces everything with horrible enthusiasm. *(Marl: boss.)*
6. **The council breaks.** At the Colosseum's peak, Doe's Supporting Cast gathers: Daphne, Valse, Sakuragi by hologram. Doe tells them the Engine is almost full. Then **Daphne turns.** She never wanted Doe's worlds. She used the Engine's power to finish what Celeste's seal started, and **the demon plane opens over every world at once.** Valse smiles: more mercy needed. Doe, for the first time, looks scared.

**Quests**
| id | foe | worst self | type | needs | text |
|---|---|---|---|---|---|
| `strings` | — (scene) | — | main | `two-halves` | Dalmavilla. The castle is dancing. So is the princess. Neither of them chose to. |
| `beatrice-avalistos` | `beatrice-avalistos` | The Puppet Queen (mini-boss) | main | `strings` | Beatrice played everyone like pieces. Now someone's playing her. |
| `priest-pristo` | `priest-pristo` | The Thousand-Year Thirst | main | `beatrice-avalistos` | The oldest resident of Dalmavilla has stopped joking about his teeth. |
| `zulu` | — (scene) | — | main | `priest-pristo` | The Colosseum of the Dead. A captive in chains says she's the villain. She'd like to help. |
| `mary` | `mary` | The Iron Maiden | main | `zulu` | Nobody is good enough to leave her arena. Nobody. |
| `fine-catastrophe` | `fine-catastrophe` | The Loaded Die | main | `zulu` | Every roll in the Colosseum is hers. Zulu says cheat back. |
| `marl` | `marl` | **The Bonebreaker** (boss) | main | `mary`, `fine-catastrophe` | The undefeated champion of the dead. She has never lost. She has never wanted to. |
| `the-council-breaks` | — (scene) | — | main | `marl` | Doe's Supporting Cast gathers above the arena. One of them has her own plans. |
| `julia-aquacrucis` | `julia-aquacrucis` | The Frozen Saint | side | `priest-pristo` | S-sorry, S-sorry... the nun's ice won't stop spreading. |
| `curtis-vongravis` | `curtis-vongravis` | The Watchman | side | `beatrice-avalistos` | The Lieutenant has watched the princess for so long he can't see anything else. |
| `brulliant-bruscos` | `brulliant-bruscos` | The Silver Debt | side | `strings` | The Bruscos brothers collect for whoever's winning. Right now, that's Doe. |
| `chris-ena` | `chris-ena` | The Fallen Nun | side | `zulu` | A nun in the Colosseum has given up praying. She's started fighting. |

**Key scene — Zulu**
```js
scene: { bg: 'Colosseum cells', music: 'none', lines: [
  { where: 'Beneath the Reincarnation Colosseum', when: '???', light: 'dark' },
  { enter: 'zulu', at: 'center', mood: 'happy' },
  ['zulu', 'happy', "Oh, a live one! You're actually breathing. That's rare down here."],
  ['zulu', 'neutral', "Everyone in this arena died when their world stopped flickering. Now they fight for a ticket back into a living one. Winner gets reborn. Over someone else."],
  ['zulu', 'proud', "I'm Zulu. I'm the villain. No, really, I say it out loud, it saves time. I want Zayd's throne and I'm going to be crueller than she is to get it."],
  ['you', "...And you want to help me?"],
  ['zulu', 'happy', "You want the Holy Four off the board. So do I. Ends justify means, kid. Rules are for the Priestess."],
  ['zulu', 'excited', "Let's cheat.", { close: true }],
  { enter: 'koko', at: 'right', mood: 'excited' },
  ['koko', 'excited', "WELCOME TO THE COLOSSEUM, FOLKS! We have a LIVING challenger tonight! Somebody is about to get HURT!"],
] },
```

**Key scene — The Council Breaks**
```js
scene: { bg: 'Colosseum peak', music: 'doomsday-clock-midnight', lines: [
  { where: 'Above the arena', when: 'The last night', light: 'rift' },
  { enter: 'doe', at: 'center', mood: 'proud' },
  ['doe', 'proud', "My Supporting Cast! Look at you all. Ninety-one percent, cariños. The Engine is nearly full. Every world, nearly looking at me."],
  { enter: 'valse', at: 'left', mood: 'happy' },
  ['valse', 'happy', "How wonderful, Doctor. So many worlds, so very tired."],
  { enter: 'daphne', at: 'right', mood: 'neutral' },
  ['daphne', 'neutral', "Ninety-one percent is enough."],
  ['doe', 'neutral', "Enough for what? I didn't say..."],
  { fx: 'rift', sfx: 'vortex', sky: [50, 15, 2, 0] },
  ['*', 'Daphne puts one hand on the air. The seal Celeste made on the hill, the one that was pulled from below, tears all the way open. Over every world. At once.'],
  ['daphne', 'neutral', "You wanted to be looked at, Doctor. Look up."],
  ['*', 'The sky above every world is full of eyes.'],
  ['valse', 'excited', "Oh... oh, so much more mercy to give."],
  ['doe', 'scared', "No. No, no, this isn't... this isn't MY story. Stop! I'm the main character! STOP!", { close: true, shake: true }],
  ['*', 'For the first time, nobody is listening to Doe. And for the first time, she looks exactly like what she is: a scared woman from Earth 2 that nobody pays attention to.'],
  { fx: 'flicker' },
  ['*', 'The Engine pulls her home, and you follow.'],
] },
```

---

### Chapter 10 — Main Character

**World:** Earth 2: Mexico City, Doe's lab and the Engine. **Theme:** being seen.

**Beats**
1. **Earth 2.** The second sun is fully up here. Mexico City is flickering: people walk out of buildings as their worst selves and back in as themselves. Noelle studies here, at the university. She leads you through the city.
2. **The Child Soldier.** Uzi guards the Engine's door. Doe broke her: no bluff left, no fear left, only the mission. You remind her of the pier. *Nobody should send you to die.* You beat her. She cries, and she stays with you. *(Uzi saved.)*
3. **The Spotlight.** Hayley is in the Engine. She always craved attention, noise and group energy. In her worst self she *is* the spotlight: the light the Engine runs on, blinding and hungry and never enough. You beat her. Underneath it she's just Hayley, and she screams your name and hugs you so hard it knocks you over.
4. **The Mother Who Won't Let Go.** Maria wakes up plagued. She was always fiercely protective, stubborn and loyal. In her worst self you are never leaving her sight again, and neither is anyone else. She stands at the last door to Doe. She isn't evil. She's your mum, and she has decided the safest place for you is *nowhere*. *(mini-boss)* It's the hardest fight in the game. When it's over she says the line from the very first chapter, the one she used to say: *"Show me how much you've grown."* Then she lets you go through the door.
5. **The Main Character.** Doe has wired herself into the Engine. Ninety-nine percent. Every world is looking at her, and it's destroying her. She has become the "you" of everything and is no one. The plague is in her too. Her worst trait, the need to be seen, has eaten everything else: the teasing, the flirting, the caring. Daphne's eyes fill the sky. Valse waits for the end. *(final boss)*
6. **"???" revealed.** Mid-battle, the binary entity speaks again. You recognise the voice: yours. It's you from the future where Doe finished the Engine. Every world became a BAD SUN, and nothing was left but data. It sent the letter back to start everything. *Call upon your weapon.* Your weapon was never cards. It was every bond in the deck: every person you saved, looking at Doe too.
7. **The cure.** The final choice: you don't take the "you" back. **You share it.** Every person you saved in ten chapters steps out of the deck and *looks at Doe*. She has been seen, by everyone, all at once, and the plague has nothing to hold on to. The Engine empties. The "you" goes home to every world. The second suns set.
8. **The seal and the saint.** With every world anchored again and everyone holding the line, Daphne's sky closes. Delphie takes Daphne's hand, and Daphne finally blinks, and cries. Valse is left alone in a world that no longer needs mercy. She is still smiling. (Her ending is left open for a post-game.)
9. **Epilogue: the doors.** The rifts don't close. They settle into something softer: doors. Maria cooks for everyone, and it isn't enough. Doe is there, invited this time. Noelle is next to her. Uzi is eating watermelon with Rirarra. Then you sit down at your desk and write a letter in ones and zeroes, to someone who doesn't know what they are yet.

**Quests**
| id | foe | worst self | type | needs | text |
|---|---|---|---|---|---|
| `earth-two` | — (scene) | — | main | `the-council-breaks` | Mexico City under a second sun. Noelle knows the way. |
| `uzi` | `uzi` | The Child Soldier | main | `earth-two` | The Crimson Hare guards the Engine. The bluff is gone. So is the fear. Only the mission is left. |
| `hayley-kate` | `hayley-kate` | The Spotlight | main | `uzi` | Hayley is the light the Engine runs on. She's blinding. She's never been looked at enough. |
| `maria-hunley` | `maria-hunley` | **The Mother Who Won't Let Go** (mini-boss) | main | `hayley-kate` | Mum is awake. She's standing at the last door. You are never leaving her sight again. |
| `doe` | `doe` | **The Main Character** (final boss) | main | `maria-hunley` | Ninety-nine percent. Every world is looking at Doe. There's nothing left of her to see. |
| `epilogue` | — (scene) | — | main | `doe` | Every world anchored. Every rift a door. One letter left to write. |
| `noelle` | `noelle` | — (friendly) | side | `earth-two` | Noelle wants one game in her home city before the end. For luck. |
| `valse-alone` | `valse` | The Saint of the Last Mercy | side (post-game) | `epilogue` | The worlds don't need her mercy anymore. She's still smiling. |

**Key scene — The Mother Who Won't Let Go** (`before`)
```js
before: { bg: 'Engine hall', music: 'goodmorning-baby-boy', lines: [
  { where: 'The Engine, the last door', when: 'The end', light: 'rift' },
  { enter: 'maria-hunley', at: 'center', mood: 'happy' },
  ['maria-hunley', 'happy', "There you are, sweetie. I've been looking everywhere. You're so cold. Come here."],
  ['*', 'She\'s smiling. She\'s standing exactly in the middle of the door.'],
  ['maria-hunley', 'neutral', "We're going home now. And you're going to stay in your room. Where it's safe. And I'm going to sit outside the door. Forever."],
  ['you', "Mum. I have to go through."],
  ['maria-hunley', 'sad', "No. No, you don't. You fell into my life from nowhere. You can fall out of it the same way. I know that. I've ALWAYS known that."],
  ['maria-hunley', 'angry', "Every morning I make your lunch and I think: today's the day they don't come home. Not today. Not ever.", { close: true }],
  { enter: 'hayley-kate', at: 'left', mood: 'scared' },
  ['hayley-kate', 'scared', "Mrs H... Maria. That's not you. That's the plague. You're the best mum in the whole..."],
  ['maria-hunley', 'rage', "I AM their mum! And nobody, NOBODY, takes my kid through that door!", { close: true, shake: true }],
  { choose: [
    ['"Then hold on to me. And let go anyway."', [['maria-hunley', 'sad', "...That's not how holding works, sweetie."]]],
    ['"You raised me to walk through doors."', [['maria-hunley', 'sad', "...I raised you to come HOME through them."]]],
  ] },
] },
```
`after`
```js
after: { music: 'reunion', lines: [
  { light: 'none' },
  ['*', 'She sits down hard. The plague goes out of her like a breath she\'s been holding since the first morning.'],
  ['maria-hunley', 'sad', "...I'm sorry. I'm so sorry. I could hear myself."],
  ['maria-hunley', 'proud', "Look at you. You're not a kid anymore, are you."],
  ['maria-hunley', 'happy', "Show me how much you've grown, sweetie. Go on. Through the door.", { close: true }],
  ['maria-hunley', 'neutral', "...And come home for dinner. After."],
] },
```

**Key scene — The Main Character** (`before`)
```js
before: { bg: 'Engine core', music: 'doomsday-clock-midnight', lines: [
  { where: 'The heart of the Engine', when: '99%', light: 'rift', weather: 'stars' },
  { fx: 'rift', sfx: 'vortex', sky: [50, 20, 2, 0] },
  { enter: 'doe', at: 'center', mood: 'proud' },
  ['doe', 'proud', "¡Hola! The main character is here~"],
  { fx: 'flicker' },
  ['*', 'Wires run into her from every direction. Behind her, in the glass, every world is turned towards her. Your town. New Haven. The beach. The river. The guild. The arena. All of them looking.'],
  ['doe', 'excited', "Do you see? Do you SEE? Everyone is looking at me. Every single world."],
  ['doe', 'neutral', "...So why can't I feel it?"],
  ['*', 'The teasing is gone from her voice. The flirting. The warmth. There\'s only the wanting left.'],
  ['doe', 'sad', "I'm the main character of everything, and there's nothing of me in it. I'm just... the place where everyone's looking."],
  ['doe', 'rage', "GIVE ME THE REST. The last one percent is YOU. Then it'll feel right. Then it has to!", { close: true, shake: true }],
  { sfx: 'static' },
  ['binary-entity', 'neutral', '01100011 01100001 01101100 01101100'],
  ['*', 'The voice from the letter. From the first night. You know it now.'],
  ['*', 'It\'s yours.'],
  ['binary-entity', 'neutral', '"I let her finish, once. Every world became a second sun. I am what\'s left. Call upon your weapon. ALL of it."'],
] },
```
`after`
```js
after: { music: 'the-story-continues', lines: [
  ['*', 'You don\'t take the last one percent back. You open your hands.'],
  ['*', 'And everyone comes out of the deck. James. Kayla. Julie. Isabella. Maiko. Diana. Marija. Delphine. Rirarra. Mireille. Lilith and Celeste, holding hands. Kagetora and Sakura. Miracle. Serris. Beatrice, complaining. Zulu. Uzi. Hayley. Maria.'],
  ['*', 'Every person you saved. All of them, looking at Doe.'],
  { enter: 'doe', at: 'center', mood: 'scared' },
  ['doe', 'scared', "...Why are you all looking at me like that?"],
  ['hayley-kate', 'happy', "Because you're here, silly. That's all it takes."],
  ['diana', 'sad', "You built an Engine across Earths. From nothing. Nobody else on ANY Earth could do that. Hermana... we see you."],
  ['*', 'The plague has nothing left to hold on to.'],
  { fx: 'flash', sfx: 'holy', light: 'none' },
  ['doe', 'sad', "...Oh. Oh, that's what it feels like.", { close: true }],
  ['*', 'The Engine empties. The "you" goes home: to every world, to every person who was holding a piece of it. The second suns set, one by one.'],
  ['*', 'Above every world, the sky full of eyes closes. In the temple ruins, Delphie takes Daphne\'s hand, and Daphne blinks. And then, for the first time in a hundred and sixty-four years, she cries.'],
] },
```

**Key scene — Epilogue: The Doors**
```js
scene: { bg: 'Our Home from the outside', music: 'reunion', lines: [
  { where: 'The Hunley house', when: 'One week later', weather: 'sparkles' },
  ['*', 'Mum has cooked for sixty. It is not enough.'],
  ['maria-hunley', 'happy', 'Come here, sweetie!'],
  ['julie-hunley', 'excited', "THERE IS A SHARK IN THE KITCHEN! AND A VAMPIRE! AND A PRINCESS WHO KEEPS CALLING ME A PEASANT!"],
  ['beatrice-avalistos', 'proud', "Because you ARE one. Pass the bread, peasant."],
  ['uzi', 'happy', "Rirarra says I'm allowed watermelon. Am I allowed watermelon? Nobody's ever... I'm allowed."],
  ['doe', 'neutral', "...Thank you for inviting me. Nobody on Earth 2 ever invites me anywhere. I usually invite myself first."],
  ['noelle', 'happy', "I invited you. Happy holi-deer. Hehe... sorry."],
  ['*', 'Later, when everyone is asleep on every sofa in the house, you sit down at your desk.'],
  ['*', 'You take a clean sheet of paper. You start to write. Ones and zeroes first, because that\'s how it has to look. Then underneath, in your own handwriting:'],
  ['you', '"Beware of the unthinkable present and future. Call upon your weapon. You are not alone."'],
  ['*', 'THE END. The rifts are doors now. Side quests, rematches and a saint who is still smiling are waiting behind every one.'],
] },
```

---

## 5. Implementation notes (for later — no code changed yet)

**New mechanics**
- **Call upon your weapon (Chapter 1).** A scene direction like `{ weapon: 'space', goal: 40, flicker: [bg, bg, ...] }`. The player mashes **Space**, or taps on mobile. A meter fills, and every press cuts the background to the next `flicker` bg for a frame with `{ fx: 'flicker' }`, faster as the meter fills. At `goal`, cards burst from the screen edges and the scene continues. It needs a small handler in the story scene player (js/story.js).
- **Plagued variants.** Every plagued fight shows the worst-self title instead of the card's name in the quest panel and battle intro. Add a field on the quest: `plague: 'The Fake Emo'`. Plagued foes can share a visual filter (desaturated, flickering sprite, cracked frame). After the first win, a short "cure" flash plays and the character's normal colours return. No new cards are needed: the cards are the same characters.
- **Choice villains** (`marija`, `celeste`, `sakura-tooyama`, `sakuragi`) use a different panel tag, *"Not plagued."*, so the player knows they're choosing this.

**Chapters vs. maps**
The current story has four act maps. Proposed mapping (`variants` can darken a map for the plague):

| Chapters | Map |
|---|---|
| 1–2 | `maps/adoptive_life.webp` (night variant for Ch 2) |
| 3 | `maps/new_haven.webp` |
| 4 | the existing `tower` / `cove` / `siren` places |
| 5 | `maps/infernal_harmony_school.webp` place, plus the Paradiso and Literature Club corners of the Act 1 map |
| 6–7 | `maps/bloodline.webp` |
| 8–9 | `maps/legend_of_you.webp`, plus the `academy` / `barony` places and a Colosseum place (backgrounds exist for the Reincarnation Colosseum cards) |
| 10 | `maps/new_haven.webp` as a dark "Earth 2" variant, or a new map |

**`MB.BOSSES` ideas for new bosses**
| Boss | Name | every | Effect | Rage |
|---|---|---|---|---|
| `maiko-ghan` | The Lost Sen | 2 | 2 damage to your strongest monster ("an honest blow") | *Brutal Honesty*: strips Shield from all your monsters |
| `marija` | Gateway Lockdown | 3 | freezes all your monsters | *Iron Mother*: restores 8 HP |
| `care` | The Warden | 2 | sends your cheapest monster back to your hand ("stay in your room") | gives all her monsters Taunt |
| `miss-mireille` | The Thirst | 3 | Lifesteal to all her monsters | *House Rules Revoked*: +2 ATK |
| `celeste` | Heaven's Seal | 3 | removes keywords from your strongest monster | *Jealous Heaven*: Guardian on all her monsters |
| `sakura-tooyama` | The True Heir | 3 | +1/+1 to all her monsters | *The Bloodline*: Shield on all her monsters |
| `sakuragi` | Transcendental Relocation | 3 | bounces your strongest monster | *Fate*: summons a random 3-cost character on his side |
| `daphne` | The Demon Heir | 3 | 2 damage to all your monsters | *Insects*: destroys your monster with the lowest HP |
| `marl` | The Bonebreaker | 2 | 3 damage to your strongest monster | *Undefeated*: +3 ATK |
| `maria-hunley` | (existing) Family Dinner / GROUNDED! | — | keep | keep |
| `doe` | (existing) Rift Surge / Multiverse Collapse | — | keep; add a 3rd phase at 25%: *Ninety-Nine Percent*: summons two random cards from YOUR deck onto her side ("everyone is looking at me") | |

**What happens to the current story**
- Kept and re-dressed as plagued fights or side quests: almost every current foe. Their current friendly `before`/`after` scenes become the "cured" `after` scenes.
- Cut: the current Act 1 lesson scene (replaced by Chapter 1's glow, plus the tutorial after `the-glow`), "A Crack in the Sky", "Where All Worlds Meet" and the current Doe finale.
- Doe's current lines ("¡Hola! The main character is here~") are reused on purpose as callbacks.

**Content note.** Some source novels (Reincarnation Colosseum, Legend of You) are much darker or more explicit than this story. The story keeps their threat and drops the explicit material entirely.
