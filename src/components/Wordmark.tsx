// The SideQuest title: our logo and the name.
import Image from "next/image";

export default function Wordmark() {
  return (
    <h1 className="flex items-center gap-3">
      {/* Decorative: the name next to it already says SideQuest. */}
      <Image src="/logo.png" alt="" width={48} height={48} priority className="h-12 w-12 shrink-0 shadow-card rounded-[22%]" />
      <span className="font-display text-[2.6rem] font-extrabold leading-none tracking-[-0.03em]">
        Side<span className="text-study">Quest</span>
      </span>
    </h1>
  );
}
