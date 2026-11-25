import type { Discovery, Product, ProductProvider, Search } from "./model";
// Illustrative snapshots only. Prices, ratings and assessments are synthetic, not current offers.
const seeds: Record<
  Search["category"],
  [string, number, number, string, string, string][]
> = {
  Tablets: [
    ["Apple iPad (A16)", 329, 4.7, "A16 chip", "11-inch display", "iPadOS"],
    [
      "Samsung Galaxy Tab S9 FE",
      299,
      4.6,
      "Exynos 1380",
      "10.9-inch display",
      "Android",
    ],
    [
      "Lenovo Tab P12",
      279,
      4.4,
      "Dimensity 7050",
      "12.7-inch display",
      "Android",
    ],
    [
      "Microsoft Surface Go 3",
      399,
      4.2,
      "Intel Pentium Gold",
      "10.5-inch display",
      "Windows",
    ],
  ],
  Laptops: [
    [
      "Acer Aspire 5",
      549,
      4.3,
      "Intel Core i5",
      "15.6-inch display",
      "Windows",
    ],
    [
      "Apple MacBook Air M2",
      799,
      4.8,
      "Apple M2",
      "13.6-inch display",
      "macOS",
    ],
    [
      "Lenovo IdeaPad Slim 3",
      449,
      4.4,
      "AMD Ryzen 5",
      "15.6-inch display",
      "Windows",
    ],
    [
      "ASUS Vivobook 15",
      599,
      4.3,
      "Intel Core i5",
      "15.6-inch display",
      "Windows",
    ],
  ],
  Headphones: [
    [
      "Sony WH-1000XM5",
      299,
      4.6,
      "Active noise cancellation",
      "30-hour battery",
      "Bluetooth",
    ],
    [
      "Bose QuietComfort",
      249,
      4.5,
      "Active noise cancellation",
      "24-hour battery",
      "Bluetooth",
    ],
    [
      "Anker Soundcore Q45",
      129,
      4.4,
      "Active noise cancellation",
      "50-hour battery",
      "Bluetooth",
    ],
    [
      "Sennheiser Momentum 4",
      279,
      4.5,
      "Active noise cancellation",
      "60-hour battery",
      "Bluetooth",
    ],
  ],
  Smartphones: [
    [
      "Google Pixel 8a",
      349,
      4.4,
      "Google Tensor G3",
      "6.1-inch display",
      "Android",
    ],
    [
      "Samsung Galaxy A55",
      329,
      4.5,
      "Exynos 1480",
      "6.6-inch display",
      "Android",
    ],
    ["Apple iPhone SE", 299, 4.3, "Apple A15", "4.7-inch display", "iOS"],
    [
      "Motorola Moto G Power",
      199,
      4.1,
      "MediaTek Dimensity",
      "6.7-inch display",
      "Android",
    ],
  ],
};
export function demoProducts(category: Search["category"]): Product[] {
  return seeds[category].map(([name, price, rating, chip, display, os], i) => {
    const sourceUrl =
      "https://www.google.com/search?q=" +
      encodeURIComponent(name + " manufacturer specifications");
    const reason =
      "Illustrative demo assessment; verify against original manufacturer documentation before purchasing.";
    return {
      id: category + "-" + i,
      name,
      price,
      rating,
      url: null,
      image: null,
      specs: [
        { label: "Platform", value: os, sourceUrl },
        { label: "Hardware", value: chip, sourceUrl },
        { label: "Display / battery", value: display, sourceUrl },
      ],
      strengths: [
        i === 0
          ? "Strong overall capability"
          : "Competitive value for the budget",
        "Portable everyday design",
      ],
      weaknesses: [
        category === "Tablets" && os !== "Windows"
          ? "Desktop Photoshop and Illustrator are not fully supported; mobile apps differ."
          : "Verify application compatibility and exact configuration.",
      ],
      evidence: {
        performance: {
          score: [88, 72, 65, 56][i],
          reason,
          sourceUrls: [sourceUrl],
        },
        compatibility: {
          score: [72, 68, 62, 90][i],
          reason,
          sourceUrls: [sourceUrl],
        },
        features:
          i === 3
            ? null
            : { score: [80, 91, 77, 65][i], reason, sourceUrls: [sourceUrl] },
      },
      sources: [
        {
          title: "Research this model (demo reference, not verified evidence)",
          url: sourceUrl,
          excerpt: reason,
        },
      ],
    };
  });
}
export const mockProvider: ProductProvider = {
  async search(input): Promise<Discovery> {
    return {
      products: demoProducts(input.category),
      explanation:
        "Demo analysis: prioritize the software you actually need. Mobile creative apps can differ substantially from their desktop counterparts. These sample assessments illustrate the decision engine and are not verified purchasing advice.",
      warnings: [
        "Demo data: illustrative prices, ratings, specifications and scores. No live APIs were called.",
      ],
    };
  },
};
