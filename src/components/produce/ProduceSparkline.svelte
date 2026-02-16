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
  let svgRef = $state<SVGSVGElement | null>(null);
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

      return sampled;
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

      return sampled;
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

    const lineSegments: { d: string; position: PositionY }[] = [];
    const areaSegments: { d: string; position: PositionY }[] = [];
    const missingGapRanges: { startX: number; endX: number }[] = [];
    const positionY = (point: { y: number }): PositionY =>
      point.y === baselineY ? 'baseline' : point.y < baselineY ? 'above' : 'below';
    const formatPoint = (point: { x: number; y: number }) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

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
          const start = currentPoints[0];
          const end = currentPoints[currentPoints.length - 1];
          const line = currentPoints.map((point) => `L ${formatPoint(point)}`).join(' ');
          const d = `M ${start.x.toFixed(2)} ${baselineY.toFixed(2)} ${line} L ${end.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
          areaSegments.push({ d, position: currentPosition });
        };

        const pushLineSegment = () => {
          if (currentPosition === null || currentPoints.length < 2) return;
          const line = currentPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${formatPoint(point)}`);
          lineSegments.push({ d: line.join(' '), position: currentPosition });
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
            lineSegments.push({
              d: `M ${formatPoint(prev)} L ${formatPoint(curr)}`,
              position: 'baseline',
            });
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
      svg: model.normalized[activeIndex],
      data: model.pointsInScale[activeIndex],
    };
  });

  const isOutOfRange = $derived.by(() => {
    if (!model || !activePoint) return false;
    const x = activePoint.svg.x;
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
    if (!model || !svgRef || model.normalized.length === 0) return;

    const ctm = svgRef.getScreenCTM();
    if (!ctm) return;

    const svgX = (e.clientX - ctm.e) / ctm.a;
    let closest = 0;
    let closestDist = Math.abs(model.normalized[0].x - svgX);

    for (let i = 1; i < model.normalized.length; i += 1) {
      const dist = Math.abs(model.normalized[i].x - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    if (closestDist > 5) {
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
    if (target instanceof SVGSVGElement) {
      target.setPointerCapture(e.pointerId);
    }
    handlePointerMove(e);
  }

  function handlePointerLeave() {
    activeIndex = null;
    lastActiveIndex = null;
  }
</script>

{#if !model}
  <div class="h-4 text-[10px] text-zinc-400">—</div>
{:else}
  <div class="relative" data-sparkline-interactive="true">
    <svg
      bind:this={svgRef}
      viewBox={`0 0 ${model.svgWidth} ${model.height + model.padding * 2}`}
      class="mx-auto h-6 touch-none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      onpointermove={handlePointerMove}
      onpointerdown={handlePointerDown}
      onpointerup={handlePointerLeave}
      onpointerleave={handlePointerLeave}
      onpointercancel={handlePointerLeave}
    >
      <defs>
        <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="4" x2="4" y2="0" stroke="#52525b" stroke-width="0.5" stroke-opacity="0.8" />
        </pattern>
      </defs>

      {#each model.missingGapRanges as gap, index (`gap-${index}`)}
        <rect
          x={gap.startX}
          y="0"
          width={Math.max(0, gap.endX - gap.startX)}
          height={model.height + model.padding * 2}
          fill="url(#hatch)"
        />
      {/each}

      {#each model.areaSegments as segment, index (`area-${segment.position}-${index}`)}
        <path
          d={segment.d}
          class={segment.position === 'above' ? 'fill-red-500/20' : 'fill-green-500/20'}
        />
      {/each}

      {#each model.lineSegments as segment, index (`line-${segment.position}-${index}`)}
        <path
          d={segment.d}
          class={{ above: 'stroke-red-500', below: 'stroke-green-500', baseline: 'stroke-zinc-400' }[
            segment.position
          ]}
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/each}

      {#if model.firstPoint}
        <line
          x1={model.padding}
          x2={model.width + model.padding}
          y1={model.firstPoint.y}
          y2={model.firstPoint.y}
          class="stroke-black"
          stroke-width="1"
          stroke-dasharray="3 3"
        />
      {/if}

      {#if model.hatchEndX > model.padding}
        <rect
          x={model.padding}
          y="0"
          width={model.hatchEndX - model.padding}
          height={model.height + model.padding * 2}
          fill="url(#hatch)"
        />
      {/if}

      {#if unavailableSinceDate && model.lastPoint && model.lastPoint.x < model.width + model.padding}
        <rect
          x={model.lastPoint.x}
          y="0"
          width={model.width + model.padding - model.lastPoint.x}
          height={model.height + model.padding * 2}
          fill="url(#hatch)"
        />
      {/if}

      {#if model.periodStartPoint}
        <circle
          cx={model.periodStartPoint.x}
          cy={model.periodStartPoint.y}
          r="2.25"
          class={{
            above: 'fill-white stroke-red-500',
            below: 'fill-white stroke-green-500',
            baseline: 'fill-white stroke-zinc-400',
          }[model.positionY(model.periodStartPoint)]}
          stroke-width="1.5"
        />
      {/if}

      {#if model.lastPoint}
        <circle
          cx={model.lastPoint.x}
          cy={model.lastPoint.y}
          r="2.75"
          class={{ above: 'fill-red-500', below: 'fill-green-500', baseline: 'fill-zinc-400' }[
            model.positionY(model.lastPoint)
          ]}
          stroke-width="0"
        />
      {/if}

      {#if activePoint}
        <g opacity={isOutOfRange ? 0.5 : 1}>
          <line
            x1={activePoint.svg.x}
            x2={activePoint.svg.x}
            y1="0"
            y2={model.height + model.padding * 2}
            class="stroke-zinc-500"
            stroke-width="0.75"
            stroke-dasharray="2 2"
          />
          <circle
            cx={activePoint.svg.x}
            cy={activePoint.svg.y}
            r="3"
            class="fill-white stroke-zinc-700"
            stroke-width="1.5"
          />
        </g>
      {/if}
    </svg>

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
