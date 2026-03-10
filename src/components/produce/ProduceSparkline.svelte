<script lang="ts">
  import type { ProduceDateRange, ProduceHistoryPoint } from '@/lib/produce-types';

  type TimePeriod =
    | '1D'
    | '1W'
    | '1M'
    | '1Y'
    | '5Y'
    | 'MAX'
    | 'YTD';

  type PositionY = 'above' | 'baseline' | 'below';
  type SparklinePoint = { x: number; y: number; pointMs: number };
  type SparklineSegment = { points: { x: number; y: number }[]; position: PositionY };
  type SparklineModel = {
    width: number;
    height: number;
    padding: number;
    svgWidth: number;
    pointsInScale: ProduceHistoryPoint[];
    normalized: SparklinePoint[];
    lineSegments: SparklineSegment[];
    areaSegments: SparklineSegment[];
    missingGapRanges: { startX: number; endX: number }[];
    firstPoint: SparklinePoint | undefined;
    lastPoint: SparklinePoint | undefined;
    baselineY: number;
    periodStartPoint: SparklinePoint | null;
    scaleStartMs: number;
    scaleEndMs: number;
    periodStartMs: number;
    minValue: number;
    maxValue: number;
    positionY: (point: { y: number }) => PositionY;
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const MAX_CONNECTED_GAP_DAYS = 3;
  const SINCE_2013_START_MS = new Date('2013-01-01T00:00:00').getTime();
  const WINDOW_TRANSITION_MS = 750;
  const MAX_DELTA_MS = 50;
  const RANGE_LERP_SPEED = 0.15;

  let {
    points,
    dateRange,
    timePeriod,
    unavailableSinceDate = null,
  }: {
    points?: ProduceHistoryPoint[];
    dateRange: ProduceDateRange | null;
    timePeriod: TimePeriod;
    unavailableSinceDate?: string | null;
  } = $props();

  let activeIndex = $state<number | null>(null);
  let canvasRef = $state<HTMLCanvasElement | null>(null);
  let lastActiveIndex = $state<number | null>(null);
  let isVisible = $state(true);

  let renderedModel = $state<SparklineModel | null>(null);
  let displayWindowMs: number | null = null;
  let displayMin = 0;
  let displayMax = 0;
  let targetMin = 0;
  let targetMax = 0;
  let rangeInited = false;
  let transitionSourceModel: SparklineModel | null = null;
  let lastStableModel: SparklineModel | null = null;
  let rafId = 0;
  let windowTransition = {
    from: 0,
    to: 0,
    startMs: 0,
    rangeFromMin: 0,
    rangeFromMax: 0,
    rangeToMin: 0,
    rangeToMax: 0,
  };

  function toDateMs(isoDate: string): number {
    // Use midday to avoid day-boundary drift across timezone/DST transitions.
    return new Date(isoDate + 'T12:00:00').getTime();
  }

  function getPeriodStartMs(period: TimePeriod, endMs: number): number {
    switch (period) {
      case '1D':
        return endMs - DAY_MS;
      case '1W':
        return endMs - 7 * DAY_MS;
      case '1M':
        return endMs - 30 * DAY_MS;
      case '1Y':
        return endMs - 365 * DAY_MS;
      case '5Y':
        return endMs - 1825 * DAY_MS;
      case 'MAX':
        return SINCE_2013_START_MS;
      case 'YTD': {
        const endDate = new Date(endMs);
        return new Date(endDate.getFullYear(), 0, 1).getTime();
      }
      default:
        return endMs - DAY_MS;
    }
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(current: number, target: number, speed: number, dt = 16.67): number {
    const factor = 1 - Math.pow(1 - speed, dt / 16.67);
    return current + (target - current) * factor;
  }

  function downsampleForTimePeriod(
    inputPoints: ProduceHistoryPoint[],
    period: TimePeriod,
  ): ProduceHistoryPoint[] {
    if (inputPoints.length < 2) return inputPoints;

    const ensureIncludesLatestPoint = (
      sampledPoints: ProduceHistoryPoint[],
      sourcePoints: ProduceHistoryPoint[],
    ): ProduceHistoryPoint[] => {
      const latestSourcePoint = sourcePoints[sourcePoints.length - 1];
      if (!latestSourcePoint) return sampledPoints;
      if (sampledPoints.length === 0) return [latestSourcePoint];

      const lastIndex = sampledPoints.length - 1;
      if (sampledPoints[lastIndex].date === latestSourcePoint.date) {
        sampledPoints[lastIndex] = latestSourcePoint;
        return sampledPoints;
      }

      sampledPoints.push(latestSourcePoint);
      return sampledPoints;
    };

    if (period === '5Y') {
      const bucketSizeMs = 7 * DAY_MS;
      const sampled: ProduceHistoryPoint[] = [];
      let activeBucket: number | null = null;

      for (const point of inputPoints) {
        const pointMs = new Date(point.date + 'T00:00:00').getTime();
        const bucket = Math.floor(pointMs / bucketSizeMs);
        if (bucket !== activeBucket) {
          sampled.push(point);
          activeBucket = bucket;
        } else {
          sampled[sampled.length - 1] = point;
        }
      }

      return ensureIncludesLatestPoint(sampled, inputPoints);
    }

    if (period === 'MAX') {
      const sampled: ProduceHistoryPoint[] = [];
      let activeMonthKey: string | null = null;

      for (const point of inputPoints) {
        const date = new Date(point.date + 'T00:00:00');
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthKey !== activeMonthKey) {
          sampled.push(point);
          activeMonthKey = monthKey;
        }
      }

      return ensureIncludesLatestPoint(sampled, inputPoints);
    }

    return inputPoints;
  }

  function getConnectedGapThresholdMs(period: TimePeriod): number {
    switch (period) {
      case '5Y':
        return 7 * DAY_MS;
      case 'MAX':
        return 31 * DAY_MS;
      default:
        return MAX_CONNECTED_GAP_DAYS * DAY_MS;
    }
  }

  function formatShortDateWithYear(isoDate: string): string {
    const date = new Date(isoDate + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function buildSparklineModel({
    period,
    scaleStartMs,
    scaleEndMs,
    periodStartMs,
    fixedRange,
    baselineYOverride,
  }: {
    period: TimePeriod;
    scaleStartMs: number;
    scaleEndMs: number;
    periodStartMs: number;
    fixedRange?: { min: number; max: number };
    baselineYOverride?: number;
  }): SparklineModel | null {
    if (!points || points.length === 0) return null;

    const width = 100;
    const height = 24;
    const padding = 3;
    const plottedPoints = points.filter((point) : boolean => {
      const pointMs = toDateMs(point.date);
      return pointMs >= scaleStartMs && pointMs <= scaleEndMs;
    });
    const pointsInScale = downsampleForTimePeriod(plottedPoints.length > 0 ? plottedPoints : points, period);
    if (pointsInScale.length === 0) return null;

    const values = pointsInScale.map((point) : number => point.price);
    const computedMin = Math.min(...values);
    const computedMax = Math.max(...values);
    const min = fixedRange ? Math.min(fixedRange.min, fixedRange.max) : computedMin;
    const max = fixedRange ? Math.max(fixedRange.min, fixedRange.max) : computedMax;
    const range = max - min;
    const totalMs = scaleEndMs - scaleStartMs;

    const normalized: SparklinePoint[] = pointsInScale.map((point) : { x: number; y: number; pointMs: number; } => {
      const pointMs = toDateMs(point.date);
      const x = (totalMs === 0 ? width / 2 : ((pointMs - scaleStartMs) / totalMs) * width) + padding;
      const y =
        (range === 0 ? height / 2 : height - ((point.price - min) / range) * height) + padding;
      return { x, y, pointMs };
    });

    const svgWidth = width + padding * 2;
    const firstPoint = normalized[0];
    const lastPoint = normalized[normalized.length - 1];
    const defaultBaselineY = firstPoint?.y ?? height / 2 + padding;
    const baselineY =
      baselineYOverride === undefined
        ? defaultBaselineY
        : clamp(baselineYOverride, padding, height + padding);
    const periodStartX =
      (totalMs === 0 ? width / 2 : ((periodStartMs - scaleStartMs) / totalMs) * width) + padding;

    const periodStartPoint = (() : SparklinePoint | null => {
      if (normalized.length < 2) return null;
      let closest = normalized[0];
      let closestDist = Infinity;
      for (const [index, point] of pointsInScale.entries()) {
        const pointMs = toDateMs(point.date);
        const dist = Math.abs(pointMs - periodStartMs);
        const normPoint = normalized[index];
        if (dist < closestDist) {
          closestDist = dist;
          closest = normPoint;
        }
      }
      return closest;
    })();

    const lineSegments: SparklineSegment[] = [];
    const areaSegments: SparklineSegment[] = [];
    const missingGapRanges: { startX: number; endX: number }[] = [];
    const positionY = (point: { y: number }): PositionY =>
      point.y === baselineY ? 'baseline' : point.y < baselineY ? 'above' : 'below';

    if (normalized.length > 1) {
      const gapThresholdMs = getConnectedGapThresholdMs(period);
      const contiguousChunks: (typeof normalized)[] = [];
      let activeChunk = [normalized[0]];
      for (let i = 1; i < normalized.length; i += 1) {
        const prevPoint = normalized[i - 1];
        const currentPoint = normalized[i];
        const gapMs = currentPoint.pointMs - prevPoint.pointMs;
        if (gapMs > gapThresholdMs) {
          contiguousChunks.push(activeChunk);
          activeChunk = [currentPoint];
          missingGapRanges.push({ startX: prevPoint.x, endX: currentPoint.x });
          continue;
        }
        activeChunk.push(currentPoint);
      }
      contiguousChunks.push(activeChunk);

      for (const chunk of contiguousChunks) {
        if (chunk.length < 2) continue;

        let currentPoints: { x: number; y: number }[] = [];
        let currentPosition: PositionY | null = null;

        const pushAreaSegment = () : void => {
          if (currentPosition === null || currentPoints.length < 2) return;
          areaSegments.push({ points: [...currentPoints], position: currentPosition });
        };

        const pushLineSegment = () : void => {
          if (currentPosition === null || currentPoints.length < 2) return;
          lineSegments.push({ points: [...currentPoints], position: currentPosition });
        };

        for (let i = 1; i < chunk.length; i += 1) {
          const prev = chunk[i - 1];
          const curr = chunk[i];
          const prevPos = positionY(prev);
          const currPos = positionY(curr);

          if (prevPos === 'baseline' && currPos === 'baseline') {
            pushAreaSegment();
            pushLineSegment();
            currentPoints = [];
            currentPosition = null;
            lineSegments.push({ points: [prev, curr], position: 'baseline' });
            continue;
          }

          const segmentPos = prevPos !== 'baseline' ? prevPos : currPos;
          if (currentPosition === null) {
            currentPosition = segmentPos;
          }
          if (currentPoints.length === 0) {
            currentPoints.push(prev);
          }

          if (
            (prevPos === 'above' && currPos === 'below') ||
            (prevPos === 'below' && currPos === 'above')
          ) {
            const t = (baselineY - prev.y) / (curr.y - prev.y);
            const intersection = {
              x: prev.x + t * (curr.x - prev.x),
              y: baselineY,
            };
            currentPoints.push(intersection);
            pushAreaSegment();
            pushLineSegment();
            currentPoints = [intersection, curr];
            currentPosition = currPos;
          } else {
            currentPoints.push(curr);
          }
        }

        pushAreaSegment();
        pushLineSegment();
      }
    }

    return {
      width,
      height,
      padding,
      svgWidth,
      pointsInScale,
      normalized,
      lineSegments,
      areaSegments,
      missingGapRanges,
      firstPoint,
      lastPoint,
      baselineY,
      periodStartPoint,
      scaleStartMs,
      scaleEndMs,
      periodStartMs,
      minValue: min,
      maxValue: max,
      positionY,
    };
  }

  const targetModel = $derived.by((): SparklineModel | null => {
    if (!points || points.length === 0) return null;
    const scaleEndMs = dateRange
      ? toDateMs(dateRange.end)
      : toDateMs(points[points.length - 1].date);
    const scaleStartMs = Math.max(SINCE_2013_START_MS, getPeriodStartMs(timePeriod, scaleEndMs));
    const periodStartMs = getPeriodStartMs(timePeriod, scaleEndMs);

    return buildSparklineModel({
      period: timePeriod,
      scaleStartMs,
      scaleEndMs,
      periodStartMs,
    });
  });

  const displayModel = $derived.by(() : SparklineModel | null => renderedModel ?? targetModel);

  const activePoint = $derived.by(() : { coordinates: SparklinePoint; data: ProduceHistoryPoint; } | null => {
    if (!displayModel) return null;
    if (activeIndex === null) return null;
    if (activeIndex < 0 || activeIndex >= displayModel.normalized.length) return null;
    if (activeIndex >= displayModel.pointsInScale.length) return null;
    return {
      coordinates: displayModel.normalized[activeIndex],
      data: displayModel.pointsInScale[activeIndex],
    };
  });

  const isOutOfRange = $derived.by(() : boolean => {
    if (!displayModel || !activePoint) return false;
    const x = activePoint.coordinates.x;
    if (
      unavailableSinceDate &&
      displayModel.lastPoint &&
      displayModel.lastPoint.x < displayModel.width + displayModel.padding &&
      x >= displayModel.lastPoint.x
    ) {
      return true;
    }
    return false;
  });

  $effect(() : (() => void) | undefined => {
    if (!canvasRef) return;
    const element = canvasRef;
    if (typeof IntersectionObserver === 'undefined') {
      isVisible = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) : void => {
        const entry = entries[0];
        isVisible = !!entry?.isIntersecting;
      },
      { root: null, threshold: 0.01 },
    );
    observer.observe(element);
    return () : void => observer.disconnect();
  });

  function resetEngineToTarget(target: SparklineModel) : void {
    displayWindowMs = Math.max(target.scaleEndMs - target.scaleStartMs, DAY_MS);
    displayMin = target.minValue;
    displayMax = target.maxValue;
    targetMin = target.minValue;
    targetMax = target.maxValue;
    rangeInited = true;
    renderedModel = target;
    lastStableModel = target;
    transitionSourceModel = null;
    windowTransition = {
      from: displayWindowMs,
      to: displayWindowMs,
      startMs: 0,
      rangeFromMin: target.minValue,
      rangeFromMax: target.maxValue,
      rangeToMin: target.minValue,
      rangeToMax: target.maxValue,
    };
  }

  $effect(() : (() => void) | undefined => {
    if (!targetModel) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      renderedModel = null;
      displayWindowMs = null;
      rangeInited = false;
      transitionSourceModel = null;
      windowTransition = {
        from: 0,
        to: 0,
        startMs: 0,
        rangeFromMin: 0,
        rangeFromMax: 0,
        rangeToMin: 0,
        rangeToMax: 0,
      };
      return;
    }

    const targetWindowMs = Math.max(targetModel.scaleEndMs - targetModel.scaleStartMs, DAY_MS);
    if (displayWindowMs === null || !rangeInited) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      resetEngineToTarget(targetModel);
      return;
    }

    if (windowTransition.to !== targetWindowMs) {
      transitionSourceModel = lastStableModel ?? targetModel;
      windowTransition = {
        from: displayWindowMs,
        to: targetWindowMs,
        startMs: performance.now(),
        rangeFromMin: displayMin,
        rangeFromMax: displayMax,
        rangeToMin: targetModel.minValue,
        rangeToMax: targetModel.maxValue,
      };
    } else {
      windowTransition = {
        ...windowTransition,
        rangeToMin: targetModel.minValue,
        rangeToMax: targetModel.maxValue,
      };
    }

    if (!isVisible) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      resetEngineToTarget(targetModel);
      return;
    }

    cancelAnimationFrame(rafId);
    let lastFrame = performance.now();

    const animate = (now: number) : void => {
      const dt = Math.min(now - lastFrame, MAX_DELTA_MS);
      lastFrame = now;

      let isWindowTransitioning = false;
      let windowProgress = 0;
      let currentWindowMs = targetWindowMs;
      const activeTransition = windowTransition;

      if (activeTransition.startMs > 0) {
        const elapsed = now - activeTransition.startMs;
        const t = Math.min(elapsed / WINDOW_TRANSITION_MS, 1);
        const eased = (1 - Math.cos(t * Math.PI)) / 2;
        windowProgress = eased;
        isWindowTransitioning = t < 1;

        const logFrom = Math.log(Math.max(activeTransition.from, DAY_MS));
        const logTo = Math.log(Math.max(activeTransition.to, DAY_MS));
        currentWindowMs = Math.exp(logFrom + (logTo - logFrom) * eased);

        if (t >= 1) {
          currentWindowMs = targetWindowMs;
          windowTransition = {
            ...activeTransition,
            startMs: 0,
            from: targetWindowMs,
          };
        }
      }

      displayWindowMs = currentWindowMs;

      if (isWindowTransitioning) {
        displayMin =
          activeTransition.rangeFromMin +
          (activeTransition.rangeToMin - activeTransition.rangeFromMin) * windowProgress;
        displayMax =
          activeTransition.rangeFromMax +
          (activeTransition.rangeToMax - activeTransition.rangeFromMax) * windowProgress;
        targetMin = targetModel.minValue;
        targetMax = targetModel.maxValue;
      } else {
        const curRange = displayMax - displayMin;
        targetMin = targetModel.minValue;
        targetMax = targetModel.maxValue;
        displayMin = lerp(displayMin, targetMin, RANGE_LERP_SPEED, dt);
        displayMax = lerp(displayMax, targetMax, RANGE_LERP_SPEED, dt);
        const pxThreshold = 0.5 * curRange / targetModel.height || 0.001;
        if (Math.abs(displayMin - targetMin) < pxThreshold) displayMin = targetMin;
        if (Math.abs(displayMax - targetMax) < pxThreshold) displayMax = targetMax;
      }

      const periodStartMs = transitionSourceModel
        ? transitionSourceModel.periodStartMs +
          (targetModel.periodStartMs - transitionSourceModel.periodStartMs) * windowProgress
        : targetModel.periodStartMs;
      const baselineY = transitionSourceModel
        ? transitionSourceModel.baselineY +
          (targetModel.baselineY - transitionSourceModel.baselineY) * windowProgress
        : targetModel.baselineY;
      const interpolated = buildSparklineModel({
        period: timePeriod,
        scaleStartMs: targetModel.scaleEndMs - currentWindowMs,
        scaleEndMs: targetModel.scaleEndMs,
        periodStartMs,
        fixedRange: { min: displayMin, max: displayMax },
        baselineYOverride: baselineY,
      });

      renderedModel = interpolated ?? targetModel;
      const rangeSettled = Math.abs(displayMin - targetMin) < 0.0005 && Math.abs(displayMax - targetMax) < 0.0005;

      if (isWindowTransitioning || !rangeSettled) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      transitionSourceModel = null;
      resetEngineToTarget(targetModel);
      rafId = 0;
    };

    rafId = requestAnimationFrame(animate);
    return () : void => {
      cancelAnimationFrame(rafId);
      rafId = 0;
    };
  });

  function handlePointerMove(e: PointerEvent) : void {
    if (!displayModel || !canvasRef || displayModel.normalized.length === 0) return;
    const rect = canvasRef.getBoundingClientRect();
    if (rect.width === 0) return;
    const canvasX = ((e.clientX - rect.left) / rect.width) * displayModel.svgWidth;
    let closest = 0;
    let closestDist = Math.abs(displayModel.normalized[0].x - canvasX);

    for (let i = 1; i < displayModel.normalized.length; i += 1) {
      const dist = Math.abs(displayModel.normalized[i].x - canvasX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    const threshold = (5 * displayModel.svgWidth) / rect.width;
    if (closestDist > threshold) {
      activeIndex = null;
      lastActiveIndex = null;
      return;
    }

    activeIndex = closest;
    if (lastActiveIndex !== closest) {
      lastActiveIndex = closest;
      navigator.vibrate?.(1);
    }
  }

  function handlePointerDown(e: PointerEvent) : void {
    const target = e.currentTarget;
    if (target instanceof HTMLCanvasElement) {
      target.setPointerCapture(e.pointerId);
    }
    handlePointerMove(e);
  }

  function handlePointerLeave() : void {
    activeIndex = null;
    lastActiveIndex = null;
  }

  function strokeLine(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    color: string,
    width = 2,
  ) : void {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      ctx.lineTo(point.x, point.y);
    }
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    fill: string,
    stroke?: string,
    strokeWidth = 1,
  ) : void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawHatchRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
  ) : void {
    if (width <= 0 || height <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    const spacing = 4;
    ctx.strokeStyle = 'rgba(82, 82, 91, 0.8)';
    ctx.lineWidth = 0.5;
    for (let i = -height; i <= width + height; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + height);
      ctx.lineTo(x + i + height, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSparklineModel(
    ctx: CanvasRenderingContext2D,
    drawModel: SparklineModel,
    unavailableDate: string | null,
  ) : void {
    const logicalHeight = drawModel.height + drawModel.padding * 2;
    const trendPosition: PositionY =
      !drawModel.periodStartPoint || !drawModel.lastPoint
        ? 'baseline'
        : Math.abs(drawModel.lastPoint.y - drawModel.periodStartPoint.y) < 0.001
          ? 'baseline'
          : drawModel.lastPoint.y < drawModel.periodStartPoint.y
            ? 'above'
            : 'below';
    const trendLineColor =
      trendPosition === 'above' ? '#ef4444' : trendPosition === 'below' ? '#22c55e' : '#a1a1aa';
    const trendFillColor =
      trendPosition === 'above'
        ? 'rgba(239, 68, 68, 0.2)'
        : trendPosition === 'below'
          ? 'rgba(34, 197, 94, 0.2)'
          : 'rgba(161, 161, 170, 0.2)';
    ctx.save();

    for (const gap of drawModel.missingGapRanges) {
      drawHatchRect(ctx, gap.startX, 0, Math.max(0, gap.endX - gap.startX), logicalHeight);
    }

    for (const segment of drawModel.areaSegments) {
      if (segment.points.length < 2) continue;
      const start = segment.points[0];
      const end = segment.points[segment.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, drawModel.baselineY);
      ctx.lineTo(start.x, start.y);
      for (let i = 1; i < segment.points.length; i += 1) {
        const point = segment.points[i];
        ctx.lineTo(point.x, point.y);
      }
      ctx.lineTo(end.x, drawModel.baselineY);
      ctx.closePath();
      ctx.fillStyle = trendFillColor;
      ctx.fill();
    }

    for (const segment of drawModel.lineSegments) {
      strokeLine(ctx, segment.points, trendLineColor, 2);
    }

    if (drawModel.firstPoint) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(drawModel.padding, drawModel.firstPoint.y);
      ctx.lineTo(drawModel.width + drawModel.padding, drawModel.firstPoint.y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    if (
      unavailableDate &&
      drawModel.lastPoint &&
      drawModel.lastPoint.x < drawModel.width + drawModel.padding
    ) {
      drawHatchRect(
        ctx,
        drawModel.lastPoint.x,
        0,
        drawModel.width + drawModel.padding - drawModel.lastPoint.x,
        logicalHeight,
      );
    }

    if (drawModel.periodStartPoint) {
      const stroke =
        drawModel.positionY(drawModel.periodStartPoint) === 'above'
          ? '#ef4444'
          : drawModel.positionY(drawModel.periodStartPoint) === 'below'
            ? '#22c55e'
            : '#a1a1aa';
      drawCircle(ctx, drawModel.periodStartPoint.x, drawModel.periodStartPoint.y, 2.25, '#ffffff', stroke, 1.5);
    }

    if (drawModel.lastPoint) {
      drawCircle(ctx, drawModel.lastPoint.x, drawModel.lastPoint.y, 2.75, trendLineColor);
    }
    ctx.restore();
  }

  $effect(() : void => {
    if (!displayModel || !canvasRef) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const logicalWidth = displayModel.svgWidth;
    const logicalHeight = displayModel.height + displayModel.padding * 2;

    canvas.width = Math.round(logicalWidth * pixelRatio);
    canvas.height = Math.round(logicalHeight * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    drawSparklineModel(ctx, displayModel, unavailableSinceDate);

    if (activePoint) {
      ctx.save();
      ctx.globalAlpha = isOutOfRange ? 0.5 : 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(activePoint.coordinates.x, 0);
      ctx.lineTo(activePoint.coordinates.x, logicalHeight);
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.restore();
      drawCircle(ctx, activePoint.coordinates.x, activePoint.coordinates.y, 3, '#ffffff', '#3f3f46', 1.5);
    }
  });
</script>

{#if !displayModel}
  <div class="h-4 text-[10px] text-zinc-400">—</div>
{:else}
  <div class="relative" data-sparkline-interactive="true">
    <canvas
      bind:this={canvasRef}
      width={displayModel.svgWidth}
      height={displayModel.height + displayModel.padding * 2}
      class="relative z-10 mx-auto h-6 w-auto touch-none"
      aria-label="Produce price sparkline"
      onpointermove={handlePointerMove}
      onpointerdown={handlePointerDown}
      onpointerup={handlePointerLeave}
      onpointerleave={handlePointerLeave}
      onpointercancel={handlePointerLeave}
    ></canvas>

    <div class="mt-0.5 h-3">
      {#if activePoint}
        <div
          class={`mb-0.5 inline-block rounded bg-black px-1.5 py-0.5 text-center text-[10px] text-white tabular-nums ${
            isOutOfRange ? 'opacity-50' : ''
          }`}
        >
          {formatShortDateWithYear(activePoint.data.date)} · ${activePoint.data.price.toFixed(2)}
        </div>
      {/if}
    </div>
  </div>
{/if}
