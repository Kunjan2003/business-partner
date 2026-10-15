import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
const config: NextConfig = { transpilePackages: ["@bp/core"] };
export default withSentryConfig(config, { silent: true, disableLogger: true });
