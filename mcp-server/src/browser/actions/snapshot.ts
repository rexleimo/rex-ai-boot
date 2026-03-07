import type { Page } from 'playwright';

import { browserLauncher } from '../launcher.js';
import { detectAuthRequired, detectChallengeRequired } from '../auth.js';
import { applyActionPacing } from '../pacing.js';

type RegionName = 'header' | 'left-sidebar' | 'main' | 'right-sidebar' | 'modal' | 'footer';

interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RawLayoutStats {
  imageCount: number;
  canvasCount: number;
  modalCount: number;
  textNodeCount: number;
  interactiveCount: number;
}

interface RawLayoutElement extends LayoutBox {
  role: string;
  tag: string;
  text: string;
  selectorHint: string;
  clickable: boolean;
  zIndex: number;
}

interface RawTextBlock extends LayoutBox {
  text: string;
}

export interface HybridLayoutRawSnapshot {
  title: string;
  url: string;
  viewport: { width: number; height: number };
  textSample: string;
  stats: RawLayoutStats;
  elements: RawLayoutElement[];
  textBlocks: RawTextBlock[];
}

interface HybridLayoutElement extends RawLayoutElement {
  region: RegionName;
}

interface HybridTextBlock extends RawTextBlock {
  region: RegionName;
}

interface HybridRegion {
  name: RegionName;
  bbox: LayoutBox;
  itemCount: number;
  sampleText: string[];
}

export interface HybridLayoutModel {
  pageSummary: {
    title: string;
    url: string;
    pageType: string;
    viewport: { width: number; height: number };
    stats: RawLayoutStats;
    textSample: string;
  };
  regions: HybridRegion[];
  elements: HybridLayoutElement[];
  textBlocks: HybridTextBlock[];
  visualHints: {
    hasModal: boolean;
    hasCanvas: boolean;
    hasLargeMedia: boolean;
    needsVisualFallback: boolean;
    reason: string;
  };
}

export interface SnapshotOptions {
  includeHtml?: boolean;
  htmlMaxChars?: number;
}

const REGION_ORDER: RegionName[] = [
  'header',
  'left-sidebar',
  'main',
  'right-sidebar',
  'modal',
  'footer',
];

