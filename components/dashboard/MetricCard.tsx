export type MetricTrendDirection = "up" | "down" | "flat";
export type MetricTrendSentiment = "positive" | "negative" | "neutral";

export interface MetricTrend {
  /** Signed change in percent: 12.5 renders "+12.5%", -3 renders "−3%", 0 renders "0%". */
  delta: number;
  /** Comparison context rendered after the badge, e.g. "vs last 7 days". */
  label?: string;
  /**
   * Set when a falling number is the good outcome (refunds, cart abandonment,
   * response time) so the badge tints by business meaning, not by sign.
   */
  invert?: boolean;
}

export interface MetricCardProps {
  /** Metric name, rendered as the card's eyebrow. */
  title: string;
  /**
   * Pre-formatted string (currency, durations, ratios) or a raw number, which
   * is grouped for display ("12,480"). Currency formatting stays with the
   * caller — the card never guesses a unit.
   */
  value: string | number;
  /** Optional period-over-period change. */
  trend?: MetricTrend;
}

const valueFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const deltaFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

function directionOf(delta: number): MetricTrendDirection {
  if (!Number.isFinite(delta) || delta === 0) return "flat";
  return delta > 0 ? "up" : "down";
}

function sentimentOf(direction: MetricTrendDirection, invert: boolean): MetricTrendSentiment {
  if (direction === "flat") return "neutral";
  const rises = direction === "up";
  return rises !== invert ? "positive" : "negative";
}

/**
 * Tint is a secondary channel only — the glyph, the sign and the sr-only
 * sentence carry the meaning, so the badge stays inside the --dash-* palette
 * (sage = good, gold = attention) with no imported red.
 */
const SENTIMENT_CLASS: Record<MetricTrendSentiment, string> = {
  positive: "bg-dash-sage/25 text-dash-forest",
  negative: "bg-dash-gold/25 text-dash-forest",
  neutral: "bg-dash-forest/10 text-dash-forest/70",
};

const DIRECTION_WORD: Record<MetricTrendDirection, string> = {
  up: "Up",
  down: "Down",
  flat: "Unchanged",
};

const GLYPH_PATH: Record<MetricTrendDirection, string> = {
  up: "M3 10 8 5l5 5",
  down: "M3 6l5 5 5-5",
  flat: "M3 8h10",
};

function TrendBadge({ trend }: { trend: MetricTrend }) {
  const direction = directionOf(trend.delta);
  const sentiment = sentimentOf(direction, trend.invert ?? false);
  const magnitude = deltaFormat.format(Math.abs(trend.delta));
  const visible =
    direction === "flat" ? "0%" : `${direction === "up" ? "+" : "−"}${magnitude}%`;
  const context = trend.label ? ` ${trend.label}` : "";
  const spoken =
    direction === "flat"
      ? `${DIRECTION_WORD.flat}${context}`
      : `${DIRECTION_WORD[direction]} ${magnitude} percent${context}`;

  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-dash-forest/60">
      <span className="sr-only">{spoken}</span>
      <span
        aria-hidden="true"
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium tabular-nums ${SENTIMENT_CLASS[sentiment]}`}
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={GLYPH_PATH[direction]} />
        </svg>
        {visible}
      </span>
      {trend.label ? <span aria-hidden="true">{trend.label}</span> : null}
    </p>
  );
}

/**
 * MetricCard — a single headline number for the dashboard.
 *
 * Server component, zero client JS. Corner radius and every colour come from
 * the --dash-* tokens in app/globals.css (rounded-dash, bg-dash-*, text-dash-*);
 * there are no literal hex values here.
 */
export function MetricCard({ title, value, trend }: MetricCardProps) {
  const display = typeof value === "number" ? valueFormat.format(value) : value;

  return (
    <article className="flex flex-col gap-3 rounded-dash border border-dash-forest/10 bg-white/70 p-6 shadow-sm shadow-dash-forest/5 sm:p-7">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-dash-forest/60">{title}</h3>
      <p className="font-serif text-3xl leading-none tracking-tight text-dash-forest tabular-nums sm:text-4xl">
        {display}
      </p>
      {trend ? <TrendBadge trend={trend} /> : null}
    </article>
  );
}

export default MetricCard;
