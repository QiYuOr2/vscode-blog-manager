import { afterEach, describe, expect, it } from "vitest";
import { buildDateGroupTree, groupArticlesByDate, parseFrontMatterDate } from "./date-group";

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTz;
  }
});

describe("parseFrontMatterDate", () => {
  it("reads a UTC date-only Date from its UTC calendar fields", () => {
    const value = new Date(Date.UTC(2024, 0, 1));

    expect(parseFrontMatterDate(value)).toEqual({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 0, 1),
    });
  });

  it("reads a UTC timestamp Date from its UTC calendar day and instant", () => {
    const value = new Date(Date.UTC(2024, 5, 2, 3, 4, 5, 6));

    expect(parseFrontMatterDate(value)).toEqual({
      year: 2024,
      month: 6,
      sortKey: value.getTime(),
    });
  });

  it("rejects an invalid Date", () => {
    expect(parseFrontMatterDate(new Date(Number.NaN))).toBeNull();
  });

  it("parses date-only strings, including single digits and surrounding whitespace", () => {
    expect(parseFrontMatterDate("2024-01-01")).toEqual({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 0, 1),
    });
    expect(parseFrontMatterDate("  2024-1-1  ")).toEqual({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 0, 1),
    });
    expect(parseFrontMatterDate("2024-02-29")).toMatchObject({ year: 2024, month: 2 });
  });

  it("parses date-time strings with and without a timezone", () => {
    expect(parseFrontMatterDate("2024-01-01 09:30")).toMatchObject({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 0, 1, 9, 30),
    });
    expect(parseFrontMatterDate("2024-01-01T09:30:00Z")).toMatchObject({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 0, 1, 9, 30),
    });
    expect(parseFrontMatterDate("2024-01-01t00:30:00z")).toMatchObject({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 0, 1, 0, 30),
    });
    expect(parseFrontMatterDate("2024-1-2 3:04:05")).toMatchObject({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 0, 2, 3, 4, 5),
    });
    expect(parseFrontMatterDate("2024-01-01T00:30:00.5Z")?.sortKey).toBe(Date.UTC(2024, 0, 1, 0, 30, 0, 500));
    expect(parseFrontMatterDate("2024-01-01 00:30:00.12")?.sortKey).toBe(Date.UTC(2024, 0, 1, 0, 30, 0, 120));
    expect(parseFrontMatterDate("2024-01-01T00:30:00.1234Z")?.sortKey).toBe(Date.UTC(2024, 0, 1, 0, 30, 0, 123));
  });

  it("keeps the literal year and month of a zoned string and sorts by the UTC instant", () => {
    expect(parseFrontMatterDate("2024-01-01T00:30:00+08:00")).toEqual({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2023, 11, 31, 16, 30),
    });
    expect(parseFrontMatterDate("2024-01-01T00:30:00+0800")).toEqual({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2023, 11, 31, 16, 30),
    });
    expect(parseFrontMatterDate("2024-01-01T00:30:00+8:00")?.sortKey).toBe(Date.UTC(2023, 11, 31, 16, 30));
    expect(parseFrontMatterDate("2024-01-01T00:30:00+08")?.sortKey).toBe(Date.UTC(2023, 11, 31, 16, 30));
    expect(parseFrontMatterDate("2024-01-31T23:30:00-05:00")).toEqual({
      year: 2024,
      month: 1,
      sortKey: Date.UTC(2024, 1, 1, 4, 30),
    });
  });

  it("treats the same offset timestamp as a UTC Date once js-yaml has converted it", () => {
    const shifted = new Date(Date.UTC(2024, 1, 1, 4, 30));

    expect(parseFrontMatterDate(shifted)).toMatchObject({ year: 2024, month: 2 });
    expect(parseFrontMatterDate("2024-01-31T23:30:00-05:00")).toMatchObject({ year: 2024, month: 1 });
  });

  it("rejects missing, blank, and unparseable values", () => {
    expect(parseFrontMatterDate(undefined)).toBeNull();
    expect(parseFrontMatterDate(null)).toBeNull();
    expect(parseFrontMatterDate("")).toBeNull();
    expect(parseFrontMatterDate("   ")).toBeNull();
    expect(parseFrontMatterDate("not-a-date")).toBeNull();
    expect(parseFrontMatterDate("2024/01/01")).toBeNull();
    expect(parseFrontMatterDate("2024-13-01")).toBeNull();
    expect(parseFrontMatterDate("2024-00-10")).toBeNull();
    expect(parseFrontMatterDate("2024-01-32")).toBeNull();
    expect(parseFrontMatterDate("2023-02-29")).toBeNull();
    expect(parseFrontMatterDate("2024-01-01T24:00:00")).toBeNull();
    expect(parseFrontMatterDate("2024-01-01T23:60:00")).toBeNull();
    expect(parseFrontMatterDate("2024-01-01T00:30:00+24:00")).toBeNull();
    expect(parseFrontMatterDate(20240101)).toBeNull();
    expect(parseFrontMatterDate(true)).toBeNull();
    expect(parseFrontMatterDate({ year: 2024 })).toBeNull();
  });

  describe("timezone boundaries", () => {
    it("does not move a UTC date-only value into the previous month in a negative offset", () => {
      process.env.TZ = "America/New_York";
      const value = new Date(Date.UTC(2024, 0, 1));

      expect(value.getFullYear()).toBe(2023);
      expect(value.getMonth()).toBe(11);
      expect(parseFrontMatterDate(value)).toEqual({
        year: 2024,
        month: 1,
        sortKey: Date.UTC(2024, 0, 1),
      });
    });

    it("does not move an early UTC timestamp into the previous year in a negative offset", () => {
      process.env.TZ = "Pacific/Honolulu";
      const value = new Date(Date.UTC(2024, 0, 1, 0, 30));

      expect(value.getFullYear()).toBe(2023);
      expect(value.getMonth()).toBe(11);
      expect(parseFrontMatterDate(value)).toMatchObject({ year: 2024, month: 1 });
    });

    it("does not move a late UTC timestamp into the next year in a positive offset", () => {
      process.env.TZ = "Pacific/Kiritimati";
      const value = new Date(Date.UTC(2023, 11, 31, 23, 30));

      expect(value.getFullYear()).toBe(2024);
      expect(value.getMonth()).toBe(0);
      expect(parseFrontMatterDate(value)).toMatchObject({ year: 2023, month: 12 });
    });

    it("keeps literal string dates stable across timezones", () => {
      for (const tz of ["UTC", "America/New_York", "Asia/Shanghai", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;

        expect(parseFrontMatterDate("2024-01-01")).toMatchObject({ year: 2024, month: 1 });
        expect(parseFrontMatterDate("2024-01-01T00:30:00+08:00")).toMatchObject({
          year: 2024,
          month: 1,
          sortKey: Date.UTC(2023, 11, 31, 16, 30),
        });
      }
    });
  });
});

