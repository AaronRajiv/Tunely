import { Suspense } from "react";
import { RoomClient } from "@/components/room-client";

export default function RoomPage({ params }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6 text-white">
          <div className="panel max-w-xl p-8 text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-white/40">Loading</p>
            <h1 className="mt-3 text-3xl font-semibold">Opening room {params.code}</h1>
          </div>
        </main>
      }
    >
      <RoomClient code={params.code} />
    </Suspense>
  );
}
