// js-yaml（front-matter 使用的 safeLoad）会把未加引号的 YAML 日期解析成 Date。
// 纯日期和未带时区的时间都是按 UTC 构造的：2024-01-01 在西时区用本地年月日会变成 2023-12。
// 因此 Date 一律取 UTC 日历。字符串（加引号，或 js-yaml 没当成时间戳的写法）按字面年月，
// 不再做时区换算。带显式偏移、且已被解析成 Date 的值只剩 UTC 瞬间，原始偏移找不回来。

export type ParsedFrontMatterDate = {
  year: number;
  month: number;
  sortKey: number;
};

export type MonthGroup<T> = {
  month: number;
  articles: T[];
};

export type YearGroup<T> = {
  year: number;
  months: MonthGroup<T>[];
};

export type DateGroups<T> = {
  years: YearGroup<T>[];
  undated: T[];
};

export type DateMonthTree<T> = {
  label: string;
  articles: T[];
};

export type DateYearTree<T> = {
  label: string;
  months: DateMonthTree<T>[];
};

export type DateUndatedTree<T> = {
  label: string;
  articles: T[];
};

export type DateGroupTreeNode<T> = DateYearTree<T> | DateUndatedTree<T>;

const DATE_PATTERN =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:(?:[Tt]|[ \t]+)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:[ \t]*(?:([Zz])|([+-])(\d{1,2})(?::?(\d{2}))?))?)?$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseFrontMatterDate(value: unknown): ParsedFrontMatterDate | null {
  if (value instanceof Date) {
    return parseDateInstance(value);
  }

  if (typeof value === "string") {
    return parseDateString(value.trim());
  }

  return null;
}

export function groupArticlesByDate<T>(articles: readonly T[], readDate: (article: T) => unknown): DateGroups<T> {
  const dated: Array<{ article: T; parsed: ParsedFrontMatterDate; index: number }> = [];
  const undated: T[] = [];

  for (let index = 0; index < articles.length; index += 1) {
    const article = articles[index];
    const parsed = parseFrontMatterDate(readDate(article));
    if (parsed === null) {
      undated.push(article);
      continue;
    }
    dated.push({ article, parsed, index });
  }

  const byYear = new Map<number, Map<number, Array<{ article: T; parsed: ParsedFrontMatterDate; index: number }>>>();
  for (const entry of dated) {
    const months = byYear.get(entry.parsed.year) ?? new Map();
    const bucket = months.get(entry.parsed.month) ?? [];
    bucket.push(entry);
    months.set(entry.parsed.month, bucket);
    byYear.set(entry.parsed.year, months);
  }

  const years = [...byYear.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((left, right) => right[0] - left[0])
        .map(([month, entries]) => ({
          month,
          articles: entries
            .slice()
            .sort((left, right) => {
              if (left.parsed.sortKey !== right.parsed.sortKey) {
                return left.parsed.sortKey < right.parsed.sortKey ? 1 : -1;
              }
              return left.index - right.index;
            })
            .map((entry) => entry.article),
        })),
    }));

  return { years, undated };
}

export function buildDateGroupTree<T>(groups: DateGroups<T>, undatedLabel: string): DateGroupTreeNode<T>[] {
  const nodes: DateGroupTreeNode<T>[] = groups.years.map((year) => ({
    label: String(year.year),
    months: year.months.map((month) => ({
      label: String(month.month).padStart(2, "0"),
      articles: month.articles,
    })),
  }));

  if (groups.undated.length > 0) {
    nodes.push({
      label: undatedLabel,
      articles: groups.undated,
    });
  }

  return nodes;
}

function parseDateInstance(value: Date): ParsedFrontMatterDate | null {
  const sortKey = value.getTime();
  if (Number.isNaN(sortKey)) {
    return null;
  }

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    sortKey,
  };
}

function parseDateString(value: string): ParsedFrontMatterDate | null {
  if (value.length === 0) {
    return null;
  }

  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }

  const hourText = match[4];
  if (hourText === undefined) {
    return {
      year,
      month,
      sortKey: Date.UTC(year, month - 1, day),
    };
  }

  const hour = Number(hourText);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const fraction = match[7] === undefined ? 0 : fractionToMilliseconds(match[7]);
  if (!isValidTime(hour, minute, second, fraction)) {
    return null;
  }

  const utc = Date.UTC(year, month - 1, day, hour, minute, second, fraction);
  const offsetSign = match[9];
  if (offsetSign === undefined) {
    return { year, month, sortKey: utc };
  }

  const offsetHour = Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);
  if (!isValidOffset(offsetHour, offsetMinute)) {
    return null;
  }

  const sign = offsetSign === "+" ? 1 : -1;
  const offsetMs = sign * (offsetHour * 60 + offsetMinute) * 60_000;
  return {
    year,
    month,
    sortKey: utc - offsetMs,
  };
}

function fractionToMilliseconds(fraction: string): number {
  return Number(fraction.slice(0, 3).padEnd(3, "0"));
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const days = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= days;
}

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) {
    return true;
  }
  if (year % 100 === 0) {
    return false;
  }
  return year % 4 === 0;
}

function isValidTime(hour: number, minute: number, second: number, fraction: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59 && fraction >= 0 && fraction <= 999;
}

function isValidOffset(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