describe("groupArticlesByDate", () => {
  type Item = { title: string; date?: unknown; publishDate?: unknown };

  function titles(groups: ReturnType<typeof groupArticlesByDate<Item>>): unknown {
    return {
      years: groups.years.map((year) => ({
        year: year.year,
        months: year.months.map((month) => ({
          month: month.month,
          titles: month.articles.map((article) => article.title),
        })),
      })),
      undated: groups.undated.map((article) => article.title),
    };
  }

  it("sorts years, months, and articles from newest to oldest and leaves undated items last", () => {
    const articles: Item[] = [
      { title: "undated-first" },
      { title: "jan-morning", date: "2024-01-02 01:00:00" },
      { title: "may", date: "1999-05-01" },
      { title: "bad", date: "yesterday" },
      { title: "jan-midnight", date: new Date(Date.UTC(2024, 0, 2)) },
      { title: "dec", date: "2024-12-01" },
      { title: "jan-afternoon", date: "2024-01-02T15:00:00Z" },
      { title: "undated-last", date: "" },
    ];

    expect(titles(groupArticlesByDate(articles, (article) => article.date))).toEqual({
      years: [
        {
          year: 2024,
          months: [
            { month: 12, titles: ["dec"] },
            { month: 1, titles: ["jan-afternoon", "jan-morning", "jan-midnight"] },
          ],
        },
        {
          year: 1999,
          months: [{ month: 5, titles: ["may"] }],
        },
      ],
      undated: ["undated-first", "bad", "undated-last"],
    });
  });

  it("keeps the original order when two articles have the same instant", () => {
    const instant = new Date(Date.UTC(2024, 0, 2));
    const articles: Item[] = [
      { title: "string-first", date: "2024-01-02" },
      { title: "date-second", date: instant },
    ];

    expect(titles(groupArticlesByDate(articles, (article) => article.date))).toEqual({
      years: [{ year: 2024, months: [{ month: 1, titles: ["string-first", "date-second"] }] }],
      undated: [],
    });
  });

  it("reads whatever field the caller selects and does not mutate the input", () => {
    const custom = Object.freeze({ title: "custom", publishDate: "2022-04-03", date: "2020-01-01" });
    const missing = Object.freeze({ title: "missing-custom", date: "2024-08-01" });
    const articles: readonly Item[] = Object.freeze([custom, missing]);
    const before = articles.map((article) => article.title);

    const grouped = groupArticlesByDate(articles, (article) => article.publishDate);

    expect(titles(grouped)).toEqual({
      years: [{ year: 2022, months: [{ month: 4, titles: ["custom"] }] }],
      undated: ["missing-custom"],
    });
    expect(grouped.years[0].months[0].articles[0]).toBe(custom);
    expect(articles.map((article) => article.title)).toEqual(before);
  });
});

describe("buildDateGroupTree", () => {
  it("labels years and zero-padded months, with the undated group last", () => {
    const articles = [
      { title: "new", date: "2024-03-02" },
      { title: "old", date: "2024-01-09" },
      { title: "none" },
    ];
    const tree = buildDateGroupTree(
      groupArticlesByDate(articles, (article) => article.date),
      "未设置日期",
    );

    expect(tree).toEqual([
      {
        label: "2024",
        months: [
          { label: "03", articles: [articles[0]] },
          { label: "01", articles: [articles[1]] },
        ],
      },
      { label: "未设置日期", articles: [articles[2]] },
    ]);
  });

  it("omits the undated group when every article has a date", () => {
    const tree = buildDateGroupTree(
      groupArticlesByDate([{ title: "only", date: "2024-12-01" }], (article) => article.date),
      "未设置日期",
    );

    expect(tree.map((node) => node.label)).toEqual(["2024"]);
  });

  it("returns no nodes for an empty article list", () => {
    expect(buildDateGroupTree(groupArticlesByDate([], () => undefined), "未设置日期")).toEqual([]);
  });
});
