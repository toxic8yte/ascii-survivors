(function (root) {
  'use strict';
  const ENEMIES = {
    darVetro: { title: 'Дар Ветров', text: 'Мегабосс после 10-й минуты: чёрный леший, красные кнуты через полкарты и залпы сфер. Перед ударом — красный пунктир.', mega: true, boss: true, ai: 'darklord', skill: 5, hp: 9000, speed: 32, radius: 45, damage: 34, xp: 250, ink: 14, glyph: 'D', sprite: ' \\|/\n/{D}\\\n/|||\\\n /\\' },
    ghoul: { title: 'Зомби', text: 'Медленная толпа, которая берёт числом.', at: 0, weight: 30, hp: 18, speed: 52, radius: 12, damage: 10, xp: 1, ink: 3, glyph: 'z', sprite: 'z' },
    bat: { title: 'Летучая мышь', text: 'Подлетает по извилистой траектории.', at: 9, weight: 18, ai: 'weave', hp: 12, speed: 104, radius: 10, damage: 8, xp: 1, ink: 5, glyph: 'v', sprite: '<v>' },
    skeleton: { title: 'Скелет', text: 'Крепче зомби, но боится огня.', at: 24, weight: 20, hp: 40, speed: 65, radius: 14, damage: 12, xp: 2, ink: 4, glyph: 'S', sprite: 'S' },
    brute: { title: 'Громила', text: 'Большой запас здоровья и тяжёлый удар.', at: 65, weight: 8, hp: 125, speed: 35, radius: 23, damage: 22, xp: 6, ink: 6, glyph: 'O', sprite: ',_,\n[O]\n/ \\' },
    mummy: { title: 'Мумия', text: 'Проклятые бинты замедляют при попадании.', at: 18, weight: 15, hp: 58, speed: 43, radius: 15, damage: 12, slow: 1.8, xp: 3, ink: 4, glyph: '=', sprite: '[=]\n/=\\' },
    spider: { title: 'Могильный паук', text: 'Быстро обходит героя с фланга.', at: 32, weight: 12, ai: 'weave', hp: 23, speed: 92, radius: 12, damage: 9, xp: 2, ink: 3, glyph: 'm', sprite: '/\\o/\\' },
    pumpkin: { title: 'Джек-о-Лантерн', text: 'Хэллоуинская тыква бросает веер огненных шаров.', at: 42, weight: 8, ai: 'ranged', skill: 3.5, hp: 75, speed: 46, radius: 19, damage: 15, xp: 4, ink: 12, glyph: 'o', sprite: ' _|_\n{o.o}\n \\_/' },
    lich: { title: 'Лич', text: 'Держит дистанцию и стреляет проклятиями.', at: 55, weight: 8, ai: 'ranged', skill: 3, hp: 85, speed: 58, radius: 16, damage: 15, xp: 5, ink: 5, glyph: 'L', sprite: ' /\\\n{L}\n /\\' },
    vampire: { title: 'Вампир', text: 'Стремительно кружит вокруг своей жертвы.', at: 75, weight: 10, ai: 'weave', hp: 72, speed: 118, radius: 14, damage: 17, xp: 4, ink: 5, glyph: 'V', sprite: '\\V/\n(V)\n/\\' },
    werewolf: { title: 'Оборотень', text: 'Замирает перед быстрым броском вперёд.', at: 90, weight: 9, ai: 'charge', skill: 4.5, hp: 130, speed: 74, radius: 20, damage: 20, xp: 6, ink: 4, glyph: 'w', sprite: '/^\\\n{w}\n/ \\' },
    alien: { title: 'Чужой', text: 'Ксеноморф атакует рывком по намеченной линии.', at: 110, weight: 9, ai: 'charge', skill: 3.8, hp: 155, speed: 84, radius: 20, damage: 23, xp: 7, ink: 2, glyph: 'X', sprite: '/===\\\n (X)~\n /|\\' },
    lichLord: { title: 'Лич-лорд', text: 'Босс: проклятия и призыв скелетов.', boss: true, ai: 'ranged', skill: 2.8, hp: 1100, speed: 54, radius: 29, damage: 24, xp: 45, ink: 5, glyph: 'W', sprite: ' \\W/\n [L]\n/| |\\' },
    british: { title: 'Зомби-лорд Бритиш', text: 'Босс: поднимает зомби и мумий вокруг себя.', boss: true, ai: 'summoner', skill: 5, hp: 1800, speed: 39, radius: 31, damage: 30, xp: 55, ink: 6, glyph: 'B', sprite: ',W,\n[B]\n/|\\' },
    freddy: { title: 'Фредди Крюгер', text: 'Босс: метит место появления и телепортируется.', boss: true, ai: 'blink', skill: 4, hp: 1350, speed: 67, radius: 25, damage: 26, xp: 50, ink: 6, glyph: 'F', sprite: '_===_\n (F)/\n /|\\' },
    jason: { title: 'Джейсон Вурхиз', text: 'Босс: медленно преследует и делает тяжёлый рывок.', boss: true, ai: 'charge', skill: 4, hp: 2200, speed: 42, radius: 28, damage: 36, xp: 60, ink: 4, glyph: 'J', sprite: ' ._.\n[:;]/\n/|\\' },
    alienQueen: { title: 'Матка Чужих', text: 'Босс: рывки и выводок ксеноморфов.', boss: true, ai: 'charge', skill: 4.8, hp: 2400, speed: 58, radius: 34, damage: 32, xp: 65, ink: 2, glyph: 'Q', sprite: ' /W\\\n(XXX)~\n/| |\\' },
    reaper: { title: 'Жнец', text: 'Босс: неотступно преследует героя.', boss: true, hp: 1000, speed: 61, radius: 32, damage: 28, xp: 35, ink: 6, glyph: 'W', sprite: ' /W\\\n (x)\n/| |\\' }
  };
  const roster = root.NightEnemyData || require('./enemy-roster.js');
  for (const row of roster) {
    const boss = ['boss', 'finalBoss'].includes(row.rank), stats = row.stats;
    ENEMIES[row.id] = Object.freeze({ title: row.name, text: row.text, roster: true, rank: row.rank, role: row.role, at: row.firstSecond, weight: 12, hp: stats.maxHealth * (boss ? 2 : 4), speed: stats.moveSpeed * 65, radius: stats.collisionRadius, damage: stats.damage, xp: stats.experience, knockbackResistance: stats.knockbackResistance, spawnCost: stats.spawnCost, movement: Object.freeze({ ...row.movement }), traits: Object.freeze([...row.traits]), ai: row.movement.type === 'charger' ? 'charge' : row.movement.type === 'wavy' ? 'weave' : row.movement.type, ...(row.movement.type === 'charger' ? { skill: 4.1 } : {}), boss, mega: row.rank === 'finalBoss', ink: row.visual.ink, glyph: row.visual.glyph[0], sprite: row.visual.glyph });
  }
  for (const row of roster) {
    if (row.summon) ENEMIES[row.id] = Object.freeze({ ...ENEMIES[row.id], summon: Object.freeze({ ...row.summon }) });
    if (row.visual.frames) ENEMIES[row.id] = Object.freeze({ ...ENEMIES[row.id], frames: Object.freeze([...row.visual.frames]) });
  }
  for (const enemy of Object.values(ENEMIES)) Object.freeze(enemy);
  Object.freeze(ENEMIES);
  const FEATURES = [
    { id: 'bestiary', title: 'Бестиарий', icon: '[?]', cost: 100, text: 'Постоянный доступ к описаниям всех встреченных и будущих врагов.' },
    { id: 'necronomicon', title: 'Некрономикон', icon: '[N]', cost: 200, text: 'Все рецепты эволюций и прогресс ингредиентов текущего забега.' },
    { id: 'treasureMap', title: 'Карта сокровищ', icon: '[X]', cost: 350, text: 'Показывает героя, тайники и оставленные боссами сундуки на большой карте.' }
  ];
  const EXTRA_WEAPONS = [
    { id: 'whip', title: 'Кнут', icon: '~==', cooldown: 1.15, behavior: 'whip', text: 'Хлёсткая дуга перед героем. Старшие ступени бьют и сзади.' },
    { id: 'axe', title: 'Топор', icon: '/P', cooldown: 2, behavior: 'axe', text: 'Тяжёлые топоры летят по дуге, пробивая толпу.' },
    { id: 'water', title: 'Святая вода', icon: '{~}', cooldown: 2.8, behavior: 'water', text: 'Бутылки оставляют освящённые лужи в выбранной области.' },
    { id: 'rune', title: 'Рунный след', icon: '<#>', cooldown: 2.1, behavior: 'rune', text: 'Руны рикошетят в области вокруг точки выстрела и пробивают врагов.' },
    { id: 'pentagram', title: 'Пентаграмма', icon: '<*>', cooldown: 24, behavior: 'pentagram', text: 'Редкая вспышка очищает обычных врагов поблизости и ранит боссов. Опыт остаётся.' },
    { id: 'garlic', title: 'Чеснок', icon: '(g)', cooldown: .8, behavior: 'garlic', text: 'Ближняя аура ранит и отталкивает врагов вокруг героя.' },
    { id: 'dagger', title: 'Ножи', icon: '-->', cooldown: .45, behavior: 'dagger', text: 'Быстрые ножи летят по направлению движения или к прицелу.' },
    { id: 'fireball', title: 'Огненный жезл', icon: '@*', cooldown: 2.2, behavior: 'fireball', text: 'Медленные огненные шары с большим уроном и пробитием.' },
    { id: 'clock', title: 'Часовой ланцет', icon: '-o-', cooldown: 2.4, behavior: 'clock', text: 'Замораживает врагов вдоль луча. Автоматически поворачивается по кругу.' },
    { id: 'laurel', title: 'Лавр', icon: '[o]', cooldown: 7, behavior: 'laurel', text: 'Даёт защитные заряды, поглощающие попадания. В ручном режиме активируется атакой.' },
    { id: 'bible', title: 'Королевская Библия', icon: '[B]', cooldown: 3.8, behavior: 'bible', text: 'Книги вращаются на широкой орбите и удерживают врагов на расстоянии.' },
    { id: 'birds', title: 'Белая птица', icon: 'v^v', cooldown: 1.9, behavior: 'birds', text: 'Белая птица бомбит вращающийся сектор. Соединяется с чёрной птицей на максимуме.' },
    { id: 'ebony', title: 'Чёрная птица', icon: '\\v/', cooldown: 1.9, behavior: 'birds', text: 'Чёрная птица бомбит встречный сектор. Для объединения обе птицы должны быть на максимуме.' },
    { id: 'hammer', title: 'Молот', icon: '[T]', cooldown: 2.1, behavior: 'hammer', text: 'Короткий замах и тяжёлый удар по области вблизи героя. Дупликатор добавляет удары. Серп + Молот на максимуме и Капитал дают Миколенина.' },
    { id: 'pistol', title: 'Пистоль', icon: '=*>', cooldown: .9, behavior: 'pistol', text: 'Быстрые пули в ближайшую цель или к прицелу. Дупликатор добавляет пули; Клевер открывает эволюцию.' },
    { id: 'sling', title: 'Праща', icon: '(o)>', cooldown: 1.3, behavior: 'sling', text: 'Камни отталкивают врагов. Шпинат силы открывает эволюцию с взрывами и двойным уроном по боссам.' }
  ];
  const UPGRADES = [
    ...EXTRA_WEAPONS.map(w => ({ ...w, kind: 'ОРУЖИЕ', weapon: true, max: 4 })),
    { id: 'needle', title: 'Огненная игла', icon: '*', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Огненные снаряды летят в ближайшую цель. Ступени усиливают урон и скорость стрельбы.' },
    { id: 'power', title: 'Сила проклятия', icon: '*', kind: 'УРОН', max: 5, text: 'Всё оружие наносит на 35% больше урона.' },
    { id: 'haste', title: 'Быстрый ритуал', icon: '>>', kind: 'СКОРОСТЬ ОГНЯ', max: 5, text: 'Всё оружие срабатывает на 22% чаще.' },
    { id: 'fork', title: 'Дупликатор', icon: '\\|/', kind: 'КОЛИЧЕСТВО', max: 3, text: '+1 снаряд, вращающийся клинок, книга или удар совместимого оружия за ступень. Один клинок становится двумя.' },
    { id: 'blades', title: 'Лунные клинки', icon: '/@/', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Клинок вращается вокруг тебя и режет врагов. Повторный выбор добавляет клинок.' },
    { id: 'pulse', title: 'Мёртвый колокол', icon: '((+))', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Волна наносит урон и отбрасывает врагов. Ступени усиливают урон и радиус.' },
    { id: 'lightning', title: 'Цепная молния', icon: '/Z/', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Молния перескакивает между врагами. Ступени добавляют цели и урон.' },
    { id: 'boomerang', title: 'Серп возврата', icon: '<)>', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Летит к врагу и возвращается к герою, поражая цели в обе стороны.' },
    { id: 'frost', title: 'Ледяная печать', icon: '{*}', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Ледяное кольцо ранит и замедляет толпу. Ступени усиливают заморозку и радиус.' },
    { id: 'meteor', title: 'Звездопад', icon: '[X]', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Помечает цель и обрушивает метеорит с взрывом. На III ступени падают два.' },
    { id: 'poison', title: 'Чумной след', icon: '~x~', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Оставляет ядовитые лужи за героем. Ступени увеличивают урон и время действия.' },
    { id: 'stride', title: 'Теневой шаг', icon: '-->', kind: 'ДВИЖЕНИЕ', max: 3, text: 'Скорость бега +15%. Рывок восстанавливается быстрее.' },
    { id: 'magnet', title: 'Собиратель душ', icon: '<*>', kind: 'ОПЫТ', max: 3, text: 'Радиус притяжения осколков опыта +65.' },
    { id: 'vital', title: 'Алое сердце', icon: '[+]', kind: 'ЗДОРОВЬЕ', max: 4, text: 'Максимум здоровья +25. Сразу восстанавливает 40 здоровья.' },
    { id: 'regen', title: 'Живая кровь', icon: '+', kind: 'ВОССТАНОВЛЕНИЕ', max: 3, text: 'Восстанавливает 0,7 здоровья каждую секунду.' },
    { id: 'pierce', title: 'Проклятая игла', icon: '--*', kind: 'ПРОБИТИЕ', max: 3, text: 'Каждый снаряд пробивает ещё одного врага.' },
    { id: 'area', title: 'Канделябр', icon: '\\|/', kind: 'ОБЛАСТЬ', max: 5, text: 'Радиусы атак и размер нового оружия +12% за ступень.' },
    { id: 'duration', title: 'Заклинатель', icon: '(o)', kind: 'ДЛИТЕЛЬНОСТЬ', max: 5, text: 'Лужи, защитные эффекты и рунические снаряды существуют на 15% дольше.' },
    { id: 'velocity', title: 'Наручи', icon: '>>>', kind: 'СКОРОСТЬ СНАРЯДОВ', max: 5, text: 'Снаряды летят на 12% быстрее за ступень.' },
    { id: 'armor', title: 'Доспех', icon: '[#]', kind: 'БРОНЯ', max: 5, text: 'Каждое попадание наносит на 2 единицы меньше урона. Минимум — 1.' },
    { id: 'growth', title: 'Корона', icon: '\\W/', kind: 'РОСТ', max: 5, text: 'Получаемый опыт +10% за ступень. Дробный опыт накапливается.' },
    { id: 'luck', title: 'Клевер', icon: '+o+', kind: 'УДАЧА', max: 5, text: 'Повышает шанс выпадения лечения и критических попаданий эволюции пистоля.' },
    { id: 'greed', title: 'Каменная маска', icon: '[$]', kind: 'ЗОЛОТО', max: 5, text: 'Заработок золота +15% за ступень. Оно остаётся между забегами.' },
    { id: 'curse', title: 'Проклятый череп', icon: '(x)', kind: 'РИСК', max: 5, text: 'Волны на 10% сильнее, а заработок золота на 20% выше за ступень.' },
    { id: 'revive', title: 'Тирагису', icon: '[+!]', kind: 'ВОЗРОЖДЕНИЕ', max: 2, text: 'Ещё одно возрождение с половиной здоровья и тремя секундами защиты.' },
    { id: 'silverRing', title: 'Серебряное кольцо', icon: '(s)', kind: 'ОБЛАСТЬ / ВРЕМЯ', max: 5, text: '+10% области и +5% длительности за ступень. Максимум нужен для эволюции ланцета.' },
    { id: 'goldRing', title: 'Золотое кольцо', icon: '(G)', kind: 'ПРОКЛЯТИЕ', max: 5, text: 'Волны на 8% сильнее, золота на 10% больше за ступень. Максимум нужен для эволюции ланцета.' },
    { id: 'leftSign', title: 'Метаглио Левое', icon: '[<]', kind: 'ЖИЗНЬ / РЕГЕНЕРАЦИЯ', max: 5, text: '+10 здоровья и +0,2 HP/с за ступень. Максимум нужен для эволюции лавра.' },
    { id: 'rightSign', title: 'Метаглио Правое', icon: '[>]', kind: 'ПРОКЛЯТИЕ', max: 5, text: 'Волны на 8% сильнее, золота на 10% больше за ступень. Максимум нужен для эволюции лавра.' },
    { id: 'capital', title: 'Капитал', icon: '[K]', kind: 'КНИГА / ЗОЛОТО', max: 5, text: 'Пассивная книга: +15% заработанного золота за ступень, до +75%. Остаётся после объединения Серпа и Молота в Миколенина; достаточно первой ступени.' }
  ];
  const WEAPON_NAMES = {
    needle: 'Игла престолов', blades: 'Оби-Ван Клиноби', pulse: 'Звонок Самаре', lightning: 'Пикачу, разрядись!', boomerang: 'Серп', frost: 'Лёд тронулся, Джон Сноу', meteor: 'Звёздные вбросы', poison: 'Чужой желудок',
    whip: 'Кнут Skywalker', axe: 'Топорный аргумент', water: 'Святая водичка, Бэтмен!', rune: 'Рунный побег', pentagram: 'Пентаграмма понарошку', garlic: 'Чеснок Носферату', dagger: 'Ножи наголо, Нео', fireball: 'Фаерболл Балрога', clock: 'Доктор Кто-когда', laurel: 'Лавр и Харди', bible: 'Библия Джона Вика', birds: 'Голубь Терминатора', ebony: 'Ворон Морфеуса', hammer: 'Молот', pistol: 'Пистоль, Джеймс Пистоль', sling: 'Праща пращуров'
  };
  for (const u of UPGRADES.filter(u => u.weapon)) { u.baseTitle = u.title; u.title = WEAPON_NAMES[u.id]; }
  for (const w of EXTRA_WEAPONS) w.title = WEAPON_NAMES[w.id];
  const PASSIVE_NAMES = { power: 'Шпинат силы', haste: 'Пустой том', stride: 'Крылья', magnet: 'Аттрактор', vital: 'Полое сердце', regen: 'Пуммарола' };
  for (const u of UPGRADES) if (PASSIVE_NAMES[u.id]) u.title = PASSIVE_NAMES[u.id];
  const EVOLUTIONS = [
    { id: 'holyNeedle', weapon: 'needle', passives: { haste: 1 }, title: 'Игла престолов: пламя и кровь', icon: '*=>', text: 'Непрерывный поток пробивающих игл с удвоенным уроном.' },
    { id: 'jediBlades', weapon: 'blades', passives: { fork: 1 }, title: 'Клиноби: высокая орбита', icon: '/+/', text: 'Два дополнительных клинка, более широкая орбита и усиленные удары.' },
    { id: 'manaBell', weapon: 'pulse', passives: { curse: 1 }, title: 'Звонок 2: семь секунд тишины', icon: '((!))', text: 'Широкая волна усиленного урона надолго замедляет толпу.' },
    { id: 'thunderLoop', weapon: 'lightning', passives: { fork: 1 }, title: 'Пикачу: двойная бухгалтерия', icon: '/ZZ/', text: 'Каждая молния получает повторный удар через 0,4 секунды.' },
    { id: 'mikolenin', weapon: 'boomerang', weapons: ['hammer'], passives: { capital: 1 }, title: 'Миколенин', icon: '{M}', text: 'Серп 4/4 + Молот 4/4 + Капитал 1+. Объединение заменяет оба оружия мощной красной аурой: она шире чесночной, наносит больше урона и отталкивает толпу. Капитал остаётся.' },
    { id: 'winterSeal', weapon: 'frost', passives: { duration: 1 }, title: 'Зима близко. Очень.', icon: '{##}', text: 'Большая ледяная печать полностью замораживает врагов и наносит больше урона.' },
    { id: 'armageddon', weapon: 'meteor', passives: { area: 1 }, title: 'Армагеддон по расписанию', icon: '[XX]', text: 'Дополнительные метеоры взрываются на большей площади.' },
    { id: 'alienTrail', weapon: 'poison', passives: { greed: 1 }, title: 'Чужой: заветный след', icon: '~X~', text: 'Кислотные лужи сильнее, дольше существуют и замедляют врагов.' },
    { id: 'bloodyWhip', weapon: 'whip', passives: { vital: 1 }, title: 'Кнут Skywalker: кровь пробуждается', icon: '~!~', text: 'Критические удары кнутом восстанавливают до 5 HP за атаку.' },
    { id: 'deathSpiral', weapon: 'axe', passives: { area: 1 }, title: 'Топор: игра окончена', icon: '(P)', text: 'Кольцо пробивающих кос летит во все стороны вместо дуги топора.' },
    { id: 'holyPuddle', weapon: 'water', passives: { magnet: 1 }, title: 'Лужа справедливости', icon: '{W}', text: 'Святые лужи растут и медленно сходятся к герою.' },
    { id: 'noFuture', weapon: 'rune', passives: { armor: 1 }, title: 'Рунный побег: будущего нет', icon: '<!>', text: 'Рикошеты руны вызывают взрывы, поражающие толпу.' },
    { id: 'gorgeousMoon', weapon: 'pentagram', passives: { growth: 1 }, title: 'Луна, дай XP!', icon: '<O>', text: 'Более частая очистка даёт дополнительный опыт и притягивает все осколки.' },
    { id: 'soulEater', weapon: 'garlic', passives: { regen: 1 }, title: 'Ганнибал Лектор: на гарнир', icon: '(G)', text: 'Широкая аура поглощает здоровье задетых врагов и лечит героя.' },
    { id: 'thousandEdge', weapon: 'dagger', passives: { velocity: 1 }, title: 'Тысяча причин для Матрицы', icon: '==>', text: 'Непрерывный поток более сильных пробивающих ножей.' },
    { id: 'hellfire', weapon: 'fireball', passives: { power: 1 }, title: 'Балрог: проходите, не задерживайтесь', icon: '(@!)', text: 'Мощные огненные шары пробивают толпу и взрываются при попадании.' },
    { id: 'corridor', weapon: 'clock', passives: { silverRing: 5, goldRing: 5 }, title: 'Доктор Кто: коридор бесконечности', icon: '(12)', text: 'Каждый полный оборот луча уменьшает текущее здоровье ближайших врагов вдвое; боссам наносит ограниченный урон.' },
    { id: 'shroud', weapon: 'laurel', passives: { leftSign: 5, rightSign: 5 }, title: 'Алый плащ Доктора Стрэнджа', icon: '[S]', text: 'Ограничивает входящий удар до 10 урона перед бронёй. Заряд защиты отвечает ударной волной.' },
    { id: 'vespers', weapon: 'bible', passives: { duration: 1 }, title: 'Святые угодники Джона Вика', icon: '[B!]', text: 'Усиленные книги вращаются постоянно в авто-режиме; ручной режим требует активации.' },
    { id: 'vandalier', weapon: 'birds', weapons: ['ebony'], passives: {}, title: 'Голубь мира: перезагрузка', icon: 'vWv', text: 'Объединяет обеих птиц в одну: широкая двойная бомбардировка. Слот ворона поглощается.' },
    { id: 'licensedCrit', weapon: 'pistol', passives: { luck: 1 }, title: 'Лицензия на крит', icon: '=007>', text: 'Пистоль стреляет вдвое чаще. Критические пули наносят тройной урон; Клевер повышает их шанс.' },
    { id: 'goliath', weapon: 'sling', passives: { power: 1 }, title: 'Давид и Голиаф: реванш', icon: '(O)!', text: 'Камни взрываются при попадании и наносят боссам двойной урон.' }
  ];
  const META = [
    { id: 'vital', title: 'Запас жизни', icon: '[+]', max: 5, cost: 25, text: '+10 максимального здоровья за ранг.' },
    { id: 'power', title: 'Могущество', icon: '*', max: 5, cost: 30, text: '+5% урона всего оружия за ранг.' },
    { id: 'haste', title: 'Ритуал скорости', icon: '>>', max: 5, cost: 35, text: '+4% частоты атак за ранг.' },
    { id: 'stride', title: 'Лёгкий шаг', icon: '-->', max: 5, cost: 25, text: '+3% скорости движения за ранг.' },
    { id: 'armor', title: 'Крепкая кожа', icon: '[#]', max: 5, cost: 30, text: 'На 1 меньше урона от каждого попадания за ранг.' },
    { id: 'magnet', title: 'Притяжение', icon: '<*>', max: 5, cost: 20, text: '+15 к радиусу сбора опыта за ранг.' },
    { id: 'growth', title: 'Память душ', icon: '\\W/', max: 5, cost: 35, text: '+3% опыта за ранг.' },
    { id: 'revive', title: 'Ещё одна жизнь', icon: '[+!]', max: 2, cost: 150, text: 'Одно дополнительное возрождение за ранг.' }
  ];
  const CHARACTERS = [
    { id: 'ripley', name: 'Тлен', role: 'Утилизатор', weapon: 'fireball', hp: 115, speed: 170, magnet: 90, dash: 3.2, ink: 7, sprite: ' (x)\n./|\\.\n / \\', traits: { armor: 1 }, text: 'Сжигает проблемы до состояния философии. Огненные шары и +1 брони.' },
    { id: 'shepard', name: 'Сигма', role: 'Рунный командир', weapon: 'rune', hp: 100, speed: 178, magnet: 100, dash: 3, ink: 9, sprite: '[S]\n/|>\n/ \\', traits: { area: .1 }, text: 'Суммирует ошибки противника. Рикошетящие руны и +10% области атак.' },
    { id: 'samus', name: 'Болт', role: 'Срыватель резьбы', weapon: 'dagger', hp: 120, speed: 180, magnet: 85, dash: 2.9, ink: 12, sprite: ' [B]\n--|>>\n / \\', traits: { armor: 2 }, text: 'На каждую проблему найдётся свой болт. Скоростные ножи и +2 брони.' },
    { id: 'mando', name: 'Шрам', role: 'Топорный мастер', weapon: 'axe', hp: 110, speed: 175, magnet: 90, dash: 3.1, ink: 4, sprite: '[/]\n/|P\n/ \\', traits: { power: .1 }, text: 'Рубит с плеча, объясняет потом. Метательные топоры и +10% урона.' },
    { id: 'hunter', name: 'Клык', role: 'Охотник', weapon: 'needle', hp: 100, speed: 172, magnet: 82, dash: 3.4, ink: 8, sprite: ' ^\n/@\\\n/ \\', text: 'Кусается на расстоянии. Точный огонь и ровные параметры для первого забега.' },
    { id: 'duelist', name: 'Тень', role: 'Дуэлянт', weapon: 'blades', hp: 95, speed: 192, magnet: 82, dash: 2.6, ink: 4, sprite: ' /\\\n<&>\n/ \\', text: 'Быстрый боец с клинком на орбите и частым рывком.' },
    { id: 'witch', name: 'Катод', role: 'Минус на плюсе', weapon: 'lightning', hp: 85, speed: 180, magnet: 105, dash: 3.4, ink: 5, sprite: '  (-)\n==|+|==\n  / \\', text: 'Плохой контакт — хорошая молния. Цепной разряд поражает несколько целей.' },
    { id: 'warden', name: 'Вектор-6', role: 'Военный прототип', weapon: 'frost', hp: 150, speed: 154, magnet: 82, dash: 3.8, ink: 9, sprite: '[V6]\n/|=>\n/ \\', text: 'Холодный расчёт, прямые углы. 150 здоровья и ледяная печать для контроля пространства.' },
    { id: 'scout', name: 'Руна', role: 'Следопыт', weapon: 'boomerang', hp: 90, speed: 200, magnet: 95, dash: 3, ink: 7, sprite: ' v\n(%>\n/ \\', text: 'Быстрый следопыт. Серп бьёт по пути туда и обратно.' },
    { id: 'plague', name: 'Мор', role: 'Алхимик', weapon: 'poison', hp: 110, speed: 168, magnet: 147, dash: 3.4, ink: 3, sprite: ' _\n(x)\n/ \\', text: 'Веди толпу по ядовитому следу. Собирает души издалека.' },
    { id: 'zero', name: 'Ноль', role: 'Пустое место', weapon: 'dagger', hp: 80, speed: 205, magnet: 90, dash: 2.7, ink: 4, sprite: '(0)\n-|->\n/ \\', text: 'Тебя недооценили на целую единицу. Быстрый бег, короткий рывок и ножи.' },
    { id: 'raven', name: 'Ворон', role: 'Чёрный ящик', weapon: 'ebony', hp: 90, speed: 185, magnet: 110, dash: 3.1, ink: 5, sprite: ' \\v/\n<(o)>\n / \\', text: 'Плохие новости доставляет с воздуха. Начинает с чёрной птицей.' },
    { id: 'ash', name: 'Прах', role: 'Сухой остаток', weapon: 'garlic', hp: 120, speed: 160, magnet: 100, dash: 3.5, ink: 4, sprite: '.:.\n/|\\\n/ \\', traits: { armor: 1 }, text: 'Рассыпается в комплиментах и чесноке. Ближняя аура, 120 здоровья и +1 брони.' },
    { id: 'volt', name: 'Вольт', role: 'Замыкатель', weapon: 'pistol', hp: 95, speed: 190, magnet: 90, dash: 2.8, ink: 7, sprite: '[Z]\n-|=>\n/ \\', text: 'Напряжённый тип с пистолем. Быстро перемещается и часто делает рывок.' },
    { id: 'beacon', name: 'Светоч Зарпы', role: 'Звёздный должник', weapon: 'meteor', hp: 100, speed: 170, magnet: 120, dash: 3.3, ink: 7, sprite: '\\ | /\n [*]\n /|\\', traits: { area: .1 }, text: 'Сияет до зарплаты. Метеоры с +10% области атак и большой радиус сбора душ.' },
    { id: 'stigma', name: 'Стигма', role: 'Носитель печати', weapon: 'bible', hp: 110, speed: 165, magnet: 100, dash: 3.3, ink: 8, sprite: ' [+]\n-|+-\n / \\', traits: { armor: 1 }, text: 'Печать качества потустороннего сервиса. Вращающиеся книги и +1 брони.' },
    { id: 'moon', name: 'Луна', role: 'Ночная смена', weapon: 'birds', hp: 90, speed: 190, magnet: 115, dash: 3.2, ink: 9, sprite: '(c)\n/|\\\n/ \\', text: 'Уже вышла, пока остальные только собираются. Белая птица бомбит вращающийся сектор.' },
    { id: 'tact', name: 'Такт', role: 'Сбиватель ритма', weapon: 'pulse', hp: 100, speed: 180, magnet: 100, dash: 3, ink: 5, sprite: ' [~]\n<-|->\n / \\', text: 'На раз — колокол, на два — тишина. Ударная волна и подвижный характер.' },
    { id: 'cryptoscam', name: 'КриптаСкам', role: 'Могильный инвестор', weapon: 'sling', hp: 90, speed: 175, magnet: 130, dash: 3.3, ink: 7, sprite: ' [$]\n /|\\\n_/ \\_', traits: { greed: .2 }, text: 'Обещает рост до могилы. Праща, широкий сбор душ и +20% базового золота.' },
    { id: 'mist', name: 'Мгла', role: 'Мутные схемы', weapon: 'water', hp: 90, speed: 195, magnet: 110, dash: 2.9, ink: 3, sprite: ' {~}\n.\\|/.\n / \\', text: 'Напускает туман на финансовые и боевые перспективы. Святые лужи и быстрый отход.' },
    { id: 'resonance', name: 'Резонанс', role: 'Громкий случай', weapon: 'pulse', hp: 85, speed: 175, magnet: 100, dash: 3.4, ink: 5, sprite: '(())\n <|>\n /|\\', traits: { area: .15 }, text: 'Отзывается даже на чужие проблемы. Волна колокола с +15% области атак.' },
    { id: 'rime', name: 'Иней', role: 'Морозный осадок', weapon: 'frost', hp: 100, speed: 182, magnet: 105, dash: 3, ink: 9, sprite: '[*]\n-|-\n/ \\', traits: { area: .1 }, text: 'Выпал из прогноза погоды. Ледяное кольцо с +10% области атак.' },
    { id: 'harvester', name: 'Жнец', role: 'Сезонный работник', weapon: 'axe', hp: 90, speed: 185, magnet: 100, dash: 3.1, ink: 6, sprite: ' /7\n(x)|\n/ \\', traits: { power: .15 }, text: 'Работа сдельная, оплата душами. Метательные топоры наносят на 15% больше урона.' },
    { id: 'eye', name: 'Око', role: 'Зрячий отдел', weapon: 'fireball', hp: 85, speed: 175, magnet: 145, dash: 3.2, ink: 12, sprite: '<O>\n/|\\\n/ \\', traits: { power: .1 }, text: 'Смотрит с огоньком. Огненные шары, +10% урона и большой радиус сбора душ.' },
    { id: 'loop', name: 'Петля', role: 'Обратная связь', weapon: 'whip', hp: 110, speed: 180, magnet: 95, dash: 2.9, ink: 6, sprite: '(8)\n/|~\n/ \\', text: 'Каждый разговор возвращается к кнуту. Надёжный боец ближней и средней дистанции.' },
    { id: 'whisper', name: 'Шёпот', role: 'Тихий запах', weapon: 'garlic', hp: 90, speed: 200, magnet: 120, dash: 2.8, ink: 3, sprite: '(.)\n~|~\n/ \\', text: 'Говорит тихо, пахнет убедительно. Чесночная аура и быстрый бег.' },
    { id: 'ark', name: 'Ковчег', role: 'Груз особого режима', weapon: 'water', hp: 140, speed: 150, magnet: 110, dash: 3.6, ink: 4, sprite: '[A]\n[|]\n/ \\', traits: { armor: 2 }, text: 'Все твари по паре, все проблемы сразу. Святая вода, 140 здоровья и +2 брони.' },
    { id: 'abyss', name: 'Бездна', role: 'Провал по плану', weapon: 'pentagram', hp: 100, speed: 175, magnet: 145, dash: 3.2, ink: 5, sprite: '(#)\n\\|/\n/ \\', text: 'Смотрит в ответ и чистит арену. Пентаграмма с редкими мощными вспышками; между ними двигайся.' },
    { id: 'error', name: 'Ошибка', role: 'Нештатная единица', weapon: 'rune', hp: 90, speed: 190, magnet: 100, dash: 2.7, ink: 13, sprite: '[!]\n/|?\n/ \\', traits: { area: .1 }, text: 'Повторить, пропустить, уничтожить. Рикошетящие руны с +10% области атак.' },
    { id: 'root', name: 'ROOT', role: 'Админ без выходных', weapon: 'hammer', hp: 120, speed: 162, magnet: 100, dash: 3.5, ink: 13, sprite: '[#]\n-|T\n/ \\', traits: { armor: 2, power: .1 }, text: 'Права есть, выходного нет. Тяжёлый молот, +2 брони и +10% урона.' }
  ];
  const HERO_ORDER = ['witch', 'warden', 'scout', 'plague', 'duelist', 'hunter', 'zero', 'mando', 'raven', 'ash', 'volt', 'beacon', 'stigma', 'ripley', 'samus', 'moon', 'tact', 'cryptoscam', 'mist', 'resonance', 'rime', 'harvester', 'eye', 'loop', 'whisper', 'ark', 'abyss', 'shepard', 'error', 'root'];
  CHARACTERS.sort((a, b) => HERO_ORDER.indexOf(a.id) - HERO_ORDER.indexOf(b.id));
  const HERO_PRICES = { hunter: 0, scout: 300, duelist: 400, witch: 500, warden: 650, plague: 750, ripley: 1000, shepard: 1500, samus: 1800, mando: 2000, zero: 450, raven: 700, ash: 550, volt: 850, beacon: 1200, stigma: 950, moon: 900, tact: 800, cryptoscam: 1600, mist: 1050, resonance: 1400, rime: 1100, harvester: 1750, eye: 1300, loop: 1150, whisper: 1250, ark: 2200, abyss: 2600, error: 3200, root: 5000 };
  for (const hero of CHARACTERS) hero.cost = HERO_PRICES[hero.id];
  const catalog = { enemies: ENEMIES, upgrades: UPGRADES, heroes: CHARACTERS, permanents: META, extraWeapons: EXTRA_WEAPONS, evolutions: EVOLUTIONS, features: FEATURES };
  root.NightCatalog = catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : window);
