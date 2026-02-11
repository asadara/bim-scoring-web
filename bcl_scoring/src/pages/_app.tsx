import type { AppProps } from "next/app";
import "@/styles/task-layer.css";
import { validatePublicRuntimeEnv } from "@/lib/runtimeEnv";

validatePublicRuntimeEnv();

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
