import type { FrameworkDefinition, SeriesDefinition, DependencyEdge } from '../types/index.js';

export type SeriesStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/**
 * Determine the status of a series based on completed rounds and dependency graph.
 * A series is LOCKED if ANY of its depends_on series has incomplete rounds.
 * A series becomes AVAILABLE only when ALL dependency series are fully completed.
 */
export function getSeriesStatus(
  series: SeriesDefinition,
  completed_rounds: string[],
  completed_series: number[],
  allSeries: SeriesDefinition[],
): SeriesStatus {
  // Check if all rounds for this series are completed
  const allRoundsComplete = series.rounds.every((r) => completed_rounds.includes(`${series.id}-${r.round}`));

  if (allRoundsComplete) return 'completed';

  // Check if any answers exist for this series
  const hasAnswers = completed_rounds.some((r) => r.startsWith(`${series.id}-`));
  if (hasAnswers) return 'in_progress';

  // Check dependencies
  const depsMet = series.depends_on.every((depId) => {
    const depSeries = allSeries.find((s) => s.id === depId);
    if (!depSeries) return false;
    return depSeries.rounds.every((r) => completed_rounds.includes(`${depId}-${r.round}`));
  });

  return depsMet ? 'available' : 'locked';
}

/**
 * Get all series with their current statuses
 */
export function getAllSeriesStatuses(
  framework: FrameworkDefinition,
  completed_rounds: string[],
  completed_series: number[],
): { series: SeriesDefinition; status: SeriesStatus }[] {
  return framework.series.map((s) => ({
    series: s,
    status: getSeriesStatus(s, completed_rounds, completed_series, framework.series),
  }));
}

/**
 * Get the next available series (first non-completed, available series)
 */
export function getNextAvailableSeries(
  framework: FrameworkDefinition,
  completed_rounds: string[],
  completed_series: number[],
): SeriesDefinition | null {
  const statuses = getAllSeriesStatuses(framework, completed_rounds, completed_series);
  const available = statuses.find((s) => s.status === 'available' || s.status === 'in_progress');
  return available?.series || null;
}

/**
 * Get all blocked series with their blocking reasons
 */
export function getBlockedSeries(
  framework: FrameworkDefinition,
  completed_rounds: string[],
  completed_series: number[],
): { series: SeriesDefinition; blocked_by: number[] }[] {
  const statuses = getAllSeriesStatuses(framework, completed_rounds, completed_series);
  return statuses
    .filter((s) => s.status === 'locked')
    .map((s) => ({
      series: s.series,
      blocked_by: s.series.depends_on.filter((depId) => {
        const depSeries = framework.series.find((ds) => ds.id === depId);
        return depSeries && !depSeries.rounds.every((r) => completed_rounds.includes(`${depId}-${r.round}`));
      }),
    }));
}
