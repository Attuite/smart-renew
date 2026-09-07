import { expect } from '@playwright/test';

export async function projectByName(request, name) {
  const response = await request.get('/api/projects');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const projects = payload?.ok === true ? payload.data?.items : payload?.items;
  const project = projects?.find((item) => item.name === name);
  expect(project, `E2E project ${name} should exist`).toBeTruthy();
  return project;
}

export function gisPath(projectId, extras = {}) {
  const query = new URLSearchParams({
    project: String(projectId),
    projectId: String(projectId),
    stage: 'gis-and-issues',
    view: 'workspace',
    ...extras
  });
  return `/business/?${query}`;
}

export function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

export async function openGis(page, projectId, extras = {}) {
  await page.goto(gisPath(projectId, extras));
  await expect(page.locator('#loadingLayer')).toBeHidden();
  await expect(page.locator('#gisWorkspace')).toBeVisible();
  await expect(page.locator('#gisMapStatus')).not.toContainText('正在读取');
}

export async function stabilizeVisualWorkspace(page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation: none !important;
      caret-color: transparent !important;
      transition: none !important;
    }
    #gisIssueList {
      max-height: 520px !important;
      overflow: hidden !important;
    }
    #geometryForm,
    .gis-batch-geometry,
    #photoGeometryForm,
    .spatial-click-hint,
    .geometry-audit-list {
      display: none !important;
    }
  ` });
  await page.evaluate(() => document.fonts?.ready);
}
