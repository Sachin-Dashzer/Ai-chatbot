// Shown while Today's data is on the way. It keeps the canvas padding of the
// real screen so the page does not jump when the figures land.
import { ScreenSkeleton } from "../components/ui";

export default function Loading() {
  return (
    <div className="min-h-dvh bg-ground px-4 py-6 sm:px-6 lg:px-gutter lg:py-8">
      <div className="mx-auto max-w-[1240px]">
        <ScreenSkeleton />
      </div>
    </div>
  );
}
