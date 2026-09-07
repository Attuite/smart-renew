import { test, expect } from '@playwright/test';

test('成果中心显示真实跨项目汇总并支持下钻', async ({ page }) => {
  await page.goto('/business/?view=outcomes');
  await expect(page.locator('#loadingLayer')).toBeHidden();
  await expect(page.locator('#outcomeWorkspace')).toBeVisible();
  await expect(page.locator('#outcomeStatStrip')).toContainText('项目');
  await expect(page.locator('[data-outcome-project]')).toHaveCount(3);
  await page.locator('[data-outcome-project]').filter({ hasText: 'E2E 小样本项目' }).click();
  await expect(page).toHaveURL(/project=/);
  await expect(page.locator('#outcomeWorkspace')).toBeHidden();
  await expect(page.locator('#overviewView')).toBeVisible();
});

test('系统设置显示 Provider、标准库与外部服务真实状态', async ({ page }) => {
  await page.goto('/business/?view=settings');
  await expect(page.locator('#loadingLayer')).toBeHidden();
  await expect(page.locator('#settingsWorkspace')).toBeVisible();
  await expect(page.locator('#settingsProviderPanel')).toContainText('sqlite');
  await expect(page.locator('#settingsMetaPanel')).toContainText('412');
  await expect(page.locator('#settingsExternalPanel')).toContainText('AI');
  await expect(page.locator('#settingsWorkspace')).not.toContainText('DASHSCOPE_API_KEY');
});
