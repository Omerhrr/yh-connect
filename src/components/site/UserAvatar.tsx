import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserAvatar({
  avatarUrl,
  name,
  className,
  fallbackClassName,
}: {
  avatarUrl?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={fallbackClassName}>{name.charAt(0).toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  );
}
