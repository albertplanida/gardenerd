import { graphqlErrorCode } from "./errors";

describe("graphqlErrorCode", () => {
  it("returns a known domain code", () => {
    expect(
      graphqlErrorCode({
        response: {
          errors: [{ extensions: { code: "GROWING_TRIAL_NOT_PLANNED" } }],
        },
      }),
    ).toBe("GROWING_TRIAL_NOT_PLANNED");
  });

  it.each([
    "GROWING_TRIAL_NOT_ACTIVE",
    "GROWING_TRIAL_NOT_ENDABLE",
    "GROWING_TRIAL_NOT_TERMINAL",
    "END_DATE_IN_FUTURE",
    "END_DATE_BEFORE_START",
    "INVALID_RESULT_SUMMARY",
  ])("recognizes the terminal trial code %s", (code) => {
    expect(
      graphqlErrorCode({
        response: { errors: [{ extensions: { code } }] },
      }),
    ).toBe(code);
  });

  it.each([
    new Error("network"),
    { response: { errors: [{ extensions: { code: "NEW_SERVER_CODE" } }] } },
    { response: { errors: [] } },
  ])("does not treat an unknown error as a domain outcome", (error) => {
    expect(graphqlErrorCode(error)).toBeNull();
  });
});
