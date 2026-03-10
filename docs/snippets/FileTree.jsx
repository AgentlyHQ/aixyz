export const FileTree = ({ structure = [], title, maxDepth = 10, showIcons = true, commentPrefix = "# " }) => {
  const lineColor = "rgba(156, 163, 175, 0.25)";

  const badgeColors = {
    blue: { bg: "rgba(59,130,246,0.1)", text: "#3b82f6", border: "rgba(59,130,246,0.2)" },
    green: { bg: "rgba(34,197,94,0.1)", text: "#22c55e", border: "rgba(34,197,94,0.2)" },
    purple: { bg: "rgba(168,85,247,0.1)", text: "#a855f7", border: "rgba(168,85,247,0.2)" },
    red: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", border: "rgba(239,68,68,0.2)" },
    amber: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", border: "rgba(245,158,11,0.2)" },
  };

  const folderSvg = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, color: "#94a3b8" }}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );

  const fileSvg = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, color: "#94a3b8" }}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );

  // Walk tree to find the widest name row (level indent + name chars)
  // so all descriptions align at the same column
  const charWidth = 8.4; // approx monospace char width at 0.875rem
  const iconGap = showIcons ? 22 : 0; // 16px icon + 6px gap
  const connectorWidth = 20;

  const measure = (items, level) => {
    let max = 0;
    for (const item of items) {
      if (!item || !item.name) continue;
      const offset = level * connectorWidth + iconGap + item.name.length * charWidth;
      if (offset > max) max = offset;
      if (item.children) {
        const childMax = measure(item.children, level + 1);
        if (childMax > max) max = childMax;
      }
    }
    return max;
  };

  const descColumn = Math.ceil(measure(structure, 0)) + 16; // 16px padding after longest name

  const render = (item, level, isLast) => {
    if (!item || !item.name || level >= maxDepth) return null;
    const hasChildren = item.children != null && item.children.length > 0;

    const badge = item.badge
      ? (() => {
          const c = badgeColors[item.badge.color] || badgeColors.blue;
          return (
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 500,
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor: c.bg,
                color: c.text,
                border: `1px solid ${c.border}`,
                lineHeight: "1.4",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
              }}
            >
              {item.badge.text}
            </span>
          );
        })()
      : null;

    const connector =
      level > 0 ? (
        <div
          style={{
            position: "relative",
            width: `${connectorWidth}px`,
            flexShrink: 0,
            alignSelf: "stretch",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "0",
              top: "0",
              bottom: isLast ? "calc(100% - 12px)" : "0",
              width: "1px",
              backgroundColor: lineColor,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "0",
              top: "12px",
              width: "12px",
              height: "1px",
              backgroundColor: lineColor,
            }}
          />
        </div>
      ) : null;

    // Width for the name section so descriptions align at descColumn
    const nameAreaWidth = descColumn - level * connectorWidth;

    const label = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          paddingTop: "1px",
          paddingBottom: "1px",
          minHeight: "24px",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: `${nameAreaWidth}px`, flexShrink: 0 }}
        >
          {showIcons && (hasChildren ? folderSvg : fileSvg)}
          <span style={hasChildren ? { fontWeight: 500 } : undefined}>{item.name}</span>
        </div>
        {item.description && (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
            {commentPrefix}
            {item.description}
          </span>
        )}
        {badge}
      </div>
    );

    return (
      <div key={`${item.name}-${level}`} style={{ display: "flex", flexDirection: "row" }}>
        {connector}
        <div style={{ flex: 1, minWidth: 0 }}>
          {label}
          {hasChildren && item.children.map((child, idx) => render(child, level + 1, idx === item.children.length - 1))}
        </div>
      </div>
    );
  };

  return (
    <div className="not-prose mt-5 mb-8 rounded-2xl relative text-gray-950 bg-gray-50 dark:bg-white/5 dark:text-gray-50 border border-gray-950/10 dark:border-white/10 p-0.5">
      {title && (
        <div className="flex text-gray-400 text-xs rounded-t-[14px] leading-6 font-medium pl-4 pr-2.5 py-1">
          <div className="flex-none flex items-center gap-1.5 text-gray-700 dark:text-gray-300">{title}</div>
        </div>
      )}
      <div
        className="w-0 min-w-full max-w-full py-3 px-4 bg-white dark:bg-[#0d1117] overflow-x-auto rounded-xl"
        style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "0.875rem" }}
      >
        {structure.map((item, idx) => render(item, 0, idx === structure.length - 1))}
      </div>
    </div>
  );
};
