import { spaceQueryClient } from "@hatch/space-sdk/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// Last-resort boundary: without it, any render-time throw unmounts the
// whole tree and the panel goes silently white — indistinguishable from
// "the card doesn't work". The fallback keeps the shell layout classes
// and offers a working reload.
class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    /* the fallback below is the user-facing surface */
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="hatch-space-root" data-hatch-space-root>
          <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
            <p className="text-5xl" aria-hidden>😢</p>
            <p className="mt-3 text-xl font-extrabold text-[#0f172a]">PlayVerse couldn&apos;t load</p>
            <p className="mt-1 max-w-sm font-semibold text-[#5b6478]">
              Something went wrong while starting the app. Reloading usually fixes it.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full bg-[#2563eb] px-5 py-2.5 font-bold text-white"
            >
              Reload PlayVerse
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// If you edit this file: keep `<QueryClientProvider client={spaceQueryClient}>`
// wrapping the app (every space shares the SDK's QueryClient), and keep
// BOTH the `hatch-space-root` class AND the `data-hatch-space-root`
// attribute on the outer div. The SDK styles select on
// `.hatch-space-root[data-hatch-space-root]` to apply mobile safe-area
// insets (notches, gesture bars, etc.), correct viewport sizing, and the
// hosting header/chrome offsets — dropping either breaks layout silently.
createRoot(rootEl).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={spaceQueryClient}>
        <div className="hatch-space-root" data-hatch-space-root>
          <App />
        </div>
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
