type SwipeStep = 1 | -1;

type SwipeDragPayload = {
  step: SwipeStep;
  travelPx: number;
  progress: number;
};

type SwipeCommitPayload = {
  step: SwipeStep;
  route: string;
};

type SwipeNavigatorConfig = {
  captureThresholdPx: number;
  maxVerticalDriftPx: number;
  peekMaxTravelRatio: number;
  commitRatio: number;
  getViewportWidth: () => number;
  canStart: () => boolean;
  isMobileTouchInput: () => boolean;
  isEditableElement: (target: EventTarget | null) => boolean;
  getSwipeTarget: (step: SwipeStep) => string | null;
  preloadRoute: (route: string) => void;
  onStart?: () => void;
  onPreviewRoute: (route: string) => void;
  onDrag: (payload: SwipeDragPayload) => void;
  onNoTarget: () => void;
  onCommit: (payload: SwipeCommitPayload) => void;
  onCancel: () => void;
};

export function createSwipeNavigator(config: SwipeNavigatorConfig) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchCurrentX = 0;
  let touchCurrentY = 0;
  let isTrackingSwipe = false;
  let isHorizontalSwipe = false;

  const resetTracking = () => {
    isTrackingSwipe = false;
    isHorizontalSwipe = false;
    touchStartX = 0;
    touchStartY = 0;
    touchCurrentX = 0;
    touchCurrentY = 0;
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (!config.isMobileTouchInput()) return;
    if (!config.canStart()) return;
    if (event.touches.length !== 1) return;
    if (config.isEditableElement(event.target)) return;

    isTrackingSwipe = true;
    isHorizontalSwipe = false;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchCurrentX = touch.clientX;
    touchCurrentY = touch.clientY;
    config.onStart?.();

    const nextPath = config.getSwipeTarget(1);
    const previousPath = config.getSwipeTarget(-1);
    if (nextPath) config.preloadRoute(nextPath);
    if (previousPath) config.preloadRoute(previousPath);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!isTrackingSwipe) return;
    if (event.touches.length !== 1) {
      resetTracking();
      return;
    }

    const touch = event.touches[0];
    touchCurrentX = touch.clientX;
    touchCurrentY = touch.clientY;

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (!isHorizontalSwipe) {
      const shouldCaptureHorizontalSwipe =
        absDeltaX >= config.captureThresholdPx &&
        absDeltaX > absDeltaY &&
        absDeltaY <= config.maxVerticalDriftPx;
      if (!shouldCaptureHorizontalSwipe) return;
      isHorizontalSwipe = true;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const step: SwipeStep = deltaX > 0 ? 1 : -1;
    const route = config.getSwipeTarget(step);
    if (!route) {
      config.onNoTarget();
      return;
    }

    config.onPreviewRoute(route);
    const viewportWidth = Math.max(config.getViewportWidth(), 1);
    const travelPx = Math.min(absDeltaX, viewportWidth * config.peekMaxTravelRatio);
    const progress = Math.min(1, travelPx / viewportWidth);
    config.onDrag({ step, travelPx, progress });
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!isTrackingSwipe) return;

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (isHorizontalSwipe && event.cancelable) {
      event.preventDefault();
    }

    const hasQualifiedSwipe =
      isHorizontalSwipe &&
      absDeltaX >= Math.max(config.getViewportWidth(), 1) * config.commitRatio &&
      absDeltaY <= config.maxVerticalDriftPx;
    if (!hasQualifiedSwipe) {
      config.onCancel();
      resetTracking();
      return;
    }

    const step: SwipeStep = deltaX > 0 ? 1 : -1;
    const route = config.getSwipeTarget(step);
    if (!route) {
      config.onCancel();
      resetTracking();
      return;
    }

    config.onCommit({ step, route });
    resetTracking();
  };

  const handleTouchCancel = () => {
    if (!isTrackingSwipe) return;
    config.onCancel();
    resetTracking();
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}
