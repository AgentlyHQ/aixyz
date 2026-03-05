import type { NextConfig } from "next";
import { experimental_withAixyz } from "@aixyz/next";

const nextConfig: NextConfig = {};

export default experimental_withAixyz(nextConfig);
