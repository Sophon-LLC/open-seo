import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Reuses OpenSEO's Recharts stack. The table also works without chart JS. */
export function DailyTrend({
  rows,
  label,
  percent = false,
}: {
  rows: { date: string; value: number | null }[];
  label: string;
  percent?: boolean;
}) {
  const format = (value: number) =>
    percent
      ? `${(value * 100).toFixed(1)}%`
      : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const hasValues = rows.some((row) => row.value !== null);
  return (
    <figure className="min-w-0 space-y-2" aria-label={`${label} daily trend`}>
      <figcaption className="text-sm font-medium">{label}</figcaption>
      {hasValues ? (
        <div className="h-60 min-w-0 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 8, right: 14, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                stroke="currentColor"
                opacity={0.1}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => String(date).slice(5)}
                minTickGap={35}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, "auto"]}
                width={46}
                tickFormatter={format}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => [format(Number(value)), label]}
                contentStyle={{
                  background: "var(--color-base-100)",
                  borderColor: "var(--color-base-300)",
                  borderRadius: 8,
                }}
              />
              <Line
                dataKey="value"
                name={label}
                type="linear"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-8 text-sm text-base-content/60">
          No daily observations available.
        </p>
      )}
      {hasValues && rows.some((row) => row.value === null) && (
        <p className="text-xs text-base-content/60">
          Unreported days remain gaps, not zero.
        </p>
      )}
      {rows.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer py-1 text-base-content/70">
            View daily values
          </summary>
          <div className="max-h-52 overflow-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>{label}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>
                      {row.value === null ? "Not reported" : format(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
