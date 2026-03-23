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

export interface CompactRlSnapshot {
  pageKind: string;
  authState: 'authenticated' | 'login_required' | 'reauth_required' | 'unknown';
  challengeState: 'none' | 'challenge' | 'blocked';
  keySelectorsPresent: string[];
  requiresHumanAction: boolean;
}

export interface SnapshotOptions {
  includeHtml?: boolean;
  htmlMaxChars?: number;
  mode?: 'hybrid' | 'ax';
  includeAx?: boolean;
  axMaxLines?: number;
  axVerbose?: boolean;
}

export interface AxSnapshotInteractiveItem {
  uid: string;
  role: string;
  name: string;
  url?: string;
  selectorHint?: string;
}

export interface AxSnapshotModel {
  mode: 'ax-v1';
  maxLines: number;
  truncated: boolean;
  text: string;
  interactive: AxSnapshotInteractiveItem[];
  error?: string;
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

function escapeQuotedValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();
}

const PLAYWRIGHT_ROLE_SELECTOR_ROLES = new Set([
  'link',
  'button',
  'textbox',
  'combobox',
  'checkbox',
  'radio',
  'tab',
  'menuitem',
  'option',
]);

function buildPlaywrightRoleSelector(role: string, name: string): string | undefined {
  if (!PLAYWRIGHT_ROLE_SELECTOR_ROLES.has(role)) return undefined;
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 100) return undefined;
  return `role=${role}[name="${escapeQuotedValue(trimmed)}"]`;
}

function classifyRegion(box: LayoutBox, viewport: { width: number; height: number }, zIndex: number): RegionName {
  const viewportWidth = Math.max(1, viewport.width || Math.round(box.x + box.width));
  const viewportHeight = Math.max(1, viewport.height || Math.round(box.y + box.height));
  const xCenter = box.x + box.width / 2;
  const yCenter = box.y + box.height / 2;
  const topBand = Math.max(80, viewportHeight * 0.14);
  const bottomBandCenter = viewportHeight * 0.88;
  const leftBand = viewportWidth * 0.24;
  const rightBand = viewportWidth * 0.76;
  const modalLike =
    zIndex >= 100 &&
    box.width >= Math.max(80, viewportWidth * 0.1) &&
    box.height >= 40 &&
    xCenter >= viewportWidth * 0.2 &&
    xCenter <= viewportWidth * 0.8 &&
    yCenter >= viewportHeight * 0.12 &&
    yCenter <= viewportHeight * 0.88;

  const sidebarLike = box.height >= viewportHeight * 0.25;

  if (modalLike) return 'modal';
  if (xCenter <= leftBand && sidebarLike) return 'left-sidebar';
  if (xCenter >= rightBand && sidebarLike) return 'right-sidebar';
  if (box.y <= topBand) return 'header';
  if (yCenter >= bottomBandCenter && box.height <= viewportHeight * 0.5) return 'footer';
  if (xCenter <= leftBand) return 'left-sidebar';
  if (xCenter >= rightBand) return 'right-sidebar';
  return 'main';
}

