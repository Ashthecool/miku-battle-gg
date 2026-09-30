"""Authored expressions for each character's signature attack, including outfit fallbacks.

Beat sheet: the character's personality sets the wind-up expression -> their existing
prop/movement carries it to contact -> the victim reacts -> attackFx restores idle.
Keep the expression for the whole attack; shared FX must not replace it with taunt.
These choices are used by both the bulk importer and sync_attack_emotions.py.
"""

# One deliberate choice per signature attack, rather than the old global angry/rage rule.
CHOICES = dict(line.split() for line in """
maria-hunley angry
hayley-kate excited
james-lone tired
maiko-ghan proud
isabella-hunley hopeful
julie-hunley excited
kayla-kate annoyed
luther-jones amused
fami-maft happy
farley-kate happy
wert-lone happy
ben-brier angry
catherine-jones proud
harris-kate confused
zoe-brier neutral
keiko-ghan angry
yumi happy
eri embarrassed
arisa scorn
misaki happy
helga neutral
suzu curious
shiina embarrassed
ai longing
evil-villainess-chan amused
mariko amused
keiko proud
lisa-reed tired
claire-larone proud
betty-glee proud
deiste-junko proud
olivia happy
mason-moose happy
benjamin-birk neutral
dan-birk excited
rimu-hiraga proud
sakura-tooyama excited
aoi-kananori blushed
ayaka-yamanami hopeful
shino-okita neutral
saito-iroha embarrassed
mai-yamanobe happy
haruka-hijikata rage
shogun-kagetora neutral
bandit angry
beatrice-avalistos amused
julia-aquacrucis shy
priest-pristo amused
hed amused
curtis-vongravis confident
pepita-pazzarella scared
mimi-hanetsu disdain
kuku-hanetsu amused
brutio-bruscos angry
brulliant-bruscos proud
borcolls-carple angry
flora-aquila confident
ellis-maidun excited
megan-dilourice neutral
owain-owegrain rage
carys-crowner excited
jack-lockster neutral
seren-lockster surprised
eira-randers disgusted
rhiannon-davis hopeful
catrin-purl happy
alice-orejin excited
alys-porter angry
linda-garmund happy
lilith rage
celeste proud
mr-dino confused
jay-lester happy
janice-garmund intrigued
charlie-and-jenny amused
clara-click embarrassed
miracle excited
faneel proud
ophelia rage
daphne neutral
shirayukihime excited
ruby intrigued
valse neutral
melise happy
serris confused
ororahime scared
rirarra-charca excited
rowdy-brachy happy
melanika-carchara proud
rinco-typus happy
daphne-mokarran proud
brizz-bigeyed amused
andrea-lyle disgusted
linda-penn neutral
eva-vinn excited
ashley-lennette excited
charlotte embarrassed
sophia-vinelace neutral
anna-vinelace disdain
emily shy
nina happy
lily amused
nerida sad
kira angry
diana intrigued
marija confident
quinta amused
clara happy
jane happy
juliana amused
asuka neutral
natalie surprised
joseph happy
cheetor confident
doe flirty
bucky confident
queen happy
aria neutral
john proud
saria scorn
delphine intrigued
juniper neutral
shenzi amused
susan disdain
noelle happy
andrew confident
louis happy
monika amused
sayori shocked
natsuki annoyed
yuri intrigued
protagonist confused
ignis angry
doloria neutral
luxuria amused
hunter-smith neutral
marie-smith happy
chris happy
olivia-paradiso happy
evelyn scared
ethan proud
hime proud
sophia intrigued
kayden happy
reina excited
lucia-atkins neutral
peter-reeves excited
skylar sad
anna annoyed
amy-lyn excited
hina proud
nala scared
saya intrigued
maiko embarrassed
beatrice hopeful
ruby-academia intrigued
irene amused
charlotte-academia happy
jeffery neutral
marianne tired
steel excited
thomas proud
makoto excited
nevaeh neutral
gwendolyn curious
hubertson intrigued
farigh-anterim tired
aria-academia amused
rion curious
licht neutral
elyssa scared
howard excited
hailey excited
dani worried
kat-13 scorn
stv-3 proud
takeda neutral
jet excited
lamina happy
seo-jin-tae proud
nikita amused
mel frustrated
crash excited
hope annoyed
pedro happy
elina amused
m-chan disgusted
yuuki hopeful
sumire excited
mizuha neutral
keiko-cries happy
hakari embarrassed
fumiko neutral
celia intrigued
keiji excited
atsuo amused
sugiura scorn
itsuki amused
sora neutral
mitsuye excited
kumi amused
nanami-hana proud
momo shy
haruka confident
nico amused
ryu confident
finn neutral
zero neutral
dante neutral
velour flirty
cupid flirty
dani-sugar confident
marine surprised
asher disgusted
""".strip().splitlines())

# Some outfits have only nine expressions. Stay in the selected outfit and retain
# the intention as closely as its art allows. Neutral is the final safe fallback.
FALLBACKS = {
    'excited': ['happy', 'amused'], 'happy': ['amused', 'hopeful'],
    'tired': ['exhausted', 'annoyed'], 'proud': ['confident', 'happy'],
    'confident': ['proud', 'happy'], 'hopeful': ['happy'],
    'annoyed': ['frustrated', 'disgusted', 'disdain'],
    'amused': ['happy'], 'scorn': ['disdain', 'disgusted'],
    'disdain': ['scorn', 'disgusted'], 'curious': ['intrigued', 'confused'],
    'intrigued': ['curious', 'confused'], 'blushed': ['embarrassed', 'shy'],
    'shy': ['embarrassed'], 'longing': ['hopeful', 'happy'],
    'rage': ['angry', 'frustrated'], 'angry': ['rage', 'frustrated'],
    'shocked': ['surprised', 'scared'], 'surprised': ['shocked', 'confused'],
    'worried': ['scared', 'confused'], 'scared': ['worried', 'shocked', 'surprised'],
    'flirty': ['teasing', 'amused', 'happy'], 'frustrated': ['annoyed', 'angry'],
    'embarrassed': ['blushed', 'shy', 'surprised'],
    'disgusted': ['disdain', 'scorn'], 'sad': ['disappointed'],
    'confused': ['surprised', 'shocked'], 'neutral': [],
}


def pick_attack_emotion(character_id, available):
    """Return an existing emotion, or None for a new, not-yet-authored character."""
    first = CHOICES.get(character_id)
    if first is None:
        return None
    return next((e for e in [first, *FALLBACKS[first], 'neutral'] if e in available), None)
