import { ExternalLink } from "lucide-react";
import { Avatar, AvatarImage } from "~/components/ui/avatar";

type SectionAccountSummaryProps = {
  address: string;
  avatarSrc: string;
  balance: string;
  explorerUrl: string;
};

export function SectionAccountSummary({
  address,
  avatarSrc,
  balance,
  explorerUrl,
}: SectionAccountSummaryProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg" className="shadow-sm">
        <AvatarImage src={avatarSrc} />
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-medium">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
          >
            <span>{address}</span>
            <ExternalLink className="size-3" />
          </a>
        </p>
        <p className="text-sm text-muted-foreground">{balance}</p>
      </div>
    </div>
  );
}
