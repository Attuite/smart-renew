import { test, expect } from '@playwright/test';
import {
  gisPath,
  openGis,
  projectByName,
  stabilizeVisualWorkspace
} from './support/gis-test-helpers.mjs';

for (const scenario of [
  ['empty', 'E2E 空项目'],
  ['small', 'E2E 小样本项目'],
  ['dense', 'E2E 密集项目']
]) {
  test(`${scenario[0]} GIS state matches its visual baseline`, async ({ page, request }) => {
    const project = await projectByName(request, scenario[1]);
    await openGis(page, project.id);
    await stabilizeVisualWorkspace(page);
    await expect(page.locator('#gisLayout')).toHaveScreenshot(`${scenario[0]}-gis.png`);
  });
}

test('satellite-road selection in no-key mode matches its honest fallback baseline', async ({ page, request }) => {
  const project = await projectByName(request, 'E2E 小样本项目');
  await openGis(page, project.id, { mapStyle: 'satellite-road' });
  await stabilizeVisualWorkspace(page);
  await expect(page.locator('#gisMapStyle')).toHaveValue('satellite-road');
  await expect(page.locator('#gisMapStatus')).toContainText('高德浏览器地图未配置');
  await expect(page.locator('#gisLayout')).toHaveScreenshot('satellite-road-fallback-gis.png');
});

test('map-view failure banner matches its visual baseline', async ({ page, request }) => {
  const project = await projectByName(request, 'E2E 小样本项目');
  await page.route('**/api/projects/*/map-view*', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: false,
      error: { code: 'E2E_MAP_VIEW_FAILURE', message: 'E2E地图读取失败' }
    })
  }));
  await page.goto(gisPath(project.id));
  await expect(page.locator('#loadingLayer')).toBeHidden();
  await expect(page.locator('#errorBanner')).toBeVisible();
  await stabilizeVisualWorkspace(page);
  await expect(page.locator('#errorBanner')).toHaveScreenshot('map-view-failure.png');
});