function unionBoxes(current: LayoutBox | undefined, next: LayoutBox): LayoutBox {
  if (!current) {
    return {
      x: next.x,
      y: next.y,
      width: next.width,
      height: next.height,
    };
  }

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBoxToViewport(box: LayoutBox, viewport: { width: number; height: number }): LayoutBox {
  const viewportWidth = Math.max(0, viewport.width);
  const viewportHeight = Math.max(0, viewport.height);

  if (viewportWidth === 0 || viewportHeight === 0) {
    return {
      x: box.x,
      y: box.y,
      width: Math.max(0, box.width),
      height: Math.max(0, box.height),
    };
  }

  const left = clamp(box.x, 0, viewportWidth);
  const top = clamp(box.y, 0, viewportHeight);
  const right = clamp(box.x + box.width, 0, viewportWidth);
  const bottom = clamp(box.y + box.height, 0, viewportHeight);

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
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
    /(publish|post|draft|compose|write|editor|caption)/i.test(lowerText);

  if (hasEditorControl) return 'editor';
  if (hasModal) return 'dialog';
  if (elements.filter((element) => ['textbox', 'combobox'].includes(element.role)).length >= 2) return 'form';
  if (elements.filter((element) => element.role === 'link').length >= 6) return 'feed';
  return 'content';
}

export function buildHybridLayoutModel(raw: HybridLayoutRawSnapshot): HybridLayoutModel {
  const viewport = raw.viewport ?? { width: 0, height: 0 };

  const elements: HybridLayoutElement[] = (raw.elements ?? []).slice(0, 40).map((element) => {
    const normalized = normalizeBoxToViewport(element, viewport);
    return {
      ...element,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      text: clampText(element.text, 120),
      selectorHint: clampText(element.selectorHint, 160),
      region: classifyRegion(normalized.width > 0 && normalized.height > 0 ? normalized : element, viewport, element.zIndex),
    };
  });

  const textBlocks: HybridTextBlock[] = (raw.textBlocks ?? []).slice(0, 20).map((block) => {
    const normalized = normalizeBoxToViewport(block, viewport);
    return {
      ...block,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      text: clampText(block.text, 200),
      region: classifyRegion(normalized.width > 0 && normalized.height > 0 ? normalized : block, viewport, 0),
    };
  });

  const regionState = new Map<RegionName, { bbox?: LayoutBox; itemCount: number; sampleText: string[] }>();
  for (const region of REGION_ORDER) {
    regionState.set(region, { bbox: undefined, itemCount: 0, sampleText: [] });
  }

  for (const item of [...elements, ...textBlocks]) {
    const normalized = normalizeBoxToViewport(item, viewport);
    if (normalized.width <= 0 || normalized.height <= 0) {
      continue;
    }

    const entry = regionState.get(item.region)!;
    entry.bbox = unionBoxes(entry.bbox, normalized);
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

export function compactRlSnapshot(args: {
  layout?: HybridLayoutModel | null;
  auth?: { requiresHumanLogin?: boolean } | null;
  challenge?: { requiresHumanVerification?: boolean } | null;
} = {}): CompactRlSnapshot {
  const layout = args.layout ?? null;
  const auth = args.auth ?? null;
  const challenge = args.challenge ?? null;
  const pageKind = layout?.pageSummary?.pageType || 'content';
  const keySelectorsPresent = Array.isArray(layout?.elements)
    ? layout!.elements
      .map((element) => element.selectorHint)
      .filter((value) => typeof value === 'string' && value.length > 0)
      .slice(0, 8)
    : [];

  let authState: CompactRlSnapshot['authState'] = 'authenticated';
  if (auth?.requiresHumanLogin) {
    authState = 'login_required';
  }

  let challengeState: CompactRlSnapshot['challengeState'] = 'none';
  if (challenge?.requiresHumanVerification) {
    challengeState = 'challenge';
  }

  return {
    pageKind,
    authState,
    challengeState,
    keySelectorsPresent,
    requiresHumanAction: Boolean(auth?.requiresHumanLogin || challenge?.requiresHumanVerification),
  };
}

export type CdpAxPropertyValue = {
  type?: string;
  value?: unknown;
};

export type CdpAxProperty = {
  name: string;
  value?: CdpAxPropertyValue;
};

export type CdpAxNode = {
  nodeId: string;
  ignored?: boolean;
  role?: { value?: string };
  name?: { value?: string };
  properties?: CdpAxProperty[];
  childIds?: string[];
  backendDOMNodeId?: number;
};

function readAxRole(node: CdpAxNode): string {
  return String(node.role?.value || '').trim();
}

function readAxName(node: CdpAxNode): string {
  return String(node.name?.value || '').replace(/\s+/g, ' ').trim();
}

function readAxProperty(node: CdpAxNode, names: string[]): unknown {
  const props = node.properties ?? [];
  for (const prop of props) {
    for (const name of names) {
      if (prop.name === name) return prop.value?.value;
    }
  }
  return undefined;
}

function formatAxLine(node: CdpAxNode, uid: string, pageUrl: string): string {
  const role = readAxRole(node) || 'unknown';
  const name = readAxName(node);

  const parts: string[] = [`uid=${uid}`, role];
  if (name) parts.push(`"${escapeQuotedValue(name)}"`);

  const urlValue = readAxProperty(node, ['url']);
  if (typeof urlValue === 'string' && urlValue) {
    parts.push(`url="${escapeQuotedValue(urlValue)}"`);
  } else if (role === 'RootWebArea') {
    parts.push(`url="${escapeQuotedValue(pageUrl)}"`);
  }

  const level = readAxProperty(node, ['level']);
  if (typeof level === 'number') {
    parts.push(`level="${level}"`);
  }

  const hasPopup = readAxProperty(node, ['hasPopup', 'haspopup']);
  if (typeof hasPopup === 'string' && hasPopup) {
    parts.push(`haspopup="${escapeQuotedValue(hasPopup)}"`);
  }

  const expanded = readAxProperty(node, ['expanded']);
  if (typeof expanded === 'boolean') {
    parts.push('expandable');
    if (expanded) parts.push('expanded');
  }

  const selected = readAxProperty(node, ['selected']);
  if (typeof selected === 'boolean') {
    parts.push('selectable');
    if (selected) parts.push('selected');
  }

  return parts.join(' ');
}

export function buildAxSnapshotFromCdpNodes(
  title: string,
  url: string,
  nodes: CdpAxNode[],
  options: { maxLines: number; verbose: boolean }
): AxSnapshotModel {
  const maxLines = Math.max(0, Math.floor(options.maxLines));
  if (maxLines === 0) {
    return {
      mode: 'ax-v1',
      maxLines,
      truncated: false,
      text: '',
      interactive: [],
    };
  }

  if (nodes.length === 0) {
    return {
      mode: 'ax-v1',
      maxLines,
      truncated: false,
      text: '',
      interactive: [],
    };
  }

  const nodeById = new Map<string, CdpAxNode>();
  for (const node of nodes) {
    if (node?.nodeId) nodeById.set(node.nodeId, node);
  }

  const parentById = new Map<string, string>();
  for (const node of nodes) {
    for (const childId of node.childIds ?? []) {
      if (!parentById.has(childId)) parentById.set(childId, node.nodeId);
    }
  }

  const root =
    nodes.find((node) => !node.ignored && readAxRole(node) === 'RootWebArea') ??
    nodes.find((node) => !node.ignored && !parentById.has(node.nodeId));

  if (!root) {
    return {
      mode: 'ax-v1',
      maxLines,
      truncated: false,
      text: '',
      interactive: [],
    };
  }

  const alwaysIncludeRoles = new Set([
    'RootWebArea',
    'banner',
    'navigation',
    'main',
    'contentinfo',
    'form',
    'region',
    'dialog',
    'alertdialog',
    'heading',
    'search',
  ]);

  const interactiveRoles = new Set<string>(PLAYWRIGHT_ROLE_SELECTOR_ROLES);

  const verboseTextRoles = new Set([
    'paragraph',
    'image',
    'list',
    'listitem',
    'article',
    'section',
    'StaticText',
  ]);

  const isInteresting = (node: CdpAxNode): boolean => {
    if (node.ignored) return false;
    const role = readAxRole(node);
    if (!role) return false;
    if (alwaysIncludeRoles.has(role)) return true;

    const focusable = readAxProperty(node, ['focusable']) === true;
    const urlValue = readAxProperty(node, ['url']);
    if (focusable || typeof urlValue === 'string') return true;
    if (interactiveRoles.has(role)) return true;

    if (role === 'StaticText') {
      if (options.verbose) return true;
      const parentId = parentById.get(node.nodeId);
      const parentRole = parentId ? readAxRole(nodeById.get(parentId) ?? { nodeId: parentId }) : '';
      return Boolean(readAxName(node)) && ['link', 'button', 'heading', 'tab'].includes(parentRole);
    }

    const name = readAxName(node);
    if (options.verbose && verboseTextRoles.has(role) && name) return true;

    return false;
  };

  const interestingIds = new Set<string>();
  for (const node of nodes) {
    if (node.ignored) continue;
    if (isInteresting(node)) interestingIds.add(node.nodeId);
  }

  const includedIds = new Set<string>();
  includedIds.add(root.nodeId);
  for (const id of interestingIds) {
    let current: string | undefined = id;
    while (current && !includedIds.has(current)) {
      includedIds.add(current);
      current = parentById.get(current);
    }
  }

  const lines: string[] = [];
  const interactive: AxSnapshotInteractiveItem[] = [];
  let truncated = false;

  const stack: Array<{ id: string; depth: number }> = [{ id: root.nodeId, depth: 0 }];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const next = stack.pop()!;
    if (visited.has(next.id)) continue;
    visited.add(next.id);

    const node = nodeById.get(next.id);
    if (!node) continue;
    if (!includedIds.has(next.id)) continue;
    const shouldRender = !node.ignored;
    const childDepth = shouldRender ? next.depth + 1 : next.depth;

    if (shouldRender) {
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }

      const uid = node.backendDOMNodeId ? `b${node.backendDOMNodeId}` : `n${node.nodeId}`;
      const indent = '  '.repeat(next.depth);
      lines.push(`${indent}${formatAxLine(node, uid, url)}`);

      const role = readAxRole(node);
      if (interactiveRoles.has(role)) {
        const name = readAxName(node);
        if (name) {
          const urlValue = readAxProperty(node, ['url']);
          interactive.push({
            uid,
            role,
            name: clampText(name, 120),
            url: typeof urlValue === 'string' ? urlValue : undefined,
            selectorHint: buildPlaywrightRoleSelector(role, name),
          });
        }
      }
    }

    const children = node.childIds ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const childId = children[index];
      if (!includedIds.has(childId)) continue;
      stack.push({ id: childId, depth: childDepth });
    }
  }

  const disambiguationIndex = new Map<string, number>();
  const totalByKey = new Map<string, number>();
  for (const item of interactive) {
    const key = `${item.role}\u0000${item.name}`;
    totalByKey.set(key, (totalByKey.get(key) ?? 0) + 1);
  }
  for (const item of interactive) {
    if (!item.selectorHint) continue;
    const key = `${item.role}\u0000${item.name}`;
    const total = totalByKey.get(key) ?? 1;
    if (total <= 1) continue;
    const index = disambiguationIndex.get(key) ?? 0;
    disambiguationIndex.set(key, index + 1);
    item.selectorHint = `${item.selectorHint} >> nth=${index}`;
  }

  const header = `# AX Snapshot (ax-v1)\n# title: ${escapeQuotedValue(title)}\n# url: ${escapeQuotedValue(url)}\n`;

  return {
    mode: 'ax-v1',
    maxLines,
    truncated,
    text: `${header}${lines.join('\n')}`.trim(),
    interactive,
  };
}

