import { BaseStationClient } from "./dist/index.js";

const baseStation = new BaseStationClient("").invoke({
  kind: "resourceBackup",
});
