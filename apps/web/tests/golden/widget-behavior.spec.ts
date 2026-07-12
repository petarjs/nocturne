import { expect, test } from "@playwright/test";

test("timeseries keeps its full line visible during rapid updates", async ({ page }) => {
  await page.goto("/display?scene=kitchenSink");
  await expect(page.getByText("Kitchen Sink", { exact: false })).toBeVisible();

  await page.keyboard.press("Backquote");
  await page.getByRole("button", { name: "network · timeseries", exact: true }).click();

  const spike = page.getByRole("button", { name: "spike", exact: true });
  const canvas = page.locator('[data-widget-id="network"] canvas');
  await expect(canvas).toBeVisible();

  await spike.click();
  await page.waitForTimeout(90);
  await spike.click();
  await page.waitForTimeout(90);
  await spike.click();
  await page.waitForTimeout(120);

  const maxRightEdgeAlpha = await canvas.evaluate((element) => {
    const chart = element as HTMLCanvasElement;
    const context = chart.getContext("2d");
    if (!context) return 0;
    const startX = Math.max(0, chart.width - Math.ceil(chart.width * 0.04));
    const pixels = context.getImageData(startX, 0, chart.width - startX, chart.height).data;
    let max = 0;
    for (let i = 3; i < pixels.length; i += 4) max = Math.max(max, pixels[i]);
    return max;
  });

  // A data morph must keep the line and terminal dot present at the right
  // edge. The old draw-on implementation repeatedly erased this edge while
  // pushes arrived faster than its 550ms animation.
  expect(maxRightEdgeAlpha).toBeGreaterThan(200);
  await expect(page.locator('[data-widget-id="network"]')).toContainText("168.6");
});

test("every widget renderer appears in the catalog without a fallback", async ({ page }) => {
  await page.goto("/display?scene=kitchenSink&still=1");
  await expect(page.getByText("Kitchen Sink", { exact: false })).toBeVisible();
  await page.keyboard.press("Backquote");

  const expectations = [
    { act: "act 1", ids: ["cpu", "memory", "network", "clock", "disk", "storage", "services", "containers"] },
    { act: "act 2", ids: ["hosts", "log", "agenda", "clock", "note", "notes-md"] },
    { act: "act 3", ids: ["playing", "weather", "image", "clock", "video", "composite-note"] },
  ];

  for (const { act, ids } of expectations) {
    await page.getByRole("button", { name: act, exact: true }).click();
    for (const id of ids) {
      await expect(page.locator(`[data-widget-id="${id}"]:not([data-has-spark])`)).toBeVisible();
    }
  }

  await expect(page.getByText("Invalid widget data", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Invalid composition", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Unsupported widget", { exact: true })).toHaveCount(0);
});
