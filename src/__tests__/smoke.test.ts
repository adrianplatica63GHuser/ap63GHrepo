// Minimal smoke test to confirm the Jest runner is wired up end-to-end.
// Real unit tests land alongside real code in slice #1 (Person CRUD).

describe("jest smoke test", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });

  it("has access to a DOM (jsdom testEnvironment)", () => {
    const div = document.createElement("div");
    div.textContent = "hello";
    expect(div.textContent).toBe("hello");
  });
});
