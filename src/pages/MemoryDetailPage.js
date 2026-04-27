import { useMemo, useState } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { MEMORY_DETAIL_PAGE_CONTENT } from "../content/memoryDetailPageContent";

/**
 * Memory Detail Page
 * - Photo carousel
 * - Full story
 * - Voice player
 */
export function MemoryDetailPage({
  memory,
  loading = false,
  error = "",
  onBack,
  locale = "en",
}) {
  const t = MEMORY_DETAIL_PAGE_CONTENT[locale] || MEMORY_DETAIL_PAGE_CONTENT.en;
  const [index, setIndex] = useState(0);
  const { soundEnabled, hapticEnabled, soundScope } = useFeedbackPrefs();

  const photos = useMemo(() => {
    if (!memory?.photo) return [];
    if (Array.isArray(memory.photo)) return memory.photo;
    return [memory.photo];
  }, [memory]);

  const voiceSrc = memory?.voice || "";
  const currentPhoto = photos[index]?.dataUrl || photos[index] || "";

  function nextPhoto() {
    if (!photos.length) return;
    setIndex((prev) => (prev + 1) % photos.length);
    triggerSuccessFeedback({
      soundEnabled,
      hapticEnabled,
      allowSound: soundScope === "all_success",
    });
  }

  function prevPhoto() {
    if (!photos.length) return;
    setIndex((prev) => (prev - 1 + photos.length) % photos.length);
    triggerSuccessFeedback({
      soundEnabled,
      hapticEnabled,
      allowSound: soundScope === "all_success",
    });
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.brand}>{t.brand}</p>
            <h1 style={styles.title}>{memory?.title || t.defaultTitle}</h1>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>

        <button type="button" onClick={onBack} style={styles.backButton}>
          {t.back}
        </button>

        {loading ? <p style={styles.feedback}>{t.loading}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {!loading && !error && !memory ? (
          <p style={styles.error}>{t.noMemory}</p>
        ) : null}

        {!loading && memory ? (
          <>
            <section style={styles.card}>
              <p style={styles.meta}>
                {new Date(memory.timelineAt).toLocaleString()}
              </p>
              {photos.length ? (
                <div style={styles.carousel}>
                  <img src={currentPhoto} alt="" style={styles.photo} />
                  {photos.length > 1 ? (
                    <div style={styles.carouselActions}>
                      <button type="button" onClick={prevPhoto} style={styles.carouselButton}>
                        {t.previous}
                      </button>
                      <span style={styles.carouselCount}>
                        {index + 1} / {photos.length}
                      </span>
                      <button type="button" onClick={nextPhoto} style={styles.carouselButton}>
                        {t.next}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p style={styles.empty}>{t.noPhotos}</p>
              )}
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>{t.storyTitle}</h2>
              <p style={styles.story}>{memory.story || t.noStory}</p>
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>{t.voiceTitle}</h2>
              {voiceSrc ? (
                <audio controls src={voiceSrc} style={{ width: "100%" }} />
              ) : (
                <p style={styles.empty}>{t.noVoice}</p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "radial-gradient(circle at top, #291e19 0%, #120f0e 58%)",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  shell: {
    maxWidth: 860,
    margin: "0 auto",
    display: "grid",
    gap: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  brand: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 30,
    fontWeight: 500,
  },
  backButton: {
    justifySelf: "start",
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  card: {
    border: "1px solid #3a2d28",
    borderRadius: 14,
    background: "#171210",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  meta: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 13,
  },
  carousel: {
    display: "grid",
    gap: 8,
  },
  photo: {
    width: "100%",
    maxHeight: 460,
    objectFit: "cover",
    borderRadius: 12,
    border: "1px solid #3a2d28",
  },
  carouselActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  carouselButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  carouselCount: {
    color: "#d9c3b3",
    fontSize: 13,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
  },
  story: {
    margin: 0,
    color: "#f8efe7",
    opacity: 0.92,
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
  },
  empty: {
    margin: 0,
    color: "#d9c3b3",
  },
  feedback: {
    margin: 0,
    color: "#f2d8c5",
  },
  error: {
    margin: 0,
    color: "#ffb8a3",
  },
};
