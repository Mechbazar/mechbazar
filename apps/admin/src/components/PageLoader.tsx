// Suspense fallback for lazy-loaded routes (see App.tsx). Deliberately tiny --
// it's only ever visible for the duration of one chunk fetch.
export default function PageLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-brand-primary" />
    </div>
  );
}
