// Credits: the creators of the miku.gg novels the cast comes from, each with a link to their miku.gg author page and their
// novels' pages, plus a fan of faces from their novels. Opened from ♥ Credits on the title screen.
// Ids are miku.gg's (api.miku.gg/users/search?username=..., api.miku.gg/bots?search=...); `novel` is the manifest's novel
// name (it picks the faces and hides NSFW novels with the mode off), `title` the name shown when it differs.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const AUTHOR = (id) => `https://miku.gg/author/${id}`;
  const NOVEL = (id) => `https://miku.gg/novel-preview/${id}`;
  // miku.gg profile pictures: new ones under optimized/ (served in sizes), old ones straight from the asset database
  const PIC = (p) => p.startsWith('optimized/') ? `https://mikugg-assets.nyc3.cdn.digitaloceanspaces.com/256p/${p}` : `https://assets.miku.services/${p}`;

  MB.CREDITS = [
    { name: 'Ash12', id: '14daff14-6a3e-4e1a-ad1d-adb592052f78', color: '#ff6fae', note: 'Also made this game',
      pic: 'optimized/14daff14-6a3e-4e1a-ad1d-adb592052f78/c26ef346-ff0f-44f8-9c27-a3f0c109663e.webp', novels: [
        { novel: 'Adoptive Life RPG', id: '6ab5036d-e333-4b81-af75-6914d72c3dd5' },
        { novel: 'Infernal Harmony', id: '7868b9e2-ac2c-49c3-ba1f-db3c4825ca73' },
        { novel: 'Between the Peaks', id: 'd09ee7a2-4bfd-422d-85bd-a7dc518b8465' },
        { novel: 'The Lifeguard has Teeth', id: '019ac585-e360-457c-b49a-bf00278cf5d9' },
        { novel: 'The yuri assist', id: '8371bd3c-6da7-42dd-a4b2-c443c5596616' },
        { novel: 'Fake It to Make It!', id: 'ffe35925-e535-4473-8127-62542ac929c5' },
        { novel: "Everythin' with Amy Lyn", id: '710d508d-1f14-43fd-96cc-21ca0ae88373' },
        { novel: 'Kumi', id: '11a431bf-55f2-4d21-be3d-6ab684262508' },
      ] },
    { name: 'Grailzy', aka: 'Final_grail', id: '12b13dbf-de11-47e7-8d83-ed788a5529c7', color: '#ffc93c',
      pic: 'optimized/12b13dbf-de11-47e7-8d83-ed788a5529c7/6be27976-2379-4766-ae78-b60453df9c4f.webp', novels: [
        { novel: 'Atarashī gakkō; Secret Garden!', id: '9032d373-d486-442d-ac63-deaba72aaf4b' },
        { novel: 'Legend Of You 1.7 ', title: 'Legend Of You', id: '52ef0b43-25d7-4555-b88b-00da6b45d822' },
        { novel: 'Flaming, Lust, and Pain.', id: '52d1cba0-3d5c-4ecd-a293-7e0444a961be' },
        { novel: 'Academia Magicka: Entrance Ceremony [DEMO]', title: 'Academia Magicka: Entrance Ceremony', id: '07792fa9-57dd-4664-9f5c-005224d21336' },
        { novel: "Makin' Magic with Miku", id: '004899cf-4191-4630-9425-7374a4b3151f' },
        { novel: 'Can Anyone Love Maia?', id: '3e403fd5-5776-4853-891e-81da3617ef65' },
        { novel: 'Stranded terrestrial SN- 1.0009...', title: 'Stranded terrestrial', id: '92ad7487-bde9-4d7c-ad14-df5772485582' },
      ] },
    { name: 'mikudev', aka: 'the miku.gg team', id: '5a967b4b-b773-46b9-94f4-4c0214a2ea0f', color: '#39d5c9',
      pic: 'optimized/5a967b4b-b773-46b9-94f4-4c0214a2ea0f/7a141c32-c421-48b8-88c7-669ca98992af.webp', novels: [
        { novel: 'Sweet Garlic', id: 'b66a0f54-db41-4d0b-84b7-ee3051526341' },
        { novel: 'Anna', id: 'ffc2c4cf-494d-4008-95c1-38a0ff59bd4e' },
        { novel: 'Hina', id: 'ba0b1227-025d-4706-ad4c-9174ff49871b' },
        { novel: 'Nala', id: '277aceff-9bee-4019-999e-56861d54e2cf' },
        { novel: 'Saya', id: '9cdef02b-814d-42eb-baff-8055540dde8f' },
        { novel: 'Elina', id: '79806bc0-3a85-48cf-897d-9c684fce9fd6' },
      ] },
    { name: 'drionste', id: '693ec19c-56ce-4b82-ac02-23fccf0de119', color: '#c0405e',
      pic: 'profile_693ec19c-56ce-4b82-ac02-23fccf0de119.png', novels: [
        { novel: 'Cordelia', id: 'aade70fe-0329-4aba-8279-dda48af6fcb1' },
        { novel: 'Seraphina', id: 'b41f2610-5356-43f9-b9ac-eebc77bdb389' },
        { novel: 'Valerian', id: 'efe0a08f-4d1f-4249-9616-f8310448baa7' },
      ] },
    { name: 'piedarling', id: 'ee597633-a4df-4067-a132-31fd982f93c7', color: '#ff9d6b',
      pic: 'optimized/ee597633-a4df-4067-a132-31fd982f93c7/072c3c96-909e-4181-b0d8-209e68cb2728.webp', novels: [
        { novel: 'Sugar & Sweethearts', id: '85d0fcda-7a49-42c4-b53d-0b8edd7997af' },
        { novel: "Siren's Cove Resort", id: 'ae00aa64-b5a2-46da-8fbb-61db95f2c91d' },
      ] },
    { name: 'salad_v_9lhdy9', id: '188067cf-3c10-4d9b-bf8f-24ea70b9be54', color: '#ffd36b', note: 'Characters © Four Leaf Studios',
      pic: '7Yc8W7N_2-OWz0DJl1tQGinHF8trQ7BI6-63rcTho7w.png', novels: [
        { novel: 'Hanako Ikezawa', title: 'Hanako Ikezawa (Katawa Shoujo)', id: '61198132-ac8d-45a4-bc91-b7615a767a1d' },
        { novel: 'Lilly Satou', title: 'Lilly Satou (Katawa Shoujo)', id: '32bc7d6c-f850-4041-bcd8-55ccefbc347c' },
      ] },
    { name: 'druidlydude', id: '042be5cb-3ad7-4292-9dbc-d1bfc3aba88a', color: '#5ad0a0',
      pic: 'optimized/042be5cb-3ad7-4292-9dbc-d1bfc3aba88a/c2765e09-9fbb-4ec3-ae2c-5b78d3325023.webp', novels: [
        { novel: 'Integrated Domestic Android', id: '0f4481d3-e4a2-4292-bbc0-c2d01a5b8453' },
        { novel: 'Meditate with Yllara', id: 'a4d06e92-5a7d-4755-a168-fd8ffb42ea40' },
      ] },
    { name: 'Richard Wily', id: '18e1c3d3-84ac-4981-9446-e829829de9c1', color: '#6bb6ff',
      pic: 'optimized/18e1c3d3-84ac-4981-9446-e829829de9c1/af2e8c4a-189c-42c4-9a26-30f8504f7599.webp', novels: [
        { novel: 'New Haven', id: '127250d3-3820-4670-bd3f-ad5d0c4227ef' },
      ] },
    { name: 'axt', aka: 'Axionist', id: 'e944cc6a-288f-40fc-a07c-b006279ed98d', color: '#a9d8ff',
      pic: 'optimized/e944cc6a-288f-40fc-a07c-b006279ed98d/4805445f-6dfd-468a-a0a5-305de05d66a5.webp', novels: [
        { novel: 'Cries behind Snowfall', id: 'ff713724-b1dc-436d-b935-04fc28bb336c' },
      ] },
    { name: 'ELBIZARRO MUCHA PAJA', id: '0efcbab5-c212-4ba7-9773-d8288824cdbc', color: '#b35cff',
      pic: 'profile_0efcbab5-c212-4ba7-9773-d8288824cdbc.jpeg', novels: [
        { novel: 'DUMB SUPER FANTASY RPG (1st Part Dalmavilla Kingdom and Banitas Accademy)', title: 'DUMB SUPER FANTASY RPG', id: '9e933fa9-7820-41de-a91f-0f2ec4e69415' },
      ] },
    { name: 'MC_Ride (Gazs)', id: '1192eca9-cf3d-497d-b54e-ef6bcf73d1a7', color: '#3dffb0',
      pic: 'optimized/1192eca9-cf3d-497d-b54e-ef6bcf73d1a7/894c09ca-5106-4aee-a77b-eee9b3b1baf5.webp', novels: [
        { novel: 'Cyber Delivery', title: 'Cyber//Delivery - Pizza Runner', id: '074f645b-4083-4b37-b24d-665c1d8940bf' },
      ] },
    { name: 'Orion', id: 'ab30ad39-6d74-49cd-a2dc-8f7e155017b2', color: '#7cdb5a', novels: [
        { novel: 'Paradiso Suburbia', id: 'c99bd6b9-60c5-4c71-aed1-2f8410078767' },
      ] },
    { name: 'Setsuna', id: '48b03b5c-5011-42e3-9886-f1dd2ee7df77', color: '#ff5a5a',
      pic: 'profile_48b03b5c-5011-42e3-9886-f1dd2ee7df77.jpeg', novels: [
        { novel: 'Bloodline', id: '2c00e206-3443-4504-b9f4-b39c470d699f' },
      ] },
    { name: 'ssspampton', id: 'a4883771-5a38-46f1-aad2-52124cfbea78', color: '#ff8fd0', note: 'Characters © Team Salvato',
      pic: 'optimized/a4883771-5a38-46f1-aad2-52124cfbea78/4516fd3d-1f57-4670-b425-e5926212788d.webp', novels: [
        { novel: 'Doki Doki Literature Club', id: '4120d649-1bec-4a1b-a4ae-58dee83efdd2' },
      ] },
    { name: 'someone199912', id: 'a79c5031-57fc-4e22-afb2-dca77526d162', color: '#ffb3c7', novels: [
        { novel: 'Nanami Hana', id: '53c1a6f1-12cd-43d2-9381-5116ea787aca' },
      ] },
    { name: 'mahorfeus', id: 'ab80f9cd-f6c0-4acb-9ab5-16f4eb4a62c7', color: '#8fa4ff',
      pic: 'optimized/ab80f9cd-f6c0-4acb-9ab5-16f4eb4a62c7/db2bbb60-d3ed-4472-aee4-665b809f7008.webp', novels: [
        { novel: 'Exodus: Bound for Beyond', id: '661d54b6-4c6d-460a-ab9c-4e0c2bfdfbe2' },
        { novel: 'In Her Care', id: '66e873ef-1f38-48a9-aa93-009c6c65b291' },
        { novel: 'Pastures Unknown: Repasteurized', id: '3f5117c2-a829-4872-b107-2d095af7e95f' },
      ] },
    { name: 'Miistiiy', id: 'd5c4dd20-edef-445f-a8f0-b543e4f8c3c8', color: '#ff7a9a',
      pic: 'optimized/d5c4dd20-edef-445f-a8f0-b543e4f8c3c8/1cd40fc6-2490-45c0-ac89-c296ff144f7e.webp', novels: [
        { novel: 'Your Loving Maid', id: 'cb140588-be2e-4726-91dd-a71b0454d434' },
      ] },
    { name: 'judgesenator', id: '9a4d779f-fa33-4e58-826a-f274f534d096', color: '#e0a35a', novels: [
        { novel: 'Noble One', id: 'ceaa122e-abbc-4c5b-96c4-4bdbe1d998c2' },
      ] },
  ];

  // Freesound authors of the sound effects (all CC0; assets/sounds/CREDITS.md has which sound is whose)
  const SOUNDS = ['1urker', '3bagbrew', 'AardsReal', 'AlaskaRobotics', 'AudioPapkin', 'Aurelon', 'BigDino1995', 'Blankened', 'bolkmar',
    'Breviceps', 'cabled_mess', 'carroll27', 'cedarstudios', 'Cloud-10', 'colorsCrimsonTears', 'CuboRodante', 'Daleonfire',
    'danielpodlovics', 'DasWaff', 'Defunct3', 'dotY21', 'doudar41', 'dpren', 'ecfike', 'egomassive', 'el_boss', 'Euphrosyyn', 'folkman',
    'GameAudio', 'GammaGool', 'gristi', 'igroglaz', 'Jarusca', 'jfournier18', 'Joao_Janz', 'Jofae', 'JohnBuhr', 'juliandmc4', 'Krokulator',
    'kylepyke', 'kyles', 'LilMati', 'lmbubec', 'loganzsound', 'lotteria001', 'Mafon2', 'magnuswaker', 'magundah14', 'marcusgar',
    'MarknKris1996', 'martian', 'matthiastidlund', 'Mikes-MultiMedia', 'modusmogulus', 'MrFossy', 'music_is_wiggly_air',
    'NearTheAtmoshphere', 'Nestra', 'nicholasdaryl', 'nickrave', 'NikitaGusev', 'NoisyRedFox', 'omgitsjo', 'owowowwo', 'owstu', 'Planman',
    'plasterbrain', 'Pogmog', 'Qat', 'qubodup', 'rafaelzimrp', 'Reitanna', 'Relenzo2', 'Rosa-Orenes256', 'Sadiquecat', 'SciFiSounds',
    'SecureSubset', 'SGAK', 'ShadowSilhouette', 'sound368', 'SoundsAreGr8', 'Splashdust', 'squidge316', 'Supakid13', 'swordofkings128',
    'TheZero', 'TristanLuigi', 'TurboFool', 'unfa', 'v0idation', 'Vrezerino', 'WillFitch1', 'wjl', 'Yarmonics', 'Za-Games', 'zgump', '_stubb'];

  const link = (href, cls, html, label) =>
    `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer"${label ? ` aria-label="${esc(label)}"` : ''}>${html}</a>`;

  function creatorCard(c, cast) {
    const novels = c.novels.filter((n) => cast[n.novel]);
    if (!novels.length) return null; // all their novels are hidden (NSFW mode off)
    const chars = novels.flatMap((n) => cast[n.novel]);
    // a fan of faces: the first character of each novel, then the rest, up to five
    const faces = [...new Set([...novels.map((n) => cast[n.novel].find((ch) => ch.portrait)), ...chars])].filter((ch) => ch && ch.portrait).slice(0, 5);
    const initials = c.name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const card = el('article', 'cr-card' + (c.novels.length > 4 ? ' big' : ''));
    card.style.setProperty('--c', c.color);
    card.innerHTML = `
      <div class="cr-faces">${faces.map((ch, i) => `<img src="${MB.asset(ch.portrait)}" alt="${esc(ch.name)}" title="${esc(ch.name)}" style="--i:${i - (faces.length - 1) / 2}">`).join('')}</div>
      ${link(AUTHOR(c.id), 'cr-who', `
        <span class="cr-pic"><i>${initials}</i>${c.pic ? `<img src="${PIC(c.pic)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
        <span class="cr-name"><b>${esc(c.name)}</b>${c.aka ? `<small>aka ${esc(c.aka)}</small>` : ''}</span>`, `${c.name} on miku.gg`)}
      <div class="cr-tally"><b>${novels.length}</b> novel${novels.length > 1 ? 's' : ''} · <b>${chars.length}</b> character${chars.length > 1 ? 's' : ''}</div>
      <ul class="cr-novels">${novels.map((n) => `<li>${link(NOVEL(n.id), '', `<span>${esc(n.title || n.novel)}</span><em>${cast[n.novel].length}</em>`)}</li>`).join('')}</ul>
      ${c.note ? `<div class="cr-note">${esc(c.note)}</div>` : ''}
      ${link(AUTHOR(c.id), 'cr-visit', 'Visit on miku.gg <span>↗</span>')}`;
    return card;
  }

  function build() {
    const M = window.MIKU_MANIFEST;
    const cast = {};
    M.characters.forEach((ch) => (cast[ch.novel] = cast[ch.novel] || []).push(ch));
    const grid = $('#cr-grid');
    grid.innerHTML = '';
    MB.CREDITS.forEach((c) => { const card = creatorCard(c, cast); if (card) grid.appendChild(card); });
    $('#cr-count').textContent = `${grid.children.length} creators · ${Object.keys(cast).length} novels · ${M.characters.length} characters`;
    $('#cr-sounds').innerHTML = SOUNDS.map((s) => `<span>${esc(s)}</span>`).join('');
  }

  function open() {
    build();
    const box = $('#credits');
    box.classList.remove('hidden');
    $('#cr-body').scrollTop = 0;
    gsap.fromTo('#credits .cr-backdrop', { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo('#credits .cr-panel', { y: 40, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' });
    gsap.fromTo('#cr-grid .cr-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, delay: 0.15, ease: 'power2.out', clearProps: 'transform,opacity' });
    $('#credits .cr-close').focus({ preventScroll: true });
  }

  function close() {
    const box = $('#credits');
    if (box.classList.contains('hidden')) return;
    gsap.to('#credits .cr-panel', { y: 30, scale: 0.96, opacity: 0, duration: 0.2, ease: 'power2.in' });
    gsap.to('#credits .cr-backdrop', { opacity: 0, duration: 0.2, onComplete: () => box.classList.add('hidden') });
  }

  function bind() {
    $('#btn-credits').onclick = () => { MB.audio.sfx('click'); open(); };
    $('#credits .cr-close').onclick = () => { MB.audio.sfx('click'); close(); };
    $('#credits .cr-backdrop').onclick = close;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  MB.Credits = { open, close };
})();
