import fs from "fs";
import config from "eslint-config-prettier";

export default [
  {
    ignores: fs.readFileSync(".gitignore", "utf8").split("\n"),
  },
  config,
];
