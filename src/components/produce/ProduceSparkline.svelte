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

  const DAY_MS = 24 * 60 * 60 * 1000;
  const MAX_CONNECTED_GAP_DAYS = 3;
  const SINCE_2013_START_MS = new Date('2013-01-01T00:00:00').getTime();

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

  function getScaleStartMs(period: TimePeriod, endMs: number): number {
    switch (period) {
      case '1D':
      case '1W':
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
        return endMs - 30 * DAY_MS;
    }
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

  const model = $derived.by(() => {
    if (!points || points.length === 0) return null;

    const width = 100;
    const height = 24;
    const padding = 3;
    const scaleEndMs = dateRange
      ? toDateMs(dateRange.end)
      : toDateMs(points[points.length - 1].date);
    const scaleStartMs = getScaleStartMs(timePeriod, scaleEndMs);

    const plottedPoints = points.filter((point) => {
      const pointMs = toDateMs(point.date);
      return pointMs >= scaleStartMs && pointMs <= scaleEndMs;
    });

    const pointsInScale = downsampleForTimePeriod(plottedPoints.length > 0 ? plottedPoints : points, timePeriod);
    const values = pointsInScale.map((point) => point.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    const startMs = scaleStartMs;
    const endMs = dateRange
      ? toDateMs(dateRange.end)
      : toDateMs(points[points.length - 1].date);
    const totalMs = endMs - startMs;

    const normalized = pointsInScale.map((point) => {
      const pointMs = toDateMs(point.date);
      const x = (totalMs === 0 ? width / 2 : ((pointMs - startMs) / totalMs) * width) + padding;
      const y =
        (range === 0 ? height / 2 : height - ((point.price - min) / range) * height) + padding;
      return { x, y, pointMs };
    });

    const svgWidth = width + padding * 2;
    const firstPoint = normalized[0];
    const lastPoint = normalized[normalized.length - 1];
    const baselineY = firstPoint?.y ?? height / 2 + padding;

    const periodStartMs = getPeriodStartMs(timePeriod, endMs);
    const periodStartX = (totalMs === 0 ? width / 2 : ((periodStartMs - startMs) / totalMs) * width) + padding;

    const periodStartPoint = (() => {
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

    const lineSegments: { points: { x: number; y: number }[]; position: PositionY }[] = [];
    const areaSegments: { points: { x: number; y: number }[]; position: PositionY }[] = [];
    const missingGapRanges: { startX: number; endX: number }[] = [];
    const positionY = (point: { y: number }): PositionY =>
      point.y === baselineY ? 'baseline' : point.y < baselineY ? 'above' : 'below';

    if (normalized.length > 1) {
      const gapThresholdMs = getConnectedGapThresholdMs(timePeriod);
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

        const pushAreaSegment = () => {
          if (currentPosition === null || currentPoints.length < 2) return;
          areaSegments.push({ points: [...currentPoints], position: currentPosition });
        };

        const pushLineSegment = () => {
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

    const hatchEndX = Math.max(periodStartX, padding, firstPoint?.x ?? padding);

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
      hatchEndX,
      positionY,
    };
  });

  const activePoint = $derived.by(() => {
    if (!model) return null;
    if (activeIndex === null) return null;
    if (activeIndex < 0 || activeIndex >= model.normalized.length) return null;
    if (activeIndex >= model.pointsInScale.length) return null;
    return {
      coordinates: model.normalized[activeIndex],
      data: model.pointsInScale[activeIndex],
    };
  });

  const isOutOfRange = $derived.by(() => {
    if (!model || !activePoint) return false;
    const x = activePoint.coordinates.x;
    if (x < model.hatchEndX) return true;
    if (
      unavailableSinceDate &&
      model.lastPoint &&
      model.lastPoint.x < model.width + model.padding &&
      x >= model.lastPoint.x
    ) {
      return true;
    }
    return false;
  });

  function handlePointerMove(e: PointerEvent) {
    if (!model || !canvasRef || model.normalized.length === 0) return;
    const rect = canvasRef.getBoundingClientRect();
    if (rect.width === 0) return;
    const canvasX = ((e.clientX - rect.left) / rect.width) * model.svgWidth;
    let closest = 0;
    let closestDist = Math.abs(model.normalized[0].x - canvasX);

    for (let i = 1; i < model.normalized.length; i += 1) {
      const dist = Math.abs(model.normalized[i].x - canvasX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    const threshold = (5 * model.svgWidth) / rect.width;
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

  function handlePointerDown(e: PointerEvent) {
    const target = e.currentTarget;
    if (target instanceof HTMLCanvasElement) {
      target.setPointerCapture(e.pointerId);
    }
    handlePointerMove(e);
  }

  function handlePointerLeave() {
    activeIndex = null;
    lastActiveIndex = null;
  }

  function strokeLine(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    color: string,
    width = 2,
  ) {
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
  ) {
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
  ) {
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

  $effect(() => {
    if (!model || !canvasRef) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const logicalWidth = model.svgWidth;
    const logicalHeight = model.height + model.padding * 2;

    canvas.width = Math.round(logicalWidth * pixelRatio);
    canvas.height = Math.round(logicalHeight * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    for (const gap of model.missingGapRanges) {
      drawHatchRect(ctx, gap.startX, 0, Math.max(0, gap.endX - gap.startX), logicalHeight);
    }

    for (const segment of model.areaSegments) {
      if (segment.points.length < 2) continue;
      const start = segment.points[0];
      const end = segment.points[segment.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, model.baselineY);
      ctx.lineTo(start.x, start.y);
      for (let i = 1; i < segment.points.length; i += 1) {
        const point = segment.points[i];
        ctx.lineTo(point.x, point.y);
      }
      ctx.lineTo(end.x, model.baselineY);
      ctx.closePath();
      ctx.fillStyle = segment.position === 'above' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
      ctx.fill();
    }

    for (const segment of model.lineSegments) {
      const color =
        segment.position === 'above' ? '#ef4444' : segment.position === 'below' ? '#22c55e' : '#a1a1aa';
      strokeLine(ctx, segment.points, color, 2);
    }

    if (model.firstPoint) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(model.padding, model.firstPoint.y);
      ctx.lineTo(model.width + model.padding, model.firstPoint.y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    if (model.hatchEndX > model.padding) {
      drawHatchRect(ctx, model.padding, 0, model.hatchEndX - model.padding, logicalHeight);
    }

    if (unavailableSinceDate && model.lastPoint && model.lastPoint.x < model.width + model.padding) {
      drawHatchRect(
        ctx,
        model.lastPoint.x,
        0,
        model.width + model.padding - model.lastPoint.x,
        logicalHeight,
      );
    }

    if (model.periodStartPoint) {
      const stroke =
        model.positionY(model.periodStartPoint) === 'above'
          ? '#ef4444'
          : model.positionY(model.periodStartPoint) === 'below'
            ? '#22c55e'
            : '#a1a1aa';
      drawCircle(ctx, model.periodStartPoint.x, model.periodStartPoint.y, 2.25, '#ffffff', stroke, 1.5);
    }

    if (model.lastPoint) {
      const fill =
        model.positionY(model.lastPoint) === 'above'
          ? '#ef4444'
          : model.positionY(model.lastPoint) === 'below'
            ? '#22c55e'
            : '#a1a1aa';
      drawCircle(ctx, model.lastPoint.x, model.lastPoint.y, 2.75, fill);
    }

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

{#if !model}
  <div class="h-4 text-[10px] text-zinc-400">—</div>
{:else}
  <div class="relative" data-sparkline-interactive="true">
    <canvas
      bind:this={canvasRef}
      width={model.svgWidth}
      height={model.height + model.padding * 2}
      class="mx-auto h-6 w-auto touch-none"
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
