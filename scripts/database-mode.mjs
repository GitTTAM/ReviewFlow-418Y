// PowerShell asks for the mode without reading or printing database credentials.
import "dotenv/config";
import { databaseSettings, safeDatabaseError } from "../server/src/databaseSettings.js";

try {
  console.log(databaseSettings().mode);
} catch (error) {
  console.error(safeDatabaseError(error));
  process.exitCode = 1;
}
