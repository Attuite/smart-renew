import { test, expect } from '@playwright/test';
import {
  collectRuntimeErrors,
  openGis,
  projectByName
} from './support/gis-test-helpers.mjs';

test('no-key mode exposes an honest vector fallback without browser errors', async ({ page, request }) => {
  const project = await projectByName(request, 'E2E 小样本项目');
  const runtimeErrors = collectRuntimeErrors(page);

  await openGis(page, project.id);

  await expect(page.locator('#gisMapStatus')).toContainText('高德浏览器地图未配置');
  await expect(page.locator('#gisMapCanvas')).toBeHidden();
  await expect(page.locator('#spatialPreview svg')).toBeVisible();
  await expect(page.locator('#gisIssueCount')).toHaveText('3');
  await expect(page.locator('#locatedIssueCount')).toHaveText('2');
  await expect(page.locator('#unlocatedIssueCount')).toHaveText('1');
  expect(runtimeErrors).toEqual([]);
});

test('filters, selected issue, layer visibility and map style survive refresh through URL state', async ({ page, request }) => {
  const project = await projectByName(request, 'E2E 小样本项目');
  await openGis(page, project.id);

  await page.locator('#gisRiskFilter').selectOption('high');
  await expect(page.locator('#gisIssueList .ledger-row')).toHaveCount(1);
  await expect(page.locator('#gisIssueList')).toContainText('消防通道堆物');

  await page.locator('#gisRiskFilter').selectOption('all');
  await page.locator('#gisIssueList .ledger-row').filter({ hasText: '楼道照明损坏' }).click();
  await expect(page).toHaveURL(/issue=ISS-/);
  await expect(page.locator('#gisIssueList .is-selected')).toContainText('楼道照明损坏');

  const boundaryLayer = page.locator('[data-gis-layer="boundary"]');
  await boundaryLayer.uncheck();
  await expect(page.locator('#spatialPreview .spatial-boundary').locator('polygon')).toHaveCount(0);
  await page.locator('#gisMapStyle').selectOption('satellite-road');
  await expect(page).toHaveURL(/mapStyle=satellite-road/);

  await page.reload();
  await expect(page.locator('#loadingLayer')).toBeHidden();
  await expect(page.locator('#gisWorkspace')).toBeVisible();
  await expect(page.locator('#gisMapStyle')).toHaveValue('satellite-road');
  await expect(boundaryLayer).not.toBeChecked();
  await expect(page.locator('#gisIssueList .is-selected')).toContainText('楼道照明损坏');
});

test('375px layout switches between list and map panes without horizontal overflow', async ({ page, request }) => {
  const project = await projectByName(request, 'E2E 小样本项目');
  await page.setViewportSize({ width: 375, height: 812 });
  await openGis(page, project.id);

  await expect(page.locator('#gisShowListButton')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#gisLayout .issue-ledger')).toBeVisible();
  await expect(page.locator('#gisLayout .coordinate-panel')).toBeHidden();

  await page.locator('#gisShowMapButton').click();
  await expect(page.locator('#gisShowMapButton')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#gisLayout .issue-ledger')).toBeHidden();
  await expect(page.locator('#gisLayout .coordinate-panel')).toBeVisible();

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test('map-view API failure stays explicit and never substitutes demo results', async ({ page, request }) => {
  const project = await projectByName(request, 'E2E 小样本项目');
  await page.route('**/api/projects/*/map-view*', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: false,
      error: { code: 'E2E_MAP_VIEW_FAILURE', message: 'E2E地图读取失败' }
    })
  }));

  await page.goto(`/business/?project=${project.id}&projectId=${project.id}&stage=gis-and-issues&view=workspace`);
  await expect(page.locator('#loadingLayer')).toBeHidden();
  await expect(page.locator('#errorBanner')).toBeVisible();
  await expect(page.locator('#errorBanner')).toContainText('E2E地图读取失败');
  await expect(page.locator('#gisIssueList')).not.toContainText('Demo');
});
