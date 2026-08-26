export const HOME_LOGICAL_WIDTH = 320;
export const HOME_LOGICAL_HEIGHT = 200;
export const MAP_LOGICAL_WIDTH = 224;
export const MAP_LOGICAL_HEIGHT = 192;

/** WorldNav HUD; scenes must not include this in their scale. */
export const WORLD_NAV_HEIGHT = 56;

/** Home hint strip below the stage. */
export const HOME_HINT_HEIGHT = 40;

/** Neighborhood top chrome (view name / slice tabs). */
export const MAP_TOP_CHROME_HEIGHT = 48;

export function integerScale(
  availableWidth: number,
  availableHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): number {
  if (logicalWidth <= 0 || logicalHeight <= 0) {
    return 1;
  }

  const byWidth = availableWidth / logicalWidth;
  const byHeight = availableHeight / logicalHeight;
  return Math.max(1, Math.floor(Math.min(byWidth, byHeight)));
}

export type Letterbox = {
  scale: number;
  stageWidth: number;
  stageHeight: number;
  offsetX: number;
  offsetY: number;
  remainderX: number;
  remainderY: number;
};

export function computeLetterbox(
  availableWidth: number,
  availableHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): Letterbox {
  const scale = integerScale(availableWidth, availableHeight, logicalWidth, logicalHeight);
  const stageWidth = logicalWidth * scale;
  const stageHeight = logicalHeight * scale;
  const remainderX = availableWidth - stageWidth;
  const remainderY = availableHeight - stageHeight;

  return {
    scale,
    stageWidth,
    stageHeight,
    offsetX: Math.floor(remainderX / 2),
    offsetY: Math.floor(remainderY / 2),
    remainderX,
    remainderY,
  };
}

export function homeStageScale(viewportWidth: number, viewportHeight: number): number {
  return integerScale(
    viewportWidth,
    viewportHeight - WORLD_NAV_HEIGHT - HOME_HINT_HEIGHT,
    HOME_LOGICAL_WIDTH,
    HOME_LOGICAL_HEIGHT,
  );
}

export function mapStageScale(viewportWidth: number, viewportHeight: number): number {
  return integerScale(
    viewportWidth,
    viewportHeight - WORLD_NAV_HEIGHT - MAP_TOP_CHROME_HEIGHT,
    MAP_LOGICAL_WIDTH,
    MAP_LOGICAL_HEIGHT,
  );
}
