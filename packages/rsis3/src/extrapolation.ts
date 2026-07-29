/**
 * Telemetry extrapolation for RSIS.
 * Deep port of Python extrapolation.py — growth prediction, trend analysis, budget forecasting.
 */

export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface TrendLine {
  slope: number;
  intercept: number;
  rSquared: number;
  forecast: number;
}

export interface ExtrapolationResult {
  metric: string;
  dataPoints: number;
  trend: TrendLine;
  forecast: number;
  confidence: 'high' | 'medium' | 'low';
  doublingTime?: number;
}

export class TelemetryExtrapolator {
  /**
   * Fit a linear regression to data points and extrapolate.
   */
  fitLinear(data: DataPoint[], forecastSteps: number = 10): TrendLine {
    if (data.length < 2) {
      return { slope: 0, intercept: 0, rSquared: 0, forecast: 0 };
    }

    const n = data.length;
    const xs = data.map((_, i) => i);
    const ys = data.map(d => d.value);

    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const yMean = sumY / n;
    const ssRes = ys.reduce((a, y, i) => a + (y - (slope * xs[i] + intercept)) ** 2, 0);
    const ssTot = ys.reduce((a, y) => a + (y - yMean) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    const forecast = slope * (n + forecastSteps - 1) + intercept;

    return { slope, intercept, rSquared, forecast };
  }

  /**
   * Analyze growth trend for a metric over time.
   */
  analyzeGrowth(
    metric: string,
    data: DataPoint[],
    forecastSteps: number = 10,
  ): ExtrapolationResult {
    const trend = this.fitLinear(data, forecastSteps);
    const n = data.length;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (n >= 10 && trend.rSquared > 0.8) confidence = 'high';
    else if (n >= 5 && trend.rSquared > 0.5) confidence = 'medium';

    // Estimate doubling time if growth is positive
    let doublingTime: number | undefined;
    if (trend.slope > 0 && data.length > 0) {
      const lastValue = data[data.length - 1].value;
      if (lastValue > 0) {
        doublingTime = (lastValue / trend.slope) * Math.log(2);
        if (doublingTime < 0) doublingTime = undefined;
      }
    }

    return {
      metric,
      dataPoints: n,
      trend,
      forecast: trend.forecast,
      confidence,
      doublingTime,
    };
  }

  /**
   * Detect plateaus in a time series.
   * Returns indices where the series plateaus (no significant change).
   */
  detectPlateaus(data: DataPoint[], windowSize: number = 5, threshold: number = 0.01): number[] {
    if (data.length < windowSize * 2) return [];

    const plateaus: number[] = [];
    for (let i = windowSize; i < data.length - windowSize; i++) {
      const window = data.slice(i - windowSize, i + windowSize);
      const values = window.map(d => d.value);
      const mean = values.reduce((a, v) => a + v, 0) / values.length;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
      const stddev = Math.sqrt(variance);

      if (stddev / (Math.abs(mean) || 1) < threshold) {
        plateaus.push(i);
      }
    }

    return plateaus;
  }

  /**
   * Forecast resource usage based on historical telemetry.
   */
  forecastResourceUsage(
    resourceType: string,
    historicalData: DataPoint[],
    horizonSteps: number = 20,
  ): { trend: TrendLine; willExceed: boolean; estimatedExceedTime?: number } {
    const analysis = this.analyzeGrowth(resourceType, historicalData, horizonSteps);
    
    // Check if forecast exceeds reasonable bounds
    const willExceed = analysis.trend.forecast > 100 || analysis.trend.slope > 5;

    let estimatedExceedTime: number | undefined;
    if (willExceed && analysis.trend.slope > 0) {
      // Rough estimate of when 100% would be reached
      const lastValue = historicalData[historicalData.length - 1]?.value || 0;
      const stepsToExceed = (100 - lastValue) / analysis.trend.slope;
      estimatedExceedTime = stepsToExceed;
    }

    return {
      trend: analysis.trend,
      willExceed,
      estimatedExceedTime,
    };
  }

  /**
   * Calculate moving average for smoothing telemetry data.
   */
  movingAverage(data: DataPoint[], windowSize: number = 3): DataPoint[] {
    if (data.length < windowSize) return [...data];

    const result: DataPoint[] = [];
    for (let i = windowSize - 1; i < data.length; i++) {
      const window = data.slice(i - windowSize + 1, i + 1);
      const avg = window.reduce((a, d) => a + d.value, 0) / windowSize;
      result.push({
        timestamp: data[i].timestamp,
        value: avg,
        label: `ma-${data[i].label || i}`,
      });
    }

    return result;
  }
}