function clampText(value: string, maxChars: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function classifyRegion(box: LayoutBox, viewport: { width: number; height: number }, zIndex: number): RegionName {
  const xCenter = box.x + box.width / 2;
  const yCenter = box.y + box.height / 2;
  const topBand = Math.max(80, viewport.height * 0.14);
  const bottomBand = viewport.height * 0.88;
  const leftBand = viewport.width * 0.24;
  const rightBand = viewport.width * 0.76;
  const modalLike =
    zIndex >= 100 &&
    box.width >= Math.max(80, viewport.width * 0.1) &&
    box.height >= 40 &&
    xCenter >= viewport.width * 0.2 &&
    xCenter <= viewport.width * 0.8 &&
    yCenter >= viewport.height * 0.12 &&
    yCenter <= viewport.height * 0.88;

  const sidebarLike = box.height >= viewport.height * 0.25;

  if (modalLike) return 'modal';
  if (xCenter <= leftBand && sidebarLike) return 'left-sidebar';
  if (xCenter >= rightBand && sidebarLike) return 'right-sidebar';
  if (box.y <= topBand) return 'header';
  if (box.y + box.height >= bottomBand) return 'footer';
  if (xCenter <= leftBand) return 'left-sidebar';
  if (xCenter >= rightBand) return 'right-sidebar';
  return 'main';
}

function unionBoxes(current: LayoutBox | undefined, next: LayoutBox): LayoutBox {
  if (!current) return { ...next };

  const minX = Math.min(current.x, next.x);
  const minY = Math.min(current.y, next.y);
  const maxX = Math.max(current.x + current.width, next.x + next.width);
  const maxY = Math.max(current.y + current.height, next.y + next.height);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function guessPageType(
  raw: HybridLayoutRawSnapshot,
  elements: HybridLayoutElement[],
  hasModal: boolean
): string {
  const lowerText = [
    raw.title,
    raw.textSample,
    ...elements.map((element) => element.text),
  ]
    .join(' ')
    .toLowerCase();

  const hasEditorControl =
    elements.some((element) => ['textbox', 'textarea'].includes(element.role) || element.tag === 'textarea') &&
    /(publish|post|draft|compose|write|editor|caption|content)/i.test(lowerText);

  if (hasEditorControl) return 'editor';
  if (hasModal) return 'dialog';
  if (elements.filter((element) => ['textbox', 'combobox'].includes(element.role)).length >= 2) return 'form';
  if (elements.filter((element) => element.role === 'link').length >= 6) return 'feed';
  return 'content';
}

export function buildHybridLayoutModel(raw: HybridLayoutRawSnapshot): HybridLayoutModel {
  const viewport = raw.viewport ?? { width: 0, height: 0 };

  const elements: HybridLayoutElement[] = (raw.elements ?? []).slice(0, 40).map((element) => ({
    ...element,
    text: clampText(element.text, 120),
    selectorHint: clampText(element.selectorHint, 160),
    region: classifyRegion(element, viewport, element.zIndex),
  }));

  const textBlocks: HybridTextBlock[] = (raw.textBlocks ?? []).slice(0, 20).map((block) => ({
    ...block,
    text: clampText(block.text, 200),
    region: classifyRegion(block, viewport, 0),
  }));

  const regionState = new Map<RegionName, { bbox?: LayoutBox; itemCount: number; sampleText: string[] }>();
  for (const region of REGION_ORDER) {
    regionState.set(region, { bbox: undefined, itemCount: 0, sampleText: [] });
  }

  for (const item of [...elements, ...textBlocks]) {
    const entry = regionState.get(item.region)!;
    entry.bbox = unionBoxes(entry.bbox, item);
    entry.itemCount += 1;
    if (item.text && entry.sampleText.length < 3) {
      entry.sampleText.push(item.text);
    }
  }

  const hasModal = raw.stats.modalCount > 0 || elements.some((element) => element.region === 'modal');
  const combinedTextLength = raw.textSample.length + textBlocks.reduce((sum, block) => sum + block.text.length, 0);
  const fallbackReasons: string[] = [];

  if (raw.stats.canvasCount > 0) fallbackReasons.push('canvas-detected');
  if (hasModal && combinedTextLength < 80) fallbackReasons.push('modal-with-limited-text');
  if (raw.stats.imageCount >= 6 && combinedTextLength < 160) fallbackReasons.push('visual-heavy-layout');

  const regions = REGION_ORDER.map((name) => {
    const region = regionState.get(name)!;
    if (!region.bbox) return undefined;

    return {
      name,
      bbox: region.bbox,
      itemCount: region.itemCount,
      sampleText: region.sampleText,
    } satisfies HybridRegion;
  }).filter((region): region is HybridRegion => Boolean(region));

  return {
    pageSummary: {
      title: raw.title,
      url: raw.url,
      pageType: guessPageType(raw, elements, hasModal),
      viewport,
      stats: raw.stats,
      textSample: clampText(raw.textSample, 600),
    },
    regions,
    elements,
    textBlocks,
    visualHints: {
      hasModal,
      hasCanvas: raw.stats.canvasCount > 0,
      hasLargeMedia: raw.stats.imageCount >= 4,
      needsVisualFallback: fallbackReasons.length > 0,
      reason: fallbackReasons.length > 0 ? fallbackReasons.join(', ') : 'layout-data-sufficient',
    },
  };
}

async function collectHybridLayoutSnapshot(page: Page, title: string, url: string): Promise<HybridLayoutRawSnapshot> {
  return page.evaluate(({ snapshotTitle, snapshotUrl }) => {
    const viewport = {
      width: Math.round(window.innerWidth || 0),
      height: Math.round(window.innerHeight || 0),
    };

    const normalizeText = (value: string | null | undefined, maxChars = 120) =>
      String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxChars);

    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const opacity = Number.parseFloat(style.opacity || '1');
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        opacity > 0 &&
        rect.width >= 4 &&
        rect.height >= 4 &&
        rect.bottom >= -40 &&
        rect.right >= -40 &&
        rect.top <= viewport.height + 40 &&
        rect.left <= viewport.width + 40
      );
    };

    const readText = (element: HTMLElement) => {
      const inputLike = element as HTMLInputElement;
      return normalizeText(
        element.innerText ||
          element.getAttribute('aria-label') ||
          inputLike.value ||
          element.getAttribute('placeholder') ||
          element.getAttribute('alt') ||
          '',
        120
      );
    };

    const readRole = (element: HTMLElement) => {
      const explicitRole = element.getAttribute('role');
      if (explicitRole) return explicitRole;

      const tag = element.tagName.toLowerCase();
      if (tag === 'a') return 'link';
      if (tag === 'button') return 'button';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'select') return 'combobox';
      if (tag === 'input') {
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        if (['submit', 'button', 'reset'].includes(type)) return 'button';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        return 'textbox';
      }
      if (tag === 'nav') return 'navigation';
      return tag;
    };

    const buildSelectorHint = (element: HTMLElement) => {
      const tag = element.tagName.toLowerCase();
      const id = normalizeText(element.id || '', 60);
      if (id) return `#${id}`;

      const testId = normalizeText(element.getAttribute('data-testid') || '', 60);
      if (testId) return `[data-testid="${testId}"]`;

      const name = normalizeText(element.getAttribute('name') || '', 60);
      if (name) return `${tag}[name="${name}"]`;

      const ariaLabel = normalizeText(element.getAttribute('aria-label') || '', 60);
      if (ariaLabel) return `${tag}[aria-label="${ariaLabel}"]`;

      const classNames = Array.from(element.classList || [])
        .slice(0, 2)
        .map((value: string) => normalizeText(value, 30))
        .filter(Boolean)
        .join('.');
      if (classNames) return `${tag}.${classNames}`;

      return tag;
    };

    const readZIndex = (element: Element) => {
      const value = Number.parseInt(window.getComputedStyle(element).zIndex || '0', 10);
      return Number.isFinite(value) ? value : 0;
    };

    const interactiveSelector = [
      'button',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="textbox"]',
      '[role="tab"]',
      '[contenteditable="true"]',
      '[tabindex]',
      'nav',
    ].join(',');

    const textSelector = ['h1', 'h2', 'h3', 'p', 'li', 'article', 'section', 'main', '[role="heading"]'].join(',');

    const elements = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((element) => isVisible(element))
      .map((element) => {
        const htmlElement = element as HTMLElement;
        const rect = element.getBoundingClientRect();
        const tag = element.tagName.toLowerCase();
        const role = readRole(htmlElement);
        return {
          role,
          tag,
          text: readText(htmlElement),
          selectorHint: buildSelectorHint(htmlElement),
          clickable:
            ['button', 'link', 'tab', 'checkbox', 'radio'].includes(role) ||
            tag === 'button' ||
            tag === 'a' ||
            element.getAttribute('contenteditable') === 'true',
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          zIndex: readZIndex(element),
        };
      })
      .filter((element) => element.text || element.clickable)
      .sort((left, right) => left.y - right.y || left.x - right.x)
      .slice(0, 40);

    const textBlocks = Array.from(document.querySelectorAll(textSelector))
      .filter((element) => isVisible(element))
      .map((element) => {
        const htmlElement = element as HTMLElement;
        const rect = element.getBoundingClientRect();
        return {
          text: readText(htmlElement),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((block) => block.text.length >= 12)
      .sort((left, right) => left.y - right.y || left.x - right.x)
      .slice(0, 20);

    const textSample = normalizeText(
      (document.body?.innerText || '')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20)
        .join('\n'),
      1200
    );

    const modalSelector = 'dialog,[role="dialog"],[aria-modal="true"],.modal,[class*="modal" i]';
    const modalCount = Array.from(document.querySelectorAll(modalSelector)).filter((element) => isVisible(element)).length;

    return {
      title: snapshotTitle,
      url: snapshotUrl,
      viewport,
      textSample,
      stats: {
        imageCount: document.images.length,
        canvasCount: document.querySelectorAll('canvas').length,
        modalCount,
        textNodeCount: textBlocks.length,
        interactiveCount: elements.length,
      },
      elements,
      textBlocks,
    };
  }, { snapshotTitle: title, snapshotUrl: url });
}

