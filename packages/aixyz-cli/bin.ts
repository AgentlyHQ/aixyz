#!/usr/bin/env bun
import { Command } from "commander";
import { devCommand } from "./dev";
import { buildCommand } from "./build";
import { erc8004Command } from "./register";
import pkg from "./package.json";

const cli = new Command();
cli.name("aixyz").description("CLI for building and deploying aixyz agents").version(pkg.version);

cli.addCommand(devCommand);
cli.addCommand(buildCommand);
cli.addCommand(erc8004Command);

cli.parse();
