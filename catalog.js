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
    { id: 'birds', title: 'Белая и чёрная птицы', icon: 'v^v', cooldown: 1.9, behavior: 'birds', text: 'Две птицы обстреливают вращающиеся области вокруг героя.' }
  ];
  const UPGRADES = [
    ...EXTRA_WEAPONS.map(w => ({ ...w, kind: 'ОРУЖИЕ', weapon: true, max: 4 })),
    { id: 'needle', title: 'Огненная игла', icon: '*', kind: 'ОРУЖИЕ', weapon: true, max: 4, text: 'Огненные снаряды летят в ближайшую цель. Ступени усиливают урон и скорость стрельбы.' },
    { id: 'power', title: 'Сила проклятия', icon: '*', kind: 'УРОН', max: 5, text: 'Всё оружие наносит на 35% больше урона.' },
    { id: 'haste', title: 'Быстрый ритуал', icon: '>>', kind: 'СКОРОСТЬ ОГНЯ', max: 5, text: 'Всё оружие срабатывает на 22% чаще.' },
    { id: 'fork', title: 'Раздвоение', icon: '\\|/', kind: 'СНАРЯДЫ', max: 3, text: 'Ещё один огненный снаряд при каждом выстреле.' },
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
    { id: 'luck', title: 'Клевер', icon: '+o+', kind: 'УДАЧА', max: 5, text: 'Повышает шанс тройных и пятерных сундуков и выпадения лечения.' },
    { id: 'greed', title: 'Каменная маска', icon: '[$]', kind: 'ЗОЛОТО', max: 5, text: 'Заработок золота +15% за ступень. Оно остаётся между забегами.' },
    { id: 'curse', title: 'Проклятый череп', icon: '(x)', kind: 'РИСК', max: 5, text: 'Волны на 10% сильнее, а заработок золота на 20% выше за ступень.' },
    { id: 'revive', title: 'Тирагису', icon: '[+!]', kind: 'ВОЗРОЖДЕНИЕ', max: 2, text: 'Ещё одно возрождение с половиной здоровья и тремя секундами защиты.' }
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
    { id: 'ripley', name: 'Рипли', role: 'Инженер', weapon: 'fireball', hp: 115, speed: 170, magnet: 90, dash: 3.2, ink: 7, sprite: ' _\n[O]\n/|\\', traits: { armor: 1 }, text: 'Отсылка к «Чужому»: огненный жезл и +1 брони против незваных пассажиров.' },
    { id: 'shepard', name: 'Шепард', role: 'Командор', weapon: 'rune', hp: 100, speed: 178, magnet: 100, dash: 3, ink: 9, sprite: ' _\n[N7]\n/ \\', traits: { area: .1 }, text: 'Отсылка к Mass Effect: рикошетящие руны и на 10% большая область атак.' },
    { id: 'samus', name: 'Сэмус', role: 'Охотница за головами', weapon: 'dagger', hp: 120, speed: 180, magnet: 85, dash: 2.9, ink: 12, sprite: ' /_\\\n[=]=>\n/ \\', traits: { armor: 2 }, text: 'Отсылка к Metroid: скоростные ножи как лучевая пушка и +2 брони.' },
    { id: 'mando', name: 'Мандалорец', role: 'Охотник', weapon: 'axe', hp: 110, speed: 175, magnet: 90, dash: 3.1, ink: 4, sprite: ' /T\\\n[|]\n/ \\', traits: { power: .1 }, text: 'Отсылка к Star Wars: метательные топоры и +10% урона. Таков путь.' },
    { id: 'hunter', name: 'Мара', role: 'Охотница', weapon: 'needle', hp: 100, speed: 172, magnet: 82, dash: 3.4, ink: 8, sprite: ' ^\n/@\\\n/ \\', text: 'Точный огонь. Надёжный герой для первого забега.' },
    { id: 'duelist', name: 'Тень', role: 'Дуэлянт', weapon: 'blades', hp: 95, speed: 192, magnet: 82, dash: 2.6, ink: 4, sprite: ' /\\\n<&>\n/ \\', text: 'Быстрый боец с клинком на орбите и частым рывком.' },
    { id: 'witch', name: 'Искра', role: 'Ведьма', weapon: 'lightning', hp: 85, speed: 180, magnet: 105, dash: 3.4, ink: 5, sprite: ' /\\\n/{\\\n/ \\', text: 'Цепная молния поражает несколько врагов сразу.' },
    { id: 'warden', name: 'Север', role: 'Страж', weapon: 'frost', hp: 150, speed: 154, magnet: 82, dash: 3.8, ink: 9, sprite: ' _\n[#]\n/ \\', text: 'Много здоровья. Ледяная печать замедляет окружение.' },
    { id: 'scout', name: 'Руна', role: 'Следопыт', weapon: 'boomerang', hp: 90, speed: 200, magnet: 95, dash: 3, ink: 7, sprite: ' v\n(%>\n/ \\', text: 'Самый быстрый герой. Серп бьёт по пути туда и обратно.' },
    { id: 'plague', name: 'Мор', role: 'Алхимик', weapon: 'poison', hp: 110, speed: 168, magnet: 147, dash: 3.4, ink: 3, sprite: ' _\n(x)\n/ \\', text: 'Веди толпу по ядовитому следу. Собирает души издалека.' }
  ];
  const catalog = { enemies: ENEMIES, upgrades: UPGRADES, heroes: CHARACTERS, permanents: META, extraWeapons: EXTRA_WEAPONS };
  root.NightCatalog = catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : window);