function buildFallbackRawSnapshot(title: string, url: string): HybridLayoutRawSnapshot {
  return {
    title,
    url,
    viewport: { width: 0, height: 0 },
    textSample: '',
    stats: {
      imageCount: 0,
      canvasCount: 0,
      modalCount: 0,
      textNodeCount: 0,
      interactiveCount: 0,
    },
    elements: [],
    textBlocks: [],
  };
}

export async function snapshot(profile: string = 'default', options: SnapshotOptions = {}) {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const pacingDelayMs = await applyActionPacing();
  const title = await page.title();
  const url = page.url();
  const htmlMaxChars = Math.max(0, options.htmlMaxChars ?? 1500);

  const [auth, challenge, rawLayout, html] = await Promise.all([
    detectAuthRequired(page),
    detectChallengeRequired(page),
    collectHybridLayoutSnapshot(page, title, url).catch(() => buildFallbackRawSnapshot(title, url)),
    options.includeHtml ? page.content().then((value) => value.substring(0, htmlMaxChars)) : Promise.resolve(undefined),
  ]);

  const layout = buildHybridLayoutModel(rawLayout);

  return {
    success: true,
    title,
    url,
    profile,
    pacingDelayMs,
    auth,
    challenge,
    requiresHumanAction: auth.requiresHumanLogin || challenge.requiresHumanVerification,
    layoutMode: 'hybrid-v1',
    pageSummary: layout.pageSummary,
    regions: layout.regions,
    elements: layout.elements,
    textBlocks: layout.textBlocks,
    visualHints: layout.visualHints,
    layout,
    htmlPreview: html,
    ...(html ? { html } : {}),
  };
}
