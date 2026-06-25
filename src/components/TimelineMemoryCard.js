/**
 * Single timeline card — lazy thumb, no inline base64 in DOM when possible.
 */
export function TimelineMemoryCard({
  memory,
  thumbUrl = "",
  textFirst = false,
  pinned = false,
  locked = false,
  viewerNow = Date.now(),
  deferLargeThumb = false,
  t,
  onTogglePin,
  onOpen,
}) {
  const sealed = Boolean(memory?.is_sealed || memory?.ring_id);
  const showThumb =
    !textFirst && (Boolean(thumbUrl) || (!deferLargeThumb && memory?.hasPhotos !== false));
  const showLargePlaceholder =
    deferLargeThumb && memory?.hasLargePhotos && !thumbUrl && !textFirst;

  return (
    <article style={styles.card}>
      <div style={styles.cardHeader}>
        <small style={styles.date}>{new Date(memory.timelineAt).toLocaleString()}</small>
        <button type="button" onClick={() => onTogglePin?.(memory.id)} style={styles.pinButton}>
          {pinned ? t.unpin : t.pin}
        </button>
      </div>
      <div style={styles.titleRow}>
        <h3 style={styles.cardTitle}>
          {pinned ? "📌 " : ""}
          {memory.title || t.untitled}
        </h3>
        {sealed ? (
          <span style={styles.sealBadge} title={t.sealedBadge}>
            🔒 {t.sealedBadge}
          </span>
        ) : null}
      </div>
      {textFirst && memory?.hasPhotos ? (
        <p style={styles.photoHint}>{t.textFirstPhotoHint}</p>
      ) : null}
      {showLargePlaceholder ? (
        <div style={styles.thumbRow}>
          <div style={styles.thumbPlaceholder} aria-hidden />
          <p style={styles.largePhotoLabel}>{t.largePhotoLabel || "Contains large photo"}</p>
        </div>
      ) : null}
      {deferLargeThumb && memory?.hasPhotos && !memory?.hasLargePhotos && !thumbUrl ? (
        <p style={styles.photoHint}>{t.largePhotoDeferredHint || t.textFirstPhotoHint}</p>
      ) : null}
      {showThumb ? (
        <div style={styles.thumbRow}>
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={t.thumbAlt}
              style={styles.thumb}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          ) : (
            <div style={styles.thumbPlaceholder} aria-hidden />
          )}
        </div>
      ) : null}
      <p style={styles.preview}>
        {locked
          ? t.capsuleLockedPreview.replace(
              "{time}",
              new Date(memory.releaseAt).toLocaleString()
            )
          : memory.storyPreview || memory.story || t.noStory}
      </p>
      <button
        type="button"
        onClick={() => onOpen?.(memory.id)}
        style={styles.primaryButton}
        disabled={locked}
      >
        {locked ? t.capsuleOpen : t.open}
      </button>
    </article>
  );
}

const styles = {
  card: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.03)",
    display: "grid",
    gap: 10,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  date: { opacity: 0.7, fontSize: 12 },
  pinButton: {
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: 12,
    opacity: 0.85,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { margin: 0, fontSize: 18, lineHeight: 1.3 },
  sealBadge: { fontSize: 11, opacity: 0.85, whiteSpace: "nowrap" },
  photoHint: {
    margin: 0,
    fontSize: 12,
    opacity: 0.72,
    fontStyle: "italic",
  },
  thumbRow: { display: "flex", gap: 8 },
  thumb: {
    width: 88,
    height: 88,
    objectFit: "cover",
    borderRadius: 10,
    background: "rgba(0,0,0,0.2)",
  },
  thumbPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
  },
  largePhotoLabel: {
    margin: 0,
    alignSelf: "center",
    fontSize: 12,
    opacity: 0.78,
    fontStyle: "italic",
  },
  preview: {
    margin: 0,
    opacity: 0.88,
    lineHeight: 1.45,
    fontSize: 14,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  primaryButton: {
    justifySelf: "start",
    borderRadius: 999,
    border: "1px solid rgba(217,166,122,0.45)",
    background: "rgba(217,166,122,0.12)",
    color: "inherit",
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
};
