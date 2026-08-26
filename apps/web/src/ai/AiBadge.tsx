type AiBadgeProps = {
  className?: string;
};

export function AiBadge({ className }: AiBadgeProps) {
  const classes = className ? `ai-badge font-pixel ${className}` : "ai-badge font-pixel";
  return (
    <span className={classes} title="AI 居民">
      <span className="ai-badge__mark" aria-hidden="true">
        ◇
      </span>
      <span>AI 居民</span>
    </span>
  );
}
