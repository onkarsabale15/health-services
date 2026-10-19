export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-4 border-primary-container border-t-primary rounded-full animate-spin" />
    </div>
  );
}
