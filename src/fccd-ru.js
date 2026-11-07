/* FCCD Russian community patch 0.2.0. Display text only. */
(() => {
  'use strict';
  const translations = Object.assign(Object.create(null), __TRANSLATIONS__);
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const lookup = text => translations[normalize(text).toLowerCase()];
  const literalFragments = Object.entries(translations)
    .filter(([source]) => source.length >= 18 && source.split(' ').length >= 3)
    .sort((a, b) => b[0].length - a[0].length);
  function translateFragments(text, depth) {
    if (depth >= 8) return undefined;
    const lower = text.toLowerCase();
    for (const [source, ru] of literalFragments) {
      if (lower.startsWith(source + ' ')) return ru + translate(text.slice(source.length), depth + 1);
      if (lower.endsWith(' ' + source)) return translate(text.slice(0, -source.length), depth + 1) + ru;
    }
    return undefined;
  }
  const ordinal = { '1st': '1-й', '2nd': '2-й', '3rd': '3-й', '4th': '4-й' };
  const templateIndex = new Map();
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const templateTranslations = __TEMPLATE_TRANSLATIONS__;
  for (const [source, translated] of templateTranslations) {
    const fragments = source.split(/\{\d+\}/);
    const identifiers = [...source.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1]));
    const words = fragments.join(' ').toLowerCase().match(/[a-z]+/g) || [];
    const keyword = words.sort((a, b) => b.length - a.length)[0];
    if (!keyword) continue;
    const pattern = fragments.map(escapeRegex).join('(.*?)');
    const flags = source === 'the {0}' ? 'i' : '';
    const rule = {
      regex: new RegExp('^' + pattern + '$', flags),
      prefix: /[.,!?]$/.test(source) && fragments.join('').length >= 15
        ? new RegExp('^' + pattern, flags) : null,
      identifiers, translated,
      whole: source.includes('. ') || source.includes('; '),
      weight: fragments.join('').length,
    };
    const bucket = keyword.slice(0, 3);
    if (!templateIndex.has(bucket)) templateIndex.set(bucket, []);
    templateIndex.get(bucket).push(rule);
  }
  function translateTemplate(text, depth, wholeOnly = false, minWeight = 18) {
    if (depth > 8) return undefined;
    const candidates = new Set();
    for (const word of text.toLowerCase().match(/[a-z]+/g) || []) {
      for (const rule of templateIndex.get(word.slice(0, 3)) || []) candidates.add(rule);
    }
    const ordered = [...candidates].sort((a, b) => b.weight - a.weight);
    function render(rule, match) {
      const values = new Map();
      rule.identifiers.forEach((identifier, index) => {
        const value = match[index + 1];
        values.set(identifier, translate(value, depth + 1));
      });
      const rendered = rule.translated.replace(/\{(\d+)\}/g, (_, identifier) => values.get(Number(identifier)));
      return agreeCounts(rendered
        .replace(/(№\s*\d+)(?:st|nd|rd|th|-й)(?=\s|[.,!?)]|$)/g, '$1')
        .replace(/(\d+)-й-([йяею])/g, '$1-$2')
        .replace(/\bthis week's\b/g, 'этой недели')
        .replace(/, а Результат/g, ', а результат')
        .replace(/\s+([.,!?»])/g, '$1'));
    }
    for (const rule of ordered) {
      if (rule.weight < minWeight) continue;
      if (wholeOnly && !rule.whole) continue;
      const match = rule.regex.exec(text);
      if (match) return render(rule, match);
      if (wholeOnly) continue;
      const prefix = rule.prefix?.exec(text);
      if (prefix && prefix[0].length < text.length) {
        return render(rule, prefix) + translate(text.slice(prefix[0].length), depth + 1);
      }
    }
    return undefined;
  }
  const countForms = {
    'ярдов': ['ярд', 'ярда', 'ярдов'],
    'очков': ['очко', 'очка', 'очков'],
    'сэков': ['сэк', 'сэка', 'сэков'],
    'матчей': ['матч', 'матча', 'матчей'],
    'игроков': ['игрок', 'игрока', 'игроков'],
    'перехватов': ['перехват', 'перехвата', 'перехватов'],
    'тачдаунов': ['тачдаун', 'тачдауна', 'тачдаунов'],
    'фамблов': ['фамбл', 'фамбла', 'фамблов'],
    'лет': ['год', 'года', 'лет'],
    'месяцев': ['месяц', 'месяца', 'месяцев'],
    'дней': ['день', 'дня', 'дней'],
    'раз': ['раз', 'раза', 'раз'],
    'потерь': ['потерю', 'потери', 'потерь'],
  };
  function agreeCounts(text) {
    return text.replace(/(\d+(?:[.,]\d+)?) (ярдов|очков|сэков|матчей|игроков|перехватов|тачдаунов|фамблов|лет|месяцев|дней|раз|потерь)(?=[\s.,!?)]|$)/g,
      (match, digits, noun, offset) => {
        const fractional = /\.\d|,\d{1,2}$/.test(digits);
        const number = Number(digits.replace(/,/g, ''));
        const last = number % 10;
        const teen = number % 100 >= 11 && number % 100 <= 14;
        const form = teen ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2;
        const prefix = text.slice(Math.max(0, offset - 20), offset);
        const genitive = /(?:^|\s)(?:до|от|более|менее|около|свыше|после|возрасте)\s*$/.test(prefix);
        const forms = countForms[noun];
        if (fractional) return digits + ' ' + forms[1];
        const selected = genitive ? form === 0 ? forms[1] : forms[2] : forms[form];
        return digits + ' ' + selected;
      });
  }
  const patterns = [
    [/^(\d+) (passing|rushing) yards?(?: or fewer)?$/, (_, count, type) => agreeCounts(count + ' ярдов ' + (type === 'passing' ? 'пасом' : 'выносом'))],
    [/^(\d+) upcoming games?$/, (_, count) => 'предстоящих матчей · ' + count],
    [/^(.+), (and|or) (.+)$/, (_, first, join, last) => first + (join === 'and' ? ' и ' : ' или ') + last],
    [/^(?:The |the )?#(\d+) ranked (.+)$/, (_, rank, team) => team + ' (№ ' + rank + ')'],
    [/^In game: (.+)$/, (_, score) => 'В матче · ' + score],
    [/^(\d{4}), Week (\d+)$/, (_, year, week) => year + ', неделя ' + week],
    [/^(Early|Mid|Late) (January|February|March|April|May|June|July|August|September|October|November|December)$/, (_, part, month) => ({Early:'Начало',Mid:'Середина',Late:'Конец'})[part] + ' ' + ({January:'января',February:'февраля',March:'марта',April:'апреля',May:'мая',June:'июня',July:'июля',August:'августа',September:'сентября',October:'октября',November:'ноября',December:'декабря'})[month]],
    [/^(\d{4}) Season: Week (\d+)$/, (_, year, week) => 'Сезон ' + year + ' · неделя ' + week],
    [/^Week (\d+)$/, (_, week) => 'Неделя ' + week],
    [/^(\d{4}) Season$/, (_, year) => 'Сезон ' + year],
    [/^Season: Week (\d+)$/, (_, week) => 'Сезон · неделя ' + week],
    [/^Advance game week \((.+)\)$/, (_, opponent) => 'Завершить неделю (' + opponent + ')'],
    [/^Last played: (.+)$/, (_, when) => 'Последняя игра · ' + translateRelativeTime(when)],
    [/^(\d+)(?:st|nd|rd|th) season$/, (_, count) => 'Сезон № ' + count],
    [/^Level (\d+)$/, (_, level) => 'Уровень ' + level],
    [/^Age: (\d+)$/, (_, age) => 'Возраст · ' + age],
    [/^Needs: (\d+)$/, (_, count) => 'Нужно · ' + count],
    [/^Q([1-4]) (\d+:\d+)$/, (_, quarter, time) => 'Ч' + quarter + ' ' + time],
    [/^Q([1-4]) (\d+:\d+), (1st|2nd|3rd|4th) and (\d+|Goal) at the (.+)$/,
      (_, quarter, time, down, yards, line) => 'Ч' + quarter + ' ' + time + ', ' + ordinal[down] + ' даун ' + (yards === 'Goal' ? 'до зачётной зоны' : 'и ' + yards) + ' на ' + line],
    [/^(1st|2nd|3rd|4th) and (\d+|Goal)$/, (_, down, yards) => ordinal[down] + ' даун ' + (yards === 'Goal' ? 'до зачётной зоны' : 'и ' + yards)],
    [/^([1-4])(?:st|nd|rd|th) Quarter$/i, (_, quarter) => 'Четверть ' + quarter],
    [/^Previous (\d+) Plays$/, (_, count) => 'Предыдущие розыгрыши (' + count + ')'],
    [/^Timeout \((\d+)\/(\d+)\)$/, (_, left, total) => 'Тайм-аут (' + left + '/' + total + ')'],
    [/^Scout \((\d+)\)$/, (_, count) => 'Просмотр (' + count + ')'],
    [/^([1-5]) Stars?$/, (_, count) => count + ' ★'],
    [/^(.+) Roster$/, (_, team) => team + ' · состав'],
    [/^(.+) Depth Chart$/, (_, team) => team + ' · состав по позициям'],
    [/^(.+) game plan$/, (_, team) => team + ' · план на игру'],
    [/^(.+) Practice Focus$/, (_, team) => team + ' · акцент тренировки'],
    [/^(.+) STAMINA AND SNAP COUNTS$/, (_, team) => team + ' · выносливость и снэпы'],
    [/^(.+) (Passing Stats|Rushing Stats|Receiving Stats|Defense Stats|Returns|Kicking & Punting|Fumbles)$/, (_, team, stat) => team + ' · ' + lookup(stat)],
    [/^(.+) offense pace$/, (_, team) => team + ' · темп нападения'],
    [/^Interest in (.+):$/, (_, team) => 'Интерес к ' + team + ' ·'],
    [/^Has (.+) Offer$/, (_, team) => 'Есть предложение от ' + team],
    [/^Show only those with (.+) offer$/, (_, team) => 'Только с предложением от ' + team],
    [/^(School prestige|Proximity to home|Stadium atmosphere|Facilities|Playing time|College life|Academics|Coach prestige|Coach style) (\(.+\))$/, (_, priority, grade) => lookup(priority) + ' ' + grade],
    [/^(\$[\d.,]+[kKmM]?) NIL deal$/, (_, money) => 'Контракт NIL · ' + money],
    [/^(-?\d+) yd (touchdown pass|pass|touchdown run|run|field goal|punt|return)$/, (_, yards, play) => lookup(play) + ' · ' + yards + ' ярд.'],
    [/^(\d+) plays, (-?\d+) yards\s*, (\d+:\d+)$/, (_, plays, yards, time) => 'Розыгрыши · ' + plays + ', ярды · ' + yards + ', ' + time],
    [/^(\d+)° F, (\d+) mph wind$/, (_, temp, wind) => temp + '° F, ветер ' + wind + ' миль/ч'],
    [/^(.+) - (Raucous|Loud|Quiet|Deafening|Normal) \((\d+)\)$/, (_, team, mood, rating) => team + ' — ' + lookup(mood) + ' (' + rating + ')'],
    [/^Go to page (\d+)$/, (_, page) => 'На страницу ' + page],
    [/^page (\d+)$/, (_, page) => 'Страница ' + page],
    [/^(\d+) states selected$/, (_, count) => 'Выбрано штатов · ' + count],
    [/^(\d+) recruits found$/, (_, count) => 'Найдено кандидатов · ' + count],
    [/^(\d+) plays?$/, (_, count) => 'Розыгрышей · ' + count],
    [/^(\d+) total$/, (_, count) => 'всего · ' + count],
    [/^(\d+) games? played$/, (_, count) => 'Матчей сыграно · ' + count],
    [/^(\d+) yrs?$/, (_, count) => count + ' г.'],
    [/^(\d+)x school record holder$/, (_, count) => 'Рекордов университета · ' + count],
    [/^(\d+) records held$/, (_, count) => 'Установлено рекордов · ' + count],
    [/^OVERALL \((.+)\):$/, (_, position) => 'РЕЙТИНГ (' + position + ')'],
    [/^(\d{4}) Game Log$/, (_, year) => 'Матчи игрока · ' + year],
    [/^End of ([1-4])(?:st|nd|rd|th) quarter$/, (_, quarter) => 'Конец ' + quarter + '-й четверти'],
    [/^(.+) Wins\. Final score: (.+)$/, (_, team, score) => team + ' побеждает. Итоговый счёт · ' + score],
    [/^(.+) \((Minor|Moderate|Major|Severe)\) - (\d+) wks?$/,
      (_, injury, severity, weeks) => (lookup(injury) || injury) + ' (' + lookup(severity) + ') · ' + weeks + ' нед.'],
    [/^Preseason: (.+)$/, (_, phase) => 'Предсезонка · ' + (lookup(phase) || phase)],
    [/^(.+) Position Changes$/, (_, team) => team + ' · смена позиций'],
    [/^([1-5], )+[1-5] stars$/, text => text.replace(' stars', ' ★')],
    [/^(~?\$[\d.,]+[kKmM]?) NIL Deal$/, (_, money) => 'Контракт NIL · ' + money],
    [/^Assigned: (.+)$/, (_, list) => 'Распределено · ' + list.replace(/Great|Good|Okay/g, word => lookup(word))],
    [/^(HC|OC|DC) Pitch - (Great|Good|Okay)$/, (_, coach, quality) => lookup(coach + ' Pitch') + ' · ' + lookup(quality)],
    [/^(\d+) team \((.+)\)$/, (_, teams, format) => teams + ' команд (' + format.replace('CCs', 'чемпионов конф.').replace('at-large', 'по приглашению') + ')'],
    [/^up (\d+)$/, (_, points) => 'при преимуществе от ' + points],
    [/^down (\d+)$/, (_, points) => 'при отставании от ' + points],
    [/^(.+) (-?\d+) yd pass from (.+)$/, (_, receiver, yards, passer) => receiver + ' · пас на ' + yards + ' ярд. от ' + translatePlayEnding(passer)],
    [/^(.+) (-?\d+) yd rush(.*)$/, (_, runner, yards, ending) => runner + ' · вынос на ' + yards + ' ярд.' + translatePlayEnding(ending)],
    [/^(.+) kicks off for a touchback\.$/, (_, kicker) => kicker + ' · начальный удар, тачбек.'],
    [/^(.+) kick\.$/, (_, kicker) => kicker + ' · удар.'],
    [/^(.+) fumbles the ball \((.+)\), recovered by (.+) and returned to the (.+) yard line\.$/,
      (_, player, tackler, recovery, yardline) => player + ' теряет мяч (' + tackler + '), ' + recovery + ' подбирает и возвращает мяч до отметки ' + yardline + '.'],
  ];

  function translateRelativeTime(text) {
    return text.replace(/(\d+) (seconds?|minutes?|hours?|days?|weeks?|months?|years?) ago/, (_, count, unit) => {
      const names = { second: 'сек.', minute: 'мин.', hour: 'ч.', day: 'дн.', week: 'нед.', month: 'мес.', year: 'г.' };
      return count + ' ' + names[unit.replace(/s$/, '')] + ' назад';
    });
  }

  function translatePlayEnding(text) {
    return text.replace(/ yd pass from /g, ' ярд. · пас от ')
      .replace(/(\d+) yd pass/g, '$1 ярд. · пас')
      .replace(/ kick\./g, ' · удар.');
  }

  function translateCommentary(text) {
    if (!/ (?:yd pass from|yd rush|yd run|pass is |pass to |pass intercepted|is sacked|fumbles the ball|tackled by|goes down in own end zone|scrambles for|takes a knee|made the|missed the|kicks off|returns kickoff|returns punt|punts \d|attempts the onside kick|pass from|runs for the successful|run falls short|PAT failed|calls timeout)/.test(text) &&
        !/^Clock runs out on the /.test(text)) return text;
    return text
      .replace(/Clock runs out on the (\d)(?:st|nd|rd|th) quarter\./g, 'Время $1-й четверти истекло.')
      .replace(/ is sacked and /g, ' получает сэк и ')
      .replace(/ is sacked by /g, ' получает сэк от ')
      .replace(/ fumbles the ball /g, ' теряет мяч ')
      .replace(/, recovered by /g, ', мяч подбирает ')
      .replace(/ tackled by /g, ' остановлен игроком ')
      .replace(/ goes down in own end zone/g, ' остановлен в своей зачётной зоне')
      .replace(/ in own end zone/g, ' в своей зачётной зоне')
      .replace(/ for a safety/g, ', сейфти')
      .replace(/ for a loss of /g, ' с потерей ')
      .replace(/ takes a knee for a /g, ' становится на колено, потеря ')
      .replace(/ yd loss/g, ' ярд.')
      .replace(/ scrambles for a /g, ' уходит в скрэмбл на ')
      .replace(/ yd gain/g, ' ярд.')
      .replace(/ (-?\d+) yd pass from /g, ' · пас на $1 ярд. от ')
      .replace(/ (-?\d+) yd (?:rush|run)/g, ' · вынос на $1 ярд.')
      .replace(/ pass is dropped by /g, ' · мяч роняет ')
      .replace(/ pass is deflected by /g, ' · пас сбивает ')
      .replace(/, resulting in an incompletion/g, ', пас не принят')
      .replace(/ pass to /g, ' · пас на ')
      .replace(/ falls incomplete/g, ' не принят')
      .replace(/ pass intercepted by /g, ' · пас перехватывает ')
      .replace(/, returned /g, ', возврат ')
      .replace(/ and returned /g, ' и возврат ')
      .replace(/ in the endzone for a touchback/g, ' в зачётной зоне, тачбек')
      .replace(/ made the (\d+) yd field goal/g, ' забивает филд-гол с $1 ярд.')
      .replace(/ missed the (\d+) yd field goal/g, ' не забивает филд-гол с $1 ярд.')
      .replace(/ kicks off for a touchback/g, ' · начальный удар, тачбек')
      .replace(/ returns kickoff /g, ' · возврат начального удара на ')
      .replace(/ returns punt /g, ' · возврат панта на ')
      .replace(/ punts /g, ' · пант на ')
      .replace(/ for a touchback/g, ', тачбек')
      .replace(/, ball bounces to the /g, ', мяч отскакивает к отметке ')
      .replace(/ fair catches the punt at the /g, ' выполняет свободную ловлю панта на отметке ')
      .replace(/ muffs the punt and /g, ' допускает мафф при ловле панта, ')
      .replace(/ recovers!/g, ' подбирает мяч!')
      .replace(/ attempts the onside kick/g, ' выполняет онсайд-кик')
      .replace(/Attempt succeeds!/g, 'Попытка успешна!')
      .replace(/Attempt fails, /g, 'Попытка не удалась, ')
      .replace(/ recovers\./g, ' подбирает мяч.')
      .replace(/ pass from /g, ' · пас от ')
      .replace(/ runs for the successful two-point conversion/g, ' · успешная двухочковая реализация выносом')
      .replace(/ for the successful two-point conversion/g, ' · успешная двухочковая реализация')
      .replace(/ pass is incomplete, two-point conversion attempt fails/g, ' · неточный пас, двухочковая реализация не удалась')
      .replace(/ run falls short, two-point conversion attempt fails/g, ' · вынос остановлен, двухочковая реализация не удалась')
      .replace(/ for a touchdown/g, ' для тачдауна')
      .replace(/ yd touchdown/g, ' ярд. для тачдауна')
      .replace(/, runs out of bounds to stop the clock/g, ', выходит за боковую и останавливает время')
      .replace(/ calls timeout\./g, ' берёт тайм-аут.')
      .replace(/ PAT failed/g, ' · одноочковая реализация не удалась')
      .replace(/, but /g, ', но ')
      .replace(/ and /g, ' и ')
      .replace(/ to the /g, ' до отметки ')
      .replace(/ yard line/g, '')
      .replace(/ (?:yards|yds)\b/g, ' ярд.');
  }

  const translationCache = new Map();
  function translate(text, depth = 0) {
    if (depth !== 0) return translateBase(text, depth);
    if (translationCache.has(text)) return translationCache.get(text);
    const result = translateBase(text, depth);
    if (translationCache.size >= 6000) translationCache.delete(translationCache.keys().next().value);
    translationCache.set(text, result);
    return result;
  }
  function translateBase(text, depth = 0) {
    const clean = normalize(text);
    if (!/[A-Za-z]/.test(clean) || clean === 'ACC' || clean === 'American') return text;
    const commentary = translateCommentary(clean);
    let result = clean === 'NEW' ? 'НОВЫЙ' : lookup(clean);
    if (result === undefined && /^a #\d+ ranking$/.test(clean)) result = clean.replace(/^a #(\d+) ranking$/, 'занимает место № $1');
    if (result === undefined && /^[\d-]/.test(clean) && /\b(?:yds|car|TD|tkl|sacks?|ints?|fum)\b/.test(clean)) result = translateStats(clean);
    if (result === undefined) {
      for (const [pattern, replacement] of patterns.slice(0, 2)) {
        if (pattern.test(clean)) { result = clean.replace(pattern, replacement); break; }
      }
    }
    if (result === undefined && /^this week's /i.test(clean)) result = 'этой недели: ' + translate(clean.replace(/^this week's /i, ''), depth + 1);
    if (result === undefined) result = translateTemplate(clean, depth, true, 0);
    if (result === undefined && depth < 8) {
      const headlines = clean.split(/;\s+(?=[A-Z])/);
      const sentences = clean.split(/(?<=\.)\s+(?=[A-Z])/);
      if (headlines.length > 1) result = headlines.map(headline => translate(headline, depth + 1)).join('; ');
      else if (sentences.length > 1) result = sentences.map(sentence => translate(sentence, depth + 1)).join(' ');
    }
    // Down-and-distance has a dedicated grammar, including goal-to-go.
    if (/^(?:(?:Q[1-4] \d+:\d+), )?(?:1st|2nd|3rd|4th) and (?:\d+|Goal)(?: at the .+)?$/.test(clean)) {
      for (const [pattern, replacement] of patterns) {
        if (pattern.test(clean)) { result = clean.replace(pattern, replacement); break; }
      }
    }
    if (result === undefined) result = translateTemplate(clean, depth);
    if (result === undefined) result = translateFragments(clean, depth);
    if (result === undefined) result = translateTemplate(clean, depth, false, 0);
    if (commentary !== clean) result = commentary;
    if (result === undefined) {
      for (const [pattern, replacement] of patterns) {
        if (pattern.test(clean)) {
          result = clean.replace(pattern, replacement);
          break;
        }
      }
    }
    if (result === undefined && clean.includes(', ')) {
      const parts = clean.split(', ');
      if (parts.every(part => lookup(part) !== undefined || /^[1-5] stars?$/.test(part))) {
        result = parts.map(part => lookup(part) || part.replace(/ stars?$/, ' ★')).join(', ');
      }
    }
    if (result === undefined && clean.endsWith(':')) {
      const label = lookup(clean.slice(0, -1));
      if (label !== undefined) result = label + ' ·';
    }
    if (result === undefined && clean.includes(' / ')) {
      const parts = clean.split(' / ');
      if (parts.every(part => lookup(part) !== undefined || /^[\d-]+(?: Split)?$/.test(part))) {
        result = parts.map(part => lookup(part) || part).join(' / ');
      }
    }
    if (result === undefined && clean.includes(' | ')) {
      const parts = clean.split(' | ');
      if (parts.some(part => lookup(part) !== undefined)) {
        result = parts.map(part => lookup(part) || part).join(' | ');
      }
    }
    if (result === undefined && /^[\d-]/.test(clean) && /\b(?:yds|pancakes|tkl|sacks?|tfl|ints?|TD|FF|car|y\/c|sacks? allowed)\b/.test(clean)) {
      result = translateStats(clean);
    }
    if (result === undefined || result === clean) return text;
    return text.slice(0, text.indexOf(text.trimStart())) + result + text.slice(text.trimEnd().length);
  }
  function translateStats(clean) {
    return clean.replace(/\byds\b/g, 'ярд.')
        .replace(/\bpancakes\b/g, 'блоков с опрокидыванием')
        .replace(/\bsacks? allowed\b/g, 'пропущенных сэков')
        .replace(/\btkl\b/g, 'захв.')
        .replace(/\bsacks?\b/g, 'сэк.')
        .replace(/\btfl\b/g, 'захв. с потерей ярдов')
        .replace(/\bints?\b/gi, 'перехв.')
        .replace(/\bTD\b/g, 'ТД')
        .replace(/\bFF\b/g, 'вын. фамбл')
        .replace(/\bcar\b/g, 'выносов')
        .replace(/\bfum\b/g, 'фамбл')
        .replace(/\by\/c\b/g, 'ярд./вынос');
  }

  const ignored = 'script,style,noscript,textarea,input,[contenteditable=true],option:not([value])';
  const attributes = ['title', 'aria-label', 'placeholder', 'alt'];
  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement || node.parentElement.closest(ignored)) return;
      const result = normalize(node.data) === 'Play' && node.parentElement.closest('button')
        ? 'Играть' : translate(node.data);
      if (result !== node.data) {
        node.parentElement.setAttribute('data-fccd-ru-text', '');
        node.data = result;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    for (const attribute of attributes) {
      if (!node.hasAttribute(attribute)) continue;
      const source = node.getAttribute(attribute);
      const result = translate(source);
      if (source !== result) node.setAttribute(attribute, result);
    }
    if (node.closest(ignored)) return;
    for (const child of node.childNodes) translateNode(child);
  }

  const observer = new MutationObserver(records => {
    observer.disconnect();
    try {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) translateNode(node);
        } else {
          translateNode(record.target);
        }
      }
    } finally {
      observe();
    }
  });
  function observe() {
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: attributes,
    });
  }
  const style = document.createElement('style');
  style.textContent = '[data-fccd-ru-text] { text-transform: none !important; }';
  document.head.appendChild(style);
  translateNode(document.documentElement);
  observe();
  Object.defineProperty(window, '__fccdRu', {
    value: Object.freeze({ version: '0.2.0', entries: Object.keys(translations).length, templates: templateTranslations.length, translate }),
  });
})();
