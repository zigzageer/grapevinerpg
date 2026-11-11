import { test, expect } from "@playwright/test";
for (const size of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`Safari engine: ${size.width}×${size.height} game fills the display and touch controls work`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize(size);
    await page.goto("/");
    await expect
      .poll(
        async () =>
          (await page.getByTestId("game-viewport").boundingBox())!.height,
      )
      .toBe(size.height);
    const world = (await page.getByTestId("game-viewport").boundingBox())!;
    expect(world).toEqual({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    });
    await page
      .getByRole("button", { name: "Choose characters", exact: true })
      .tap();
    await page.getByLabel("Find a character").fill("Genesis");
    await page
      .getByRole("group", { name: "Character selection" })
      .getByRole("button", { name: "Play as Genesis", exact: true })
      .tap();
    await expect(page.getByTestId("active-character-name")).toHaveText(
      "Genesis",
    );
    const sprite = page.getByTestId("player-sprite"),
      x = Number(await sprite.getAttribute("data-x")),
      right = (await page
        .getByRole("button", { name: "Move right", exact: true })
        .boundingBox())!;
    await page.mouse.move(
      right.x + right.width / 2,
      right.y + right.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    await expect
      .poll(async () => Number(await sprite.getAttribute("data-x")))
      .toBeGreaterThan(x + 30);
    await page.waitForTimeout(100);
    const stopped = Number(await sprite.getAttribute("data-x"));
    await page.waitForTimeout(150);
    expect(Number(await sprite.getAttribute("data-x"))).toBeCloseTo(stopped, 0);
    await page.getByRole("button", { name: "Pause menu", exact: true }).tap();
    await page.getByRole("switch", { name: "TV episode look" }).tap();
    await page.getByRole("button", { name: "Resume game", exact: true }).tap();
    await expect(page.locator(".play-screen")).toHaveAttribute(
      "data-tv-look",
      "false",
    );
    expect(errors).toEqual([]);
  });
}
