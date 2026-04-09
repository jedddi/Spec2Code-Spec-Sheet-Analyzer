import { Inngest } from "inngest";

/** App ID must stay stable for Inngest Cloud routing. */
export const inngest = new Inngest({
  id: "spec2code",
  name: "Spec2Code",
});