async function collectAxSnapshot(
  page: Page,
  title: string,
  url: string,
  options: { maxLines: number; verbose: boolean }
): Promise<AxSnapshotModel> {
  const maxLines = Math.max(0, Math.floor(options.maxLines));
  const verbose = Boolean(options.verbose);
  if (maxLines === 0) {
    return buildAxSnapshotFromCdpNodes(title, url, [], { maxLines, verbose });
  }

  const client = await page.context().newCDPSession(page);
  try {
    await Promise.all([
      client.send('Accessibility.enable').catch(() => undefined),
      client.send('DOM.enable').catch(() => undefined),
    ]);

    const response = await client.send('Accessibility.getFullAXTree');
    const nodes = (Array.isArray((response as any)?.nodes) ? (response as any).nodes : []) as CdpAxNode[];
    const snapshot = buildAxSnapshotFromCdpNodes(title, url, nodes, { maxLines, verbose });
    return snapshot;
  } catch (error) {
    return {
      mode: 'ax-v1',
      maxLines,
      truncated: false,
      text: '',
      interactive: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.detach().catch(() => undefined);
  }
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
  const mode = options.mode ?? 'hybrid';
  const includeAx = mode === 'ax' ? true : Boolean(options.includeAx);
  const axMaxLines = Math.max(0, Math.floor(options.axMaxLines ?? 350));
  const axVerbose = Boolean(options.axVerbose);

  const [auth, challenge, rawLayout, axSnapshot, html] = await Promise.all([
    detectAuthRequired(page),
    detectChallengeRequired(page),
    mode === 'hybrid'
      ? collectHybridLayoutSnapshot(page, title, url).catch(() => buildFallbackRawSnapshot(title, url))
      : Promise.resolve(undefined),
    includeAx
      ? collectAxSnapshot(page, title, url, { maxLines: axMaxLines, verbose: axVerbose })
      : Promise.resolve(undefined),
    options.includeHtml ? page.content().then((value) => value.substring(0, htmlMaxChars)) : Promise.resolve(undefined),
  ]);

  if (mode === 'ax') {
    return {
      success: true,
      title,
      url,
      profile,
      pacingDelayMs,
      auth,
      challenge,
      requiresHumanAction: auth.requiresHumanLogin || challenge.requiresHumanVerification,
      layoutMode: 'ax-v1',
      axSnapshot,
      htmlPreview: html,
      ...(html ? { html } : {}),
    };
  }

  const layout = buildHybridLayoutModel(rawLayout ?? buildFallbackRawSnapshot(title, url));

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
    ...(axSnapshot ? { axSnapshot } : {}),
    htmlPreview: html,
    ...(html ? { html } : {}),
  };
}
