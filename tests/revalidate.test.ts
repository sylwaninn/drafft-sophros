import { describe, expect, it } from "vitest";
import { rootRevalidation } from "~/lib/revalidate";

const url = (path: string) => new URL(path, "https://sophros.test");

function setup(staleMs = 60_000) {
  let clock = 1_000_000;
  const should = rootRevalidation(staleMs, () => clock);
  const navigate = (path: string) => should({ nextUrl: url(path), defaultShouldRevalidate: true });
  return { should, navigate, advance: (ms: number) => (clock += ms) };
}

describe("rootRevalidation", () => {
  it("reads the counters again on the way to the overview", () => {
    const { navigate } = setup();
    expect(navigate("/")).toBe(true);
    expect(navigate("/")).toBe(true);
  });

  it("skips fresh counters between other pages", () => {
    const { navigate, advance } = setup();
    expect(navigate("/reports")).toBe(false);
    advance(59_000);
    expect(navigate("/accounts?q=x")).toBe(false);
  });

  it("reads them again once they are stale, then waits again", () => {
    const { navigate, advance } = setup();
    advance(60_000);
    expect(navigate("/reports")).toBe(true);
    advance(1_000);
    expect(navigate("/support")).toBe(false);
  });

  it("counts from the last read, whatever caused it", () => {
    const { navigate, advance } = setup();
    advance(50_000);
    expect(navigate("/")).toBe(true);
    advance(50_000);
    expect(navigate("/reports")).toBe(false);
  });

  it("follows the router after a submission", () => {
    const { should, navigate, advance } = setup();
    const submit = (defaultShouldRevalidate: boolean) => should({ formMethod: "POST", nextUrl: url("/reports"), defaultShouldRevalidate });
    expect(submit(true)).toBe(true);
    expect(submit(false)).toBe(false);
    advance(30_000);
    expect(navigate("/reports")).toBe(false);
    advance(30_000);
    expect(navigate("/reports")).toBe(true);
  });
});
