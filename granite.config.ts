import { defineConfig } from "@apps-in-toss/web-framework";

export default defineConfig({
  appName: "Money Flow",
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
  },
  brand: {
    displayName: "Money Flow",
    primaryColor: "#3182F6",
  },
});
