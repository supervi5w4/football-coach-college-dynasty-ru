import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const element = () => ({
  nodeType: 1, childNodes: [], closest: () => null, hasAttribute: () => false,
  appendChild: () => {}, setAttribute: () => {},
});
const context = {
  document: { documentElement: element(), head: element(), createElement: element },
  window: {}, Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  MutationObserver: class { observe() {} disconnect() {} },
};
vm.runInNewContext(readFileSync('build/fccd-ru.js', 'utf8'), context);
const translate = context.window.__fccdRu.translate;
const cases = [
  ['New game', 'Новая карьера'],
  ['  Continue  ', '  Продолжить  '],
  ['Week 19', 'Неделя 19'],
  ['Recruiting', 'Набор игроков'],
  ['Roster', 'Состав'],
  ['Depth Chart', 'Состав по позициям'],
  ['Game Settings', 'Настройки игры'],
  ['Last played: 11 months ago', 'Последняя игра · 11 месяцев назад'],
  ['In game: MSST 0, UF 7', 'В матче · MSST 0, UF 7'],
  ['1st and 10', '1-й даун и 10'],
  ['4th and Goal', '4-й даун до зачётной зоны'],
  ['Q1 11:28, 1st and 10 at the MSST 41', 'Ч1 11:28, 1-й даун и 10 на MSST 41'],
  ['14 yd pass', 'Пас на 14 ярдов'],
  ['Florida Passing Stats', 'Florida · Пасы'],
  ['Scout (', 'Просмотр ('],
  ['Scout (10)', 'Просмотр (10)'],
  ['Timeout (3/3)', 'Тайм-аут (3/3)'],
  ['5, 4, 3, 2, 1 stars', 'Звёзды · 5, 4, 3, 2, 1'],
  ['HS, JUCO, Transfer', 'Школа, Колледж, Трансфер'],
  ['Leg (Minor) - 2 wks', 'Нога (Лёгкая) · 2 нед.'],
  ['51 states selected', 'Выбрано штатов · 51'],
  ['Assigned: 1 Great, 3 Good, 2 Okay', 'Распределено · 1 Отлично, 3 Хорошо, 2 Нормально'],
  ['School prestige (UF: C+)', 'Престиж университета (UF: C+)'],
  ['Florida', 'Florida'],
  ['QB Joshua Nixon', 'QB Joshua Nixon'],
  ['HB Stretch', 'Стретч на HB'],
  ['constructor', 'constructor'],
  ['__proto__', '__proto__'],
  ['17 - 23', '17 - 23'],
  ['$$','$$'],
  ['ACC', 'ACC'],
  ['American', 'American'],
  ['Singleback - Ace', 'Один бэк — Эйс'],
  ['Mid September', 'Середина сентября'],
  ['2025 Season: Week 3', 'Сезон 2025 · неделя 3'],
  ['200 passing yards or fewer', '200 ярдов пасом'],
  ['175 rushing yards or fewer', '175 ярдов выносом'],
  ['Georgia, Texas, or Mississippi State', 'Georgia, Texas или Mississippi State'],
  ['End of 4th Quarter', 'Конец 4-й четверти'],
  ['1 yd run', 'Вынос на 1 ярд'],
  ['2 yd run', 'Вынос на 2 ярда'],
  ['11 yd run', 'Вынос на 11 ярдов'],
  ['21 yd run', 'Вынос на 21 ярд'],
  ['22 yd run', 'Вынос на 22 ярда'],
  ['1.7 yd run', 'Вынос на 1.7 ярда'],
  ['Extra Point', 'Одноочковая реализация'],
  ['Two Point Conversion', 'Двухочковая реализация'],
  ['Fair Catch', 'Свободная ловля'],
];
for (const [source, expected] of cases) assert.equal(translate(source), expected, source);
const plays = [
  'WR Eddie Allison 14 yd pass from QB Edgar King (S Matthew Everett).',
  'RB Axel Harding 6 yd rush (DL Jadon Johns).',
  'RB Juan Mills fumbles the ball (LB Barrett Farmer), recovered by LB Mason McCarty and returned to the MSST 41 yard line.',
  'QB Edgar King pass intercepted by CB Jack Leal and returned 22 yards for a touchdown.',
  'QB Edgar King is sacked by DL Braxton George for a loss of 7 yds.',
  'K Leonardo Kirby made the 33 yd field goal.',
  'K Romeo Miller punts 41 yds, RB Axel Harding returns punt 10 yds to the UF 31 yard line.',
  'QB Joshua Nixon pass to WR Triston McIntosh falls incomplete.',
  'QB Joshua Nixon pass is dropped by WR Triston McIntosh.',
  'QB Joshua Nixon scrambles for a 12 yd gain (LB Jadon Johns).',
  'QB Joshua Nixon takes a knee for a 2 yd loss.',
  'Clock runs out on the 1st quarter.',
  'K Romeo Miller punts 41 yds, but RB Axel Harding muffs the punt and LB Mason McCarty recovers!',
  'K Romeo Miller punts 41 yds, RB Axel Harding fair catches the punt at the UF 31 yard line.',
  'QB Joshua Nixon is sacked by DL Jadon Johns in own end zone for a safety.',
];
for (const source of plays) {
  const result = translate(source);
  assert.notEqual(result, source, source);
  assert.deepEqual(result.match(/\d+/g), source.match(/\d+/g), 'Numbers changed in ' + source);
  assert.ok(!/ yd|yards|pass from|rush|fumbles|intercepted|sacked|runs out|own end zone| but | and |muffs|fair catches/.test(result), result);
}
assert.ok(translate(plays[0]).includes('WR Eddie Allison'));
assert.ok(translate(plays[0]).includes('QB Edgar King'));
assert.ok(translate(plays[2]).includes('LB Mason McCarty'));
console.log(JSON.stringify({ passed: cases.length + plays.length, dictionary: context.window.__fccdRu.entries }));
